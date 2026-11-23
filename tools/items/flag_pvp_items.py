#!/usr/bin/env python3
"""Identify PvP-only items from published data (never guessed).

Sources:
  - Forever ItemSparse: RequiredPVPRank, MinFactionID in the six battleground
    reputations (League of Arathor, Defilers, Frostwolf, Stormpike,
    Warsong Outriders, Silverwing Sentinels).
  - NorgannonDB items/npcs/quests/objects/recipes (Forever drops, vendors, rewards):
    pvpRank, repFaction, vendors, drops, rewardOf.
  - CMaNGOS classic-db (optional): item_template.requiredhonorrank and
    RequiredReputationFaction, npc_vendor, creature map, quest_template
    (Type 41 = PvP, ZoneOrSort in BG zones, BG reputation on the quest).
  - tools/items/pvp-src/pvp-ref.json, built from Forever 1.60.1.71037
    Faction, FactionTemplate, and AreaTable.

An item is flagged PvP-only when every known source is a PvP source
(PvP vendor, drop inside a battleground or from a PvP-faction NPC,
reward of a BG/PvP quest) or, if no source is listed, the item itself
requires a PvP rank or a battleground reputation. Items that also come
from a world drop, a PvE vendor, a non-PvP quest, or a recipe are not flagged.

Usage:
  python3 tools/items/flag_pvp_items.py            # write pvp-only.json, print summary
  python3 tools/items/flag_pvp_items.py --apply    # also patch data/items/*.js
  from flag_pvp_items import compute_pvp_only      # used by build_items.py
"""
from __future__ import annotations

import argparse, csv, gzip, json, os, re, sys
from collections import defaultdict
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from norgannondb import load_records  # noqa: E402

# Local copies of helpers (do not import build_items: it calls find_src() at import time).

def iint(v, default=0):
    try:
        if v is None or v == "":
            return default
        return int(float(v))
    except (TypeError, ValueError):
        return default

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


def find_src():
    env = os.environ.get("ITEM_SRC")
    for p in [Path(env) if env else None, TOOLS / "cache", Path("/tmp/item-db-src")]:
        if not p:
            continue
        if (p / "ItemSparse.csv").exists() or (p / "forever" / "ItemSparse.csv").exists() or (p / "norgannon" / "items.lua").exists():
            return p
    return Path("/tmp/item-db-src")

def load_ref() -> dict:
    p = TOOLS / "pvp-src" / "pvp-ref.json"
    return json.loads(p.read_text(encoding="utf-8"))


def sparse_path(src: Path) -> Path:
    for p in (src / "ItemSparse.csv", src / "forever" / "ItemSparse.csv", Path("/tmp/item-db-src/forever/ItemSparse.csv")):
        if p.exists():
            return p
    raise SystemExit("ItemSparse.csv not found")


def norg_dir(src: Path) -> Path:
    for p in (src / "norgannon", Path("/tmp/norgannon"), src):
        if (p / "items.lua").exists():
            return p
    raise SystemExit("Norgannon items.lua not found")


def extract_sql_tables(gz_path: Path, wanted: set[str]) -> dict[str, tuple[list, list]]:
    """Return {table: (cols, rows)} for INSERT/CREATE of the named tables."""
    found = {t: None for t in wanted}  # cols
    inserts = {t: [] for t in wanted}
    collecting = None
    with gzip.open(gz_path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith("CREATE TABLE `"):
                m = re.match(r"CREATE TABLE `([^`]+)`", line)
                if m and m.group(1) in wanted:
                    collecting = m.group(1)
                    found[collecting] = []
                else:
                    collecting = None
                continue
            if collecting:
                m = re.match(r"\s+`([^`]+)`", line)
                if m:
                    found[collecting].append(m.group(1))
                if line.startswith(")") or line.startswith(") "):
                    collecting = None
                continue
            if "INSERT INTO `" in line:
                m = re.match(r"INSERT INTO `([^`]+)`", line)
                if not m or m.group(1) not in wanted:
                    continue
                blob = line
                if not line.rstrip().endswith(";"):
                    for cont in f:
                        blob += cont
                        if cont.rstrip().endswith(";"):
                            break
                inserts[m.group(1)].append(blob)
    out = {}
    for t in wanted:
        cols = found[t] or []
        rows = []
        for blob in inserts[t]:
            i = blob.find("VALUES")
            if i < 0:
                continue
            for row in _parse_sql_values(blob[i + 6:]):
                if cols and len(row) < len(cols):
                    continue
                rec = {cols[j]: row[j] for j in range(min(len(cols), len(row)))} if cols else row
                rows.append(rec)
        out[t] = (cols, rows)
        print(f"  CMaNGOS {t}: {len(rows)} rows")
    return out


def compute_pvp_only(src: Path | None = None, root: Path | None = None) -> dict:
    src = Path(src) if src else find_src()
    root = Path(root) if root else ROOT
    ref = load_ref()
    bg_factions = {int(k) for k in ref["bgFactions"]}
    bg_faction_names = {int(k): v for k, v in ref["bgFactions"].items()}
    bg_maps = {int(k) for k in ref["bgMaps"]}
    bg_areas = {int(k) for k in ref["bgAreas"]}
    honor_halls = {int(k) for k in ref.get("honorHalls", {})}
    bg_areas |= honor_halls
    templates = {int(k): int(v) for k, v in ref["bgFactionTemplates"].items()}
    marks = {int(k) for k in ref.get("markOfHonorItems", {})}

    # --- Forever ItemSparse ---
    sp_rank = {}
    sp_fac = {}
    sp_name = {}
    with sparse_path(src).open(newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            iid = int(r["ID"])
            sp_name[iid] = r.get("Display_lang") or ""
            rk = iint(r.get("RequiredPVPRank"))
            if rk:
                sp_rank[iid] = rk
            fac = iint(r.get("MinFactionID"))
            if fac in bg_factions:
                sp_fac[iid] = fac

    # --- Norgannon ---
    nor = norg_dir(src)
    print("loading Norgannon items/npcs/quests/objects/recipes")
    n_items = load_records(nor / "items.lua")
    n_npcs = load_records(nor / "npcs.lua")
    n_quests = load_records(nor / "quests.lua") if (nor / "quests.lua").exists() else {}
    n_objs = load_records(nor / "objects.lua") if (nor / "objects.lua").exists() else {}
    n_recipes = {}
    if (nor / "recipes.lua").exists():
        # recipes.lua may be an assignment, not packed R(); try both
        try:
            n_recipes = load_records(nor / "recipes.lua")
        except Exception:
            n_recipes = {}
    print(f"  items {len(n_items)} npcs {len(n_npcs)} quests {len(n_quests)} objects {len(n_objs)}")

    # Crafted products (any recipe output is a non-PvP source)
    crafted = set()
    if n_recipes:
        for rec in n_recipes.values():
            for key in ("product", "item", "creates", "output"):
                v = rec.get(key)
                if isinstance(v, int):
                    crafted.add(v)
            # common norgannon: maybe not packed this way
    # professions-data.js products, if present, are also crafts
    prof_path = root / "js" / "professions-data.js"
    if prof_path.exists():
        t = prof_path.read_text(encoding="utf-8")
        for m in re.finditer(r'"id"\s*:\s*(\d+)', t):
            pass
        # products often appear as recipe.item or similar; also scan "creates"
        for m in re.finditer(r'"(?:item|product|creates|output)"\s*:\s*(\d+)', t):
            crafted.add(int(m.group(1)))

    # NPC is a PvP vendor/creature if: BG area, honor hall, BG faction template, or BG map via zone.
    def npc_zone(nid):
        rec = n_npcs.get(int(nid)) or {}
        return rec.get("zone")

    def npc_is_pvp(nid) -> tuple[bool, str]:
        rec = n_npcs.get(int(nid)) or {}
        z = rec.get("zone")
        if z and int(z) in bg_areas:
            area = ref["bgAreas"].get(str(int(z))) or ref.get("honorHalls", {}).get(str(int(z)))
            name = area["name"] if isinstance(area, dict) else area
            return True, f"npc zone {z} ({name})"
        ft = rec.get("factionTemplate")
        if ft and int(ft) in templates:
            fac = templates[int(ft)]
            return True, f"npc faction {bg_faction_names[fac]}"
        # spawned in a BG area even if .zone is a parent (check spawns keys — those are zone IDs)
        spawns = rec.get("spawns") or {}
        if isinstance(spawns, dict):
            for zid in spawns:
                try:
                    zid = int(zid)
                except (TypeError, ValueError):
                    continue
                if zid in bg_areas:
                    area = ref["bgAreas"].get(str(zid)) or ref.get("honorHalls", {}).get(str(zid))
                    name = area["name"] if isinstance(area, dict) else area
                    return True, f"npc spawn zone {zid} ({name})"
        return False, ""

    # Also treat an NPC as PvP if it sells any item that requires a PvP rank or BG faction.
    # Filled after we know item requirements.
    pvp_by_stock = set()

    def obj_is_pvp(oid) -> tuple[bool, str]:
        rec = n_objs.get(int(oid)) or {}
        z = rec.get("zone")
        if z and int(z) in bg_areas:
            area = ref["bgAreas"].get(str(int(z))) or {}
            return True, f"object zone {z} ({area.get('name') if isinstance(area, dict) else area})"
        spawns = rec.get("spawns") or {}
        if isinstance(spawns, dict):
            for zid in spawns:
                try:
                    zid = int(zid)
                except (TypeError, ValueError):
                    continue
                if zid in bg_areas:
                    return True, f"object spawn zone {zid}"
        return False, ""

    def quest_is_pvp(qid) -> tuple[bool, str]:
        rec = n_quests.get(int(qid)) or {}
        zos = rec.get("zoneOrSort")
        if zos and int(zos) in bg_areas:
            area = ref["bgAreas"].get(str(int(zos))) or {}
            return True, f"quest zoneOrSort {zos} ({area.get('name') if isinstance(area, dict) else zos})"
        # reputation objectives / rewards
        for key in ("repFaction", "requiredMinRepFaction", "requiredRepFaction"):
            v = rec.get(key)
            if v and int(v) in bg_factions:
                return True, f"quest {key} {bg_faction_names[int(v)]}"
        # norgannon rewards may include rep
        rew = rec.get("rewards") or {}
        if isinstance(rew, dict):
            for key in ("rep", "reputation", "repFaction"):
                v = rew.get(key)
                if isinstance(v, int) and v in bg_factions:
                    return True, f"quest reward rep {bg_faction_names[v]}"
                if isinstance(v, dict):
                    for fk in v:
                        try:
                            if int(fk) in bg_factions:
                                return True, f"quest reward rep {bg_faction_names[int(fk)]}"
                        except (TypeError, ValueError):
                            pass
        # starters/finishers only in BG? if any starter npc is pvp-located
        for role in ("starters", "finishers"):
            block = rec.get(role) or {}
            npcs = []
            if isinstance(block, dict):
                raw = block.get("npcs") or []
                if isinstance(raw, dict):
                    npcs = list(raw.keys())
                elif isinstance(raw, list):
                    for x in raw:
                        if isinstance(x, int):
                            npcs.append(x)
                        elif isinstance(x, dict) and "id" in x:
                            npcs.append(x["id"])
            for nid in npcs:
                ok, why = npc_is_pvp(nid)
                if ok:
                    return True, f"quest {role} {why}"
        return False, ""

    # --- CMaNGOS (optional) ---
    cm_rank = {}
    cm_fac = {}
    cm_quest_pvp = {}  # qid -> reason
    cm_quest_rewards = defaultdict(list)
    cm_vendor = defaultdict(list)  # item -> [npc]
    cm_npc_pvp = {}  # nid -> reason
    cm_loot_nonpvp = defaultdict(set)  # item -> reasons (world loot from non-pvp creatures)
    cm_loot_pvp = defaultdict(set)

    gz = None
    for p in (src / "cmangos" / "ClassicDB.sql.gz", Path("/tmp/item-db-src/cmangos/ClassicDB.sql.gz")):
        if p.exists():
            gz = p
            break
    if gz:
        print("loading CMaNGOS tables from", gz)
        tables = extract_sql_tables(gz, {
            "item_template", "npc_vendor", "npc_vendor_template",
            "creature_template", "creature", "quest_template",
        })
        _, item_rows = tables["item_template"]
        for rec in item_rows:
            iid = iint(rec.get("entry"))
            if not iid:
                continue
            rk = iint(rec.get("requiredhonorrank"))
            if rk:
                cm_rank[iid] = rk
            fac = iint(rec.get("RequiredReputationFaction"))
            if fac in bg_factions:
                cm_fac[iid] = fac
        # creature template faction + Vendor vendor id
        ct_faction = {}
        ct_name = {}
        for rec in tables["creature_template"][1]:
            nid = iint(rec.get("Entry"))
            ct_faction[nid] = iint(rec.get("Faction"))
            ct_name[nid] = rec.get("Name") or ""
            fac = iint(rec.get("Faction"))
            if fac in templates:
                cm_npc_pvp[nid] = f"CMaNGOS faction {bg_faction_names[templates[fac]]}"
        # creature spawns on BG maps / honor halls
        npc_maps = defaultdict(set)
        for rec in tables["creature"][1]:
            nid = iint(rec.get("id"))
            mp = iint(rec.get("map"))
            npc_maps[nid].add(mp)
            if mp in bg_maps:
                cm_npc_pvp[nid] = f"CMaNGOS spawn map {mp} ({ref['bgMaps'][str(mp)]})"
        _, vendor_rows = tables["npc_vendor"]
        for rec in vendor_rows:
            nid, iid = iint(rec.get("entry")), iint(rec.get("item"))
            if nid and iid:
                cm_vendor[iid].append(nid)
        # vendor templates? would need creature_template VendorTemplateId — not always present in classic
        _, qrows = tables["quest_template"]
        # column names: Type, ZoneOrSort, RewItemId1-4, RewChoiceItemId1-6,
        # RepObjectiveFaction, RequiredMinRepFaction, RewRepFaction1-5
        for rec in qrows:
            qid = iint(rec.get("entry"))
            typ = iint(rec.get("Type"))
            zos = iint(rec.get("ZoneOrSort"))
            reason = None
            if typ == 41 and zos in bg_areas:
                reason = "CMaNGOS quest Type 41 (PvP) in a battleground zone"
            elif typ == 41:
                # Type 41 is the PvP quest type, but some open-world quests are tagged
                # with it (e.g. Hinterlands "Final Message to the Wildhammer"). Do not
                # treat Type 41 alone as a battleground/honor source.
                reason = None
            elif zos in bg_areas:
                area = ref["bgAreas"].get(str(zos)) or {}
                reason = f"CMaNGOS quest ZoneOrSort {zos} ({area.get('name') if isinstance(area, dict) else zos})"
            else:
                for col in ("RepObjectiveFaction", "RequiredMinRepFaction",
                            "RewRepFaction1", "RewRepFaction2", "RewRepFaction3",
                            "RewRepFaction4", "RewRepFaction5"):
                    fac = iint(rec.get(col))
                    if fac in bg_factions:
                        reason = f"CMaNGOS quest {col} {bg_faction_names[fac]}"
                        break
            if reason:
                cm_quest_pvp[qid] = reason
            for col in [f"RewItemId{i}" for i in range(1, 5)] + [f"RewChoiceItemId{i}" for i in range(1, 7)]:
                iid = iint(rec.get(col))
                if iid:
                    cm_quest_rewards[iid].append(qid)
        print(f"  honor-rank items {len(cm_rank)} BG-rep items {len(cm_fac)} PvP quests {len(cm_quest_pvp)} vendor rows {sum(len(v) for v in cm_vendor.values())}")

    # Item requires PvP (rank or BG faction)
    def item_requires_pvp(iid) -> list[str]:
        reasons = []
        rec = n_items.get(iid) or {}
        if iid in sp_rank:
            reasons.append(f"Forever RequiredPVPRank {sp_rank[iid]}")
        elif rec.get("pvpRank"):
            reasons.append(f"Norgannon pvpRank {rec.get('pvpRank')}")
        elif iid in cm_rank:
            reasons.append(f"CMaNGOS requiredhonorrank {cm_rank[iid]}")
        fac = sp_fac.get(iid) or (int(rec["repFaction"]) if rec.get("repFaction") and int(rec["repFaction"]) in bg_factions else None) or cm_fac.get(iid)
        if fac:
            srcn = "Forever MinFactionID" if iid in sp_fac else ("Norgannon repFaction" if rec.get("repFaction") and int(rec.get("repFaction") or 0) in bg_factions else "CMaNGOS RequiredReputationFaction")
            reasons.append(f"{srcn} {bg_faction_names[int(fac)]}")
        return reasons

    # Stock counts of PvP-required items per vendor (Forever + CMaNGOS + Norgannon).
    stock_total = defaultdict(int)
    stock_pvp = defaultdict(int)
    def _note_stock(nid, iid):
        try:
            nid, iid = int(nid), int(iid)
        except (TypeError, ValueError):
            return
        stock_total[nid] += 1
        if item_requires_pvp(iid):
            stock_pvp[nid] += 1
    for iid, rec in n_items.items():
        vendors = rec.get("vendors") or {}
        if isinstance(vendors, dict):
            for nid in vendors:
                _note_stock(nid, iid)
        # also NPC.sells (same data, fills gaps)
    for nid, rec in n_npcs.items():
        sells = rec.get("sells") or {}
        if isinstance(sells, dict):
            for iid in sells:
                _note_stock(nid, iid)
    for iid, nids in cm_vendor.items():
        for nid in nids:
            _note_stock(nid, iid)

    def vendor_kind(nid) -> tuple[str, str]:
        """Return (specialist|incidental|none, reason).

        Specialist: honor halls; BG-reputation vendors outside a battleground
        (WSG/AB/AV entrance quartermasters); or a vendor whose stock is mostly
        PvP-rank / BG-reputation items (city honor accessories quartermasters,
        AV supply officers whose items carry CMaNGOS reputation requirements).

        Incidental: general goods / reagents / food vendors who happen to stand
        in a battleground. Selling there is a PvP *location* but is not enough
        on its own to call the item PvP-only (common goods may list only those
        vendors in the extract).
        """
        nid = int(nid)
        ok, why = npc_is_pvp(nid)
        in_hall = False
        in_bg = False
        rec = n_npcs.get(nid) or {}
        hall_ids = set(honor_halls)
        zones = []
        z = rec.get("zone")
        if z:
            zones.append(int(z))
        spawns = rec.get("spawns") or {}
        if isinstance(spawns, dict):
            for zid in spawns:
                try:
                    zones.append(int(zid))
                except (TypeError, ValueError):
                    pass
        if any(z in hall_ids for z in zones):
            in_hall = True
        if any(z in bg_areas and z not in hall_ids for z in zones):
            in_bg = True
        if nid in cm_npc_pvp and "map 449" in cm_npc_pvp[nid] or (nid in cm_npc_pvp and "map 450" in cm_npc_pvp[nid]):
            in_hall = True
        if nid in cm_npc_pvp and any(s in cm_npc_pvp[nid] for s in ("map 30", "map 489", "map 529")):
            in_bg = True
        ft = rec.get("factionTemplate")
        bg_fac = bool(ft and int(ft) in templates) or (iint((n_npcs.get(nid) or {}).get("factionTemplate")) in templates)
        # CMaNGOS creature faction
        if nid in cm_npc_pvp and "faction" in cm_npc_pvp[nid]:
            bg_fac = True
        tot, pv = stock_total[nid], stock_pvp[nid]
        stock_ok = pv >= 5 and (pv / max(tot, 1)) >= 0.3
        if in_hall:
            return "specialist", why or "honor hall vendor"
        if stock_ok:
            return "specialist", f"stock is PvP-required ({pv}/{tot})"
        if bg_fac and not in_bg:
            fac = templates.get(int(ft) if ft else -1)
            label = bg_faction_names.get(fac, "battleground faction")
            return "specialist", why or f"BG-reputation vendor ({label})"
        if in_bg or bg_fac:
            return "incidental", why or cm_npc_pvp.get(nid) or "vendor located in a battleground"
        return "none", ""

    def vendor_is_pvp(nid) -> tuple[bool, str]:
        kind, why = vendor_kind(nid)
        return kind in ("specialist", "incidental"), (kind + ": " + why if why else kind)

    # Collect sources per item
    # Each source: ('pvp'|'other', kind, reason)
    sources = defaultdict(list)  # iid -> list

    def add(iid, kind, pvp, reason):
        sources[int(iid)].append({"pvp": bool(pvp), "kind": kind, "reason": reason})

    for iid, rec in n_items.items():
        vendors = rec.get("vendors") or {}
        if isinstance(vendors, dict):
            for nid in vendors:
                try:
                    nid = int(nid)
                except (TypeError, ValueError):
                    continue
                nrec = n_npcs.get(nid) or {}
                # Unplaced placeholder vendors (no zone, no spawns) are not a real source.
                if not nrec.get("zone") and not nrec.get("spawns") and nid not in cm_npc_pvp:
                    continue
                ok, why = vendor_is_pvp(nid)
                nm = nrec.get("name") or f"NPC {nid}"
                add(iid, "vendor", ok, f"{nm} ({why or 'not a PvP vendor'})")
        drops = rec.get("drops") or {}
        if isinstance(drops, dict):
            npcs = drops.get("npcs") or {}
            if isinstance(npcs, dict):
                for nid in npcs:
                    try:
                        nid = int(nid)
                    except (TypeError, ValueError):
                        continue
                    ok, why = npc_is_pvp(nid)
                    if not ok and nid in cm_npc_pvp:
                        ok, why = True, cm_npc_pvp[nid]
                    nm = (n_npcs.get(nid) or {}).get("name") or f"NPC {nid}"
                    add(iid, "drop-npc", ok, f"{nm} ({why or 'world/PVE drop'})")
            objs = drops.get("objects") or {}
            if isinstance(objs, dict):
                for oid in objs:
                    try:
                        oid = int(oid)
                    except (TypeError, ValueError):
                        continue
                    ok, why = obj_is_pvp(oid)
                    nm = (n_objs.get(oid) or {}).get("name") or f"Object {oid}"
                    add(iid, "drop-object", ok, f"{nm} ({why or 'world/PVE object'})")
            # lootTables alone: if there are no npc/object pointers, treat as unknown non-pvp
            # only when no npcs/objects were listed (the loot table is often a duplicate of npcs)
            if drops.get("lootTables") and not npcs and not objs:
                add(iid, "loot-table", False, "Norgannon loot table with no NPC/object")
        ro = rec.get("rewardOf") or {}
        qids = []
        if isinstance(ro, dict):
            qids = [int(x) for x in ro]
        elif isinstance(ro, list):
            qids = [int(x) for x in ro]
        elif isinstance(ro, int):
            qids = [ro]
        for qid in qids:
            ok, why = quest_is_pvp(qid)
            if not ok and qid in cm_quest_pvp:
                ok, why = True, cm_quest_pvp[qid]
            title = (n_quests.get(qid) or {}).get("name") or f"Quest {qid}"
            add(iid, "quest", ok, f"{title} ({why or 'non-PvP quest'})")

    # CMaNGOS vendors / quests not already listed
    for iid, nids in cm_vendor.items():
        have = {(s["kind"], s["reason"]) for s in sources[iid]}
        for nid in nids:
            ok, why = vendor_is_pvp(nid)
            nm = (n_npcs.get(nid) or {}).get("name") or ct_name.get(nid) if 'ct_name' in dir() else None
            nm = nm or f"NPC {nid}"
            reason = f"{nm} ({why or 'not a PvP vendor'}) [CMaNGOS]"
            add(iid, "vendor", ok, reason)
    for iid, qids in cm_quest_rewards.items():
        for qid in qids:
            ok, why = quest_is_pvp(qid)
            if not ok and qid in cm_quest_pvp:
                ok, why = True, cm_quest_pvp[qid]
            title = (n_quests.get(qid) or {}).get("name") or f"Quest {qid}"
            add(iid, "quest", ok, f"{title} ({why or 'non-PvP quest'}) [CMaNGOS]")

    # Mark of Honor tokens themselves (from BG wins / BG quests)
    for iid in marks:
        # if they have no sources, still PvP
        pass

    # Crafted
    for iid in crafted:
        if iid:
            add(iid, "craft", False, "profession recipe")

    # Decide
    pvp_only = {}
    also_pvp = {}  # has a PvP source AND a non-PvP source (not flagged, reported)
    require_only = {}  # requirement but conflicting sources go to also/not

    all_ids = set(sources) | set(sp_rank) | set(sp_fac) | set(cm_rank) | set(cm_fac) | set(marks)
    for rec in n_items.values():
        if rec.get("pvpRank") or (rec.get("repFaction") and int(rec.get("repFaction") or 0) in bg_factions):
            # need the id
            pass
    for iid, rec in n_items.items():
        if rec.get("pvpRank") or (rec.get("repFaction") and int(rec.get("repFaction") or 0) in bg_factions):
            all_ids.add(iid)
    all_ids |= marks

    for iid in all_ids:
        srcs = sources.get(iid) or []
        req = item_requires_pvp(iid)
        is_mark = iid in marks
        pvp_srcs = [s for s in srcs if s["pvp"]]
        other = [s for s in srcs if not s["pvp"]]
        name = sp_name.get(iid) or (n_items.get(iid) or {}).get("name") or f"Item {iid}"
        # Incidental BG general-goods vendors are not enough on their own.
        strong = [s for s in pvp_srcs if "incidental:" not in str(s.get("reason") or "")]
        # quest, drop, specialist vendor, requirement, mark are strong
        has_strong = bool(strong or req or is_mark)

        if other and (pvp_srcs or req or is_mark):
            also_pvp[iid] = {"id": iid, "name": name, "requires": req, "pvp": pvp_srcs, "other": other}
            continue
        if other and not pvp_srcs and not req and not is_mark:
            continue  # purely PvE, ignore
        # no non-PvP sources; only flag when a strong PvP source (or requirement) exists
        if has_strong:
            pvp_srcs = strong or pvp_srcs
            reasons = list(req)
            if is_mark:
                reasons.append("Battleground Mark of Honor (Forever ItemSparse)")
            reasons += [f"{s['kind']}: {s['reason']}" for s in pvp_srcs]
            # classify primary source bucket
            bucket = []
            if any("RequiredPVPRank" in r or "pvpRank" in r or "requiredhonorrank" in r for r in reasons):
                bucket.append("pvp-rank")
            if any("MinFactionID" in r or "repFaction" in r or "RequiredReputationFaction" in r for r in reasons):
                bucket.append("bg-reputation")
            if any(s["kind"] == "vendor" for s in pvp_srcs):
                bucket.append("pvp-vendor")
            if any(s["kind"] == "quest" for s in pvp_srcs):
                bucket.append("pvp-quest")
            if any(s["kind"].startswith("drop") for s in pvp_srcs):
                bucket.append("bg-drop")
            if is_mark:
                bucket.append("mark-of-honor")
            pvp_only[iid] = {
                "id": iid,
                "name": name,
                "buckets": bucket,
                "reasons": reasons[:12],
            }

    return {
        "pvpOnly": pvp_only,
        "alsoPvp": also_pvp,
        "counts": {
            "pvpOnly": len(pvp_only),
            "alsoPvp": len(also_pvp),
            "sparseRank": len(sp_rank),
            "sparseBgFaction": len(sp_fac),
            "norgannonPvpRank": sum(1 for r in n_items.values() if r.get("pvpRank")),
            "cmangosRank": len(cm_rank),
            "cmangosBgFaction": len(cm_fac),
            "marks": len(marks),
        },
        "ref": {
            "bgFactions": ref["bgFactions"],
            "bgMaps": ref["bgMaps"],
            "sourceBuild": ref.get("build"),
        },
    }


def apply_to_data(root: Path, pvp_ids: set[int]) -> dict:
    """Patch data/items/{index,gear,d*.js} with a pvp flag. Idempotent."""
    out_dir = root / "data" / "items"
    changed = {}

    def flag_obj(obj):
        """obj is a dict that may have id. Return whether modified."""
        iid = obj.get("id")
        if iid is None:
            return False
        want = int(iid) in pvp_ids
        has = bool(obj.get("pvp"))
        if want and not has:
            obj["pvp"] = True if "n" not in obj else 1
            # compact index uses short keys; use pvp:1
            if "n" in obj and "q" in obj and "cat" in obj:
                obj.pop("pvp", None)
                obj["pvp"] = 1
            return True
        if not want and has:
            obj.pop("pvp", None)
            return True
        return False

    # index.js
    p = out_dir / "index.js"
    t = p.read_text(encoding="utf-8")
    m = re.search(r"window\.ITEM_INDEX\s*=\s*(\[.*\]);?\s*$", t, re.S)
    if not m:
        raise SystemExit("cannot parse index.js")
    head, arr = t[:m.start(1)], json.loads(m.group(1))
    n = 0
    for it in arr:
        if flag_obj(it):
            n += 1
    p.write_text(head + json.dumps(arr, separators=(",", ":")) + ";\n", encoding="utf-8")
    changed["index.js"] = n

    # gear.js
    p = out_dir / "gear.js"
    t = p.read_text(encoding="utf-8")
    m = re.search(r"window\.ITEM_GEAR\s*=\s*(\[.*\]);?\s*$", t, re.S)
    if not m:
        raise SystemExit("cannot parse gear.js")
    head, arr = t[:m.start(1)], json.loads(m.group(1))
    n = 0
    for it in arr:
        if flag_obj(it):
            n += 1
    p.write_text(head + json.dumps(arr, separators=(",", ":")) + ";\n", encoding="utf-8")
    changed["gear.js"] = n

    # detail chunks
    for p in sorted(out_dir.glob("d[0-9]*.js")):
        t = p.read_text(encoding="utf-8")
        m = re.search(r"(window\.ITEM_DETAIL_CHUNK=window\.ITEM_DETAIL_CHUNK\|\|\{\};window\.ITEM_DETAIL_CHUNK\[)(\d+)(\]=)(\{.*\})(;?)\s*$", t, re.S)
        if not m:
            # looser
            m2 = re.search(r"window\.ITEM_DETAIL_CHUNK\[(\d+)\]=(\{.*\};?)\s*$", t, re.S)
            if not m2:
                print("warn: skip", p)
                continue
            k, blob = m2.group(1), m2.group(2)
            data = json.loads(blob.rstrip(";"))
            prefix = t[:m2.start()]
            suffix_fmt = "window.ITEM_DETAIL_CHUNK[%s]=%s;\n"
            n = 0
            for rec in data.values():
                if isinstance(rec, dict) and flag_obj(rec):
                    n += 1
            p.write_text(prefix + suffix_fmt % (k, json.dumps(data, separators=(",", ":"))) , encoding="utf-8")
            changed[p.name] = n
            continue
        k = m.group(2)
        data = json.loads(m.group(4))
        n = 0
        for rec in data.values():
            if isinstance(rec, dict) and flag_obj(rec):
                n += 1
        p.write_text(m.group(1) + k + m.group(3) + json.dumps(data, separators=(",", ":")) + ";\n", encoding="utf-8")
        changed[p.name] = n
    return changed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--root", default=str(ROOT))
    args = ap.parse_args()
    root = Path(args.root).resolve()
    result = compute_pvp_only(root=root)
    only = result["pvpOnly"]
    also = result["alsoPvp"]
    out = TOOLS / "pvp-src" / "pvp-only.json"
    slim_also = {
        str(i): {"name": v["name"], "requires": v["requires"],
                 "pvp": v["pvp"][:5], "other": v["other"][:5]}
        for i, v in list(also.items())[:200]
    }
    payload = {
        "counts": result["counts"],
        "ref": result["ref"],
        "pvpOnlyIds": sorted(int(i) for i in only),
        "pvpOnly": {str(i): v for i, v in only.items()},
        "alsoPvpSample": slim_also,
        "alsoPvpCount": len(also),
        "alsoPvpIds": sorted(int(i) for i in also),
    }
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print("counts", json.dumps(result["counts"], indent=2))
    # buckets
    from collections import Counter
    b = Counter()
    for v in only.values():
        for x in v["buckets"]:
            b[x] += 1
    print("buckets", dict(b))
    print("examples:")
    for key in ("High Warlord's Blade", "Grand Marshal's Battle Hammer", "Private's Tabard",
                "Sergeant's Cloak", "Frostwolf Plate Belt", "Ironweave Battlesuit",
                "Warsong Gulch Mark of Honor", "Rune of the Guard Captain",
                "Caretaker's Cape", "Highlander's Plate Girdle", "Stormpike Plate Girdle"):
        hits = [v for v in only.values() if v["name"] == key] or [v for v in also.values() if v["name"] == key]
        in_only = any(v["name"] == key for v in only.values())
        print(" ", key, "FLAGGED" if in_only else ("also-pvp" if hits else "not flagged / not found"), hits[:1])
    print("wrote", out, "pvp-only", len(only), "also-pvp", len(also))
    if args.apply:
        ch = apply_to_data(root, set(only))
        print("patched", ch)


if __name__ == "__main__":
    main()
