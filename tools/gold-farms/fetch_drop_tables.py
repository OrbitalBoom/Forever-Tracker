#!/usr/bin/env python3
"""Fetch Classic 1.12 loot tables (ZugZugDB / VMaNGOS world data) and Wowhead
average coin drops for gold-farm NPCs. Cached under /tmp/gf-drops-cache."""
from __future__ import annotations
import html as htmlmod
import json, re, time, subprocess
from pathlib import Path

CACHE = Path("/tmp/gf-drops-cache")
CACHE.mkdir(exist_ok=True)
OUT = Path("/workspace/wow-forever-gold3/tools/gold-farms/drop-tables.json")
SLEEP = 0.28

FARMS = {
    "bael-modan-wool": [3374, 3375, 3376, 3377, 3378],
    "barrens-linen-quilboar": [3265, 3266, 3267, 3268, 3269, 3271, 3272, 3273, 3274, 3275, 3397],
    "westfall-linen-jangolode": [117, 123, 124, 500, 501, 1065, 1426],
    "arathi-burning-exiles": [2760],
    "arathi-thundering-exiles": [2762],
    "arathi-cresting-exiles": [2761],
    "hinterlands-owlbeasts": [2927, 2928, 2929],
    "tanaris-rocs": [5428, 5429, 5430],
    "badlands-rock-elementals": [92, 2735, 2736, 2791],
    "tanaris-steeljaw": [14123],
    "dustwallow-mudrock": [4396, 4397, 4398, 4399, 4400],
    "feralas-longtooth": [5286, 5287],
    "tanaris-dunemaul-mageweave": [5471, 5472, 5473, 5474, 5475],
    "feralas-gordunni-mageweave": [5229, 5232, 5234, 5236, 5237],
    "thousand-needles-sparkleshell": [4142, 4143, 4144],
    "wpl-venom-mist-lurkers": [1822],
    "azshara-thunderhead": [6375, 6376, 6377, 6378, 6379, 6380],
    "searing-gorge-lava-spiders": [5857, 5858],
    "tanaris-glasshide": [5421],
    "silithus-cyclone-warriors": [11745],
    "silithus-dredge-crushers": [11741],
    "ungoro-scorching-elementals": [6520, 6521],
    "silithus-desert-ragers": [11746, 11747],
    "epl-water-elementals": [8520, 8521],
    "deadwind-runecloth": [7369, 7371, 7372, 7379],
    "blasted-lands-felguards": [6011],
    "scarlet-monastery-silk": [4293, 4308, 4286, 4287, 4288, 4290, 4295, 4296, 4297, 4298, 4299, 4300, 4540],
    "maraudon-orange-purple": [11790, 11791, 11792, 12219, 12220, 11793, 11794],
    "ungoro-devilsaurs": [6498, 6499, 6500],
    "winterspring-frostsabers": [7431, 7432, 7433, 7434],
    "wpl-diseased-bears": [1815, 1816],
    "ungoro-ravasaurs": [6505, 6506, 6507],
    "wetlands-raptors-leather": [1020, 1021, 1022, 1023],
}

def fetch(url: str, cache_name: str) -> str:
    p = CACHE / cache_name
    if p.exists() and p.stat().st_size > 10:
        data = p.read_bytes()
        if cache_name.endswith(".json") and data.lstrip()[:1] not in (b"{", b"["):
            p.unlink()
        else:
            return data.decode("utf-8", "replace")
    time.sleep(SLEEP)
    r = subprocess.run(
        ["curl", "-sL", "-A", "Mozilla/5.0 (compatible; ForeverTracker/1.0)",
         "--max-time", "30", url],
        capture_output=True, check=False,
    )
    data = r.stdout or b""
    if data:
        p.write_bytes(data)
    return data.decode("utf-8", "replace")

def canonical_npc(page_html: str, nid: int) -> str:
    m = re.search(r'rel="canonical" href="(https://zugzugdb.com/npc/[^"]+)"', page_html)
    if m:
        return m.group(1)
    return f"https://zugzugdb.com/n/{nid}"

def parse_qty(name: str):
    m = re.search(r"x(\d+)\s*-\s*(\d+)\s*$", name)
    if m:
        a, b = int(m.group(1)), int(m.group(2))
        return (a + b) / 2.0, a, b, re.sub(r"\s*x\d+\s*-\s*\d+\s*$", "", name).strip()
    m = re.search(r"x(\d+)\s*$", name)
    if m:
        n = int(m.group(1))
        return float(n), n, n, re.sub(r"\s*x\d+\s*$", "", name).strip()
    return 1.0, 1, 1, name.strip()

def parse_rate(s):
    if not s:
        return 0.0
    m = re.search(r"([\d.]+)", str(s))
    return float(m.group(1)) / 100.0 if m else 0.0

def parse_vendor(s):
    if not s:
        return None
    s = str(s).lower().replace(",", "")
    g = re.search(r"(\d+)\s*g", s)
    si = re.search(r"(\d+)\s*s", s)
    c = re.search(r"(\d+)\s*c", s)
    if not (g or si or c):
        return None
    return ((int(g.group(1)) if g else 0) * 10000
            + (int(si.group(1)) if si else 0) * 100
            + (int(c.group(1)) if c else 0))

def npc_meta(nid: int):
    page = fetch(f"https://zugzugdb.com/n/{nid}", f"zz-html-{nid}.html")
    title = re.search(r"<title>([^<]+)</title>", page)
    title = htmlmod.unescape(title.group(1) if title else "")
    name = title.split(":")[0].strip() if title else f"NPC {nid}"
    if (not page) or "Not Found" in title or "Page not found" in page[:500]:
        return {"id": nid, "ok": False, "name": name, "title": title, "canonical": None}
    sp = re.search(r"(\d+)\s+spawn points", page, re.I)
    zone = re.search(r"Found in ([^<]+)", page)
    lvl = re.search(r"Level\s+([0-9\-]+)", page)
    can = canonical_npc(page, nid)
    return {
        "id": nid, "ok": True, "name": name, "title": title,
        "spawns": int(sp.group(1)) if sp else None,
        "zone": htmlmod.unescape(zone.group(1).strip()) if zone else None,
        "level": lvl.group(1) if lvl else None,
        "url": can,
        "canonical": can,
    }

def loot_table(nid: int, table: str, base: str):
    rows = []
    page_key = "drops-page" if table == "drops" else f"{table}-page"
    page = 1
    while page <= 16:
        raw = fetch(
            f"{base}?format=json&table={table}&{page_key}={page}",
            f"zz-{table}-{nid}-p{page}.json",
        )
        if not raw or raw.strip() in ("", "[]", "{}"):
            break
        try:
            data = json.loads(raw)
        except Exception:
            print("  bad json", nid, table, page, raw[:60])
            break
        if not isinstance(data, list) or not data:
            break
        if page > 1 and rows and data[0].get("id") == rows[0].get("id") and data[0].get("name") == rows[0].get("name"):
            break
        rows.extend(data)
        if len(data) < 50:
            break
        page += 1
    return rows

def wowhead_money(nid: int):
    html = fetch(f"https://www.wowhead.com/classic/npc={nid}", f"wh-html-{nid}.html")
    m = re.search(r"\[money=(\d+)\]", html)
    title = re.search(r"<title>([^<]+)</title>", html)
    title = htmlmod.unescape(title.group(1)) if title else ""
    return {
        "copper": int(m.group(1)) if m else None,
        "title": title,
        "url": f"https://www.wowhead.com/classic/npc={nid}",
    }

def normalize_rows(rows, kind):
    out = []
    for r in rows:
        name = r.get("name") or ""
        if "quest" in name.lower():
            continue
        qty, qmin, qmax, clean = parse_qty(name)
        rate = parse_rate(r.get("rate"))
        if rate <= 0:
            continue
        out.append({
            "id": r.get("id"),
            "name": clean,
            "chance": rate,
            "qty": qty,
            "qtyMin": qmin,
            "qtyMax": qmax,
            "vendor": parse_vendor(r.get("value")),
            "kind": kind,
        })
    return out

def aggregate(farm_id, npc_ids, npc_data):
    usable = [npc_data[i] for i in npc_ids if npc_data[i]["meta"].get("ok")]
    if not usable:
        return {"farm": farm_id, "npcs": [], "error": "no verified NPCs"}
    if all(n["meta"].get("spawns") for n in usable):
        weights = [n["meta"]["spawns"] for n in usable]
        weighting = "spawns"
    else:
        weights = [1] * len(usable)
        weighting = "equal"
    wsum = sum(weights)
    bucket = {}
    for n, w in zip(usable, weights):
        for row in n["drops"] + n["skins"]:
            key = (row["kind"], row["id"], row["name"])
            b = bucket.setdefault(key, {**row, "chance": 0.0, "qty_acc": 0.0, "w": 0})
            b["chance"] += row["chance"] * w
            b["qty_acc"] += row["qty"] * w
            b["w"] += w
            if row.get("vendor") is not None:
                b["vendor"] = row["vendor"]
    items = []
    for b in bucket.values():
        items.append({
            "id": b["id"],
            "name": b["name"],
            "chance": round(b["chance"] / wsum, 6),
            "qty": round(b["qty_acc"] / b["w"], 4),
            "qtyMin": b["qtyMin"],
            "qtyMax": b["qtyMax"],
            "vendor": b.get("vendor"),
            "kind": b["kind"],
        })
    items.sort(key=lambda x: -x["chance"])
    coin_pairs = [(w, n["money"]["copper"]) for n, w in zip(usable, weights) if n["money"].get("copper") is not None]
    coin = round(sum(w * c for w, c in coin_pairs) / sum(w for w, c in coin_pairs), 2) if coin_pairs else None
    return {
        "farm": farm_id,
        "npcs": [{
            "id": n["meta"]["id"], "name": n["meta"]["name"],
            "spawns": n["meta"].get("spawns"), "level": n["meta"].get("level"),
            "zone": n["meta"].get("zone"), "url": n["meta"].get("url"),
            "money": n["money"].get("copper"),
        } for n in usable],
        "weighting": weighting,
        "items": items,
        "coinPerKill": coin,
        "coinSource": "Wowhead Classic, 'average money dropped'" if coin is not None else None,
        "lootSource": "ZugZugDB, Classic patch 1.12 world data (VMaNGOS), not yet confirmed in Forever",
        "lootSourceUrl": "https://zugzugdb.com/about",
        "retrieved": "2026-11-20",
    }

def main():
    all_ids = sorted({i for ids in FARMS.values() for i in ids})
    print("NPCs to fetch", len(all_ids), "farms", len(FARMS), flush=True)
    npc_data = {}
    for i, nid in enumerate(all_ids, 1):
        print(f"[{i}/{len(all_ids)}] NPC {nid}", flush=True)
        meta = npc_meta(nid)
        base = meta.get("canonical") or f"https://zugzugdb.com/n/{nid}"
        drops = normalize_rows(loot_table(nid, "drops", base), "drop") if meta.get("ok") else []
        skins = normalize_rows(loot_table(nid, "skinning", base), "skin") if meta.get("ok") else []
        money = wowhead_money(nid)
        npc_data[nid] = {"meta": meta, "drops": drops, "skins": skins, "money": money}
        print("   ", meta.get("name"), "ok", meta.get("ok"),
              "drops", len(drops), "skins", len(skins), "money", money.get("copper"), flush=True)

    farms = {}
    for fid, ids in FARMS.items():
        farms[fid] = aggregate(fid, ids, npc_data)
        print(f"{fid}: items={len(farms[fid].get('items') or [])} coin={farms[fid].get('coinPerKill')} npcs={len(farms[fid].get('npcs') or [])}", flush=True)

    out = {
        "source": "ZugZugDB 1.12 world data + Wowhead Classic money",
        "date": "2026-11-20",
        "farms": farms,
        "npcs": {str(k): {**v["meta"], "money": v["money"], "dropCount": len(v["drops"]), "skinCount": len(v["skins"])} for k, v in npc_data.items()},
    }
    OUT.write_text(json.dumps(out, indent=2))
    print("wrote", OUT, "bytes", OUT.stat().st_size)

if __name__ == "__main__":
    main()
