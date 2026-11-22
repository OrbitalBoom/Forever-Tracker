#!/usr/bin/env python3
"""Build random-suffix / random-enchant tables for the Forever Tracker.

Forever client 1.60.1.71037 (wago.tools) has no ItemRandomProperties or
ItemRandomSuffix table, and ItemSparse/Item have no RandomProperty mapping.
RandPropPoints and SpellItemEnchantment exist, but without a suffix table
they cannot describe which suffixes an item can roll.

Fallback (labelled Classic):
  - wago.tools Classic Era ItemRandomProperties + SpellItemEnchantment
    (fixed +N amounts on each enchant id, parsed from the official name)
  - CMaNGOS classic-db item_template.RandomProperty + item_enchantment_template
    (which suffixes each item can roll, and the chance) — GPL-3.0

Never invents stat amounts. Unparsed enchant names are kept as effect text.

Can be called from build_items.py, or run on its own to update existing
data/items files without a full rebuild:

  ITEM_SRC=/tmp/item-db-src python3 tools/items/build_suffixes.py [site_root]
"""
from __future__ import annotations

import csv, gzip, json, os, re, sys, time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else Path(__file__).resolve().parents[2]).resolve()
TOOLS = Path(__file__).resolve().parent

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
WEAPON_SUB = {
    0: "axe", 1: "axe", 2: "bow", 3: "gun", 4: "mace", 5: "mace", 6: "polearm",
    7: "sword", 8: "sword", 10: "staff", 13: "fist", 14: "misc", 15: "dagger",
    16: "thrown", 17: "thrown", 18: "crossbow", 19: "wand", 20: "fishingpole",
}
ARMOR_SUB = {0: "misc", 1: "cloth", 2: "leather", 3: "mail", 4: "plate", 5: "misc", 6: "shield", 7: "libram", 8: "idol", 9: "totem"}
STAT_KEY = {
    1: "health", 3: "agi", 4: "str", 5: "int", 6: "spi", 7: "sta",
    12: "defense", 13: "dodge", 14: "parry", 15: "blockChance",
    16: "hit", 17: "hit", 18: "spellHit", 19: "crit", 20: "crit", 21: "spellCrit",
    22: "hit", 23: "spellCrit", 31: "hit", 32: "crit",
    38: "ap", 39: "rap", 40: "fap", 41: "healing", 42: "sp", 43: "mp5",
    44: "arp", 45: "sp", 46: "hp5", 47: "spellPen", 48: "blockValue",
    51: "fireRes", 52: "frostRes", 53: "holyRes", 54: "shadowRes", 55: "natureRes", 56: "arcaneRes",
}
SKIP_NAME_RE = re.compile(
    r"^(OLD|UNUSED|Deprecated|Monster -|Hidden |Transmog |WoW Token|Failsafe Test|Gamemaster )",
    re.I,
)
SKIP_NAME_IN = re.compile(r"\b(DEPRECATED|UNUSED|NYI|TEST ITEM|GAMEMASTER)\b", re.I)

PRIM = {"Strength": "str", "Agility": "agi", "Stamina": "sta", "Intellect": "int", "Spirit": "spi"}
SCHOOL_SP = {"Fire": "spFire", "Frost": "spFrost", "Shadow": "spShadow", "Arcane": "spArcane", "Nature": "spNature", "Holy": "spHoly"}
SCHOOL_RES = {"Fire": "fireRes", "Frost": "frostRes", "Shadow": "shadowRes", "Arcane": "arcaneRes", "Nature": "natureRes", "Holy": "holyRes"}

# Official SpellItemEnchantment Name_lang patterns. Amounts come from the name.
NAME_RULES = [
    (re.compile(r"^\+(\d+) (Strength|Agility|Stamina|Intellect|Spirit)$"),
     lambda m: {PRIM[m.group(2)]: int(m.group(1))}),
    (re.compile(r"^\+(\d+)% (Dodge|Parry)$"),
     lambda m: {m.group(2).lower(): int(m.group(1))}),
    (re.compile(r"^\+(\d+)% Block$"),
     lambda m: {"blockChance": int(m.group(1))}),
    (re.compile(r"^\+(\d+) Defense$"),
     lambda m: {"defense": int(m.group(1))}),
    (re.compile(r"^\+(\d+) Attack Power$"),
     lambda m: {"ap": int(m.group(1))}),
    (re.compile(r"^\+(\d+) (?:Healing Spells|Healing)$"),
     lambda m: {"healing": int(m.group(1))}),
    (re.compile(r"^\+(\d+) Damage and Healing Spells$"),
     lambda m: {"sp": int(m.group(1)), "healing": int(m.group(1))}),
    (re.compile(r"^Increase Spell Damage \+(\d+)$"),
     lambda m: {"sp": int(m.group(1))}),
    (re.compile(r"^\+(\d+) (Fire|Frost|Shadow|Arcane|Nature|Holy) Spell Damage$"),
     lambda m: {SCHOOL_SP[m.group(2)]: int(m.group(1))}),
    (re.compile(r"^\+(\d+) (Fire|Frost|Shadow|Arcane|Nature|Holy) Resistance$"),
     lambda m: {SCHOOL_RES[m.group(2)]: int(m.group(1))}),
    (re.compile(r"^\+(\d+) mana every 5 sec\.?$"),
     lambda m: {"mp5": int(m.group(1))}),
    (re.compile(r"^\+(\d+) health every 5 sec\.?$"),
     lambda m: {"hp5": int(m.group(1))}),
]


def iint(v, default=0):
    try:
        if v is None or v == "":
            return default
        return int(float(v))
    except (TypeError, ValueError):
        return default


def find_src() -> Path:
    env = os.environ.get("ITEM_SRC")
    candidates = []
    if env:
        candidates.append(Path(env))
    candidates += [TOOLS / "cache", Path("/tmp/item-db-src")]
    for p in candidates:
        if not p:
            continue
        if (p / "cmangos" / "ClassicDB.sql.gz").exists() or (p / "ClassicDB.sql.gz").exists():
            return p
        if (p / "era" / "ItemRandomProperties.csv").exists():
            return p
    raise SystemExit("No suffix sources found (need CMaNGOS ClassicDB and Classic Era ItemRandomProperties). Set ITEM_SRC.")


def load_csv_by_id(path: Path) -> dict:
    out = {}
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            out[int(row["ID"])] = row
    return out


def parse_enchant_name(name: str) -> tuple[dict, list]:
    name = (name or "").strip()
    if not name:
        return {}, []
    for rx, fn in NAME_RULES:
        m = rx.match(name)
        if m:
            return fn(m), []
    return {}, [name]


def extract_sql_table(gz_path: Path, table: str) -> tuple[list, list]:
    cols, collecting, inserts = [], False, []
    with gzip.open(gz_path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith(f"CREATE TABLE `{table}`"):
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
            if f"INSERT INTO `{table}`" in line:
                inserts.append(line)
                if not line.rstrip().endswith(";"):
                    for cont in f:
                        inserts[-1] += cont
                        if cont.rstrip().endswith(";"):
                            break
    return cols, inserts


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


def extract_item_template(gz_path: Path) -> dict:
    cols, inserts = extract_sql_table(gz_path, "item_template")
    out = {}
    for blob in inserts:
        i = blob.find("VALUES")
        if i < 0:
            continue
        for row in _parse_sql_values(blob[i + 6:]):
            if len(row) < len(cols):
                continue
            rec = {cols[j]: row[j] for j in range(len(cols))}
            try:
                out[int(rec["entry"])] = rec
            except (TypeError, ValueError, KeyError):
                continue
    return out


def extract_enchantment_template(gz_path: Path) -> dict[int, list]:
    cols, inserts = extract_sql_table(gz_path, "item_enchantment_template")
    groups = defaultdict(list)
    seen = set()
    for blob in inserts:
        i = blob.find("VALUES")
        if i < 0:
            continue
        if cols == ["entry", "ench", "chance"] or not cols:
            for m in re.finditer(r"\((\d+),(\d+),([0-9.]+)\)", blob):
                entry, ench, chance = int(m.group(1)), int(m.group(2)), float(m.group(3))
                key = (entry, ench)
                if key in seen:
                    continue
                seen.add(key)
                groups[entry].append((ench, chance))
            continue
        for row in _parse_sql_values(blob[i + 6:]):
            rec = {cols[j]: row[j] for j in range(min(len(cols), len(row)))}
            try:
                entry, ench, chance = int(rec["entry"]), int(rec["ench"]), float(rec["chance"])
            except (TypeError, ValueError, KeyError):
                continue
            key = (entry, ench)
            if key in seen:
                continue
            seen.add(key)
            groups[entry].append((ench, chance))
    for g in groups.values():
        g.sort(key=lambda x: (-x[1], x[0]))
    return dict(groups)


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


def item_type(class_id: int, sub: int, inv: int) -> str:
    if class_id == 2:
        return WEAPON_SUB.get(sub, "misc")
    if class_id == 4:
        if inv == 23:
            return "held"
        if inv == 16:
            return "cloth" if sub == 1 else ARMOR_SUB.get(sub, "misc")
        return ARMOR_SUB.get(sub, "misc")
    return "misc"


def skip_name(name: str) -> bool:
    if not name or not name.strip():
        return True
    if SKIP_NAME_RE.search(name) or SKIP_NAME_IN.search(name):
        return True
    if re.search(r"\[PH\]|\(Test\)|\(TEST\)|<PH>|\bTODO\b", name):
        return True
    return False


def bind_label(b: int):
    return {1: "bop", 2: "boe", 3: "bou", 4: "quest"}.get(b)


def js_assign(var: str, obj, header: str) -> str:
    return header + "\nwindow." + var + " = " + json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + ";\n"


def collect_suffix_data(src: Path) -> dict:
    era_dir = src / "era" if (src / "era" / "ItemRandomProperties.csv").exists() else src
    forever_dir = src / "forever" if (src / "forever" / "SpellItemEnchantment.csv").exists() else src
    props_path = era_dir / "ItemRandomProperties.csv"
    if not props_path.exists():
        raise SystemExit("Need ItemRandomProperties.csv (Classic Era) in " + str(era_dir))

    sie = {}
    sie_src = {}
    for path, tag in (
        (forever_dir / "SpellItemEnchantment.csv", "forever"),
        (era_dir / "SpellItemEnchantment.csv", "classic"),
    ):
        if not path.exists():
            continue
        for iid, row in load_csv_by_id(path).items():
            if iid not in sie:
                sie[iid] = row
                sie_src[iid] = tag

    props = {}
    unparsed = []
    parsed_ok = 0
    with props_path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            pid = int(row["ID"])
            name = (row.get("Name_lang") or "").strip()
            if not name or name.startswith("Stat "):
                continue
            enchs = [int(row[f"Enchantment_{i}"]) for i in range(5) if iint(row.get(f"Enchantment_{i}"))]
            stats, effects = {}, []
            sources = set()
            for eid in enchs:
                erow = sie.get(eid)
                if not erow:
                    unparsed.append((pid, name, eid, "<missing SpellItemEnchantment>"))
                    continue
                sources.add(sie_src.get(eid, "classic"))
                st, fx = parse_enchant_name(erow.get("Name_lang") or "")
                if not st and not fx:
                    unparsed.append((pid, name, eid, erow.get("Name_lang") or ""))
                    fx = [erow.get("Name_lang") or ("Enchant " + str(eid))]
                if st:
                    parsed_ok += 1
                    for k, v in st.items():
                        stats[k] = stats.get(k, 0) + v
                effects.extend(fx)
            props[pid] = {
                "n": name,
                "s": stats,
                "e": effects,
                "src": "forever" if sources == {"forever"} else "classic",
            }

    gz = src / "cmangos" / "ClassicDB.sql.gz"
    if not gz.exists():
        gz = src / "ClassicDB.sql.gz"
    if not gz.exists():
        raise SystemExit("Need CMaNGOS ClassicDB.sql.gz")
    groups = extract_enchantment_template(gz)
    templates = extract_item_template(gz)

    # item id -> group id
    item_group = {}
    for entry, rec in templates.items():
        g = iint(rec.get("RandomProperty"))
        if g and g in groups:
            item_group[entry] = g

    era_sparse_path = era_dir / "ItemSparse.csv"
    era_item_path = era_dir / "Item.csv"
    era_sparse = load_csv_by_id(era_sparse_path) if era_sparse_path.exists() else {}
    era_item = load_csv_by_id(era_item_path) if era_item_path.exists() else {}
    # Era RandomSelect as a fallback mapping when CMaNGOS has no row
    for iid, row in era_sparse.items():
        rsel = iint(row.get("RandomSelect"))
        if rsel and rsel in groups and iid not in item_group:
            item_group[iid] = rsel

    # Only keep properties that actually appear on a roll table we use
    used_props = {pid for rolls in groups.values() for pid, _ch in rolls}
    used_props &= set(props)

    era_build = ""
    build_file = era_dir / "BUILD.txt"
    if build_file.exists():
        era_build = build_file.read_text().strip()

    return {
        "props": props,
        "groups": groups,
        "item_group": item_group,
        "templates": templates,
        "era_sparse": era_sparse,
        "era_item": era_item,
        "used_props": used_props,
        "unparsed": unparsed,
        "parsed_ok": parsed_ok,
        "era_build": era_build or "1.15.9.70576",
        "forever_build": os.environ.get("WAGO_BUILD", "1.60.1.71037"),
        "cmangos": str(gz),
    }


def make_classic_gear_item(iid: int, data: dict) -> dict | None:
    sp = data["era_sparse"].get(iid) or {}
    it = data["era_item"].get(iid) or {}
    tmpl = data["templates"].get(iid) or {}
    name = (sp.get("Display_lang") or tmpl.get("name") or "").strip()
    if skip_name(name):
        return None
    inv = iint(sp.get("InventoryType"), iint(it.get("InventoryType"), iint(tmpl.get("InventoryType"))))
    class_id = iint(it.get("ClassID"), iint(tmpl.get("class")))
    sub = iint(it.get("SubclassID"), iint(tmpl.get("subclass")))
    slot_id, slot_label = INV_TO_SLOT.get(inv, (None, None))
    if not slot_id:
        return None
    typ = item_type(class_id, sub, inv)
    q = iint(sp.get("OverallQualityID"), iint(tmpl.get("Quality"), 2))
    rec = {
        "id": iid,
        "name": name,
        "slot": slot_id,
        "slotLabel": slot_label,
        "type": typ,
        "quality": QNAME.get(q, "uncommon"),
        "reqLevel": iint(sp.get("RequiredLevel"), iint(tmpl.get("RequiredLevel"))),
        "itemLevel": iint(sp.get("ItemLevel"), iint(tmpl.get("ItemLevel"))),
        "stats": classic_stat_map(tmpl) if tmpl else {},
        "source": "Classic reference",
        "sourceType": "classic-db",
        "forever": False,
        "suffixGroup": data["item_group"][iid],
        "statSource": "classic-db",
    }
    icon = iint(it.get("IconFileDataID")) or None
    if icon:
        rec["icon"] = icon
    bind = bind_label(iint(sp.get("Bonding"), iint(tmpl.get("bonding") if tmpl else 0)))
    if bind:
        rec["bind"] = bind
    weapon = classic_weapon(tmpl, delay_ms_fallback=sp.get("ItemDelay")) if tmpl else None
    if weapon:
        rec["weapon"] = weapon
    return rec


def write_suffix_files(site: Path, data: dict, add_missing_classic=True) -> dict:
    out_dir = site / "data" / "items"
    header = (
        "/* Generated by tools/items/build_suffixes.py. Do not hand-edit. "
        + datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        + " */"
    )
    used = data["used_props"]
    props_out = {}
    for pid in sorted(used):
        p = data["props"][pid]
        rec = {"n": p["n"], "s": p["s"], "src": p["src"]}
        if p["e"]:
            rec["e"] = p["e"]
        props_out[str(pid)] = rec

    groups_out = {}
    for gid, rolls in data["groups"].items():
        cleaned = [[pid, ch] for pid, ch in rolls if pid in used]
        if cleaned:
            groups_out[str(gid)] = cleaned

    payload = {
        "schema": 1,
        "foreverBuild": data["forever_build"],
        "classicBuild": data["era_build"],
        "sources": [
            {"name": "wago.tools DB2 ItemSparse, Item, SpellItemEnchantment, RandPropPoints", "build": data["forever_build"], "role": "Forever client check (no ItemRandomProperties / ItemRandomSuffix; no item RandomProperty column)"},
            {"name": "wago.tools DB2 ItemRandomProperties, SpellItemEnchantment, ItemSparse", "build": data["era_build"], "flavor": "wow_classic_era", "role": "Classic suffix names and fixed enchant amounts (from official Name_lang)"},
            {"name": "cmangos/classic-db item_template.RandomProperty and item_enchantment_template", "license": "GPL-3.0", "role": "Which suffixes each item can roll, and the chance"},
        ],
        "props": props_out,
        "groups": groups_out,
        "notes": [
            "Forever 1.60.1.71037 does not ship ItemRandomProperties or ItemRandomSuffix, so suffix rolls are Classic data and labelled Classic.",
            "Classic random enchants are fixed values per ItemRandomProperties / SpellItemEnchantment id, not ilvl-scaled ItemRandomSuffix.",
        ],
    }
    (out_dir / "suffixes.js").write_text(js_assign("ITEM_SUFFIXES", payload, header), encoding="utf-8")

    # Patch existing gear + add missing Classic-reference RP items
    gear_path = out_dir / "gear.js"
    index_path = out_dir / "index.js"
    gear = []
    if gear_path.exists():
        t = gear_path.read_text(encoding="utf-8")
        gear = json.loads(t[t.find("["):].rstrip().rstrip(";"))
    by_id = {it["id"]: it for it in gear}
    tagged = 0
    for it in gear:
        g = data["item_group"].get(it["id"])
        if g and str(g) in groups_out:
            it["suffixGroup"] = g
            tagged += 1
        elif "suffixGroup" in it:
            del it["suffixGroup"]

    added = 0
    new_items = []
    if add_missing_classic:
        for iid, g in data["item_group"].items():
            if iid in by_id:
                continue
            if str(g) not in groups_out:
                continue
            rec = make_classic_gear_item(iid, data)
            if not rec:
                continue
            new_items.append(rec)
            by_id[iid] = rec
            added += 1
        gear.extend(new_items)

    # stable-ish order: existing first, then new by id
    new_header = (
        "/* Generated by tools/items/build_items.py + build_suffixes.py. Do not hand-edit. "
        + datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        + " */"
    )
    gear_path.write_text(js_assign("ITEM_GEAR", gear, new_header), encoding="utf-8")

    # index
    index = []
    if index_path.exists():
        t = index_path.read_text(encoding="utf-8")
        index = json.loads(t[t.find("["):].rstrip().rstrip(";"))
    idx_ids = {it["id"] for it in index}
    # tag nothing on index (keep it small); add new classic gear rows
    next_k = 0
    if index:
        next_k = max((iint(it.get("k")) for it in index), default=-1) + 1
    new_chunk = []
    for rec in new_items:
        if rec["id"] in idx_ids:
            continue
        index.append({
            "id": rec["id"],
            "n": rec["name"],
            "q": rec["quality"],
            "cat": "gear",
            "k": next_k,
            "f": 0,
            "icon": rec.get("icon"),
            "il": rec.get("itemLevel"),
            "rl": rec.get("reqLevel"),
            "slot": rec["slot"],
            "typ": rec["type"],
        })
        # detail chunk entry (compact, enough for the tooltip)
        d = {
            "id": rec["id"], "name": rec["name"], "quality": rec["quality"], "cat": "gear",
            "icon": rec.get("icon"), "slot": rec["slot"], "slotLabel": rec.get("slotLabel"),
            "type": rec["type"], "reqLevel": rec.get("reqLevel"), "itemLevel": rec.get("itemLevel"),
            "stats": rec.get("stats") or {}, "source": rec.get("source"), "sourceType": rec.get("sourceType"),
            "forever": False, "bind": rec.get("bind"), "statSource": rec.get("statSource"),
            "suffixGroup": rec["suffixGroup"],
        }
        if rec.get("weapon"):
            d["weapon"] = rec["weapon"]
        new_chunk.append(d)
        idx_ids.add(rec["id"])
    if new_chunk:
        chunk_map = {str(it["id"]): it for it in new_chunk}
        (out_dir / f"d{next_k}.js").write_text(
            js_assign("ITEM_DETAIL_CHUNK", {str(next_k): None}, new_header).replace(
                json.dumps({str(next_k): None}, separators=(",", ":")),
                json.dumps({next_k: chunk_map}, separators=(",", ":")),
            ) if False else
            new_header + "\nwindow.ITEM_DETAIL_CHUNK = window.ITEM_DETAIL_CHUNK || {};\n"
            + "window.ITEM_DETAIL_CHUNK[" + str(next_k) + "] = "
            + json.dumps(chunk_map, ensure_ascii=False, separators=(",", ":")) + ";\n",
            encoding="utf-8",
        )
        index_path.write_text(js_assign("ITEM_INDEX", index, new_header), encoding="utf-8")

    names = sorted({data["props"][pid]["n"] for pid in used})
    return {
        "itemsWithSuffixes": tagged + added,
        "existingTagged": tagged,
        "classicAdded": added,
        "suffixTypes": len(names),
        "suffixTypeNames": names,
        "propertyRows": len(props_out),
        "groups": len(groups_out),
        "unparsed": data["unparsed"],
        "chunk": next_k if new_chunk else None,
    }


def main():
    t0 = time.time()
    src = find_src()
    print("suffix sources in", src)
    data = collect_suffix_data(src)
    used_names = sorted({data["props"][pid]["n"] for pid in data["used_props"]})
    print("  properties used on CMaNGOS rolls", len(data["used_props"]), "of", len(data["props"]))
    print("  suffix type names", len(used_names))
    print("  groups", len(data["groups"]), "items with a group", len(data["item_group"]))
    if data["unparsed"]:
        # only report unparsed that appear on a used property
        u = [x for x in data["unparsed"] if x[0] in data["used_props"]]
        print("  unparsed used enchants", len(u))
        for row in u[:15]:
            print("   ", row)
    stats = write_suffix_files(ROOT, data)
    print("  tagged existing gear", stats["existingTagged"], "added classic-reference", stats["classicAdded"])
    print("  items with suffixes", stats["itemsWithSuffixes"], "types", stats["suffixTypes"])
    print("  wrote data/items/suffixes.js" + (f" and d{stats['chunk']}.js" if stats["chunk"] is not None else ""))
    print("  elapsed", round(time.time() - t0, 1), "s")
    return stats


if __name__ == "__main__":
    main()
