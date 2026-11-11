"""
Exports the BGL cascade used in the paper (Phase A2 variant V3, seed 42) for the app's AI service.

  Stage 1: TF-IDF + LogisticRegression, fitted on the BGL chronological TRAINING split exactly as in the
           experiments (rerun_2026/src/pipeline.py: fit_tfidf / fit_lr; lbfgs is deterministic).
  Gate:    forward to stage 2 if p_LR >= t, t taken from rerun_2026/phase_a2/results/selection.json (seed 42).
  Stage 2: DistilBERT trained in Phase A (rerun_2026/models/bgl/chronological/seed42), copied unchanged.

Writes python-service/models/cascade_bgl/{stage1.joblib, distilbert/, manifest.json}. Nothing is retrained
except the deterministic LR/TF-IDF refit, which the parity test checks against the experiment result files.
Run from python-service/:  python tools/export_cascade_bgl.py
"""

import datetime as dt
import hashlib
import json
import shutil
import sys
from pathlib import Path

import joblib
import numpy as np
import sklearn
import torch
import transformers

SVC = Path(__file__).resolve().parents[1]                    # python-service
ROOT = SVC.parent                                            # aetherlog (17)
R26 = ROOT / "rerun_2026"
OUT = SVC / "models" / "cascade_bgl"
SEED = 42
sys.path.insert(0, str(R26 / "src"))
from common import load_subset                               # noqa: E402
from pipeline import fit_lr, fit_tfidf                       # noqa: E402


def sha(p: Path):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        while b := f.read(1 << 20):
            h.update(b)
    return h.hexdigest()


def main():
    texts, _, y, splits = load_subset()
    tr = splits["chronological"]["train"]
    tfidf = fit_tfidf([texts[i] for i in tr])
    lr = fit_lr(tfidf.transform([texts[i] for i in tr]), y[tr], 0)
    t = json.loads((R26 / "phase_a2" / "results" / "selection.json").read_text())["seeds"][str(SEED)]["V3"]["threshold"]
    src_bert = R26 / "models" / "bgl" / "chronological" / f"seed{SEED}"
    if not (src_bert / "model.safetensors").exists():
        raise FileNotFoundError(f"{src_bert} missing. STOP.")

    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "distilbert").mkdir(parents=True)
    joblib.dump({"tfidf": tfidf, "lr": lr}, OUT / "stage1.joblib")
    for f in src_bert.iterdir():
        if f.is_file():
            shutil.copy2(f, OUT / "distilbert" / f.name)

    files = {str(p.relative_to(OUT)).replace("\\", "/"): sha(p) for p in sorted(OUT.rglob("*")) if p.is_file()}
    combined = hashlib.sha256("".join(f"{k}:{v};" for k, v in sorted(files.items())).encode()).hexdigest()
    manifest = {
        "name": f"cascade-bgl-seed{SEED}",
        "display_name": f"Cascade (TF-IDF + LR gate -> DistilBERT) trained on BGL, seed {SEED}",
        "note": "Trained on BGL (Blue Gene/L supercomputer) logs only; scores for other log formats are not reliable.",
        "threshold_t": float(t),
        "stage2_decision": "anomaly if p_DistilBERT >= 0.5",
        "stage1_decision": "if p_LR < t: normal, score = p_LR (stage 'stage1_lr')",
        "model_text": "BGL 'Type Component Level Content' (label, timestamps and node fields removed)",
        "app_text_rule": "type = last part of source after '/', component = first word of message, level = app level "
                         "(WARN -> WARNING), content = rest of message",
        "training_data": "BGL chronological split of the 50,000-line real subset (rerun_2026/data), 35,000 training lines",
        "sources": {"stage1": "refit with rerun_2026/src/pipeline.py fit_tfidf/fit_lr (deterministic)",
                    "threshold": "rerun_2026/phase_a2/results/selection.json seeds.42.V3.threshold",
                    "distilbert": "rerun_2026/models/bgl/chronological/seed42 (Phase A)"},
        "versions": {"python": sys.version.split()[0], "scikit-learn": sklearn.__version__,
                     "transformers": transformers.__version__, "torch": torch.__version__, "numpy": np.__version__},
        "files_sha256": files, "model_hash": combined,
        "exporter_sha256": sha(Path(__file__)),
        "created": dt.datetime.now().isoformat(timespec="seconds"),
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))
    print(f"exported to {OUT}; t = {t:.6f}; model_hash = {combined[:16]}")


if __name__ == "__main__":
    main()
