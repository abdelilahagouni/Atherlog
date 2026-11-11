"""
Tests the separate rate limits (backend must run in TEST_MODE; the script stops otherwise).

Two phases, each against a FRESH test-mode backend (limits live in memory):
  python test_ingest_rate_limit.py low    backend started with INGEST_RATE_LIMIT_PER_SECOND=3 (process env only)
     1. the RateLimit-Limit header equals the configured value (3)
     2. a burst of 30 concurrent ingest requests -> some 429s, and never more than 3 accepted in any 1-second window
     3. after a pause, ingest works again (the window resets)
  python test_ingest_rate_limit.py high   backend started with the .env value (100)
     1. the RateLimit-Limit header equals 100
     2. ingest does NOT use the general /api budget: 1,100 ingest requests (above the general limit of 1,000),
        no 429, and a general /api route still answers 200 afterwards
     3. the general limit still applies to other routes: /api/health hammered until it returns 429
Note: with bcryptjs API-key checks the backend handles ~8 ingest requests/second, so 100/s cannot be reached in
practice; the 'low' phase is what proves the per-second limiter itself.
Logs are real BGL test lines (source "BGL-ratelimit/<type>"); they are deleted from the test organisation afterwards.
Writes rate_limit_report.json. Run right after a fresh test-mode backend start (limits are in memory).
"""

import concurrent.futures as cf
import csv
import sys
import json
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

from test_guard import BACKEND, require_test_mode

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
GENERAL = 1000     # general /api limit per 15 minutes per IP


def lines():
    rows = list(csv.DictReader(open(ROOT / "rerun_2026" / "data" / "bgl_subset_50k.csv", encoding="utf-8", newline="")))
    te = json.loads((ROOT / "rerun_2026" / "data" / "bgl_splits.json").read_text())["chronological"]["test"]
    out = []
    for i in te:
        p = rows[i]["text"].split(" ", 3)
        out.append({"level": {"WARNING": "WARN"}.get(p[2] if len(p) > 2 else "INFO", p[2] if len(p) > 2 else "INFO"),
                    "message": " ".join([p[1]] + p[3:]) if len(p) > 1 else rows[i]["text"], "source": f"BGL-ratelimit/{p[0]}"})
    return out


def ingest(key, body, with_headers=False):
    req = urllib.request.Request(f"{BACKEND}/api/ingest", json.dumps(body).encode(), {"Content-Type": "application/json", "X-API-KEY": key})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            res = (r.status, dict(r.headers), time.time())
    except urllib.error.HTTPError as e:
        res = (e.code, dict(e.headers), time.time())
    return res if with_headers else res[0]


def get(path):
    try:
        with urllib.request.urlopen(f"{BACKEND}{path}", timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


def cleanup(org):
    env = dict(l.strip().split("=", 1) for l in (ROOT / "backend" / ".env").read_text().splitlines() if "=" in l and not l.startswith("#"))
    return subprocess.run(["docker", "exec", "aetherlog17-db-1", "psql", "-U", env["POSTGRES_USER"].strip('"'), "-d",
                           env["POSTGRES_DB"].strip('"'), "-At", "-c",
                           f"DELETE FROM logs WHERE \"organizationId\"='{org}' AND source LIKE 'BGL-ratelimit/%'"],
                          capture_output=True, text=True).stdout.strip()


def phase_low(key, L):
    time.sleep(1.1)
    st, hd, _ = ingest(key, L[0], True)
    limit = int({k.lower(): v for k, v in hd.items()}.get("ratelimit-limit", "-1"))
    time.sleep(1.1)
    with cf.ThreadPoolExecutor(30) as ex:
        res = list(ex.map(lambda b: ingest(key, b, True), L[1:31]))
    ok_t = sorted(t for c, _, t in res if c == 202)
    max_in_window = max(sum(1 for u in ok_t if t <= u < t + 1.0) for t in ok_t) if ok_t else 0
    time.sleep(1.5)
    after = ingest(key, L[40])
    r = {"ratelimit_limit_header": limit, "burst_30": {"accepted_202": sum(c == 202 for c, _, _ in res),
         "rejected_429": sum(c == 429 for c, _, _ in res), "max_accepted_in_any_1s_window": max_in_window},
         "after_pause_status": after}
    r["passed"] = limit == 3 and r["burst_30"]["rejected_429"] > 0 and max_in_window <= limit and after == 202
    return r


def phase_high(key, L):
    st, hd, _ = ingest(key, L[0], True)
    limit = int({k.lower(): v for k, v in hd.items()}.get("ratelimit-limit", "-1"))
    sent, codes, t0 = 0, [], time.time()
    with cf.ThreadPoolExecutor(20) as ex:
        while sent < 1100:
            batch = L[200 + sent: 200 + sent + 50]
            codes += list(ex.map(lambda b: ingest(key, b), batch)); sent += len(batch)
    general_after = get("/api/health")
    n, status = 0, 200
    while status != 429 and n < GENERAL + 50:
        status = get("/api/health"); n += 1
    r = {"ratelimit_limit_header": limit,
         "ingest_over_general_budget": {"ingest_requests": sent, "accepted_202": codes.count(202), "rejected_429": codes.count(429),
                                        "seconds": round(time.time() - t0, 1), "requests_per_second": round(sent / (time.time() - t0), 1),
                                        "general_route_after": general_after},
         "general_limit_other_routes": {"requests_until_429": n, "got_429": status == 429,
                                        "note": "1,000 minus the few general requests made before (guard, health)"}}
    r["passed"] = (limit == 100 and codes.count(429) == 0 and general_after == 200 and status == 429)
    return r


def main():
    phase = sys.argv[1] if len(sys.argv) > 1 else "high"
    require_test_mode()
    acct = dict(l.split(": ", 1) for l in (HERE / "TEST_ACCOUNT.txt").read_text().splitlines() if ": " in l)
    key, org = acct["API key (X-API-KEY)"].strip(), acct["Organisation id"].strip()
    L = lines()
    rep = phase_low(key, L) if phase == "low" else phase_high(key, L)
    rep["phase"] = phase
    rep["cleanup"] = cleanup(org)
    out = HERE / "rate_limit_report.json"
    allr = json.loads(out.read_text()) if out.exists() and "phase" not in json.loads(out.read_text()) else {}
    allr[phase] = rep
    out.write_text(json.dumps(allr, indent=2))
    print(json.dumps(rep, indent=2))


if __name__ == "__main__":
    main()
