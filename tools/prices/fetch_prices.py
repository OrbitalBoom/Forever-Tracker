#!/usr/bin/env python3
"""Fetch WoW: Forever auction prices (US, Normal ruleset, Horde AH) and write
data/prices.json + data/prices.js.

Source, in order of preference:
  1. Blizzard Battle.net Game Data API (official). Needs a free client from
     https://develop.battle.net/access/clients, supplied as env vars
     BLIZZARD_CLIENT_ID / BLIZZARD_CLIENT_SECRET (GitHub repo secrets).
       GET /data/wow/ruleset/{RULESET}/auctions/{HOUSE}?namespace=dynamic-forever-us
       GET /data/wow/ruleset/{RULESET}/auctions/{HOUSE}/commodities?namespace=dynamic-forever-us
     Ruleset 2 = Normal; house 114 = Normal Horde AH on US (see README).
     Both endpoints are the full realm dump (one request each).
  2. Fallback when no credentials are set (and PRICE_FALLBACK != "off"):
     Forever Goblin (https://forevergoblin.trade), a free fan site that stores
     the same hourly Blizzard API snapshots. One request returns the whole
     house: GET /api/m/{region}-{house}/prices

Keeps every priced auction in the dump (not a profession-only id list). Output
is compact: items[id] = [minBuyout, marketValue, quantity, soldPerDay?]. The
page's JS accepts this schema (2) and the older object shape (schema 1).
Exits non-zero and writes nothing if the fetch fails, so old prices are kept.

Usage: python3 tools/prices/fetch_prices.py [site_root]
"""
import base64, datetime, json, os, sys, urllib.request, urllib.error

ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..")
REGION = os.environ.get("PRICE_REGION", "us")
RULESET = int(os.environ.get("PRICE_RULESET", "2"))      # 2 = Normal
HOUSE = int(os.environ.get("PRICE_HOUSE", "114"))        # US Normal Horde
UA = "Forever-Tracker price sync (+https://github.com/OrbitalBoom/Forever-Tracker)"

def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def get_json(url, headers=None, data=None, timeout=120):
    h = {"User-Agent": UA, "Accept": "application/json"}
    h.update(headers or {})
    req = urllib.request.Request(url, headers=h, data=data)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8")), dict(r.headers)

def market_value(units):
    """units: list of (unit_price, qty). Average of the cheapest 15% of units
    (at least the cheapest listing), the same rule Forever Goblin documents."""
    units = sorted(units)
    total = sum(q for _, q in units)
    if total <= 0:
        return None
    take = max(1, int(round(total * 0.15))) if total >= 14 else units[0][1]
    got = 0; acc = 0
    for p, q in units:
        n = min(q, take - got)
        acc += p * n; got += n
        if got >= take:
            break
    return int(round(acc / got))

def compact_row(v):
    """[minBuyout, marketValue, quantity, soldPerDay?] in copper / units."""
    row = [int(v["minBuyout"] or 0), int(v["marketValue"]), int(v.get("quantity") or 0)]
    spd = v.get("soldPerDay")
    if spd is not None:
        row.append(spd)
    return row

def from_blizzard(cid, secret):
    tok, _ = get_json("https://oauth.battle.net/token",
                      headers={"Authorization": "Basic " + base64.b64encode(("%s:%s" % (cid, secret)).encode()).decode(),
                               "Content-Type": "application/x-www-form-urlencoded"},
                      data=b"grant_type=client_credentials")
    auth = {"Authorization": "Bearer " + tok["access_token"]}
    base = "https://%s.api.blizzard.com/data/wow/ruleset/%d/auctions/%d" % (REGION, RULESET, HOUSE)
    ns = "?namespace=dynamic-forever-%s&locale=en_US" % REGION
    house, hh = get_json(base + ns, headers=auth)
    comm, ch = get_json(base + "/commodities" + ns, headers=auth)
    units = {}
    for a in house.get("auctions", []):
        q = a.get("quantity") or 1
        if a.get("buyout"):
            units.setdefault(a["item"]["id"], []).append((a["buyout"] / q, q))
    for a in comm.get("auctions", []):
        units.setdefault(a["item"]["id"], []).append((a["unit_price"], a.get("quantity") or 1))
    items = {}
    for iid, u in units.items():
        items[iid] = {"minBuyout": int(round(min(p for p, _ in u))), "marketValue": market_value(u),
                      "quantity": sum(q for _, q in u), "soldPerDay": None}
    lm = hh.get("Last-Modified") or ch.get("Last-Modified")
    updated = now_iso()
    if lm:
        try:
            updated = datetime.datetime.strptime(lm, "%a, %d %b %Y %H:%M:%S %Z").strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            pass
    return {"source": "Blizzard Battle.net Game Data API (official)",
            "sourceUrl": "https://develop.battle.net/documentation/world-of-warcraft",
            "houseName": house.get("name") or "Horde Auction House",
            "updated": updated, "items": items}

def from_forevergoblin():
    market = "%s-%d" % (REGION, HOUSE)
    d, _ = get_json("https://forevergoblin.trade/api/m/%s/prices" % market)
    items = {}
    # row: [itemId, marketPrice, lowest, quantity, change24h, ?, soldPerDay]
    for row in d["items"]:
        items[row[0]] = {"minBuyout": row[2], "marketValue": row[1], "quantity": row[3],
                         "soldPerDay": row[6] if len(row) > 6 else None}
    return {"source": "Forever Goblin (forevergoblin.trade), from Blizzard's hourly API snapshots",
            "sourceUrl": "https://forevergoblin.trade/about", "houseName": "Horde Auction House",
            "updated": datetime.datetime.fromtimestamp(d["updated"], datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "items": items}

def main():
    cid = os.environ.get("BLIZZARD_CLIENT_ID", "").strip()
    secret = os.environ.get("BLIZZARD_CLIENT_SECRET", "").strip()
    try:
        if cid and secret:
            res = from_blizzard(cid, secret)
        elif os.environ.get("PRICE_FALLBACK", "on").lower() != "off":
            res = from_forevergoblin()
        else:
            print("No Blizzard credentials and fallback is off; nothing to do.")
            return 0
    except (urllib.error.URLError, KeyError, ValueError) as e:
        print("Price fetch failed: %r" % (e,), file=sys.stderr)
        return 1
    items = {}
    for k, v in sorted(res["items"].items(), key=lambda kv: int(kv[0])):
        if not v.get("marketValue"):
            continue
        items[str(k)] = compact_row(v)
    if len(items) < 50:
        print("Only %d priced items; refusing to overwrite prices." % len(items), file=sys.stderr)
        return 1
    out = {
        "schema": 2, "region": REGION.upper(), "ruleset": "Normal" if RULESET == 2 else str(RULESET),
        "faction": "Horde", "house": HOUSE, "houseName": res["houseName"],
        "source": res["source"], "sourceUrl": res["sourceUrl"],
        "updated": res["updated"], "fetched": now_iso(),
        "units": "copper per single item",
        "fields": {"0": "minBuyout (cheapest buyout)", "1": "marketValue (average of the cheapest 15% of units listed)",
                   "2": "quantity (units listed)", "3": "soldPerDay (Forever Goblin only, omitted when unknown)"},
        "items": items,
    }
    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    body = json.dumps(out, separators=(",", ":"))
    with open(os.path.join(ROOT, "data", "prices.json"), "w") as f:
        f.write(body + "\n")
    with open(os.path.join(ROOT, "data", "prices.js"), "w") as f:
        f.write("/* Auction prices snapshot; regenerated by tools/prices/fetch_prices.py */\nwindow.PRICE_DATA = " + body + ";\n")
    print("Wrote %d prices from %s (snapshot %s), %d bytes" % (len(items), res["source"], res["updated"], len(body)))
    return 0

if __name__ == "__main__":
    sys.exit(main())
