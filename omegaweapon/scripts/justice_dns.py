#!/usr/bin/env python3
"""UltimaWeapon / Justice — resolve domains and match them against a platform signature.
Usage: python3 scripts/justice_dns.py --platform agency.tld,www.seedclient.tld --candidates candidates.txt --out omega_cache/<agency>/dns.csv
Signature = union of A records of the platform hosts (both apex and www are tried). MATCH means the candidate resolves
into that set — strong evidence of shared hosting/edge, not proof of a client relationship."""
import socket, csv, argparse
def ips(host):
    out = set()
    for h in {host, "www." + host if not host.startswith("www.") else host[4:]}:
        try: out |= set(socket.gethostbyname_ex(h)[2])
        except Exception: pass
    return out
ap = argparse.ArgumentParser(); ap.add_argument("--platform", required=True); ap.add_argument("--candidates", required=True); ap.add_argument("--out", required=True)
a = ap.parse_args(); sig = set()
for h in a.platform.split(","): sig |= ips(h.strip())
print("platform signature:", sorted(sig))
rows = []
for d in [l.strip().lower().replace("https://", "").replace("http://", "").split("/")[0] for l in open(a.candidates) if l.strip()]:
    got = ips(d); rows.append({"domain": d, "ips": " ".join(sorted(got)), "match": "MATCH" if got & sig else ("NXDOMAIN" if not got else "no")})
    print(f"{rows[-1]['match']:8} {d} {rows[-1]['ips']}")
with open(a.out, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["domain", "ips", "match"]); w.writeheader(); w.writerows(rows)
