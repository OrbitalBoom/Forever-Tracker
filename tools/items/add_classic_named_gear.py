#!/usr/bin/env python3
"""Add Classic named gear that is missing from Forever ItemSparse and the current
gear index. These were omitted because build_items.py only kept classic-reference
gear present in the Wowhead starter tooltip cache (dungeon/raid/crafted/rep/PvP
uncommons, plus rares+), so world-drop named greens such as Humbert's Helm (4724)
never made it in.

Sources: CMaNGOS classic-db item_template (stats, names), Forever Item.csv (icons
when the row exists even without ItemSparse), Classic Era ItemSparse (name/ilvl
corroboration), NorgannonDB npc drop lists. Does not invent stats.
"""
from __future__ import annotations

import csv, json, re, sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[2]).resolve()
TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(TOOLS))

# Load build_items helpers without requiring ItemSparse at the SRC root.
_bi = (TOOLS / "build_items.py").read_text(encoding="utf-8")
_bi = _bi.replace("SRC = find_src()", "SRC = Path('/tmp/item-db-src')")
_ns = {"__file__": str(TOOLS / "build_items.py"), "__name__": "build_items_helpers"}
exec(compile(_bi, "build_items.py", "exec"), _ns)

extract_item_template = _ns["extract_item_template"]
skip_name = _ns["skip_name"]
classic_stat_map = _ns["classic_stat_map"]
classic_weapon = _ns["classic_weapon"]
item_type = _ns["item_type"]
bind_label = _ns["bind_label"]
source_summary = _ns["source_summary"]
GEAR_INV = _ns["GEAR_INV"]
INV_TO_SLOT = _ns["INV_TO_SLOT"]
QNAME = _ns["QNAME"]
iint = _ns["iint"]
CHUNK_SIZE = 800
MAX_DROPS = 10

OUT = ROOT / "data" / "items"
CMANGOS = Path("/tmp/item-db-src/cmangos/ClassicDB.sql.gz")
FOREVER_SPARSE = Path("/tmp/item-db-src/forever/ItemSparse.csv")
FOREVER_ITEM = Path("/tmp/item-db-src/forever/Item.csv")
ERA_SPARSE = Path("/tmp/item-db-src/era/ItemSparse.csv")
NOR_DIR = Path("/tmp/norgannon")


def load_csv(path: Path) -> dict:
    out = {}
    if not path.exists():
        return out
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            out[int(row["ID"])] = row
    return out


def load_js_array(path: Path, assign: str):
    t = path.read_text(encoding="utf-8")
    m = re.search(re.escape(assign) + r"\s*=\s*(\[.*\]);?\s*$", t, re.S)
    if not m:
        raise SystemExit("could not parse " + assign + " in " + str(path))
    return json.loads(m.group(1)), t, m


def parse_npc_drops(path: Path):
    """item_id -> list of {id,name,zone,chance} from norgannon npcs.lua."""
    text = path.read_text(encoding="utf-8")
    from norgannondb import load_zone_names
    zones = {}
    world = path.parent / "world.lua"
    if world.exists():
        zones = load_zone_names(world)
    drops = defaultdict(list)
    # R(id,"Name",[[...drops={...},...zone=N...]])
    rec_re = re.compile(
        r'R\((\d+),"((?:[^"\\]|\\.)*)",\[\[(.*?)\]\]\)',
        re.S,
    )
    drops_re = re.compile(r"drops=\{([^}]*)\}")
    pair_re = re.compile(r"\[(\d+)\]=([0-9.]+)")
    zone_re = re.compile(r"zone=(\d+)")
    for m in rec_re.finditer(text):
        nid = int(m.group(1))
        name = m.group(2).encode("utf-8").decode("unicode_escape") if "\\" in m.group(2) else m.group(2)
        body = m.group(3)
        dm = drops_re.search(body)
        if not dm:
            continue
        zm = zone_re.search(body)
        zone = zones.get(int(zm.group(1))) if zm else None
        for item_id, ch in pair_re.findall(dm.group(1)):
            chance = float(ch)
            drops[int(item_id)].append({
                "kind": "npc",
                "id": nid,
                "name": name,
                "zone": zone,
                "chance": round(chance, 2) if chance else 0,
            })
    for iid in drops:
        drops[iid].sort(key=lambda d: -d["chance"])
        drops[iid] = drops[iid][:MAX_DROPS]
    return drops


TEST_RE = re.compile(r"\bTEST\b", re.I)


def should_skip(name: str, quality: int) -> bool:
    if skip_name(name) or TEST_RE.search(name or ""):
        return True
    if quality >= 6:  # 1.12 "artifact" rows are typically GM items, not player legendaries
        return True
    return False


def build_records():
    print("loading sources")
    cmangos = extract_item_template(CMANGOS)
    fs = load_csv(FOREVER_SPARSE)
    fi = load_csv(FOREVER_ITEM)
    es = load_csv(ERA_SPARSE)
    npc_drops = parse_npc_drops(NOR_DIR / "npcs.lua") if (NOR_DIR / "npcs.lua").exists() else {}
    print("  cmangos", len(cmangos), "forever sparse", len(fs), "forever item", len(fi), "drop items", len(npc_drops))

    gear, gear_txt, gear_m = load_js_array(OUT / "gear.js", "window.ITEM_GEAR")
    index, index_txt, index_m = load_js_array(OUT / "index.js", "window.ITEM_INDEX")
    gear_ids = {int(it["id"]) for it in gear}
    existing_max_k = max((int(it.get("k") or 0) for it in index), default=-1)

    added = []
    for iid, rec in sorted(cmangos.items()):
        inv = iint(rec.get("InventoryType"))
        q = iint(rec.get("Quality"))
        if inv not in GEAR_INV or q < 2:
            continue
        name = rec.get("name") or ""
        if should_skip(name, q):
            continue
        if iid in fs or iid in gear_ids:
            continue
        # Prefer official Era Display_lang when it matches this id; otherwise CMaNGOS name.
        era_name = (es.get(iid) or {}).get("Display_lang") if iid in es else None
        if era_name:
            name = era_name
        slot_id, slot_label = INV_TO_SLOT[inv]
        typ = item_type(iint(rec.get("class"), -1), iint(rec.get("subclass")), inv)
        ilvl = iint(rec.get("ItemLevel")) or iint((es.get(iid) or {}).get("ItemLevel"))
        req = iint(rec.get("RequiredLevel"))
        if not req and iid in es:
            req = iint(es[iid].get("RequiredLevel"))
        icon = iint((fi.get(iid) or {}).get("IconFileDataID")) or iint((es.get(iid) or {}).get("IconFileDataID") and None)
        # Era Item.csv may have the icon too; Forever Item.csv is preferred and already tried.
        stats = classic_stat_map(rec)
        weapon = classic_weapon(rec)
        bind = bind_label(iint(rec.get("bonding")))
        sell = iint(rec.get("SellPrice")) or None
        buy = iint(rec.get("BuyPrice")) or None
        drops = list(npc_drops.get(iid) or [])
        src_text, src_type = source_summary({"drops": drops, "crafted": [], "vendors": [], "questRewards": []})
        if not src_text:
            src_text, src_type = "Classic reference", "classic-db"
        detail = {
            "id": iid,
            "name": name,
            "quality": QNAME.get(q, "common"),
            "cat": "gear",
            "icon": icon or None,
            "slot": slot_id,
            "slotLabel": slot_label,
            "type": typ,
            "reqLevel": req or 0,
            "itemLevel": ilvl or None,
            "stats": stats or {},
            "source": src_text,
            "sourceType": src_type,
            "forever": False,
            "bind": bind,
            "statSource": "classic-db" if (stats or weapon) else None,
        }
        if sell:
            detail["sell"] = sell
        if buy:
            detail["buy"] = buy
        if weapon:
            detail["weapon"] = weapon
        if drops:
            detail["drops"] = drops
        added.append(detail)
    return added, gear, gear_txt, gear_m, index, index_txt, index_m, existing_max_k


def compact(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def write_files(added, gear, gear_txt, gear_m, index, index_txt, index_m, existing_max_k):
    header = "/* Generated by tools/items/add_classic_named_gear.py. Do not hand-edit. " + datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") + " */\n"
    # Assign chunks after existing k
    start_k = existing_max_k + 1
    for i, rec in enumerate(added):
        rec["chunk"] = start_k + (i // CHUNK_SIZE)
    n_chunks = (len(added) + CHUNK_SIZE - 1) // CHUNK_SIZE if added else 0

    gear_recs = []
    index_recs = []
    by_chunk = defaultdict(dict)
    for rec in added:
        k = rec["chunk"]
        gear_rec = {
            "id": rec["id"],
            "name": rec["name"],
            "slot": rec["slot"],
            "slotLabel": rec["slotLabel"],
            "type": rec["type"],
            "quality": rec["quality"],
            "reqLevel": rec["reqLevel"],
            "itemLevel": rec["itemLevel"],
            "stats": rec.get("stats") or {},
            "source": rec["source"],
            "sourceType": rec["sourceType"],
            "forever": False,
            "statSource": rec.get("statSource"),
            "icon": rec.get("icon"),
            "bind": rec.get("bind"),
        }
        if rec.get("weapon"):
            gear_rec["weapon"] = rec["weapon"]
        gear_recs.append(gear_rec)
        idx = {
            "id": rec["id"],
            "n": rec["name"],
            "q": rec["quality"],
            "cat": "gear",
            "k": k,
            "f": 0,
        }
        if rec.get("icon"):
            idx["icon"] = rec["icon"]
        if rec.get("itemLevel"):
            idx["il"] = rec["itemLevel"]
        if rec.get("reqLevel"):
            idx["rl"] = rec["reqLevel"]
        if rec.get("slot"):
            idx["slot"] = rec["slot"]
        if rec.get("type"):
            idx["typ"] = rec["type"]
        index_recs.append(idx)
        # detail: drop internal chunk key
        detail = {kk: vv for kk, vv in rec.items() if kk != "chunk" and vv is not None}
        by_chunk[k][str(rec["id"])] = detail

    # Append to existing arrays without rewriting prior records
    def append_array(txt, match, new_objs):
        body = match.group(1)
        # match.group is the array including brackets
        start, end = match.span(1)
        inner_end = end - 1  # before ]
        # find last ]
        # group 1 includes [ ... ]
        arr_end = start + len(body) - 1
        prefix = txt[:arr_end]
        # if array is not empty, need a comma
        stripped = body[1:-1].rstrip()
        joiner = "" if not stripped else ("" if stripped.endswith(",") else ",")
        addition = "".join(compact(o) + "," for o in new_objs)
        if addition.endswith(","):
            addition = addition[:-1]
        return prefix + joiner + addition + txt[arr_end:]

    new_gear = append_array(gear_txt, gear_m, gear_recs)
    (OUT / "gear.js").write_text(new_gear, encoding="utf-8")
    new_index = append_array(index_txt, index_m, index_recs)
    (OUT / "index.js").write_text(new_index, encoding="utf-8")
    for k, payload in by_chunk.items():
        body = header + "window.ITEM_DETAIL_CHUNK=window.ITEM_DETAIL_CHUNK||{};window.ITEM_DETAIL_CHUNK[" + str(k) + "]=" + compact(payload) + ";\n"
        (OUT / f"d{k}.js").write_text(body, encoding="utf-8")
        print("wrote", OUT / f"d{k}.js", "items", len(payload))
    return start_k, n_chunks


def main():
    added, gear, gear_txt, gear_m, index, index_txt, index_m, existing_max_k = build_records()
    print("to add", len(added))
    helm = next((r for r in added if r["id"] == 4724), None)
    print("Humbert's Helm", helm)
    if not added:
        return
    start_k, n_chunks = write_files(added, gear, gear_txt, gear_m, index, index_txt, index_m, existing_max_k)
    print("added", len(added), "classic-reference named gear; chunks starting at", start_k, "count", n_chunks)


if __name__ == "__main__":
    main()
