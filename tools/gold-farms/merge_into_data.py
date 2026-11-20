#!/usr/bin/env python3
"""Re-aggregate cached ZugZugDB loot by item id and merge into gold-farms-data.js."""
from __future__ import annotations
import json, re
from pathlib import Path

CACHE = Path("/tmp/gf-drops-cache")
TABLES = Path("/workspace/wow-forever-gold3/tools/gold-farms/drop-tables.json")
COIN = Path("/workspace/wow-forever-gold3/tools/gold-farms/coin-drops.json")
DATA = Path("/workspace/wow-forever-gold3/js/gold-farms-data.js")
AGG_OUT = Path("/workspace/wow-forever-gold3/tools/gold-farms/drop-tables-agg.json")

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
    "azshara-thunderhead": [6375, 6377, 6378, 6379, 6380],  # 6376 is Wren Darkspring, not a Thunderhead
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

# Existing rates that are expected items/kill, not a drop chance.
YIELD_PER_KILL = {
    ("barrens-linen-quilboar", 2589),
    ("westfall-linen-jangolode", 2589),
    ("tanaris-dunemaul-mageweave", 4338),
    ("feralas-gordunni-mageweave", 4338),
}

QUEST_IDS = {
    725, 4479, 4480, 4481, 5017, 5018, 5019, 11116,
    12430, 12431, 12432, 12433,  # E'ko family (if present)
}

# Vanilla trade goods and other notable loot worth showing individually.
MAT_IDS = {
    765, 785, 929, 954, 1179, 1205, 1206, 1478, 1707, 1712, 2287, 2318, 2319,
    2447, 2449, 2450, 2589, 2592, 2770, 2771, 2775, 2835, 2836, 2838, 3012, 3182,
    3385, 3404, 3712, 3821, 3857, 3858, 4234, 4235, 4304, 4306, 4337, 4338, 4537,
    4542, 4589, 4599, 4606, 4607, 4608, 4625, 5117, 5637, 5784, 5785, 6359, 6370,
    6371, 7067, 7068, 7069, 7070, 7075, 7076, 7077, 7078, 7079, 7080, 7081, 7082,
    7911, 7912, 7973, 7974, 8146, 8150, 8154, 8165, 8167, 8169, 8170, 8171,
    8831, 8836, 8838, 8839, 8845, 8846, 8948, 8952, 10285, 10286, 10450, 10620,
    11018, 11417, 12202, 12203, 12204, 12205, 12207, 12208, 12359, 12360, 12361,
    12363, 12364, 12365, 12662, 12803, 12804, 12808, 12809, 12811, 13422, 13423,
    13446, 13463, 13464, 13465, 13466, 13467, 13468, 14047, 14227, 14256, 15407,
    15408, 15410, 15412, 15414, 15415, 15416, 15417, 15419, 15422, 17012, 17056,
    19933, 20424, 20520,
    3928, 1710, 6149, 3827, 2455, 2456, 3385, 929, 118, 858, 13443, 13446, 13444,
}

MAT_NAME = re.compile(
    r"(Cloth|Leather|Hide|Scale|Silk|Essence|Elemental |Core of|Heart of Fire|"
    r"Heart of the Wild|Globe of|Breath of|Coal|Meat|Egg|Clam|Feather|Plume|"
    r"Potion|Salt|Soil|Ore|Stone|Crystal|Wicked Claw|Buzzard Wing|Runecloth|"
    r"Felcloth|Mageweave|Rune\b|Enchanted Water|Deeprock|Hippogryph|"
    r"Scorpid|Devilsaur|Warbear|Frostsaber|Ironweb|Shadow Silk|Sandworm|"
    r"Giant Egg|Ham Steak|Moonberry|Morning Glory|King Bolete|Roasted Quail|"
    r"Healing Potion|Mana Potion|Melon Juice|Cornbread|Tel'Abim|Ice Cold Milk|"
    r"Haunch of Meat|Cured Ham|Cave Mold|Black Truffle|Spongy Morel|"
    r"Undamaged|Long Elegant|Vibrant Plume|Turtle Meat|Tender Wolf|Red Wolf|"
    r"Big-mouth Clam|White Spider|Crisp Spider|Thick Spider|Demonic Rune|"
    r"Un'Goro Soil|Heavy Scorpid|Glowing Scorpid|Lifeless Stone|Solid Stone|"
    r"Burning Pitch|Heart of Fire|Core of Earth)",
    re.I,
)

CLASSIC_NOTE = (
    "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). "
    "Not yet confirmed in Forever."
)

def parse_qty(name: str):
    name = re.sub(r"\s*\(classic data\)\s*", "", name or "", flags=re.I).strip()
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
        return None
    m = re.search(r"([\d.]+)", str(s))
    if not m:
        return None
    return float(m.group(1)) / 100.0

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

def load_rows(nid, table):
    rows = []
    for p in sorted(CACHE.glob(f"zz-{table}-{nid}-p*.json")):
        try:
            data = json.loads(p.read_text())
        except Exception:
            continue
        if isinstance(data, list):
            rows.extend(data)
    return rows

def is_quest(row, clean_name):
    nid = row.get("id")
    if nid in QUEST_IDS:
        return True
    n = (row.get("name") or "") + " " + (clean_name or "")
    if re.search(r"\bquest\b", n, re.I):
        return True
    if re.search(r"\bE'ko\b", clean_name or "", re.I):
        return True
    if clean_name in ("Sacred Frostsaber Meat", "A Mangled Journal", "Gnoll Paw",
                      "Heart of Zeal", "Burning Charm", "Thundering Charm", "Cresting Charm"):
        return True
    return False

def is_tbc(item_id):
    return item_id is not None and 21800 <= int(item_id) <= 248999

def npc_item_map(nid, kind, rows):
    """Merge rows for one NPC by item id. Prefer observed % over classic-data %."""
    buckets = {}
    for r in rows:
        raw = r.get("name") or ""
        is_classic = "(classic data)" in raw.lower()
        qty, qmin, qmax, clean = parse_qty(raw)
        if not clean or r.get("id") is None:
            continue
        if is_quest(r, clean):
            continue
        if is_tbc(r.get("id")):
            continue
        rate = parse_rate(r.get("rate"))
        key = int(r["id"])
        cand = {
            "id": key,
            "name": clean,
            "chance": rate,
            "qty": qty,
            "qtyMin": qmin,
            "qtyMax": qmax,
            "vendor": parse_vendor(r.get("value")),
            "kind": kind,
            "classic": is_classic,
            "count": r.get("count"),
        }
        cur = buckets.get(key)
        if cur is None:
            buckets[key] = cand
            continue
        # Prefer a real percentage over a count-only or missing rate.
        def score(x):
            s = 0
            if x["chance"] is not None and x["chance"] > 0:
                s += 4
            if not x["classic"]:
                s += 2
            if x.get("count"):
                s += 1
            return s
        if score(cand) > score(cur):
            # keep vendor if new one lacks it
            if cand["vendor"] is None:
                cand["vendor"] = cur["vendor"]
            buckets[key] = cand
        elif cur["vendor"] is None and cand["vendor"] is not None:
            cur["vendor"] = cand["vendor"]
    # Drop entries that still have no percentage (tiny Forever samples).
    return {k: v for k, v in buckets.items() if v["chance"] is not None and v["chance"] > 0}

def js_num(x):
    if x is None:
        return "null"
    if isinstance(x, bool):
        return "true" if x else "false"
    if isinstance(x, int) or (isinstance(x, float) and abs(x - round(x)) < 1e-9):
        return str(int(round(x)))
    s = f"{x:.6f}".rstrip("0").rstrip(".")
    return s

def js_str(s):
    return json.dumps(s, ensure_ascii=False)

def js_obj(d, indent=4):
    """One-line-ish JS object in insertion order."""
    parts = []
    for k, v in d.items():
        if v is None:
            continue
        if k in ("qtyMin", "qtyMax") and v == 1 and d.get("qty") == 1:
            continue
        if isinstance(v, bool):
            val = "true" if v else "false"
        elif isinstance(v, (int, float)):
            val = js_num(v)
        elif isinstance(v, str):
            val = js_str(v)
        else:
            val = str(v)
        parts.append(f"{k}: {val}")
    return "{ " + ", ".join(parts) + " }"

def format_loot_array(items):
    if len(items) == 1:
        return "[" + js_obj(items[0]) + "]"
    inner = ",\n      ".join(js_obj(it) for it in items)
    return "[\n      " + inner + "\n    ]"

# Load prior meta (spawns, names, money)
tables = json.loads(TABLES.read_text())
coin = {}
if COIN.exists():
    coin = {int(k): v for k, v in json.loads(COIN.read_text()).items()}

# Build per-NPC item maps and farm aggregates
npc_maps = {}
count_only = {}  # nid -> set((kind, id)) seen without a published %
def collect_count_only(nid, kind, rows):
    s = count_only.setdefault(nid, set())
    for r in rows:
        raw = r.get("name") or ""
        qty, qmin, qmax, clean = parse_qty(raw)
        if r.get("id") is None or is_quest(r, clean) or is_tbc(r.get("id")):
            continue
        rate = parse_rate(r.get("rate"))
        if rate is None and r.get("count"):
            s.add((kind, int(r["id"])))

for fid, ids in FARMS.items():
    for nid in ids:
        drows = load_rows(nid, "drops")
        srows = load_rows(nid, "skinning")
        drops = npc_item_map(nid, "drop", drows)
        skins = npc_item_map(nid, "skin", srows)
        collect_count_only(nid, "drop", drows)
        collect_count_only(nid, "skin", srows)
        npc_maps[nid] = list(drops.values()) + list(skins.values())

agg = {}
for fid, ids in FARMS.items():
    farm = tables["farms"][fid]
    npc_meta = {n["id"]: n for n in farm["npcs"]}
    usable, metas = [], []
    for nid in ids:
        if nid not in npc_maps or nid not in npc_meta:
            continue
        if not npc_maps[nid]:
            continue  # empty table (wrong id or no data): omit, do not treat as 0%
        usable.append(nid)
        metas.append(npc_meta[nid])
    if not usable:
        agg[fid] = {"npcs": [], "weighting": "equal", "items": [], "coinPerKill": None,
                    "coinNpcs": 0, "npcCount": 0}
        continue
    if all(m.get("spawns") for m in metas):
        weights = [m["spawns"] for m in metas]
        weighting = "spawns"
    else:
        weights = [1] * len(usable)
        weighting = "equal"
    wsum = sum(weights) or 1
    weight_of = dict(zip(usable, weights))
    # Absence of an item on a usable NPC counts as 0%. A count-only row
    # (item seen, no published %) excludes that NPC from this item's denominator.
    buckets = {}
    seen_npc = {}
    for nid, w in zip(usable, weights):
        for row in npc_maps[nid]:
            key = (row["kind"], row["id"])
            b = buckets.setdefault(key, {
                "id": row["id"], "name": row["name"], "kind": row["kind"],
                "vendor": row.get("vendor"), "qtyMin": row["qtyMin"], "qtyMax": row["qtyMax"],
                "chance_acc": 0.0, "exp_acc": 0.0,
            })
            b["chance_acc"] += row["chance"] * w
            b["exp_acc"] += row["chance"] * row["qty"] * w
            if row.get("vendor") is not None:
                b["vendor"] = row["vendor"]
            b["qtyMin"] = min(b["qtyMin"], row["qtyMin"])
            b["qtyMax"] = max(b["qtyMax"], row["qtyMax"])
            seen_npc.setdefault(key, []).append(nid)
    items = []
    for key, b in buckets.items():
        miss = sum(weight_of[nid] for nid in usable if key in count_only.get(nid, set()))
        den = wsum - miss
        if den <= 0:
            continue
        chance = b["chance_acc"] / den
        exp = b["exp_acc"] / den
        qty = exp / chance if chance else 1
        items.append({
            "id": b["id"],
            "name": b["name"],
            "chance": round(chance, 6),
            "qty": round(qty, 4),
            "qtyMin": b["qtyMin"],
            "qtyMax": b["qtyMax"],
            "vendor": b.get("vendor"),
            "kind": b["kind"],
            "npcCoverage": len(seen_npc[key]),
            "npcTotal": len(usable),
        })
    items.sort(key=lambda x: -x["chance"])
    # coin: spawn-weighted among NPCs that have a Wowhead money figure
    coin_pairs = []
    for nid, w, m in zip(usable, weights, metas):
        c = m.get("money")
        if c is None:
            c = coin.get(nid)
        if c is not None:
            coin_pairs.append((w, c))
    coin_pk = round(sum(w * c for w, c in coin_pairs) / sum(w for w, c in coin_pairs), 2) if coin_pairs else None
    agg[fid] = {
        "npcs": metas,
        "weighting": weighting,
        "items": items,
        "coinPerKill": coin_pk,
        "coinNpcs": len(coin_pairs),
        "npcCount": len(usable),
    }

AGG_OUT.write_text(json.dumps(agg, indent=2))
print("wrote", AGG_OUT, "farms", len(agg))

# Preview bael and SM silk
for fid in ("bael-modan-wool", "scarlet-monastery-silk", "westfall-linen-jangolode",
            "barrens-linen-quilboar", "wetlands-raptors-leather", "azshara-thunderhead"):
    f = agg[fid]
    print(f"\n==== {fid} coin={f['coinPerKill']} weight={f['weighting']}")
    for it in f["items"][:12]:
        print(f"  {it['chance']*100:6.2f}% x{it['qty']} {it['name']} id={it['id']} "
              f"cov={it['npcCoverage']}/{it['npcTotal']} kind={it['kind']}")

# ---------- merge into JS data file ----------
text = DATA.read_text()

# Split farms
prefix, rest = text.split("window.GOLD_FARMS = [", 1)
body, suffix = rest.rsplit("];", 1)
# farms start with '  {\n    id:'
chunks = re.split(r'(?=\n  \{\n    id: )', body)
# first chunk may be leading newline
new_chunks = []

def parse_farm_chunk(chunk):
    m = re.search(r'id: "([^"]+)"', chunk)
    return m.group(1) if m else None

def extract_loot(chunk):
    m = re.search(r'\n    loot: (\[.*?\n    \]|\[[^\n]*\]),', chunk, re.S)
    return m

def parse_existing_loot(loot_js):
    items = []
    for m in re.finditer(
        r'\{\s*id:\s*(\d+)\s*,\s*name:\s*"((?:\\.|[^"\\])*)"([^}]*)\}',
        loot_js,
    ):
        rest = m.group(3)
        item = {"id": int(m.group(1)), "name": m.group(2)}
        cm = re.search(r'chance:\s*([0-9.]+)', rest)
        if cm:
            item["chance"] = float(cm.group(1))
        qm = re.search(r'qty:\s*([0-9.]+)', rest)
        if qm:
            item["qty"] = float(qm.group(1))
        nm = re.search(r'chanceNote:\s*"((?:\\.|[^"\\])*)"', rest)
        if nm:
            item["chanceNote"] = nm.group(1)
        items.append(item)
    return items

def notable(it, existing_ids):
    if it["id"] in existing_ids or it["id"] in MAT_IDS:
        return True
    if MAT_NAME.search(it["name"] or "") and it["chance"] >= 0.01:
        return True
    if it["chance"] >= 0.03 and it.get("vendor"):
        return True
    return False

CITATION = (
    "Classic 1.12 drop and skinning tables from ZugZugDB "
    "(https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever "
    "observations replace them). Coin is Wowhead Classic “average money dropped.” "
    "Rates labeled Forever on an item come from that item’s existing source, not 1.12."
)

unsourced = []
stats = {"with_per_kill_items": 0}

for chunk in chunks:
    if not chunk.strip():
        new_chunks.append(chunk)
        continue
    fid = parse_farm_chunk(chunk)
    if not fid:
        new_chunks.append(chunk)
        continue
    loot_m = extract_loot(chunk)
    if not loot_m:
        new_chunks.append(chunk)
        continue
    existing = parse_existing_loot(loot_m.group(1))
    farm_agg = agg.get(fid)
    by_id = {}
    if farm_agg:
        # if drop and skin share an id, keep both under kind; prefer listing both
        for it in farm_agg["items"]:
            by_id.setdefault(it["id"], it)  # first is highest chance (sorted)
            if it["kind"] == "skin":
                by_id[it["id"]] = it  # prefer skin row name if both? actually keep drop if already, 
        # Better index
        by_id = {}
        for it in farm_agg["items"]:
            by_id.setdefault((it["kind"], it["id"]), it)
            by_id.setdefault(it["id"], it)

    new_loot = []
    used_ids = set()

    def attach_agg(item, src_item, keep_chance=False):
        out = {"id": item["id"], "name": item.get("name") or src_item["name"]}
        if keep_chance:
            out["chance"] = item["chance"]
            if item.get("qty") is not None:
                out["qty"] = item["qty"]
            else:
                out["qty"] = 1
            if item.get("chanceNote"):
                out["chanceNote"] = item["chanceNote"]
            if (fid, item["id"]) in YIELD_PER_KILL:
                out["yieldPerKill"] = True
            if not out.get("chanceNote"):
                out["chanceNote"] = "Rate kept from this camp’s existing Forever or Classic guide source."
        else:
            out["chance"] = src_item["chance"]
            out["qty"] = src_item["qty"]
            if src_item.get("qtyMin") and (src_item["qtyMin"] != src_item.get("qtyMax") or src_item["qty"] != 1):
                out["qtyMin"] = src_item["qtyMin"]
                out["qtyMax"] = src_item["qtyMax"]
            out["chanceNote"] = CLASSIC_NOTE
            if src_item.get("npcCoverage") and src_item["npcCoverage"] < src_item["npcTotal"]:
                out["chanceNote"] += (
                    f" Averaged over {src_item['npcCoverage']} of {src_item['npcTotal']} "
                    "listed mob types that have a published percentage for this item."
                )
        if src_item:
            out["kind"] = src_item.get("kind") or "drop"
            if src_item.get("vendor") is not None:
                out["vendor"] = src_item["vendor"]
        if item["id"] in QUEST_IDS or (item.get("name") in (
            "Burning Charm", "Thundering Charm", "Cresting Charm"
        )):
            out["kind"] = "quest"
        return out

    for item in existing:
        used_ids.add(item["id"])
        src = by_id.get(item["id"]) if by_id else None
        if item.get("chance") is not None:
            new_loot.append(attach_agg(item, src or {}, keep_chance=True))
        elif src:
            new_loot.append(attach_agg(item, src, keep_chance=False))
        else:
            # still list it; no rate
            stub = {"id": item["id"], "name": item["name"]}
            if item["id"] in QUEST_IDS:
                stub["kind"] = "quest"
            new_loot.append(stub)
            if farm_agg is not None or fid in (
                "silithus-firetail", "thousand-needles-vortex", "barrens-pristine-leather"
            ):
                unsourced.append((fid, item["id"], item["name"], "no sourced drop rate"))

    # Special: Firetail Forever rates already written in the sourced note
    if fid == "silithus-firetail":
        for it in new_loot:
            if it["id"] == 15408 and "chance" not in it:
                it["chance"] = 0.75
                it["qty"] = 1
                it["kind"] = "skin"
                it["chanceNote"] = (
                    "Conquest Capped, PvP-realm AH, 15 Nov 2026: 75% Heavy Scorpid Scale. "
                    "Firetail Stinger has no matching 1.12 NPC id (Stonelash Scorpids are a different mob)."
                )
            if it["id"] == 19933 and "chance" not in it:
                it["chance"] = 0.07
                it["qty"] = 1
                it["kind"] = "drop"
                it["chanceNote"] = (
                    "Conquest Capped, 15 Nov 2026: 7% Glowing Scorpid Blood. "
                    "No matching 1.12 Firetail Stinger NPC."
                )
        # remove from unsourced
        unsourced[:] = [u for u in unsourced if not (u[0] == fid and u[1] in (15408, 19933))]

    # Extra notable items from 1.12
    if farm_agg:
        extras = []
        for it in farm_agg["items"]:
            if it["id"] in used_ids:
                continue
            if not notable(it, used_ids):
                continue
            extras.append(attach_agg({"id": it["id"], "name": it["name"]}, it, keep_chance=False))
            used_ids.add(it["id"])
        # keep extras after original notable, still chance-desc already
        new_loot.extend(extras)

        # Vendor trash: everything else with a vendor price
        trash = 0.0
        trash_n = 0
        notable_ids = {it["id"] for it in new_loot}
        for it in farm_agg["items"]:
            if it["id"] in notable_ids:
                continue
            if it["id"] in QUEST_IDS:
                continue
            if not it.get("vendor"):
                continue
            trash += it["chance"] * it["qty"] * it["vendor"]
            trash_n += 1
        vendor_trash = round(trash, 2) if trash_n and trash > 0.05 else (round(trash, 2) if trash else None)
        if vendor_trash is not None and vendor_trash <= 0:
            vendor_trash = None
    else:
        vendor_trash = None

    loot_js = format_loot_array(new_loot)

    extra_fields = []
    if farm_agg and farm_agg.get("coinPerKill") is not None:
        extra_fields.append(f"    coinPerKill: {js_num(farm_agg['coinPerKill'])},")
        who = "spawn-weighted" if farm_agg["weighting"] == "spawns" else "equal-weighted"
        extra_fields.append(
            "    coinNote: " + js_str(
                f"Wowhead Classic “average money dropped,” {who} across "
                f"{farm_agg['coinNpcs']} of {farm_agg['npcCount']} listed mob types that have a published coin drop."
            ) + ","
        )
    if farm_agg:
        if vendor_trash:
            extra_fields.append(f"    vendorTrashPerKill: {js_num(vendor_trash)},")
            extra_fields.append(
                "    vendorTrashNote: " + js_str(
                    "Expected vendor value of grey and other unsold drops from the same 1.12 tables, "
                    "excluding the items listed above and quest items."
                ) + ","
            )
        npc_names = ", ".join(
            f"{n['name']} ({n['id']})" for n in farm_agg["npcs"]
        )
        extra_fields.append("    dropSource: {")
        extra_fields.append("      citation: " + js_str(CITATION) + ",")
        extra_fields.append("      url: \"https://zugzugdb.com/about\",")
        extra_fields.append("      coinUrl: \"https://www.wowhead.com/classic/\",")
        extra_fields.append("      weighting: " + js_str(farm_agg["weighting"]) + ",")
        extra_fields.append("      npcs: " + js_str(npc_names))
        extra_fields.append("    },")

    extra_block = (("\n" + "\n".join(extra_fields)) if extra_fields else "") + "\n"
    new_loot_block = f"\n    loot: {loot_js},{extra_block}"
    chunk = chunk[:loot_m.start()] + new_loot_block + chunk[loot_m.end():]

    # Bael note: document 1.12 calculation vs small beta samples
    if fid == "bael-modan-wool":
        chunk = chunk.replace(
            'note: "theforeverguides (beta logs): Bael\'dun Officers dropped Wool on 49% of 35 logged kills and Bael\'dun Excavators on 47% of 59. Small beta samples. They recommend Wool and Medium Leather as the level-20 farm."',
            'note: "Per-kill gold uses Classic 1.12 world data (ZugZugDB / VMaNGOS), spawn-weighted across the five Bael\'dun types at Bael Modan. Wool is 24.36% for 1–2 cloth (expected 0.365/kill), plus Linen, Silk, coin, and vendor trash. theforeverguides beta logs (Officers 49% of 35, Excavators 47% of 59) were smaller samples and were not used for the calculation."'
        )
        if "zugzugdb.com/about" not in chunk:
            chunk = chunk.replace(
                '    sources: [\n      { title: "WoW Forever Gold Farming by Level: 1–60 Brackets", url: "https://theforeverguides.com/gold-making/gold-by-level/", date: "2026-11-04", site: "theforeverguides" }\n    ]',
                '    sources: [\n'
                '      { title: "WoW Forever Gold Farming by Level: 1–60 Brackets", url: "https://theforeverguides.com/gold-making/gold-by-level/", date: "2026-11-04", site: "theforeverguides" },\n'
                '      { title: "ZugZugDB — about the 1.12 world data", url: "https://zugzugdb.com/about", date: "2026-11-20", site: "ZugZugDB" },\n'
                '      { title: "Wowhead Classic NPC money drops (e.g. Bael\'dun Officer)", url: "https://www.wowhead.com/classic/npc=3378", date: "2026-11-20", site: "Wowhead Classic" }\n'
                '    ]'
            )
        chunk = chunk.replace(
            'risk: "Beta sample sizes are small. Tag is Classic-era / beta, likely applies."',
            'risk: "Drop rates are Classic 1.12 world data, not a published Forever table. Tag is Classic-era, likely applies."'
        )

    if fid == "epl-water-elementals":
        # Note 8521 is Blighted Horror, not Plague Monstrosity
        if "Blighted Horror" not in chunk:
            chunk = chunk.replace(
                'loc: ',
                'loc: ',
            )  # no-op placeholder; loc rewrite below if we can find it

    if any(it.get("chance") is not None for it in new_loot) or (farm_agg and farm_agg.get("coinPerKill")):
        stats["with_per_kill_items"] += 1

    new_chunks.append(chunk)

# EPL loc note: read after write if needed

# Update META disclaimer
new_prefix = prefix
old_disc = 'disclaimer: "Gold per hour moves with the Auction House and with how fast you can pull. Sourced figures are snapshots, not promises. Live values are computed from current AH prices and the drop rates a source listed."'
new_disc = 'disclaimer: "Gold per hour and gold per kill move with the Auction House. Per-kill figures use sourced drop chances × average stack size × this site’s current US Normal Horde AH market value, plus a sourced coin drop and grey vendor value when those exist. Gold/hour is shown when a source also published a kills/hour figure. Sourced snapshots are not promises. Nothing here is invented."'
if old_disc in new_prefix:
    new_prefix = new_prefix.replace(old_disc, new_disc)
else:
    print("WARN: disclaimer not found")

new_text = new_prefix + "window.GOLD_FARMS = [" + "".join(new_chunks) + "];" + suffix
DATA.write_text(new_text)
print("updated", DATA, "bytes", len(new_text))
print("farms with some per-kill component in this pass:", stats["with_per_kill_items"])
print("unsourced leftovers:")
for u in unsourced:
    print(" ", u)
