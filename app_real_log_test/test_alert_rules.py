"""Alert-rule test (TEST_MODE + ANOMALY_MODEL=cascade only; refuses to run otherwise).

Sends REAL BGL lines (from compare_1000_cascade.csv, written earlier by compare_1000.py) to /api/ingest:
  A) FATAL-level lines that the cascade judged NORMAL   -> must raise NO alert (level alone no longer alerts)
  B) FATAL-level lines that the cascade judged ANOMALY  -> must raise an alert decision (reason = cascade)
  C) INFO-level lines that the cascade judged NORMAL    -> no alert
Then checks alert_events (TEST_MODE records decisions with testMode=true; nothing is sent) and that the demo log
generator produced nothing. Writes alert_rules_report.json. Every number in the report is computed here.
"""
import csv, json, subprocess, time, urllib.request
from pathlib import Path
from test_guard import require_test_mode, BACKEND

HERE = Path(__file__).parent
N = 10


def psql(sql):
    r = subprocess.run(["docker", "exec", "-i", "aetherlog17-db-1", "psql", "-U", "admin", "-d", "ailoganalyzer", "-At", "-F", "\t"],
                       input=sql, capture_output=True, text=True, check=True)
    return [l.split("\t") for l in r.stdout.strip().splitlines() if l]


def main():
    require_test_mode(expect_model="cascade")
    acct = dict(l.split(": ", 1) for l in (HERE / "TEST_ACCOUNT.txt").read_text().splitlines() if ": " in l)
    key, org = acct["API key (X-API-KEY)"].strip(), acct["Organisation id"].strip()

    rows = list(csv.DictReader(open(HERE / "compare_1000_cascade.csv", encoding="utf-8")))
    groups = {
        "A_fatal_cascade_normal": [r for r in rows if r["level"] == "FATAL" and r["app_says_anomaly"] == "0"][:N],
        "B_fatal_cascade_anomaly": [r for r in rows if r["level"] == "FATAL" and r["app_says_anomaly"] == "1"][:N],
        "C_info_cascade_normal": [r for r in rows if r["level"] == "INFO" and r["app_says_anomaly"] == "0"][:N],
    }
    t0 = psql("select now();")[0][0]
    sent = {}
    for g, rs in groups.items():
        body = json.dumps({"logs": [{"level": r["level"], "message": r["message"], "source": f"alert-test-{g}"} for r in rs]}).encode()
        req = urllib.request.Request(f"{BACKEND}/api/ingest", data=body, method="POST",
                                     headers={"Content-Type": "application/json", "X-API-KEY": key})
        res = json.loads(urllib.request.urlopen(req, timeout=120).read())
        sent[g] = [x for x in res["results"] if x["status"] == "stored"]
    time.sleep(3)   # alert decisions are written asynchronously

    ev = psql(f"""select "logId", type, severity, payload->>'reason', payload->>'testMode', payload->>'suppressed'
                  from alert_events where "organizationId" = '{org}' and "createdAt" >= '{t0}';""")
    by_log = {e[0]: e for e in ev}
    report = {"started_at_db": t0, "groups": {}}
    ok = True
    for g, res in sent.items():
        alerted = [r for r in res if r["id"] in by_log]
        expect = len(res) if g.startswith("B_") else 0
        stage2_anom = sum(1 for r in res if r["scoreStage"] == "stage2_distilbert" and r["anomalyScore"] >= 0.5)
        good = len(alerted) == expect and stage2_anom == expect
        ok &= good
        report["groups"][g] = {"sent": len(groups[g]), "stored": len(res), "cascade_anomaly_now": stage2_anom,
                               "alert_decisions": len(alerted), "expected_alert_decisions": expect,
                               "reasons": sorted({by_log[r["id"]][3] for r in alerted}),
                               "all_testMode_and_suppressed": all(by_log[r["id"]][4] == "true" and by_log[r["id"]][5] == "true" for r in alerted),
                               "pass": good}
    demo = psql(f"""select count(*) from logs where "timestamp" >= '{t0}' and ("scoreStage" = 'demo_unscored'
                    or "threatCategory" = 'Not scored (demo)' or ("scoreModel" is null and source in
                    ('user-service','auth-service','api-gateway','frontend-logger','db-replicator')));""")[0][0]
    report["demo_logs_since_start"] = int(demo)
    ok &= int(demo) == 0
    report["PASS"] = bool(ok)
    (HERE / "alert_rules_report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
