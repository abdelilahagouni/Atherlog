"""
BGL cascade for the AI service: TF-IDF + LR gate -> DistilBERT (paper variant V3, seed 42).

Loaded once at startup from models/cascade_bgl/ (written by tools/export_cascade_bgl.py).
If that folder exists, loading is STRICT: any missing file, file-hash mismatch or library-version mismatch
raises an error and the service does not start. If the folder does not exist, the cascade is simply unavailable
(the /cascade endpoint answers 503) and the app keeps using the keyword rule.
"""

import hashlib
import json
import os
import time
from pathlib import Path

MODEL_DIR = Path(os.environ.get("CASCADE_MODEL_DIR", Path(__file__).resolve().parent / "models" / "cascade_bgl"))
LEVEL_BACK = {"WARN": "WARNING"}            # app level -> BGL level (others identical)


def _sha(p: Path):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        while b := f.read(1 << 20):
            h.update(b)
    return h.hexdigest()


CODE_HASH = _sha(Path(__file__))


class Cascade:
    def __init__(self, model_dir: Path = MODEL_DIR):
        import joblib
        import sklearn
        import torch
        import transformers
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        man_path = model_dir / "manifest.json"
        if not man_path.exists():
            raise FileNotFoundError(f"cascade manifest missing: {man_path}")
        self.manifest = json.loads(man_path.read_text())
        # 1. versions must match training
        have = {"scikit-learn": sklearn.__version__, "transformers": transformers.__version__, "torch": torch.__version__}
        base = lambda v: str(v).split("+")[0]          # ignore build tags such as +cu124 / +cpu
        bad = {k: (have[k], v) for k, v in self.manifest["versions"].items() if k in have and base(have[k]) != base(v)}
        if bad:
            raise RuntimeError(f"cascade: library versions differ from training (installed, trained): {bad}")
        # 2. every file must exist and match its hash
        for rel, digest in self.manifest["files_sha256"].items():
            p = model_dir / rel
            if not p.exists():
                raise FileNotFoundError(f"cascade: missing model file {p}")
            if _sha(p) != digest:
                raise RuntimeError(f"cascade: hash mismatch for {p}")
        # 3. load
        st = joblib.load(model_dir / "stage1.joblib")
        self.tfidf, self.lr = st["tfidf"], st["lr"]
        self.t = float(self.manifest["threshold_t"])
        self.device = "cuda" if torch.cuda.is_available() and not os.environ.get("CASCADE_FORCE_CPU") else "cpu"
        self.tok = AutoTokenizer.from_pretrained(model_dir / "distilbert")
        self.bert = AutoModelForSequenceClassification.from_pretrained(model_dir / "distilbert").to(self.device).eval()
        self.torch = torch
        self.model_hash = self.manifest["model_hash"]

    # ---------------------------------------------------------------- text preparation
    @staticmethod
    def app_text(log: dict) -> str:
        """Builds the BGL model text 'Type Component Level Content' from an app log entry."""
        source = str(log.get("source") or "")
        typ = source.split("/")[-1] if source else ""
        msg = str(log.get("message") or "").strip()
        comp, _, content = msg.partition(" ")
        level = LEVEL_BACK.get(str(log.get("level") or ""), str(log.get("level") or ""))
        return " ".join(x for x in (typ, comp, level, content) if x)

    # ---------------------------------------------------------------- scoring
    def p_bert(self, texts, batch=32):
        out = []
        with self.torch.no_grad():
            for a in range(0, len(texts), batch):
                enc = self.tok(texts[a:a + batch], truncation=True, max_length=128, padding=True, return_tensors="pt").to(self.device)
                out += self.torch.softmax(self.bert(**enc).logits.float(), -1)[:, 1].cpu().tolist()
        return out

    def score(self, texts, all_stages=False):
        """Returns one dict per text. all_stages=True also computes DistilBERT for non-forwarded texts (parity test only)."""
        t0 = time.perf_counter()
        q = self.lr.predict_proba(self.tfidf.transform(texts))[:, 1].tolist()
        fwd = [i for i, v in enumerate(q) if v >= self.t]
        idx = list(range(len(texts))) if all_stages else fwd
        pb = dict(zip(idx, self.p_bert([texts[i] for i in idx]))) if idx else {}
        ms = 1000 * (time.perf_counter() - t0) / max(len(texts), 1)
        res = []
        for i, txt in enumerate(texts):
            forwarded = q[i] >= self.t
            if forwarded:
                p = pb[i]
                r = {"anomaly": p >= 0.5, "score": p, "stage": "stage2_distilbert"}
            else:
                r = {"anomaly": False, "score": q[i], "stage": "stage1_lr"}
            r.update({"p_lr": q[i], "p_bert": pb.get(i), "forwarded": forwarded, "threshold": self.t,
                      "model": self.manifest["name"], "model_hash": self.model_hash, "code_hash": CODE_HASH,
                      "ms_per_log": ms, "text": txt})
            res.append(r)
        return res

    def info(self):
        m = self.manifest
        return {"available": True, "name": m["name"], "display_name": m["display_name"], "note": m["note"],
                "threshold_t": self.t, "model_hash": self.model_hash, "code_hash": CODE_HASH, "device": self.device,
                "versions": m["versions"], "trained_on": m["training_data"]}


def load_if_present():
    """None if the model folder does not exist; otherwise a loaded Cascade (raises on any problem)."""
    if not MODEL_DIR.exists():
        print(f"[CASCADE] {MODEL_DIR} not found - cascade unavailable (keyword rule stays in use).")
        return None
    c = Cascade(MODEL_DIR)
    print(f"[CASCADE] loaded {c.manifest['name']} (t={c.t:.6f}, model_hash={c.model_hash[:16]}, device={c.device})")
    return c
