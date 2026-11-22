#!/usr/bin/env python3
"""Build the Forever Tracker item database (search index, detail chunks, gear list).

Sources (see tools/items/README.md):
  - wago.tools DB2 ItemSparse + Item (live WoW: Forever client)
  - zmarotrix/NorgannonDB items, npcs, objects, quests, recipes, world (GPL-3.0)
  - existing js/professions-data.js (LibProfessionDB + wago, Forever recipes)
  - js/items.js starter set, if present (Napalmsteak/Wowhead Classic tooltips) for stats
  - optional CMaNGOS classic-db item_template (GPL-3.0) for Classic-reference stats

Does not invent stats, drop rates, or prices. Amounts and chances are copied from
those sources and tagged Forever-confirmed or Classic-reference.

Usage:
  python3 tools/items/build_items.py [site_root]
Env:
  ITEM_SRC   directory with downloaded sources (default: tools/items/cache, then /tmp/item-db-src)
"""
from __future__ import annotations

import csv, gzip, json, os, re, sys, time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[2]).resolve()
TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "tools"))
from norgannondb import _Parser, load_records, load_zone_names, load_info  # noqa: E402

def find_src() -> Path:
    env = os.environ.get("ITEM_SRC")
    for p in [Path(env) if env else None, TOOLS / "cache", Path("/tmp/item-db-src")]:
        if p and (p / "ItemSparse.csv").exists():
            return p
        if p and (p / "norgannon" / "items.lua").exists() and (p.parent / "ItemSparse.csv").exists():
            return p.parent
    # norgannon nested
    for p in [Path(env) if env else None, TOOLS / "cache", Path("/tmp/item-db-src")]:
        if p and ((p / "ItemSparse.csv").exists() or (p / "norgannon" / "items.lua").exists()):
            return p
    raise SystemExit("No item sources found. See tools/items/README.md (set ITEM_SRC).")

SRC = find_src()
NOR = SRC / "norgannon" if (SRC / "norgannon").is_dir() else SRC
OUT = ROOT / "data" / "items"
CHUNK_SIZE = 800
MAX_DROPS = 10
MAX_VENDORS = 8
MAX_RECIPES = 24
MAX_QUESTS = 12

QNAME = {0: "poor", 1: "common", 2: "uncommon", 3: "rare", 4: "epic", 5: "legendary", 6: "artifact", 7: "heirloom"}
INV_TO_SLOT = {
    1: ("head", "Head"), 2: ("neck", "Neck"), 3: ("shoulder", "Shoulder"),
    4: ("shirt", "Shirt"), 5: ("chest", "Chest"), 6: ("waist", "Waist"),
    7: ("legs", "Legs"), 8: ("feet", "Feet"), 9: ("wrist", "Wrist"),
    10: ("hands", "Hands"), 11: ("finger", "Finger"), 12: ("trinket", "Trinket"),
    13: ("onehand", "One-Hand"), 14: ("offhand", "Off Hand"), 15: ("ranged", "Ranged"),
    16: ("back", "Back"), 17: ("twohand", "Two-Hand"), 20: ("chest", "Chest"),
    21: ("mainhand", "Main Hand"), 22: ("offhand", "Off Hand"), 23: ("offhand", "Held In Off-hand"),
    25: ("ranged", "Thrown"), 26: ("ranged", "Ranged"), 28: ("relic", "Relic"),
}
# Item class 2 (weapon) subclass -> site type
WEAPON_SUB = {
    0: "axe", 1: "axe", 2: "bow", 3: "gun", 4: "mace", 5: "mace", 6: "polearm",
    7: "sword", 8: "sword", 10: "staff", 13: "fist", 14: "misc", 15: "dagger",
    16: "thrown", 17: "thrown", 18: "crossbow", 19: "wand", 20: "fishingpole",
}
# Item class 4 (armor) subclass
ARMOR_SUB = {0: "misc", 1: "cloth", 2: "leather", 3: "mail", 4: "plate", 5: "misc", 6: "shield", 7: "libram", 8: "idol", 9: "totem"}
CONSUMABLE_SUB = {
    0: "explosives", 1: "potion", 2: "elixir", 3: "flask", 4: "scroll",
    5: "food", 6: "permanent", 7: "bandage", 8: "other",
}
TRADE_SUB = {
    0: "trade", 1: "parts", 2: "explosives", 3: "devices", 4: "jewelcrafting",
    5: "cloth", 6: "leather", 7: "metal", 8: "meat", 9: "herb", 10: "elemental",
    11: "other", 12: "enchanting", 13: "materials",
}
SKILL_NAME = {
    129: "First Aid", 164: "Blacksmithing", 165: "Leatherworking", 171: "Alchemy",
    182: "Herbalism", 185: "Cooking", 186: "Mining", 197: "Tailoring",
    202: "Engineering", 333: "Enchanting", 356: "Fishing", 393: "Skinning",
}
# Vanilla item_template / tooltip stat ids used in this project
STAT_KEY = {
    1: "health", 3: "agi", 4: "str", 5: "int", 6: "spi", 7: "sta",
    12: "defense", 13: "dodge", 14: "parry", 15: "blockChance",
    16: "hit", 17: "hit", 18: "spellHit", 19: "crit", 20: "crit", 21: "spellCrit",
    22: "hit", 23: "spellCrit",
    31: "hit", 32: "crit",
    38: "ap", 39: "rap", 40: "fap", 41: "healing", 42: "sp", 43: "mp5",
    44: "arp", 45: "sp", 46: "hp5", 47: "spellPen", 48: "blockValue",
    51: "fireRes", 52: "frostRes", 53: "holyRes", 54: "shadowRes", 55: "natureRes", 56: "arcaneRes",
}
SKIP_NAME_RE = re.compile(
    r"^(OLD|UNUSED|Deprecated|Monster -|Hidden |Transmog |WoW Token|Failsafe Test|Gamemaster )",
    re.I,
)
SKIP_NAME_IN = re.compile(r"\b(DEPRECATED|UNUSED|NYI|TEST ITEM|GAMEMASTER)\b", re.I)
GEAR_INV = set(INV_TO_SLOT)

ATTUNE_HINT = re.compile(r"attune|attunement", re.I)
SKIP_NPC_NAME = re.compile(r"dummy|image of |training dummy", re.I)
# Well-known key / attunement item IDs already documented in this repo's goals / Classic + Forever.
KNOWN_KEYS = {
    7146: "The Scarlet Key — opens the Armory and Cathedral in Scarlet Monastery.",
    13704: "Skeleton Key — Key to Scholomance (Western Plaguelands quest chain).",
    12344: "Seal of Ascension — opens Upper Blackrock Spire.",
    18249: "Crescent Key — dropped by Pusillin; unlocks the rest of Dire Maul.",
    16309: "Drakefire Amulet — Onyxia attunement (alliance / horde quests).",
    20949: "Magical Ledger — starts a section of the Onyxia attunement chain.",
    21111: "Draconic for Dummies — Onyxia / Nefarian related.",
    18987: "Blackhand's Command — starts the UBRS / rend attunement path.",
    22057: "Brazier of Invocation — Scholomance / Spectral Essence related.",
    13523: "Blood of Innocents — used in the Scholomance key / Kirtonos chain.",
    13536: "Horn of Awakening — related to the Scholomance key quests.",
}


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def iint(v, default=0):
    try:
        if v is None or v == "":
            return default
        return int(float(v))
    except (TypeError, ValueError):
        return default


def load_csv_by_id(path: Path) -> dict:
    out = {}
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            out[int(row["ID"])] = row
    return out


def load_wow_items() -> dict:
    candidates = [
        SRC / "wow-classic-tooltips.js",
        TOOLS / "wow-classic-tooltips.js",
        TOOLS / "cache" / "wow-classic-tooltips.js",
        Path("/tmp/item-db-src/wow-classic-tooltips.js"),
        ROOT / "js" / "items.js",
    ]
    path = next((p for p in candidates if p.exists() and p.stat().st_size > 10000), None)
    if not path:
        return {}
    t = path.read_text(encoding="utf-8")
    if "window.WOW_ITEMS" not in t:
        return {}
    m = re.search(r"window\.WOW_ITEMS\s*=\s*(\[.*\]);?\s*$", t, re.S)
    if not m:
        return {}
    items = json.loads(m.group(1))
    return {it["id"]: it for it in items if isinstance(it, dict) and "id" in it}


def load_prof_data() -> dict:
    path = ROOT / "js" / "professions-data.js"
    t = path.read_text(encoding="utf-8")
    s = t[t.index("{"): t.rstrip().rindex("}") + 1]
    return json.loads(s)


def parse_lua_assign(path: Path, assign: str):
    t = path.read_text(encoding="utf-8")
    m = re.search(re.escape(assign) + r"\s*=\s*(\{)", t)
    if not m:
        raise ValueError("no assignment " + assign + " in " + str(path))
    return _Parser(t[m.start(1):]).value()


def classic_stat_map(template: dict) -> dict:
    stats = {}
    for n in range(1, 11):
        typ = iint(template.get(f"stat_type{n}"))
        val = iint(template.get(f"stat_value{n}"))
        if typ and val and typ in STAT_KEY:
            k = STAT_KEY[typ]
            stats[k] = stats.get(k, 0) + val
    armor = iint(template.get("armor"))
    if armor:
        stats["armor"] = armor
    for col, key in (
        ("holy_res", "holyRes"), ("fire_res", "fireRes"), ("nature_res", "natureRes"),
        ("frost_res", "frostRes"), ("shadow_res", "shadowRes"), ("arcane_res", "arcaneRes"),
    ):
        v = iint(template.get(col))
        if v:
            stats[key] = v
    return stats


def classic_weapon(template: dict, delay_ms_fallback=None) -> dict | None:
    dmin = float(template.get("dmg_min1") or 0)
    dmax = float(template.get("dmg_max1") or 0)
    delay = iint(template.get("delay")) or iint(delay_ms_fallback) or 0
    if dmin <= 0 and dmax <= 0:
        return None
    speed = (delay / 1000.0) if delay else None
    dps = None
    if speed and speed > 0:
        dps = round(((dmin + dmax) / 2.0) / speed, 2)
    w = {"min": int(round(dmin)), "max": int(round(dmax))}
    if speed:
        w["speed"] = round(speed, 2)
    if dps is not None:
        w["dps"] = dps
    return w


def extract_item_template(gz_path: Path) -> dict:
    """Parse CMaNGOS item_template from the Full_DB gzip SQL."""
    cols = []
    collecting = False
    inserts = []
    with gzip.open(gz_path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith("CREATE TABLE `item_template`"):
                collecting = True
                cols = []
                continue
            if collecting:
                m = re.match(r"\s+`([^`]+)`", line)
                if m:
                    cols.append(m.group(1))
                if line.startswith(")") or line.startswith(") "):
                    collecting = False
                continue
            if "INSERT INTO `item_template`" in line:
                inserts.append(line)
                # multi-line inserts: keep reading until semicolon at end
                if not line.rstrip().endswith(";"):
                    for cont in f:
                        inserts[-1] += cont
                        if cont.rstrip().endswith(";"):
                            break
    if not cols or not inserts:
        print("warn: no item_template in", gz_path)
        return {}
    out = {}
    for blob in inserts:
        i = blob.find("VALUES")
        if i < 0:
            continue
        rows = _parse_sql_values(blob[i + 6:])
        for row in rows:
            if len(row) < len(cols):
                continue
            rec = {cols[j]: row[j] for j in range(len(cols))}
            try:
                out[int(rec["entry"])] = rec
            except (TypeError, ValueError, KeyError):
                continue
    return out


def _parse_sql_values(s: str):
    rows = []
    i, n = 0, len(s)
    while i < n:
        while i < n and s[i] in " \t\r\n,":
            i += 1
        if i >= n or s[i] == ";":
            break
        if s[i] != "(":
            i += 1
            continue
        i += 1
        row = []
        while i < n:
            while i < n and s[i] in " \t\r\n":
                i += 1
            if i < n and s[i] == ")":
                i += 1
                rows.append(row)
                break
            if i < n and s[i] == "'":
                i += 1
                buf = []
                while i < n:
                    if s[i] == "\\" and i + 1 < n:
                        buf.append(s[i + 1]); i += 2
                        continue
                    if s[i] == "'":
                        if i + 1 < n and s[i + 1] == "'":
                            buf.append("'"); i += 2
                            continue
                        i += 1
                        break
                    buf.append(s[i]); i += 1
                row.append("".join(buf))
            else:
                j = i
                while i < n and s[i] not in ",)":
                    i += 1
                tok = s[j:i].strip()
                row.append(None if tok.upper() == "NULL" else tok)
            while i < n and s[i] in " \t\r\n":
                i += 1
            if i < n and s[i] == ",":
                i += 1
    return rows


def item_type(class_id: int, sub: int, inv: int) -> str:
    if class_id == 2:
        return WEAPON_SUB.get(sub, "misc")
    if class_id == 4:
        if inv == 23:
            return "held"
        if inv == 16:
            return "cloth" if sub == 1 else ARMOR_SUB.get(sub, "misc")
        return ARMOR_SUB.get(sub, "misc")
    if class_id == 0:
        return CONSUMABLE_SUB.get(sub, "consumable")
    if class_id == 7:
        return TRADE_SUB.get(sub, "trade")
    if class_id == 5:
        return "reagent"
    if class_id == 9:
        return "recipe"
    if class_id == 12:
        return "quest"
    if class_id == 13:
        return "key"
    if class_id == 15:
        return "misc"
    if class_id == 6:
        return "ammo"
    return "misc"


def category(class_id: int, inv: int, typ: str, name: str, is_key=False) -> str:
    if is_key or class_id in (12, 13) or typ in ("quest", "key"):
        if inv in GEAR_INV and typ not in ("quest", "key", "misc", "recipe"):
            return "gear"
        return "quest"
    if inv in GEAR_INV and class_id in (2, 4):
        return "gear"
    if class_id == 0:
        return "consumable"
    if class_id in (5, 7):
        return "reagent"
    if typ in ("herb", "ore", "leather", "cloth", "elemental", "meat", "enchanting", "metal", "parts"):
        return "reagent"
    if typ == "recipe":
        return "reagent"
    return "other"


def skip_name(name: str) -> bool:
    if not name or not name.strip():
        return True
    if SKIP_NAME_RE.search(name) or SKIP_NAME_IN.search(name):
        return True
    if re.search(r"\[PH\]|\(Test\)|\(TEST\)|<PH>|\bTODO\b", name):
        return True
    return False


def notable_white(q: int, inv: int, class_id: int, req: int, ilvl: int, typ: str) -> bool:
    """Quality 1 equippable pieces worth keeping for early slots, plus all reagents/consumables/quest."""
    if q >= 2:
        return True
    if class_id in (0, 5, 7, 9, 12, 13):
        return q >= 1 or class_id in (7, 5, 12, 13)  # greys usually skipped except some trade? no, skip poor
    if q != 1:
        return False
    if inv in GEAR_INV and class_id in (2, 4):
        # early whites and anything required at or below 20, or ilvl <= 25
        return req <= 20 or ilvl <= 25 or req == 0
    return False


def source_summary(detail: dict) -> tuple[str, str]:
    """Return (source text, sourceType) for the upgrade card."""
    crafted = detail.get("crafted") or []
    if crafted:
        profs = sorted({c["prof"] for c in crafted if c.get("prof")})
        return (("Crafted: " + ", ".join(profs)) if profs else "Crafted", "craft")
    vendors = detail.get("vendors") or []
    if vendors:
        v = vendors[0]
        bits = [v.get("name") or "Vendor"]
        if v.get("zone"):
            bits.append("in " + v["zone"])
        if v.get("price"):
            bits.append("(" + format_copper(v["price"]) + ")")
        return ("Vendor: " + " ".join(bits), "vendor")
    drops = detail.get("drops") or []
    if drops:
        d = drops[0]
        who = d.get("name") or "Unknown"
        loc = (" — " + d["zone"]) if d.get("zone") else ""
        ch = d.get("chance")
        pct = f" ({ch}%)" if isinstance(ch, (int, float)) and ch > 0 else ""
        kind = d.get("kind") or "drop"
        prefix = "Herb/ore node: " if kind == "object" else "Dropped by "
        return (prefix + who + loc + pct, "drop")
    qrew = [q for q in (detail.get("questRewards") or [])]
    if qrew:
        return ("Quest reward: " + qrew[0]["name"], "quest")
    return ("", "")


def format_copper(c: int) -> str:
    c = int(c)
    g, rem = divmod(c, 10000)
    s, c = divmod(rem, 100)
    parts = []
    if g:
        parts.append(f"{g}g")
    if s:
        parts.append(f"{s}s")
    if c or not parts:
        parts.append(f"{c}c")
    return " ".join(parts)


def js_assign(var: str, obj, header: str) -> str:
    return header + "\nwindow." + var + " = " + json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + ";\n"


def bind_label(b: int) -> str | None:
    return {1: "bop", 2: "boe", 3: "bou", 4: "quest"}.get(b)


def main():
    t0 = time.time()
    print("sources in", SRC)
    sparse_path = SRC / "ItemSparse.csv"
    item_path = SRC / "Item.csv"
    if not sparse_path.exists() or not item_path.exists():
        raise SystemExit("Need ItemSparse.csv and Item.csv in " + str(SRC))

    print("loading ItemSparse / Item")
    sparse = load_csv_by_id(sparse_path)
    item_rows = load_csv_by_id(item_path)
    build_id = os.environ.get("WAGO_BUILD", "1.60.1.71037")

    wow_items = load_wow_items()
    print("WOW_ITEMS stats cache", len(wow_items))

    prof = load_prof_data()
    print("PROF_DATA items", len(prof.get("items") or {}), "professions", len(prof.get("professions") or {}))

    n_info = {}
    if (NOR / "info.lua").exists():
        n_info = load_info(NOR / "info.lua")
    print("loading Norgannon items/npcs/objects/quests/recipes")
    n_items = load_records(NOR / "items.lua") if (NOR / "items.lua").exists() else {}
    n_npcs = load_records(NOR / "npcs.lua") if (NOR / "npcs.lua").exists() else {}
    n_objs = load_records(NOR / "objects.lua") if (NOR / "objects.lua").exists() else {}
    n_quests = load_records(NOR / "quests.lua") if (NOR / "quests.lua").exists() else {}
    n_recipes = {}
    if (NOR / "recipes.lua").exists():
        n_recipes = parse_lua_assign(NOR / "recipes.lua", "NorgannonDB.recipes")
    zones = {}
    if (NOR / "world.lua").exists():
        zones = load_zone_names(NOR / "world.lua")
    print("  items", len(n_items), "npcs", len(n_npcs), "objects", len(n_objs),
          "quests", len(n_quests), "recipes", len(n_recipes), "zones", len(zones))

    cmangos = {}
    gz = SRC / "cmangos" / "ClassicDB.sql.gz"
    if not gz.exists():
        gz = SRC / "ClassicDB.sql.gz"
    if gz.exists():
        print("loading CMaNGOS item_template")
        cmangos = extract_item_template(gz)
        print("  item_template", len(cmangos))
    else:
        print("no CMaNGOS dump; Classic-reference stats limited to existing tooltip cache")

    # Invert recipes -> uses and crafted-by
    uses_recipes = defaultdict(list)  # itemId -> list
    crafted_by = defaultdict(list)

    def add_recipe(spell_id, name, skill_name, skill_req, product_id, product_qty, reagents, forever=True, src=""):
        rec = {
            "spellId": int(spell_id),
            "name": name,
            "prof": skill_name,
            "skill": skill_req,
            "productId": product_id,
            "qty": product_qty or 1,
            "src": src,
        }
        if product_id:
            crafted_by[int(product_id)].append({**rec, "reagents": reagents})
        for rid, qty in reagents:
            uses_recipes[int(rid)].append({**rec, "usedQty": qty})

    for pid, p in (prof.get("professions") or {}).items():
        pname = p.get("name") or SKILL_NAME.get(iint(pid), str(pid))
        for r in p.get("recipes") or []:
            reagents = [(int(g[0]), int(g[1])) for g in (r.get("g") or []) if g]
            add_recipe(r["id"], r.get("n") or "", pname, r.get("r") or (r.get("d") or [None])[0],
                       r.get("i"), (r.get("y") or [1])[0], reagents, True, "prof-data")

    for sid, r in n_recipes.items():
        # skip if already from PROF_DATA (same spell id)
        already = False
        prod = r.get("item")
        if prod and any(c["spellId"] == int(sid) for c in crafted_by.get(int(prod), [])):
            already = True
        reagents = []
        for pair in r.get("reagents") or []:
            if isinstance(pair, (list, tuple)) and len(pair) >= 2:
                reagents.append((int(pair[0]), int(pair[1])))
        if already:
            continue
        skill_name = SKILL_NAME.get(iint(r.get("skill")), str(r.get("skill") or ""))
        add_recipe(sid, r.get("name") or "", skill_name, r.get("learn") or (r.get("levels") or [None])[0],
                   prod, r.get("count") or 1, reagents, True, "norgannon")

    # Invert quests
    quest_uses = defaultdict(list)  # required / objective
    quest_rewards = defaultdict(list)
    quest_starts = defaultdict(list)
    for qid, q in n_quests.items():
        if q.get("hidden") is True:
            continue
        name = q.get("name") or ("Quest " + str(qid))
        def add_use(iid, kind):
            quest_uses[int(iid)].append({"id": int(qid), "name": name, "kind": kind})
        for iid in q.get("requiredItems") or []:
            add_use(iid, "required")
        if q.get("sourceItem"):
            add_use(q["sourceItem"], "starter")
            quest_starts[int(q["sourceItem"])].append({"id": int(qid), "name": name, "kind": "starts"})
        objs = q.get("objectives") or {}
        if isinstance(objs, dict):
            for it in objs.get("items") or []:
                if isinstance(it, dict) and it.get("id"):
                    add_use(it["id"], "objective")
                elif isinstance(it, (list, tuple)) and it:
                    add_use(it[0], "objective")
        rew = q.get("rewards") or {}
        items = []
        if isinstance(rew, dict):
            items = rew.get("items") or []
            choice = bool(rew.get("choice"))
        else:
            choice = False
        for iid in items:
            quest_rewards[int(iid)].append({"id": int(qid), "name": name, "choice": choice})

    def npc_name(nid):
        rec = n_npcs.get(int(nid)) or {}
        return rec.get("name") or ("NPC " + str(nid))

    def npc_zone(nid):
        rec = n_npcs.get(int(nid)) or {}
        zid = rec.get("zone")
        return zones.get(int(zid), None) if zid else None

    def obj_name(oid):
        rec = n_objs.get(int(oid)) or {}
        return rec.get("name") or ("Object " + str(oid))

    def obj_zone(oid):
        rec = n_objs.get(int(oid)) or {}
        zid = rec.get("zone")
        return zones.get(int(zid), None) if zid else None

    def item_name(iid, fallback=None):
        if iid in sparse:
            n = sparse[iid].get("Display_lang") or fallback
            if n:
                return n
        if iid in n_items and n_items[iid].get("name"):
            return n_items[iid]["name"]
        if str(iid) in (prof.get("items") or {}) or iid in (prof.get("items") or {}):
            rec = (prof["items"] or {}).get(str(iid)) or (prof["items"] or {}).get(iid)
            if rec:
                return rec[0]
        if iid in wow_items:
            return wow_items[iid].get("name") or fallback
        return fallback or ("Item " + str(iid))

    # Build candidate id set
    ids = set()
    ids.update(sparse.keys())
    # Classic-reference gear from the tooltip cache and Norgannon, even if missing from Sparse
    for iid, it in wow_items.items():
        if it.get("quality") in ("uncommon", "rare", "epic", "legendary") or it.get("slot"):
            ids.add(int(iid))
    for iid, rec in n_items.items():
        cls = iint(rec.get("class"), -1)
        if cls in (0, 2, 4, 5, 7, 9, 12, 13):
            ids.add(int(iid))
    # anything used as a reagent or produced
    ids.update(uses_recipes.keys())
    ids.update(crafted_by.keys())
    ids.update(quest_uses.keys())
    ids.update(quest_rewards.keys())

    included = []
    skipped_hidden = 0
    for iid in sorted(ids):
        name = item_name(iid)
        if skip_name(name):
            skipped_hidden += 1
            continue
        sp = sparse.get(iid)
        it = item_rows.get(iid) or {}
        nrec = n_items.get(iid) or {}
        wow = wow_items.get(iid)
        tmpl = cmangos.get(iid)

        class_id = iint(it.get("ClassID"), iint(nrec.get("class"), iint(tmpl.get("class") if tmpl else 0, -1)))
        sub = iint(it.get("SubclassID"), iint(nrec.get("subClass"), iint(tmpl.get("subclass") if tmpl else 0)))
        inv = iint(sp.get("InventoryType") if sp else None,
                   iint(it.get("InventoryType"), iint(tmpl.get("InventoryType") if tmpl else 0)))
        qmap = {"poor": 0, "common": 1, "uncommon": 2, "rare": 3, "epic": 4, "legendary": 5, "artifact": 6}
        q = None
        if sp and sp.get("OverallQualityID") not in (None, ""):
            q = iint(sp.get("OverallQualityID"), None)
        if q is None and tmpl and tmpl.get("Quality") not in (None, ""):
            q = iint(tmpl.get("Quality"), None)
        if q is None and wow and wow.get("quality") in qmap:
            q = qmap[wow["quality"]]
        if q is None:
            q = 1
        ilvl = 0
        if sp and sp.get("ItemLevel") not in (None, ""):
            ilvl = iint(sp.get("ItemLevel"))
        elif nrec.get("level") not in (None, ""):
            ilvl = iint(nrec.get("level"))
        elif tmpl and tmpl.get("ItemLevel") not in (None, ""):
            ilvl = iint(tmpl.get("ItemLevel"))
        elif wow and wow.get("itemLevel"):
            ilvl = iint(wow.get("itemLevel"))
        req = 0
        if sp and sp.get("RequiredLevel") not in (None, ""):
            req = iint(sp.get("RequiredLevel"))
        elif nrec.get("requiredLevel") not in (None, ""):
            req = iint(nrec.get("requiredLevel"))
        elif tmpl and tmpl.get("RequiredLevel") not in (None, ""):
            req = iint(tmpl.get("RequiredLevel"))
        elif wow and wow.get("reqLevel"):
            req = iint(wow.get("reqLevel"))
        typ = item_type(class_id, sub, inv)
        if wow and wow.get("type") and typ in ("misc", "trade", "other"):
            typ = wow["type"]
        if wow and wow.get("slot") and inv not in GEAR_INV:
            # prefer wow slot for gear missing from sparse
            slot_id = wow.get("slot")
            slot_label = wow.get("slotLabel") or slot_id
        else:
            slot_id, slot_label = INV_TO_SLOT.get(inv, (None, None))
            if wow and wow.get("slot"):
                slot_id = wow["slot"]
                slot_label = wow.get("slotLabel") or slot_label or slot_id

        is_key = iid in KNOWN_KEYS or typ == "key" or class_id == 13
        cat = category(class_id, inv, typ, name, is_key=is_key)
        forever = iid in sparse  # player-facing in the live Forever client

        # inclusion
        keep = False
        if forever and notable_white(q, inv, class_id, req, ilvl, typ):
            keep = True
        if forever and cat in ("reagent", "consumable", "quest") and q >= 1:
            keep = True
        if forever and is_key:
            keep = True
        if forever and (iid in uses_recipes or iid in crafted_by or iid in quest_uses or iid in quest_rewards):
            if q >= 1 or typ in ("quest", "key") or is_key:
                keep = True
        # Classic-reference named gear from the tooltip cache / Norgannon, not in the client
        if not forever:
            if wow and wow.get("quality") in ("uncommon", "rare", "epic", "legendary"):
                keep = True
                cat = "gear"
            elif cat in ("reagent", "consumable", "quest") and (iid in uses_recipes or iid in quest_uses or iid in quest_rewards or is_key):
                keep = True
        if not keep:
            continue

        icon = iint(it.get("IconFileDataID")) or None
        sell = iint(sp.get("SellPrice") if sp else None, iint(tmpl.get("SellPrice") if tmpl else 0)) or None
        buy = iint(sp.get("BuyPrice") if sp else None, iint(tmpl.get("BuyPrice") if tmpl else 0)) or None
        bind = bind_label(iint(sp.get("Bonding") if sp else None, iint(tmpl.get("bonding") if tmpl and "bonding" in tmpl else 0)))
        if wow and wow.get("bind") and not bind:
            bind = wow["bind"]

        # stats: prefer Wowhead Classic tooltip parse, then CMaNGOS item_template. Never invent Forever amounts.
        stats = {}
        stat_source = None
        if tmpl:
            stats = classic_stat_map(tmpl)
            if stats:
                stat_source = "classic-db"
        if wow and wow.get("stats"):
            # overlay / replace with richer tooltip stats
            stats = dict(wow["stats"])
            stat_source = "wowhead-classic"
        weapon = None
        if tmpl:
            weapon = classic_weapon(tmpl, delay_ms_fallback=(sp.get("ItemDelay") if sp else None))
        if wow and wow.get("weapon"):
            weapon = dict(wow["weapon"])
            if not stat_source:
                stat_source = "wowhead-classic"
        effects = list(wow.get("effects") or []) if wow else []
        classes = list(wow.get("classes") or []) if wow else []
        unique = bool(wow.get("unique")) if wow else False

        # sources from Norgannon
        drops = []
        drec = (nrec.get("drops") or {}) if nrec else {}
        if isinstance(drec, dict):
            npc_ch = drec.get("npcs") or {}
            if isinstance(npc_ch, dict):
                rows = []
                for nid, ch in npc_ch.items():
                    chance = float(ch or 0)
                    nm = npc_name(nid)
                    if SKIP_NPC_NAME.search(nm or ""):
                        continue
                    rows.append((chance, int(nid)))
                rows.sort(key=lambda x: -x[0])
                for chance, nid in rows[:MAX_DROPS]:
                    drops.append({
                        "kind": "npc",
                        "id": nid,
                        "name": npc_name(nid),
                        "zone": npc_zone(nid),
                        "chance": round(chance, 2) if chance else 0,
                    })
            obj_ch = drec.get("objects") or {}
            if isinstance(obj_ch, dict):
                rows = []
                for oid, ch in obj_ch.items():
                    rows.append((float(ch or 0), int(oid)))
                rows.sort(key=lambda x: -x[0])
                already = len(drops)
                for chance, oid in rows[: max(0, MAX_DROPS - already)]:
                    drops.append({
                        "kind": "object",
                        "id": oid,
                        "name": obj_name(oid),
                        "zone": obj_zone(oid),
                        "chance": round(chance, 2) if chance else 0,
                    })
        vendors = []
        vend = (nrec.get("vendors") or {}) if nrec else {}
        if isinstance(vend, dict):
            for nid, count in list(vend.items())[:MAX_VENDORS]:
                vendors.append({
                    "id": int(nid),
                    "name": npc_name(nid),
                    "zone": npc_zone(nid),
                    "stock": int(count or 0),
                    "price": buy,
                })

        crafted = []
        for c in crafted_by.get(iid, [])[:8]:
            crafted.append({
                "spellId": c["spellId"], "name": c["name"], "prof": c["prof"],
                "skill": c["skill"], "qty": c["qty"],
            })
        recipes_using = []
        for u in uses_recipes.get(iid, [])[:MAX_RECIPES]:
            recipes_using.append({
                "spellId": u["spellId"], "name": u["name"], "prof": u["prof"],
                "skill": u["skill"], "productId": u.get("productId"),
                "product": item_name(u["productId"]) if u.get("productId") else None,
                "qty": u.get("usedQty") or 1,
            })
        quse = quest_uses.get(iid, [])[:MAX_QUESTS]
        qrew = quest_rewards.get(iid, [])[:MAX_QUESTS]
        attune = KNOWN_KEYS.get(iid)
        if not attune:
            for qu in quse + qrew:
                if ATTUNE_HINT.search(qu.get("name") or ""):
                    attune = "Involved in: " + qu["name"]
                    break

        src_text, src_type = source_summary({
            "crafted": crafted, "vendors": vendors, "drops": drops, "questRewards": qrew
        })
        if not src_text and wow and wow.get("source"):
            src_text, src_type = wow["source"], wow.get("sourceType") or "drop"

        included.append({
            "id": iid,
            "name": name,
            "quality": QNAME.get(q, "common"),
            "q": q,
            "cat": cat,
            "slot": slot_id,
            "slotLabel": slot_label,
            "type": typ,
            "reqLevel": req or 0,
            "itemLevel": ilvl or None,
            "icon": icon,
            "forever": forever,
            "sell": sell,
            "buy": buy,
            "bind": bind,
            "stats": stats or None,
            "statSource": stat_source,
            "weapon": weapon,
            "effects": effects or None,
            "classes": classes or None,
            "unique": unique or None,
            "source": src_text or None,
            "sourceType": src_type or None,
            "drops": drops or None,
            "vendors": vendors or None,
            "crafted": crafted or None,
            "recipes": recipes_using or None,
            "questUses": quse or None,
            "questRewards": qrew or None,
            "attune": attune,
            "startQuest": nrec.get("startQuest"),
        })

    print("included", len(included), "skipped hidden/test", skipped_hidden)

    # chunk assignment in id order
    for i, rec in enumerate(included):
        rec["chunk"] = i // CHUNK_SIZE
    n_chunks = (len(included) + CHUNK_SIZE - 1) // CHUNK_SIZE if included else 0

    index = []
    gear = []
    details_by_chunk = defaultdict(list)
    counts = defaultdict(int)
    forever_n = 0
    for rec in included:
        counts[rec["cat"]] += 1
        if rec["forever"]:
            forever_n += 1
        idx = {
            "id": rec["id"], "n": rec["name"], "q": rec["quality"], "cat": rec["cat"],
            "k": rec["chunk"], "f": 1 if rec["forever"] else 0,
        }
        if rec["icon"]:
            idx["icon"] = rec["icon"]
        if rec["itemLevel"]:
            idx["il"] = rec["itemLevel"]
        if rec["reqLevel"]:
            idx["rl"] = rec["reqLevel"]
        if rec["slot"]:
            idx["slot"] = rec["slot"]
        if rec["type"] and rec["cat"] == "gear":
            idx["typ"] = rec["type"]
        if rec["cat"] == "quest" or rec.get("bind") in ("bop", "quest"):
            idx["nt"] = 1
        index.append(idx)

        if rec["cat"] == "gear" and rec["slot"] and rec["slot"] not in ("shirt",):
            g = {
                "id": rec["id"],
                "name": rec["name"],
                "slot": rec["slot"],
                "slotLabel": rec["slotLabel"] or rec["slot"],
                "type": rec["type"] or "misc",
                "quality": rec["quality"],
                "reqLevel": rec["reqLevel"] or 0,
                "itemLevel": rec["itemLevel"],
                "stats": rec["stats"] or {},
                "source": rec["source"] or ("Forever client" if rec["forever"] else "Classic reference"),
                "sourceType": rec["sourceType"] or "drop",
                "forever": rec["forever"],
            }
            if rec["weapon"]:
                g["weapon"] = rec["weapon"]
            if rec["effects"]:
                g["effects"] = rec["effects"]
            if rec["classes"]:
                g["classes"] = rec["classes"]
            if rec["unique"]:
                g["unique"] = True
            if rec["bind"]:
                g["bind"] = rec["bind"]
            if rec["icon"]:
                g["icon"] = rec["icon"]
            if rec["statSource"]:
                g["statSource"] = rec["statSource"]
            gear.append(g)

        d = {
            "id": rec["id"], "name": rec["name"], "quality": rec["quality"],
            "cat": rec["cat"], "slot": rec["slot"], "slotLabel": rec["slotLabel"],
            "type": rec["type"], "reqLevel": rec["reqLevel"], "itemLevel": rec["itemLevel"],
            "icon": rec["icon"], "forever": rec["forever"], "sell": rec["sell"], "buy": rec["buy"],
            "bind": rec["bind"], "stats": rec["stats"], "statSource": rec["statSource"],
            "weapon": rec["weapon"], "effects": rec["effects"], "classes": rec["classes"],
            "unique": rec["unique"], "source": rec["source"], "sourceType": rec["sourceType"],
            "drops": rec["drops"], "vendors": rec["vendors"], "crafted": rec["crafted"],
            "recipes": rec["recipes"], "questUses": rec["questUses"],
            "questRewards": rec["questRewards"], "attune": rec["attune"],
            "startQuest": rec["startQuest"],
        }
        # drop nulls to shrink
        details_by_chunk[rec["chunk"]].append({k: v for k, v in d.items() if v not in (None, [], {}, False)})

    OUT.mkdir(parents=True, exist_ok=True)
    # wipe old chunks
    for old in OUT.glob("d*.js"):
        old.unlink()

    meta = {
        "schema": 1,
        "built": now_iso(),
        "clientBuild": build_id,
        "norgannon": n_info or {"note": "NorgannonDB data files from cache"},
        "counts": {
            "index": len(index),
            "gear": len(gear),
            "foreverConfirmed": forever_n,
            "classicReference": len(index) - forever_n,
            "byCategory": dict(counts),
            "chunks": n_chunks,
        },
        "sources": [
            {"name": "wago.tools DB2 ItemSparse and Item", "build": build_id, "role": "Forever client item facts (name, quality, ilvl, req, slot, vendor prices, icon file id)"},
            {"name": "zmarotrix/NorgannonDB", "license": "GPL-3.0", "role": "Forever drops, vendors, quest uses/rewards, recipes"},
            {"name": "LibProfessionDB / js/professions-data.js", "role": "Forever recipe reagents and products"},
            {"name": "Napalmsteak/WoW-Classic-Item-Caches (Wowhead Classic tooltips)", "role": "Classic-reference stats, weapon damage, on-equip text, class restrictions"},
            {"name": "cmangos/classic-db item_template", "license": "GPL-3.0", "role": "Classic-reference stats and weapon damage when no tooltip cache row exists"},
        ],
        "iconUrl": "https://render.worldofwarcraft.com/forever-us/icons/56/{icon}.jpg",
        "wowheadClassic": "https://www.wowhead.com/classic/item={id}",
        "notes": [
            "forever=true means the item has a player-facing ItemSparse record in the live Forever client.",
            "Items only in Classic databases or the previous tooltip cache are marked Classic-reference and are excluded from the upgrade finder by default.",
            "Stat amounts on gear come from Classic tooltip/DB sources, not from Forever ItemSparse (the client stores allocation weights, not raw amounts). They may differ if Forever changed a piece.",
            "Drop chances are copied from NorgannonDB (QuestieDB / pfQuest / DungeonJournal / Collector). A chance of 0 means 'drops, chance unknown'.",
            "Live auction prices are not stored here; the UI reads data/prices.js and the prices-data branch.",
        ],
    }

    header = "/* Generated by tools/items/build_items.py. Do not hand-edit. " + meta["built"] + " */"
    (OUT / "meta.js").write_text(js_assign("ITEM_DB_META", meta, header), encoding="utf-8")
    (OUT / "index.js").write_text(js_assign("ITEM_INDEX", index, header), encoding="utf-8")
    (OUT / "gear.js").write_text(js_assign("ITEM_GEAR", gear, header), encoding="utf-8")
    for k in range(n_chunks):
        payload = {str(r["id"]): r for r in details_by_chunk[k]}
        body = header + "\nwindow.ITEM_DETAIL_CHUNK=window.ITEM_DETAIL_CHUNK||{};window.ITEM_DETAIL_CHUNK[" + str(k) + "]=" + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n"
        (OUT / f"d{k}.js").write_text(body, encoding="utf-8")

    # slim items.js stub so old script tags keep working; real gear is data/items/gear.js
    stub = header + """
/* Gear list lives in data/items/gear.js (loaded with the Items tab). */
window.WOW_ITEMS = window.WOW_ITEMS || [];
"""
    (ROOT / "js" / "items.js").write_text(stub, encoding="utf-8")

    # sizes
    def sz(p: Path):
        return p.stat().st_size if p.exists() else 0
    total = sum(sz(p) for p in OUT.glob("*.js")) + sz(ROOT / "js" / "items.js")
    try:
        from build_suffixes import collect_suffix_data, write_suffix_files, find_src as find_suffix_src
        sdata = collect_suffix_data(find_suffix_src())
        sstats = write_suffix_files(ROOT, sdata)
        print("  suffixes", sstats["itemsWithSuffixes"], "items", sstats["suffixTypes"], "types")
    except SystemExit as e:
        print("  suffixes skipped:", e)

    print("wrote", OUT)
    print("  index", sz(OUT / "index.js"), "gear", sz(OUT / "gear.js"), "chunks", n_chunks,
          "chunk0", sz(OUT / "d0.js") if n_chunks else 0, "total", total)
    print("  counts", dict(counts), "forever", forever_n, "classic", len(index) - forever_n, "gear", len(gear))
    print("elapsed", round(time.time() - t0, 1), "s")

    # sanity: Wool Cloth
    wool = next((r for r in included if r["id"] == 2592), None)
    if wool:
        print("Wool Cloth forever=", wool["forever"], "recipes", len(wool["recipes"] or []),
              "drops", len(wool["drops"] or []), "quests", len(wool["questUses"] or []),
              "sell", wool["sell"])
    else:
        print("WARNING: Wool Cloth 2592 not included")


if __name__ == "__main__":
    main()
