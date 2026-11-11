"""
Ingest bottleneck fix - tests (backend must run in TEST_MODE with the cascade; the script stops otherwise).

  python test_ingest_throughput.py main     backend started with high request/log limits (process env only), so the
                                            limits do not cap the throughput numbers
     a. revoke: a new API key works (bcrypt, then cached), is deleted via DELETE /api/keys/:id and is rejected on its
        very next request; same for a key removed directly in the database (any path)
     b. throughput (logs/second) for single-log requests (8 parallel clients) and batches of 100 and 500
     c. parity through the app: all 10,000 BGL chronological test lines ingested in batches of 500; the stored
        decisions and scores are compared with the experiment's V3 seed-42 results
     d. stored text is still xss-sanitised (single log and batch), although the model scores the raw text
  python test_ingest_throughput.py limits   backend started with INGEST_LOGS_PER_SECOND=150 (process env only)
     batch of 100 accepted; a second batch of 100 in the same second -> 429; batch of 501 -> 413
Test logs (source "BGL-thru/...") and temporary API keys are removed afterwards. Writes throughput_report.json.
"""

import concurrent.futures as cf
import csv
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np

from test_guard import BACKEND, require_test_mode

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
TOL = 1e-4


def http(method, path, body=None, headers=None):
    h = {"Content-Type": "application/json", **(headers or {})}
    req = urllib.request.Request(f"{BACKEND}{path}", json.dumps(body).encode() if body is not None else None, h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw.decode(errors="replace")


def psql(sql):
    env = dict(l.strip().split("=", 1) for l in (ROOT / "backend" / ".env").read_text().splitlines() if "=" in l and not l.startswith("#"))
    # SQL is passed on stdin (long id lists would exceed the Windows command-line limit)
    return subprocess.run(["docker", "exec", "-i", "aetherlog17-db-1", "psql", "-U", env["POSTGRES_USER"].strip('"'), "-d",
                           env["POSTGRES_DB"].strip('"'), "-At"], input=sql, capture_output=True, text=True).stdout.strip()


def bgl_test_logs():
    rows = list(csv.DictReader(open(ROOT / "rerun_2026" / "data" / "bgl_subset_50k.csv", encoding="utf-8", newline="")))
    te = json.loads((ROOT / "rerun_2026" / "data" / "bgl_splits.json").read_text())["chronological"]["test"]
    out = []
    for i in te:
        p = rows[i]["text"].split(" ", 3)
        lvl = p[2] if len(p) > 2 else "INFO"
        out.append({"level": {"WARNING": "WARN"}.get(lvl, lvl), "message": " ".join([p[1]] + p[3:]) if len(p) > 1 else rows[i]["text"],
                    "source": f"BGL-thru/{p[0]}"})
    return out


def account():
    a = dict(l.split(": ", 1) for l in (HERE / "TEST_ACCOUNT.txt").read_text().splitlines() if ": " in l)
    return {k: v.strip() for k, v in a.items()}


def login(acct):
    st, r = http("POST", "/api/auth/login", {"username": acct["Username"], "password": acct["Password"]})
    assert st == 200, f"login failed: {st}"
    return {"Authorization": f"Bearer {r['token']}"}


def ingest(key, body):
    return http("POST", "/api/ingest", body, {"X-API-KEY": key})


# ------------------------------------------------------------------ a. revoke
def test_revoke(acct, L):
    auth = login(acct); res = {}
    # via the API (DELETE /api/keys/:id)
    st, k = http("POST", "/api/keys", {"name": "revoke-test-api"}, auth)
    assert st == 201, (st, k)
    t0 = time.perf_counter(); s1, _ = ingest(k["rawKey"], L[0]); t1 = time.perf_counter()
    s2, _ = ingest(k["rawKey"], L[1]); t2 = time.perf_counter()
    sd, _ = http("DELETE", f"/api/keys/{k['id']}", None, auth)
    s3, _ = ingest(k["rawKey"], L[2])
    res["via_api_delete"] = {"first_request": s1, "first_ms_bcrypt": round(1000 * (t1 - t0), 1), "second_request": s2,
                             "second_ms_cached": round(1000 * (t2 - t1), 1), "delete_status": sd,
                             "next_request_after_revoke": s3, "rejected": s3 == 401}
    # removed directly in the database (any other path, e.g. SQL console / organisation deletion)
    st, k2 = http("POST", "/api/keys", {"name": "revoke-test-db"}, auth)
    a1, _ = ingest(k2["rawKey"], L[3]); a2, _ = ingest(k2["rawKey"], L[4])
    psql(f"DELETE FROM api_keys WHERE id='{k2['id']}'")
    a3, _ = ingest(k2["rawKey"], L[5])
    res["via_direct_db_delete"] = {"first_request": a1, "second_request_cached": a2, "next_request_after_delete": a3, "rejected": a3 == 401}
    res["passed"] = s1 == 202 and s2 == 202 and sd == 204 and s3 == 401 and a1 == 202 and a2 == 202 and a3 == 401
    return res


# ------------------------------------------------------------------ b. throughput
def test_throughput(key, L):
    res = {}
    # warm-up (cache the key, load GPU kernels)
    ingest(key, {"logs": L[:32]})
    n = 2000
    logs = L[100:100 + n]
    t0 = time.perf_counter()
    with cf.ThreadPoolExecutor(8) as ex:
        codes = list(ex.map(lambda b: ingest(key, b)[0], logs))
    dt = time.perf_counter() - t0
    res["single_log_requests_8_clients"] = {"logs": n, "seconds": round(dt, 2), "logs_per_second": round(n / dt, 1),
                                            "all_202": all(c == 202 for c in codes)}
    for size in (100, 500):
        logs = L[2200:2200 + n] if size == 100 else L[4300:4300 + n]
        t0 = time.perf_counter(); ok = True
        for a in range(0, n, size):
            st, r = ingest(key, {"logs": logs[a:a + size]})
            ok &= st == 202 and r["stored"] == len(logs[a:a + size])
        dt = time.perf_counter() - t0
        res[f"batch_{size}_1_client"] = {"logs": n, "requests": n // size, "seconds": round(dt, 2),
                                         "logs_per_second": round(n / dt, 1), "all_stored": ok}
    return res


# ------------------------------------------------------------------ c. parity through the app
def test_parity(key, L):
    v3 = np.load(ROOT / "rerun_2026" / "phase_b" / "results" / "bgl" / "v3_seed42.npz")
    exp_pred = v3["test_pred"].astype(bool); exp_score = v3["test_score"]
    exp_app_score = np.where(exp_score >= 1.0, exp_score - 1.0, exp_score)   # forwarded: p_DistilBERT; else p_LR
    dec, score, ids = [], [], []
    t0 = time.perf_counter()
    for a in range(0, len(L), 500):
        st, r = ingest(key, {"logs": L[a:a + 500]})
        assert st == 202, (st, r)
        for x in r["results"]:
            dec.append(x["threatCategory"] == "Critical"); score.append(x["anomalyScore"]); ids.append(x["id"])
    dt = time.perf_counter() - t0
    dec = np.array(dec); score = np.array(score, dtype=float)
    stored = int(psql("SELECT count(*) FROM logs WHERE id IN (" + ",".join(f"'{i}'" for i in ids) + ")"))
    d = np.abs(score - exp_app_score)
    return {"lines": len(L), "stored_in_db": stored, "seconds": round(dt, 1), "logs_per_second": round(len(L) / dt, 1),
            "decision_differences_vs_experiment": int((dec != exp_pred).sum()),
            "score_max_abs_diff": float(d.max()), "scores_over_tolerance": int((d > TOL).sum()),
            "passed": stored == len(L) and int((dec != exp_pred).sum()) == 0 and int((d > TOL).sum()) == 0}


# ------------------------------------------------------------------ d. stored text is still sanitised
def test_sanitised(key):
    evil = {"level": "INFO", "message": "KERNEL test <script>alert(1)</script> & more", "source": "BGL-thru/RAS"}
    s1, r1 = ingest(key, evil)
    s2, r2 = ingest(key, {"logs": [evil]})
    ids = [r1["id"], r2["results"][0]["id"]]
    stored = psql("SELECT message FROM logs WHERE id IN (" + ",".join(f"'{i}'" for i in ids) + ")").splitlines()
    return {"single_status": s1, "batch_status": s2, "stored_messages": stored,
            "passed": s1 == 202 and s2 == 202 and len(stored) == 2 and all("<script" not in m for m in stored)}


# ------------------------------------------------------------------ limits
def test_limits(key, L):
    time.sleep(1.2)
    s1, _ = ingest(key, {"logs": L[:100]})
    s2, r2 = ingest(key, {"logs": L[100:200]})
    s3, r3 = ingest(key, {"logs": L[:501]})
    return {"configured_logs_per_second": 150, "first_batch_100": s1, "second_batch_100_same_second": s2,
            "second_message": r2.get("message") if isinstance(r2, dict) else r2, "batch_501": s3,
            "batch_501_message": r3.get("message") if isinstance(r3, dict) else r3,
            "passed": s1 == 202 and s2 == 429 and s3 == 413}


def main():
    phase = sys.argv[1] if len(sys.argv) > 1 else "main"
    require_test_mode("cascade")
    acct = account(); key, org = acct["API key (X-API-KEY)"], acct["Organisation id"]
    L = bgl_test_logs()
    out = HERE / "throughput_report.json"
    rep = json.loads(out.read_text()) if out.exists() else {}
    if phase == "main":
        rep["a_revoke"] = test_revoke(acct, L)
        rep["b_throughput"] = test_throughput(key, L)
        rep["c_parity_through_app"] = test_parity(key, L)
        rep["d_stored_text_sanitised"] = test_sanitised(key)
    else:
        rep["limits"] = test_limits(key, L)
    rep["cleanup_logs"] = psql(f"DELETE FROM logs WHERE \"organizationId\"='{org}' AND source LIKE 'BGL-thru/%'")
    rep["cleanup_keys"] = psql(f"DELETE FROM api_keys WHERE \"organizationId\"='{org}' AND name LIKE 'revoke-test-%'")
    out.write_text(json.dumps(rep, indent=2))
    print(json.dumps(rep, indent=2))


if __name__ == "__main__":
    main()
