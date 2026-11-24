#!/usr/bin/env python3
"""Build js/pets-data.js from the Forever client DB2 and Classic creature data.

Sources (never invents numbers or locations):
  * wago.tools DB2 for WoW: Forever 1.60.1.71091: CreatureFamily, ItemPetFood,
    PetLoyalty, TalentTab, SkillLine, SkillLineAbility, Spell, SpellName,
    SpellLevels, SpellEffect, SpellMisc, SpellDuration, LevelExperience.
  * CMaNGOS classic-db (GPL-3.0) creature_template (tameable flag, family,
    level, PetSpellDataId) plus Classic CreatureSpellData (1.13.7.38704 via
    wago.tools) for the spells a beast already knows when tamed.
    Forever 1.60.1.71091 does not ship CreatureSpellData.
  * NorgannonDB 1.9 (GPL-3.0; QuestieDB + CMaNGOS) for zone names and
    spawn points (zone-map percentages, not invented).

Usage:
  python3 tools/pets/build_pets.py --root . \\
    --cache /tmp/forever-71091-pets \\
    --cmangos /tmp/item-db-src/cmangos/ClassicDB.sql.gz \\
    --norgannon /tmp/norgannon
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import norgannondb  # noqa: E402

BUILD = "1.60.1.71091"
TAMEABLE_FLAG = 1  # CMaNGOS CreatureTypeFlags: CREATURE_TYPE_FLAG_TAMEABLE


def load_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def i(v, default=0) -> int:
    try:
        return int(float(v or 0))
    except (TypeError, ValueError):
        return default


def fnum(v, default=0.0) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return default


def diet_from_mask(mask: int, foods: dict[int, str]) -> list[str]:
    out = []
    for fid, name in sorted(foods.items()):
        bit = 1 << (fid - 1)
        if mask & bit:
            out.append(name)
    return out


def parse_mysql_rows(text: str):
    """Yield tuples from a MySQL VALUES (...) list."""
    i, n = 0, len(text)
    while i < n:
        while i < n and text[i] in " \t\r\n,":
            i += 1
        if i >= n:
            return
        if text[i] != "(":
            return
        i += 1
        row = []
        while True:
            while i < n and text[i] in " \t\r\n":
                i += 1
            if i >= n:
                return
            c = text[i]
            if c == ")":
                i += 1
                yield row
                break
            if c == "'":
                i += 1
                buf = []
                while i < n:
                    if text[i] == "\\":
                        if i + 1 < n:
                            buf.append(text[i + 1])
                            i += 2
                            continue
                    if text[i] == "'":
                        if i + 1 < n and text[i + 1] == "'":
                            buf.append("'")
                            i += 2
                            continue
                        i += 1
                        break
                    buf.append(text[i])
                    i += 1
                row.append("".join(buf))
            elif text.startswith("NULL", i):
                row.append(None)
                i += 4
            else:
                j = i
                while i < n and text[i] not in ",)":
                    i += 1
                tok = text[j:i].strip()
                if tok.isdigit() or (tok.startswith("-") and tok[1:].isdigit()):
                    row.append(int(tok))
                else:
                    try:
                        row.append(float(tok))
                    except ValueError:
                        row.append(tok)
            while i < n and text[i] in " \t\r\n":
                i += 1
            if i < n and text[i] == ",":
                i += 1


def extract_table(gz_path: Path, table: str) -> tuple[list[str], list[list]]:
    """Return (columns, rows) for INSERT INTO `table` statements in a .sql.gz."""
    cols: list[str] = []
    rows: list[list] = []
    ins_re = re.compile(rf"INSERT INTO `{re.escape(table)}`( \([^)]+\))? VALUES ", re.I)
    create_cols = []
    capturing_create = False
    buf = []
    with gzip.open(gz_path, "rt", encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith(f"CREATE TABLE `{table}`"):
                capturing_create = True
                buf = [line]
                continue
            if capturing_create:
                buf.append(line)
                if line.strip().startswith(")") and "ENGINE" in line.upper():
                    create_txt = "".join(buf)
                    create_cols = re.findall(r"`([^`]+)`", create_txt.split("PRIMARY")[0])
                    # first match is table name
                    if create_cols and create_cols[0] == table:
                        create_cols = create_cols[1:]
                    capturing_create = False
                continue
            if "INSERT INTO `" + table + "`" not in line:
                continue
            # may be one long line
            m = ins_re.search(line)
            if not m:
                continue
            colpart = m.group(1)
            if colpart:
                cols = re.findall(r"`([^`]+)`", colpart)
            else:
                cols = create_cols
            values = line[m.end():]
            # strip trailing semicolon
            if values.rstrip().endswith(";"):
                values = values.rstrip()[:-1]
            for row in parse_mysql_rows(values):
                rows.append(row)
    return cols, rows


def rows_as_dicts(cols, rows):
    out = []
    for row in rows:
        d = {}
        for i, c in enumerate(cols):
            d[c] = row[i] if i < len(row) else None
        out.append(d)
    return out


def fmt_duration_ms(ms: int) -> str:
    if ms <= 0:
        return ""
    if ms % 60000 == 0:
        m = ms // 60000
        return f"{m} min" if m != 1 else "1 min"
    if ms % 1000 == 0:
        s = ms // 1000
        return f"{s} sec"
    return f"{ms / 1000:g} sec"


def resolve_tokens(text: str, effects: list[dict], duration_ms: int | None) -> tuple[str, bool]:
    """Replace simple $s/$d/$m tokens from SpellEffect / duration. Leave others."""
    if not text:
        return "", True
    unresolved = False

    def effect_points(idx: int) -> str | None:
        if idx < 0 or idx >= len(effects):
            return None
        e = effects[idx]
        bp = fnum(e.get("EffectBasePointsF"))
        var = fnum(e.get("Variance"))
        # Client field is used as-is (never invented). Variance, if present, is shown as a ± hint
        # only when it is stored; we do not invent a min/max formula.
        if var:
            return f"{bp:g}"
        if bp == int(bp):
            return str(int(bp))
        return f"{bp:g}"

    def repl(m):
        nonlocal unresolved
        tok = m.group(0)
        kind = m.group(1).lower()
        n = i(m.group(2) or "1", 1)
        idx = max(0, n - 1)
        if kind in ("s", "m", "b"):
            val = effect_points(idx)
            if val is None:
                unresolved = True
                return tok
            return val
        if kind == "d":
            if duration_ms:
                return fmt_duration_ms(duration_ms)
            unresolved = True
            return tok
        unresolved = True
        return tok

    out = re.sub(r"\$(s|d|m|b|t|o|x|a)(\d+)?", repl, text, flags=re.I)
    out = re.sub(r"\|c[0-9a-fA-F]{8}", "", out)
    out = out.replace("|r", "").replace("|R", "")
    return out, not unresolved


def ability_chain(rows_for_line: list[dict]) -> dict[int, int]:
    """spellId -> 1-based rank by walking SupercedesSpell."""
    by_id = {i(r["Spell"]): r for r in rows_for_line}
    rank = {}

    def rk(sid):
        if sid in rank:
            return rank[sid]
        prev = i(by_id.get(sid, {}).get("SupercedesSpell"))
        rank[sid] = (rk(prev) + 1) if prev and prev in by_id else 1
        return rank[sid]

    for sid in by_id:
        rk(sid)
    return rank


def skip_spell_name(name: str) -> bool:
    n = (name or "").lower()
    if "dnd" in n or "scaling" in n or "tamed pet passive" in n:
        return True
    if name in ("Intimidation",):
        return True
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=Path, default=Path("."))
    ap.add_argument("--cache", type=Path, default=Path("/tmp/forever-71091-pets"))
    ap.add_argument("--cmangos", type=Path, default=Path("/tmp/item-db-src/cmangos/ClassicDB.sql.gz"))
    ap.add_argument("--norgannon", type=Path, default=Path("/tmp/norgannon"))
    ap.add_argument(
        "--spelldata",
        type=Path,
        default=Path("/tmp/forever-71091-pets/CreatureSpellData-classic-1.13.7.38704.csv"),
        help="Classic CreatureSpellData CSV (Forever does not ship this table)",
    )
    ap.add_argument("--spelldata-build", default="1.13.7.38704")
    ap.add_argument("--build", default=BUILD)
    args = ap.parse_args()
    cache = args.cache

    def T(name):
        return load_csv(cache / f"{name}.csv")

    foods = {i(r["ID"]): r["Name_lang"] for r in T("ItemPetFood")}
    families_raw = T("CreatureFamily")
    loyalty_raw = T("PetLoyalty")
    tabs = T("TalentTab")
    skill_lines = {i(r["ID"]): r.get("DisplayName_lang") or r.get("Name_lang") or "" for r in T("SkillLine")}
    sla = T("SkillLineAbility")
    spell_name = {i(r["ID"]): r["Name_lang"] for r in T("SpellName")}
    spell_txt = {i(r["ID"]): r for r in T("Spell")}
    spell_levels = {i(r["SpellID"]): r for r in T("SpellLevels") if r.get("SpellID") not in ("0", "", None)}
    spell_misc = {}
    for r in T("SpellMisc"):
        sid = i(r.get("SpellID"))
        if sid:
            spell_misc[sid] = r
    durations = {i(r["ID"]): i(r["Duration"]) for r in T("SpellDuration")}
    effects_by = defaultdict(list)
    for r in T("SpellEffect"):
        effects_by[i(r["SpellID"])].append(r)
    for sid in effects_by:
        effects_by[sid].sort(key=lambda e: i(e.get("EffectIndex")))
    xp_rows = T("LevelExperience")

    # Pet talent trees?
    pet_tabs = [r for r in tabs if i(r.get("CategoryEnumID")) != 0 or "pet" in (r.get("Name_lang") or "").lower()]
    # All current tabs are class trees (CategoryEnumID 0, class masks). No pet tabs.
    has_pet_talents = len(pet_tabs) > 0
    hunter_fam = []
    warlockish = []
    for r in families_raw:
        food = i(r["PetFoodMask"])
        s0, s1 = i(r["SkillLine_0"]), i(r["SkillLine_1"])
        rec = {
            "id": i(r["ID"]),
            "name": r["Name_lang"],
            "dietMask": food,
            "diet": diet_from_mask(food, foods),
            "skillLine": s0,
            "genericSkillLine": s1,
            "petTalentType": i(r.get("PetTalentType")),
        }
        if s1 == 270 and food > 0:
            rec["hunter"] = True
            # Classic 1.12 hunter families: ids 1-12, 20, 21, 24-27
            rec["classicFamily"] = rec["id"] in {1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 20, 21, 24, 25, 26, 27}
            hunter_fam.append(rec)
        else:
            rec["hunter"] = False
            warlockish.append(rec)

    def build_ability(r, rank):
        sid = i(r["Spell"])
        name = spell_name.get(sid, f"Spell {sid}")
        if skip_spell_name(name):
            return None
        st = spell_txt.get(sid, {})
        sub = (st.get("NameSubtext_lang") or "").strip()
        rm = re.search(r"Rank\s+(\d+)", sub, re.I)
        if rm:
            rank = i(rm.group(1), rank)
        sl = spell_levels.get(sid, {})
        req = i(sl.get("SpellLevel")) or i(sl.get("BaseLevel")) or None
        if req == 0:
            req = None
        cost = i(r.get("Field_5_5_4_67090_014_1"))
        misc = spell_misc.get(sid, {})
        dur_id = i(misc.get("DurationIndex"))
        dur_ms = durations.get(dur_id) if dur_id else None
        desc_raw = st.get("Description_lang") or ""
        aura_raw = st.get("AuraDescription_lang") or ""
        desc, ok1 = resolve_tokens(desc_raw, effects_by.get(sid, []), dur_ms)
        aura, ok2 = resolve_tokens(aura_raw, effects_by.get(sid, []), dur_ms)
        return {
            "id": sid,
            "name": name,
            "rank": rank,
            "level": req,
            "trainingPoints": cost if cost > 0 else (0 if cost == 0 and req is not None else None),
            "subtext": sub,
            "desc": desc,
            "aura": aura,
            "tokensResolved": bool(ok1 and ok2),
            "durationMs": dur_ms,
        }

    sla_by_line = defaultdict(list)
    for r in sla:
        sla_by_line[i(r["SkillLine"])].append(r)

    def abilities_for_line(line_id: int) -> list[dict]:
        rows = sla_by_line.get(line_id, [])
        ranks = ability_chain(rows)
        out = []
        seen = set()
        for r in rows:
            sid = i(r["Spell"])
            if sid in seen:
                continue
            seen.add(sid)
            ab = build_ability(r, ranks.get(sid, 1))
            if ab:
                out.append(ab)
        # group sort: name, rank
        out.sort(key=lambda a: (a["name"], a["rank"], a["id"]))
        return out

    shared = abilities_for_line(270)
    shared_names = {a["name"] for a in shared}
    for fam in hunter_fam:
        fam_abs = abilities_for_line(fam["skillLine"])
        fam["abilities"] = fam_abs
        fam["specialNames"] = []  # filled below once all families are known

    from collections import Counter
    owners = Counter()
    for fam in hunter_fam:
        for nm in {a["name"] for a in fam["abilities"]}:
            owners[nm] += 1
    for fam in hunter_fam:
        seen = []
        for a in fam["abilities"]:
            if owners[a["name"]] == 1 and a["name"] not in seen:
                seen.append(a["name"])
        fam["specialNames"] = seen

    loyalty = []
    for r in loyalty_raw:
        lid = i(r["ID"])
        name = r["Name_lang"]
        pts = i(r.get("Field_1_60_1_69876_001"))
        unused = "unused" in name.lower() or "cap" in name.lower() or name.startswith("(")
        loyalty.append({
            "id": lid,
            "name": re.sub(r"^\([^)]+\)\s*", "", name).strip() or name,
            "points": pts,
            "rawName": name,
            "unused": unused,
        })

    xp_by_level = {}
    for r in xp_rows:
        lv = i(r.get("Level") or r.get("ID"))
        exp = i(r.get("Experience"))
        if 1 <= lv <= 60:
            xp_by_level[str(lv)] = exp

    # --- Classic tame data (CMaNGOS PetSpellDataId + Classic CreatureSpellData) ---
    # Forever 1.60.1.71091 has no CreatureSpellData table (wago: "Table not found").
    # CMaNGOS creature_template.PetSpellDataId points at Classic CreatureSpellData
    # rows (the spells a beast already knows — learned by taming it).
    print("loading Classic CreatureSpellData…")
    if not args.spelldata.exists():
        raise SystemExit(f"missing CreatureSpellData CSV: {args.spelldata}")
    spelldata = {}
    for r in load_csv(args.spelldata):
        sid = i(r["ID"])
        spells = []
        for k in range(4):
            sp = i(r.get(f"Spells_{k}"))
            if sp:
                spells.append(sp)
        if sid and spells:
            spelldata[sid] = spells
    print(f"  {len(spelldata)} CreatureSpellData rows ({args.spelldata_build})")

    print("extracting CMaNGOS creature_template…")
    family_ids = {f["id"] for f in hunter_fam}
    cols_c, rows_c = extract_table(args.cmangos, "creature_template")
    idx = {c: n for n, c in enumerate(cols_c)}
    templates = {}
    needed_ids = set()
    missed_psd = 0
    for row in rows_c:
        if "Entry" not in idx:
            continue
        entry = i(row[idx["Entry"]])
        fam = i(row[idx["Family"]]) if "Family" in idx else 0
        flags = i(row[idx["CreatureTypeFlags"]]) if "CreatureTypeFlags" in idx else 0
        if fam not in family_ids:
            continue
        if not (flags & TAMEABLE_FLAG):
            continue
        psd = i(row[idx["PetSpellDataId"]]) if "PetSpellDataId" in idx else 0
        templates[entry] = {
            "id": entry,
            "name": row[idx["Name"]] if "Name" in idx else f"NPC {entry}",
            "minLevel": i(row[idx["MinLevel"]]) if "MinLevel" in idx else 1,
            "maxLevel": i(row[idx["MaxLevel"]]) if "MaxLevel" in idx else 1,
            "familyId": fam,
            "tameable": True,
            "petSpellDataId": psd,
            "rank": i(row[idx["Rank"]]) if "Rank" in idx else 0,
        }
        needed_ids.add(entry)
        if psd and psd not in spelldata:
            missed_psd += 1
    print(f"  {len(templates)} tameable hunter-family templates; {missed_psd} PetSpellDataId misses")

    # Norgannon spawns + zones
    zones = norgannondb.load_zone_names(args.norgannon / "world.lua")
    print(f"  {len(zones)} zone names")
    npcs = norgannondb.load_records(args.norgannon / "npcs.lua", ids=needed_ids) if needed_ids else {}
    sizes = {}
    world_path = args.norgannon / "world.lua"
    text_w = world_path.read_text(encoding="utf-8")
    m = re.search(r"NorgannonDB\.legacy\s*=\s*(\{.*?\}) end f\(\) end", text_w, re.S)
    if m:
        rec = norgannondb._Parser(m.group(1)).value()
        raw_sizes = rec.get("minimapSize") if isinstance(rec, dict) else None
        if isinstance(raw_sizes, dict):
            for k, v in raw_sizes.items():
                if isinstance(v, (list, tuple)) and len(v) >= 2:
                    sizes[int(k)] = [float(v[0]), float(v[1])]

    # spell id -> ability meta from our built lists
    ability_index = {}
    for a in shared:
        ability_index[a["id"]] = a
    for fam in hunter_fam:
        for a in fam["abilities"]:
            ability_index[a["id"]] = a

    sources_by_spell = defaultdict(list)
    notable_npcs = {}
    for entry, tmpl in templates.items():
        psd = tmpl["petSpellDataId"]
        raw_spells = spelldata.get(psd, [])
        taught = []
        for sid in raw_spells:
            ab = ability_index.get(sid)
            if not ab:
                nm = spell_name.get(sid, "")
                if skip_spell_name(nm) or not nm:
                    continue
                # A spell on the beast that is not in the hunter pet skill lines —
                # skip rather than invent a rank/level.
                continue
            taught.append({
                "id": ab["id"],
                "name": ab["name"],
                "rank": ab.get("rank"),
                "level": ab.get("level"),
            })
        if not taught:
            continue
        nrec = npcs.get(entry) or {}
        spawns = nrec.get("spawns") or {}
        best_zid, best_pts = None, []
        if isinstance(spawns, dict):
            for zid, pts in spawns.items():
                try:
                    zid_i = int(zid)
                except (TypeError, ValueError):
                    continue
                plist = []
                if isinstance(pts, list):
                    for p in pts:
                        if isinstance(p, (list, tuple)) and len(p) >= 2:
                            try:
                                plist.append([round(float(p[0]), 2), round(float(p[1]), 2)])
                            except (TypeError, ValueError):
                                pass
                if len(plist) > len(best_pts):
                    best_zid, best_pts = zid_i, plist
        zone_name = zones.get(best_zid) if best_zid is not None else None
        if not zone_name and nrec.get("zone"):
            zid2 = i(nrec.get("zone"))
            zone_name = zones.get(zid2)
            if best_zid is None:
                best_zid = zid2
        for ab in taught:
            sources_by_spell[ab["id"]].append({
                "id": entry,
                "name": tmpl["name"],
                "minLevel": tmpl["minLevel"],
                "maxLevel": tmpl["maxLevel"],
                "familyId": tmpl["familyId"],
                "zone": zone_name,
                "zoneId": best_zid,
                "spawnCount": len(best_pts),
                "elite": bool(tmpl.get("rank")),
            })
        notable_npcs[entry] = {
            "id": entry,
            "name": tmpl["name"],
            "minLevel": tmpl["minLevel"],
            "maxLevel": tmpl["maxLevel"],
            "familyId": tmpl["familyId"],
            "zone": zone_name,
            "zoneId": best_zid,
            "teaches": taught,
            "spawnCount": len(best_pts),
            "hasSpawns": bool(best_pts),
            "points": best_pts,
            "mapSize": sizes.get(best_zid) if best_zid is not None else None,
            "elite": bool(tmpl.get("rank")),
        }

    for sid, lst in sources_by_spell.items():
        lst.sort(key=lambda x: (x["minLevel"], x["maxLevel"], x["id"]))

    featured_ids = set()
    for sid, lst in sources_by_spell.items():
        if sid in ability_index and lst:
            featured_ids.add(lst[0]["id"])
            # a couple of alternates if the lowest-level one has no zone
            for alt in lst[1:3]:
                if not lst[0].get("zone"):
                    featured_ids.add(alt["id"])

    notable = [notable_npcs[k] for k in sorted(featured_ids, key=lambda k: (
        notable_npcs[k]["minLevel"], notable_npcs[k]["name"], k
    ))]
    # Keep spawn points only on featured rows (maps); drop from anyone else.
    featured_set = set(featured_ids)
    for entry, recn in notable_npcs.items():
        if entry not in featured_set:
            recn["points"] = []

    meta = {
        "build": args.build,
        "hasPetTalents": has_pet_talents,
        "petTalentTabs": [r["Name_lang"] for r in pet_tabs],
        "talentTabCount": len(tabs),
        "sources": [
            {
                "name": "wago.tools DB2 (Forever client)",
                "build": args.build,
                "tables": [
                    "CreatureFamily", "ItemPetFood", "PetLoyalty", "TalentTab",
                    "SkillLine", "SkillLineAbility", "Spell", "SpellName",
                    "SpellLevels", "SpellEffect", "SpellMisc", "SpellDuration",
                    "LevelExperience",
                ],
                "role": "Families, diet, loyalty ranks, ability ranks/levels/training-point costs, tooltips, XP-to-level, and the pet-talent check.",
            },
            {
                "name": "CMaNGOS classic-db",
                "license": "GPL-3.0",
                "tables": ["creature_template"],
                "role": "Tameable flag, family, level range, and PetSpellDataId on Classic creatures. Classic data, may differ in Forever.",
            },
            {
                "name": "Classic client CreatureSpellData",
                "build": "1.13.7.38704",
                "via": "wago.tools",
                "role": "Spells a beast already knows (learned by taming it). Forever 1.60.1.71091 does not ship this table. Classic data, may differ in Forever.",
            },
            {
                "name": "NorgannonDB 1.9",
                "license": "GPL-3.0",
                "url": "https://github.com/zmarotrix/NorgannonDB",
                "role": "Zone names and spawn points (zone-map percentages). Classic data, may differ in Forever.",
            },
        ],
        "notes": [
            "Forever TalentTab in this build contains only the nine class trees (CategoryEnumID 0). There are no pet talent tabs, so this page does not include a pet talent planner.",
            "Vanilla 1.12 also had no pet talents; pets used training points and loyalty. Ability training-point costs come from SkillLineAbility; required levels come from SpellLevels.",
            "Tame locations and 'abilities learned by taming' come from Classic creature data and may differ in Forever.",
            "A token in a tooltip that could not be resolved from SpellEffect / SpellDuration is left in the raw text. Numbers are never invented.",
        ],
    }

    data = {
        "meta": meta,
        "foods": [{"id": k, "name": v} for k, v in sorted(foods.items())],
        "loyalty": loyalty,
        "sharedAbilities": shared,
        "families": hunter_fam,
        "notable": notable,
        "teachSources": {
            str(sid): lst[:5]  # up to 5 lowest-level teachers; compact
            for sid, lst in sources_by_spell.items()
            if sid in ability_index
        },
        "xpByLevel": xp_by_level,
        "xpSource": {
            "table": "LevelExperience",
            "build": args.build,
            "label": "Forever client LevelExperience (build " + args.build + ")",
        },
    }

    out = args.root / "js" / "pets-data.js"
    body = (
        "/* Forever hunter pet data. Generated by tools/pets/build_pets.py. Do not hand-edit.\n"
        " * Forever client " + args.build + " via wago.tools DB2.\n"
        " * Tame locations: CMaNGOS classic-db + NorgannonDB 1.9 (GPL-3.0) — Classic data, may differ in Forever.\n"
        " */\n"
        "window.PETS_DATA = "
        + json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    out.write_text(body, encoding="utf-8")
    kb = out.stat().st_size // 1024
    print(f"wrote {out} ({kb} KB)")
    print(f"  families={len(hunter_fam)} shared={len(shared)} notable={len(notable)} "
          f"hasPetTalents={has_pet_talents} xpLevels={len(xp_by_level)}")
    for fam in hunter_fam:
        print(f"  - {fam['name']}: diet={fam['diet']} special={fam['specialNames']} abs={len(fam['abilities'])} classic={fam['classicFamily']}")


if __name__ == "__main__":
    main()
