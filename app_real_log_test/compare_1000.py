"""
1,000-line comparison through the WHOLE app (ingest API -> pipelines/PII masking -> AI service -> database).

  python compare_1000.py keyword   # backend running WITHOUT ANOMALY_MODEL (keyword rule)
  python compare_1000.py cascade   # backend running WITH ANOMALY_MODEL=cascade
  python compare_1000.py report    # writes compare_1000_report.json from both runs

Lines: 1,000 lines drawn at random (seed 2026) from the BGL chronological TEST split, real anomaly ratio kept.
Each run sends the same lines with source "BGL-cmp-<mode>/<type>" to the test organisation, measures the
end-to-end ingest time per log (client side), then reads back how the app scored each log from the database.
The experiment's own V3 seed-42 decisions for the same lines are included for reference.
"""

import csv
import json
import random
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
from test_guard import require_test_mode  # noqa: E402  (stops unless backend TEST_MODE=true)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
LEVEL = {"WARNING": "WARN"}   # real BGL level is sent as is (SEVERE/FAILURE kept); only WARNING -> app WARN (mapped back by the cascade)


def norm_msg(m):
    return re.sub(r"[\s0-9a-fA-F*\-]+", "#", m)


def sample():
    rows = list(csv.DictReader(open(ROOT / "rerun_2026" / "data" / "bgl_subset_50k.csv", encoding="utf-8", newline="")))
    te = json.loads((ROOT / "rerun_2026" / "data" / "bgl_splits.json").read_text())["chronological"]["test"]
    rng = random.Random(2026)
    pos = sorted(rng.sample(range(len(te)), 1000))
    return rows, te, pos


def app_log(text, mode):
    p = text.split(" ", 3)
    return {"level": (lambda l: LEVEL.get(l, l))(p[2] if len(p) > 2 else "INFO"),
            "message": " ".join([p[1]] + p[3:]) if len(p) > 1 else text,
            "source": f"BGL-cmp-{mode}/{p[0]}"}


def psql(sql):
    env = dict(l.strip().split("=", 1) for l in (ROOT / "backend" / ".env").read_text().splitlines() if "=" in l and not l.startswith("#"))
    return subprocess.run(["docker", "exec", "aetherlog17-db-1", "psql", "-U", env["POSTGRES_USER"].strip('"'), "-d",
                           env["POSTGRES_DB"].strip('"'), "-At", "-F", "\t", "-c", sql], capture_output=True, text=True).stdout


def run(mode, n=1000):
    require_test_mode('cascade' if mode.startswith('cascade') else 'keyword-rule')
    acct = dict(l.split(": ", 1) for l in (HERE / "TEST_ACCOUNT.txt").read_text().splitlines() if ": " in l)
    key, org = acct["API key (X-API-KEY)"].strip(), acct["Organisation id"].strip()
    rows, te, pos = sample()
    pos = pos[:n]                      # optional smaller run (the API rate limit is 1,000 requests / 15 min)
    sent, times = [], []
    for k in pos:
        i = te[k]; body = app_log(rows[i]["text"], mode)
        req = urllib.request.Request("http://127.0.0.1:4000/api/ingest", json.dumps(body).encode(),
                                     {"Content-Type": "application/json", "X-API-KEY": key})
        t0 = time.perf_counter()
        with urllib.request.urlopen(req, timeout=60) as r:
            status = r.status
        times.append(1000 * (time.perf_counter() - t0))
        sent.append({"test_position": k, "subset_row": i, "label": int(rows[i]["label"]), "http": status, **body})
    time.sleep(2)
    out = psql(f'SELECT message, "anomalyScore", "threatCategory", "scoreStage", "scoreModel", "scoreThreshold", "scoreModelHash", "scoreCodeHash" '
               f'FROM logs WHERE "organizationId"=\'{org}\' AND source LIKE \'BGL-cmp-{mode}/%\'')
    pool = {}
    for line in out.splitlines():
        m, s, cat, st, mo, th, mh, ch = line.split("\t")
        pool.setdefault(norm_msg(m), []).append({"app_score": float(s) if s else None, "app_category": cat, "stage": st or None,
                                                "model": mo or None, "threshold": float(th) if th else None,
                                                "model_hash": mh or None, "code_hash": ch or None})
    for r, ms in zip(sent, times):
        lst = pool.get(norm_msg(r["message"]), [])
        r.update(lst.pop(0) if lst else {"app_score": None, "app_category": None})
        r["ms_end_to_end"] = ms
        r["app_says_anomaly"] = int(r.get("app_category") == "Critical")
    with open(HERE / f"compare_1000_{mode}.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(sent[0])); w.writeheader(); w.writerows(sent)
    print(f"{mode}: sent {len(sent)}, matched {sum(r['app_score'] is not None or r['app_category'] for r in sent)}, "
          f"median {np.median(times):.1f} ms/log end-to-end")


def metrics(y, p):
    y, p = np.asarray(y), np.asarray(p).astype(bool)
    tp = int((p & (y == 1)).sum()); fp = int((p & (y == 0)).sum()); fn = int((~p & (y == 1)).sum()); tn = int((~p & (y == 0)).sum())
    rec = tp / (tp + fn) if tp + fn else None; prec = tp / (tp + fp) if tp + fp else None
    f1 = 2 * tp / (2 * tp + fp + fn) if tp else 0.0
    return {"anomalies": int((y == 1).sum()), "normals": int((y == 0).sum()), "tp": tp, "fp_false_alarms": fp, "fn_missed": fn, "tn": tn,
            "recall": rec, "precision": prec, "f1": f1, "false_alarm_rate": fp / (fp + tn) if fp + tn else None}


def report():
    rep = {"lines": 1000, "source": "BGL chronological test split, random 1,000 lines (seed 2026), real anomaly ratio"}
    v3 = np.load(ROOT / "rerun_2026" / "phase_b" / "results" / "bgl" / "v3_seed42.npz")["test_pred"].astype(bool)
    modes = sys.argv[2:] or ["keyword", "cascade"]
    for mode in modes:
        r = list(csv.DictReader(open(HERE / f"compare_1000_{mode}.csv", encoding="utf-8", newline="")))
        y = [int(x["label"]) for x in r]; p = [int(x["app_says_anomaly"]) for x in r]
        ms = np.array([float(x["ms_end_to_end"]) for x in r])
        d = {"metrics": metrics(y, p), "ms_per_log_end_to_end_mean": float(ms.mean()), "ms_per_log_end_to_end_median": float(np.median(ms)),
             "not_scored": sum(1 for x in r if x["app_category"] in ("Not scored", "", "None")),
             "stages": dict(sorted({s: sum(1 for x in r if x.get("stage") == s) for s in {x.get("stage") for x in r}}.items(), key=lambda kv: str(kv[0]))),
             "rows_with_model_hash": sum(1 for x in r if x.get("model_hash") not in (None, "", "None")),
             "rows_with_code_hash": sum(1 for x in r if x.get("code_hash") not in (None, "", "None"))}
        if mode.startswith("cascade"):
            exp = [bool(v3[int(x["test_position"])]) for x in r]
            d["experiment_v3_seed42_same_lines"] = metrics(y, exp)
            d["app_vs_experiment_decision_differences"] = sum(1 for x, e in zip(r, exp) if bool(int(x["app_says_anomaly"])) != e)
        rep[mode] = d
    name = "compare_1000_report.json" if modes == ["keyword", "cascade"] else f"compare_1000_report_{'_'.join(modes)}.json"
    (HERE / name).write_text(json.dumps(rep, indent=2))
    print(json.dumps(rep, indent=2))


if __name__ == "__main__":
    report() if sys.argv[1] == "report" else run(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 1000)
