"""Every test script calls require_test_mode() first: it STOPS unless the running backend reports TEST_MODE=true,
so tests can never trigger real Telegram / e-mail / SMS / webhook / Slack / Teams alerts.
Start the backend for tests with START_BACKEND_TEST_MODE.bat (sets TEST_MODE=true)."""

import json
import sys
import urllib.request

BACKEND = "http://127.0.0.1:4000"
AI = "http://127.0.0.1:5001"


def require_test_mode(expect_model=None):
    try:
        h = json.loads(urllib.request.urlopen(f"{BACKEND}/api/health", timeout=10).read())
    except Exception as e:
        sys.exit(f"STOP: backend not reachable at {BACKEND} ({e}).")
    if h.get("testMode") is not True:
        sys.exit("STOP: backend is NOT in TEST_MODE - refusing to send test logs (alerts could be sent). "
                 "Restart it with START_BACKEND_TEST_MODE.bat.")
    if expect_model and h.get("anomalyModel") != expect_model:
        sys.exit(f"STOP: backend scores with '{h.get('anomalyModel')}', this test expects '{expect_model}'.")
    print(f"[guard] backend TEST_MODE=true, anomaly model = {h.get('anomalyModel')}")
    return h
