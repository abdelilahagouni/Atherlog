"""
Parity test: the app's AI service (/cascade) must reproduce the experiment's probabilities for the same lines.

Lines: all 10,000 lines of the BGL chronological test split (seed-42 models).
Reference: rerun_2026/phase_b/results/bgl/{lr_only,distilbert_only,v3}_seed42.npz (written by the experiments).
Checks (tolerance 1e-4):
  A. p_LR                  vs lr_only test_score
  B. p_DistilBERT          vs distilbert_only test_score      (all_stages=true, so every line is scored by stage 2)
  C. cascade combined score vs v3 test_score (p_LR if not forwarded, 1 + p_DistilBERT if forwarded)
  D. cascade decision      vs v3 test_pred (exact)
  E. app text rule: rebuilding the model text from app fields (source, level, message) gives the training text
Output: parity_report.json, parity_differences.csv (only lines that differ).
"""

import csv
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "python-service"))
from cascade import Cascade  # noqa: E402  (only the static app_text rule is used here)
from test_guard import require_test_mode  # noqa: E402  (stops unless backend TEST_MODE=true)

TOL = 1e-4
LEVEL = {"WARNING": "WARN"}   # real BGL level is sent as is (SEVERE/FAILURE kept); only WARNING -> app WARN (mapped back by the cascade)


def post(body):
    r = urllib.request.Request("http://127.0.0.1:5001/cascade", json.dumps(body).encode(), {"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(r, timeout=600).read())


def main():
    require_test_mode()
    rows = list(csv.DictReader(open(ROOT / "rerun_2026" / "data" / "bgl_subset_50k.csv", encoding="utf-8", newline="")))
    te = json.loads((ROOT / "rerun_2026" / "data" / "bgl_splits.json").read_text())["chronological"]["test"]
    texts = [rows[i]["text"] for i in te]
    ref = {s: np.load(ROOT / "rerun_2026" / "phase_b" / "results" / "bgl" / f"{s}_seed42.npz") for s in ("lr_only", "distilbert_only", "v3")}

    out = []
    for a in range(0, len(texts), 500):
        out += post({"texts": texts[a:a + 500], "all_stages": True})
    p_lr = np.array([r["p_lr"] for r in out]); p_b = np.array([r["p_bert"] for r in out])
    fwd = np.array([r["forwarded"] for r in out]); dec = np.array([r["anomaly"] for r in out])
    comb = np.where(fwd, 1.0 + p_b, p_lr)

    checks = {
        "A_p_lr_vs_lr_only": np.abs(p_lr - ref["lr_only"]["test_score"]),
        "B_p_distilbert_vs_distilbert_only": np.abs(p_b - ref["distilbert_only"]["test_score"]),
        "C_combined_score_vs_v3": np.abs(comb - ref["v3"]["test_score"]),
    }
    report = {"lines": len(texts), "tolerance": TOL, "service": post({"texts": [texts[0]]})[0]["model"],
              "model_hash": out[0]["model_hash"], "checks": {}}
    diffs = []
    for k, d in checks.items():
        bad = np.flatnonzero(d > TOL)
        report["checks"][k] = {"max_abs_diff": float(d.max()), "mean_abs_diff": float(d.mean()), "lines_over_tolerance": int(len(bad))}
        diffs += [{"check": k, "test_position": int(i), "subset_row": int(te[i]), "abs_diff": float(d[i]), "text": texts[i][:200]} for i in bad]
    dd = np.flatnonzero(dec != ref["v3"]["test_pred"].astype(bool))
    report["checks"]["D_decision_vs_v3"] = {"lines_different": int(len(dd)), "forwarded": int(fwd.sum())}
    diffs += [{"check": "D_decision_vs_v3", "test_position": int(i), "subset_row": int(te[i]), "abs_diff": None, "text": texts[i][:200]} for i in dd]

    # E. app text rule (what the backend sends) -> training text
    mism, app_logs = 0, []
    for t in texts:
        p = t.split(" ", 3)
        app_log = {"source": f"BGL-real/{p[0]}", "level": (lambda l: LEVEL.get(l, l))(p[2] if len(p) > 2 else "INFO"),
                   "message": " ".join([p[1]] + p[3:]) if len(p) > 1 else t}
        app_logs.append(app_log)
        if Cascade.app_text(app_log) != t:
            mism += 1
            diffs.append({"check": "E_app_text_rule", "test_position": len(app_logs) - 1, "subset_row": int(te[len(app_logs) - 1]),
                          "abs_diff": None, "text": t[:200]})
    report["checks"]["E_app_text_rule"] = {"lines_where_rebuilt_text_differs": int(mism),
        "rule": "real BGL level sent to the app (only WARNING -> WARN, mapped back by the cascade)"}

    # F. the app's privacy masking (backend maskPII, default patterns): does it change cascade scores/decisions?
    masked_msgs = json.loads(subprocess.run(
        ["node", "-r", "ts-node/register/transpile-only", str(HERE / "mask_with_app.cjs")], cwd=ROOT / "backend",
        input=json.dumps([l["message"] for l in app_logs]), capture_output=True, text=True, check=True).stdout)
    masked_texts = [Cascade.app_text(dict(l, message=m)) for l, m in zip(app_logs, masked_msgs)]
    changed = [i for i, (a, b) in enumerate(zip(masked_texts, texts)) if a != b]
    mo = []
    for a in range(0, len(masked_texts), 500):
        mo += post({"texts": masked_texts[a:a + 500]})
    m_dec = np.array([r["anomaly"] for r in mo]); m_score = np.array([r["score"] for r in mo])
    u_score = np.array([r["score"] for r in out])
    dec_diff = np.flatnonzero(m_dec != dec)
    sc_diff = np.flatnonzero(np.abs(m_score - u_score) > TOL)
    report["checks"]["F_privacy_masking_effect"] = {
        "lines_changed_by_masking": len(changed), "decisions_changed_by_masking": int(len(dec_diff)),
        "scores_changed_over_tolerance": int(len(sc_diff)),
        "note": "compares cascade output on masked vs unmasked text; the backend now scores BEFORE masking and stores only the masked text"}
    diffs += [{"check": "F_masking_changes_decision", "test_position": int(i), "subset_row": int(te[i]), "abs_diff": None,
               "text": texts[i][:200]} for i in dec_diff]
    report["passed"] = (all(v.get("lines_over_tolerance", 0) == 0 for v in report["checks"].values()) and len(dd) == 0
                        and mism == 0)
    (HERE / "parity_report.json").write_text(json.dumps(report, indent=2))
    with open(HERE / "parity_differences.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["check", "test_position", "subset_row", "abs_diff", "text"]); w.writeheader(); w.writerows(diffs)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
