"""Model-only scoring time per log: the same 1,000 lines as compare_1000.py, one log per HTTP call (as the backend does),
keyword rule (/urgency) vs cascade (/cascade). 20 warm-up calls are not timed. Writes model_latency.json."""

import json
import time
import urllib.request
from pathlib import Path

import numpy as np

from compare_1000 import app_log, sample
from test_guard import require_test_mode  # noqa: E402  (stops unless backend TEST_MODE=true)

HERE = Path(__file__).resolve().parent


def call(ep, log):
    r = urllib.request.Request(f"http://127.0.0.1:5001{ep}", json.dumps({"log": log}).encode(), {"Content-Type": "application/json"})
    t0 = time.perf_counter(); json.loads(urllib.request.urlopen(r, timeout=60).read()); return 1000 * (time.perf_counter() - t0)


def main():
    require_test_mode()
    rows, te, pos = sample()
    logs = [app_log(rows[te[k]]["text"], "latency") for k in pos]
    out = {}
    for ep in ("/urgency", "/cascade"):
        for l in logs[:20]:
            call(ep, l)
        ms = np.array([call(ep, l) for l in logs])
        out[ep] = {"mean_ms": float(ms.mean()), "median_ms": float(np.median(ms)), "p95_ms": float(np.percentile(ms, 95))}
    out["note"] = "HTTP round trip to the AI service via 127.0.0.1, one log per call; GPU for DistilBERT (RTX 3050 Laptop)"
    (HERE / "model_latency.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
