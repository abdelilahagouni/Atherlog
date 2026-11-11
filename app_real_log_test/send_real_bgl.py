"""
Sends REAL BGL log lines (chronological test split of the real BGL.log subset) to the running app's ingest API
(POST http://127.0.0.1:4000/api/ingest, header X-API-KEY from TEST_ACCOUNT.txt), then reads back how the app scored
each log from the local database and compares with the real BGL label.

Level: the real BGL level is sent unchanged, except WARNING -> WARN (mapped back by the cascade).
FATAL->FATAL, anything else->INFO. Message = BGL "Component Content". Source = "BGL-real/<node type>".
Outputs: results.csv, summary.json (in this folder).
"""

import csv
import re
import sys
import json
import random
import subprocess
import time
import urllib.request
from pathlib import Path
from test_guard import require_test_mode  # noqa: E402  (stops unless backend TEST_MODE=true)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
N_EACH = 25
LEVEL = {"WARNING": "WARN"}   # real BGL level is sent as is (SEVERE/FAILURE kept); only WARNING -> app WARN (mapped back by the cascade)


def norm_msg(m):
    """The app masks card-like digit groups (e.g. '00000002 00000000' -> '****-****-****-0000');
    compare messages with all hex/digit/mask runs collapsed."""
    return re.sub(r"[\s0-9a-fA-F*\-]+", "#", m)[:80]


def main():
    require_test_mode()
    readback_only = "--readback-only" in sys.argv
    acct = dict(l.split(": ", 1) for l in (HERE / "TEST_ACCOUNT.txt").read_text().splitlines() if ": " in l)
    key, org = acct["API key (X-API-KEY)"].strip(), acct["Organisation id"].strip()
    rows = list(csv.DictReader(open(ROOT / "rerun_2026" / "data" / "bgl_subset_50k.csv", encoding="utf-8", newline="")))
    test = json.loads((ROOT / "rerun_2026" / "data" / "bgl_splits.json").read_text())["chronological"]["test"]
    rng = random.Random(42)
    anom = [i for i in test if rows[i]["label"] == "1"]; norm = [i for i in test if rows[i]["label"] == "0"]
    seen, pick_a = set(), []
    for i in rng.sample(anom, len(anom)):            # prefer distinct anomaly messages
        if rows[i]["text"] not in seen and len(pick_a) < N_EACH:
            seen.add(rows[i]["text"]); pick_a.append(i)
    pick = pick_a + rng.sample(norm, N_EACH)
    rng.shuffle(pick)

    sent = []
    if readback_only:
        sent = [dict(r, row=int(r["row"]), bgl_label=int(r["bgl_label"]), http=int(r["http"]))
                for r in csv.DictReader(open(HERE / "results.csv", encoding="utf-8", newline=""))]
        pick = []
    for i in pick:
        parts = rows[i]["text"].split(" ", 3)        # Type Component Level Content
        lvl = (lambda l: LEVEL.get(l, l))(parts[2] if len(parts) > 2 else "INFO")
        msg = " ".join([parts[1]] + parts[3:]) if len(parts) > 3 else rows[i]["text"]
        body = {"level": lvl, "message": msg, "source": f"BGL-real/{parts[0]}"}
        req = urllib.request.Request("http://127.0.0.1:4000/api/ingest", json.dumps(body).encode(),
                                     {"Content-Type": "application/json", "X-API-KEY": key})
        with urllib.request.urlopen(req, timeout=30) as r:
            status = r.status
        sent.append({"row": i, "bgl_label": int(rows[i]["label"]), "bgl_level": parts[2] if len(parts) > 2 else "",
                     "app_level": lvl, "message": msg, "http": status})
        time.sleep(0.05)
    if not readback_only:
        time.sleep(2)

    env = dict(l.strip().split("=", 1) for l in (ROOT / "backend" / ".env").read_text().splitlines() if "=" in l and not l.startswith("#"))
    q = (f'SELECT message, "anomalyScore", "threatCategory", level FROM logs WHERE "organizationId" = \'{org}\' '
         f'AND source LIKE \'BGL-real/%\'')
    out = subprocess.run(["docker", "exec", "aetherlog17-db-1", "psql", "-U", env["POSTGRES_USER"].strip('"'), "-d",
                          env["POSTGRES_DB"].strip('"'), "-At", "-F", "\t", "-c", q], capture_output=True, text=True).stdout
    scored = {}
    for line in out.splitlines():
        m, s, cat, lv = line.split("\t")
        scored[norm_msg(m)] = (float(s), cat)
    for r in sent:
        r["app_score"], r["app_category"] = scored.get(norm_msg(r["message"]), (None, None))
        r["app_says_anomaly"] = int(r["app_category"] == "Critical")
    with open(HERE / "results.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(sent[0])); w.writeheader(); w.writerows(sent)

    tp = sum(r["app_says_anomaly"] and r["bgl_label"] for r in sent); fp = sum(r["app_says_anomaly"] and not r["bgl_label"] for r in sent)
    fn = sum((not r["app_says_anomaly"]) and r["bgl_label"] for r in sent); tn = len(sent) - tp - fp - fn
    total_in_org = subprocess.run(["docker", "exec", "aetherlog17-db-1", "psql", "-U", env["POSTGRES_USER"].strip('"'), "-d",
                                   env["POSTGRES_DB"].strip('"'), "-At", "-c",
                                   f'SELECT count(*), count(*) FILTER (WHERE source NOT LIKE \'BGL-real/%\') FROM logs WHERE "organizationId"=\'{org}\''],
                                  capture_output=True, text=True).stdout.strip()
    summ = {"sent": len(sent), "http_accepted_202": sum(r["http"] == 202 for r in sent), "found_in_db": sum(r["app_score"] is not None for r in sent),
            "real_anomalies": N_EACH, "real_normals": N_EACH, "tp": tp, "fp": fp, "fn": fn, "tn": tn,
            "app_recall": tp / (tp + fn) if tp + fn else None, "app_precision": tp / (tp + fp) if tp + fp else None,
            "logs_in_test_org_total_and_non_real": total_in_org,
            "app_decision": "threatCategory == 'Critical' (score 0.9) from the python-service /urgency keyword rule"}
    (HERE / "summary.json").write_text(json.dumps(summ, indent=2))
    print(json.dumps(summ, indent=2))


if __name__ == "__main__":
    main()
