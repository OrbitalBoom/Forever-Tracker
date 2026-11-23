#!/usr/bin/env python3
"""Patch the built item database with Forever-client-derived stats.

Fills stats / weapon / armor only when the item has no Classic (or other)
numeric stats / weapon yet. Never overwrites existing amounts.

Also attaches client effect text (ItemEffect + Spell descriptions) when the
item has no effects yet, and skill-bonus lines from known bonusStat types.
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from forever_client_stats import ForeverClientStats, SOURCE, find_forever_src

TRIGGER = {0: "Use", 1: "Equip", 2: "Chance on hit", 5: "Equip", 6: "Use"}
PLACEHOLDER_RE = re.compile(r"\$[a-zA-Z0-9/{}_:]+")

def fmt_duration(ms: int) -> str:
    if ms <= 0:
        return ""
    if ms % 60000 == 0:
        n = ms // 60000
        return f"{n} min" if n != 1 else "1 min"
    if ms % 1000 == 0:
        n = ms // 1000
        return f"{n} sec"
    return f"{ms} ms"


def load_spell_support(src: Path):
    effects_by_spell = {}
    ep = src / "SpellEffect.csv"
    if ep.exists():
        with ep.open(newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                sid = int(float(row["SpellID"] or 0))
                idx = int(float(row.get("EffectIndex") or 0))
                effects_by_spell.setdefault(sid, {})[idx] = row
    duration = {}
    dp = src / "SpellDuration.csv"
    if dp.exists():
        with dp.open(newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                duration[int(row["ID"])] = int(float(row.get("Duration") or 0))
    misc = {}
    mp = src / "SpellMisc.csv"
    if mp.exists():
        with mp.open(newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("SpellID"):
                    misc[int(row["SpellID"])] = row
    return effects_by_spell, duration, misc


def fill_placeholders(text: str, spell_id: int, effects_by_spell, duration, misc) -> str:
    if not text:
        return ""
    fx = effects_by_spell.get(spell_id) or {}
    def s_val(idx):
        row = fx.get(idx) or fx.get(idx - 1)
        if not row:
            return None
        return row.get("EffectBasePointsF") or row.get("EffectBasePoints") or ""
    def d_val():
        m = misc.get(spell_id) or {}
        did = int(float(m.get("DurationIndex") or 0) or 0)
        ms = duration.get(did, 0)
        return fmt_duration(ms) if ms else None

    def repl(m):
        tok = m.group(0)
        key = tok[1:]
        low = key.lower()
        if low in ("s1", "s", "s1.0"):
            v = s_val(0)
            return str(int(float(v))) if v not in (None, "") and float(v)==int(float(v)) else (str(v) if v not in (None,"") else tok)
        if low.startswith("s") and low[1:].isdigit():
            v = s_val(int(low[1:]) - 1)
            return str(int(float(v))) if v not in (None, "") and float(v)==int(float(v)) else (str(v) if v not in (None,"") else tok)
        if low in ("d1", "d"):
            v = d_val()
            return v if v else tok
        return tok

    out = re.sub(r"\$[a-zA-Z0-9]+", repl, text)
    return out


def load_spells(path: Path) -> dict:
    out = {}
    if not path.exists():
        return out
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            out[int(row["ID"])] = row
    return out


def load_item_effects(src: Path):
    xmap = {}  # item_id -> [effect_ids]
    xp = src / "ItemXItemEffect.csv"
    ep = src / "ItemEffect.csv"
    if not (xp.exists() and ep.exists()):
        return {}, {}
    with xp.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            xmap.setdefault(int(row["ItemID"]), []).append(int(row["ItemEffectID"]))
    effects = {}
    with ep.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            effects[int(row["ID"])] = row
    return xmap, effects


def clean_desc(text: str) -> str:
    if not text:
        return ""
    t = text.replace("|n", " ").replace("\r", " ").replace("\n", " ")
    t = re.sub(r"\s+", " ", t).strip()
    return t


def effect_lines_for(item_id: int, xmap, effects, spells, effects_by_spell, duration, misc) -> list[str]:
    lines = []
    for eid in xmap.get(item_id, []):
        ev = effects.get(eid)
        if not ev:
            continue
        trig = TRIGGER.get(int(float(ev.get("TriggerType") or 0)), "Equip")
        sid = int(float(ev.get("SpellID") or 0))
        sp = spells.get(sid) or {}
        desc = clean_desc(sp.get("Description_lang") or "") or clean_desc(sp.get("AuraDescription_lang") or "")
        if desc:
            desc = fill_placeholders(desc, sid, effects_by_spell, duration, misc)
            desc = clean_desc(desc)
        if desc and PLACEHOLDER_RE.search(desc):
            # Still has tokens we cannot fill from the client tables; skip rather than invent.
            desc = ""
        if not desc:
            continue
        line = f"{trig}: {desc}"
        if line not in lines:
            lines.append(line)
    return lines


def has_numeric_stats(stats) -> bool:
    if not stats:
        return False
    return any(isinstance(v, (int, float)) and v for v in stats.values())


def has_weapon(weapon) -> bool:
    return bool(weapon and (weapon.get("dps") or weapon.get("min")))


def load_js_array(path: Path, assign: str):
    t = path.read_text(encoding="utf-8")
    m = re.search(re.escape(assign) + r"\s*=\s*(\[.*\])\s*;?\s*$", t, re.S)
    if not m:
        raise ValueError("no array " + assign + " in " + str(path))
    header = t[: m.start(1)]
    footer = t[m.end(1) :]
    return json.loads(m.group(1)), header, footer


def load_js_object(path: Path):
    t = path.read_text(encoding="utf-8")
    # window.ITEM_DETAIL_CHUNK=window.ITEM_DETAIL_CHUNK||{};window.ITEM_DETAIL_CHUNK[N]={...}
    m = re.search(r"(window\.ITEM_DETAIL_CHUNK(?:\s*=\s*window\.ITEM_DETAIL_CHUNK\s*\|\|\s*\{\}\s*)?;?\s*window\.ITEM_DETAIL_CHUNK\s*\[\s*\d+\s*\]\s*=\s*)(\{.*\})\s*;?\s*$", t, re.S)
    if not m:
        # alternate: window.ITEM_DETAIL_CHUNK[N] = {...}
        m = re.search(r"(window\.ITEM_DETAIL_CHUNK\s*\[\s*\d+\s*\]\s*=\s*)(\{.*\})\s*;?\s*$", t, re.S)
    if not m:
        raise ValueError("no detail chunk object in " + str(path))
    return json.loads(m.group(2)), m.group(1), t[m.end(2) :]


def dump_js(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def apply(root: Path, src: Path) -> dict:
    deriver = ForeverClientStats(src)
    spells = load_spells(src / "Spell.csv")
    xmap, effects = load_item_effects(src)
    effects_by_spell, duration, misc = load_spell_support(src)

    items_dir = root / "data" / "items"
    gear, g_head, g_foot = load_js_array(items_dir / "gear.js", "window.ITEM_GEAR")
    by_id = {it["id"]: it for it in gear}

    details = {}
    detail_files = {}
    for path in sorted(items_dir.glob("d*.js")):
        obj, head, foot = load_js_object(path)
        detail_files[path] = (obj, head, foot)
        for k, rec in obj.items():
            details[int(k)] = rec

    filled_stats = filled_weapon = filled_armor_only = filled_effects = skill_added = 0
    still_empty = 0
    examples = []

    # Walk every forever gear item
    targets = []
    for it in gear:
        targets.append(it)
    # also details-only gear? usually a subset. Apply to details too for all ids in chunks that are gear.
    seen = {it["id"] for it in gear}
    for rec in details.values():
        if rec.get("id") in seen:
            continue
        if rec.get("cat") == "gear" and rec.get("forever"):
            targets.append(rec)

    for it in targets:
        iid = it["id"]
        det = details.get(iid, it)
        # Merge view of current stats/weapon/effects from gear + details
        stats = dict(it.get("stats") or det.get("stats") or {})
        weapon = it.get("weapon") or det.get("weapon")
        eff = list(it.get("effects") or det.get("effects") or [])

        had_stats = has_numeric_stats(stats)
        had_weapon = has_weapon(weapon)
        derived = deriver.derive(iid)

        changed = False
        if not had_stats and derived.get("stats"):
            stats = dict(derived["stats"])
            it["stats"] = stats
            it["statSource"] = SOURCE
            if det is not it:
                det["stats"] = stats
                det["statSource"] = SOURCE
            filled_stats += 1
            changed = True
            if len(examples) < 8:
                examples.append((iid, it.get("name"), stats, derived.get("weapon")))
        if not had_weapon and derived.get("weapon"):
            weapon = dict(derived["weapon"])
            it["weapon"] = weapon
            if not it.get("statSource") and not had_stats:
                it["statSource"] = SOURCE
            if det is not it:
                det["weapon"] = weapon
                if not det.get("statSource") and not had_stats:
                    det["statSource"] = SOURCE
            filled_weapon += 1
            changed = True

        # Effects: keep existing; add skill lines and missing client effect text
        new_eff = list(eff)
        for line in derived.get("skill_effects") or []:
            if line not in new_eff:
                new_eff.append(line)
                skill_added += 1
        if not new_eff:
            extra = effect_lines_for(iid, xmap, effects, spells, effects_by_spell, duration, misc)
            for line in extra:
                if line not in new_eff:
                    new_eff.append(line)
        if new_eff != eff:
            it["effects"] = new_eff
            if det is not it:
                det["effects"] = new_eff
            if not eff and new_eff:
                filled_effects += 1
            changed = True

        if not has_numeric_stats(it.get("stats") or {}) and not has_weapon(it.get("weapon")):
            still_empty += 1

    # write gear
    (items_dir / "gear.js").write_text(g_head + dump_js(gear) + g_foot, encoding="utf-8")
    for path, (obj, head, foot) in detail_files.items():
        path.write_text(head + dump_js(obj) + foot, encoding="utf-8")

    # counts for report
    unknown = effect_only = 0
    for it in gear:
        if not it.get("forever"):
            continue
        st = has_numeric_stats(it.get("stats"))
        w = has_weapon(it.get("weapon"))
        if st or w:
            continue
        if it.get("effects"):
            effect_only += 1
        else:
            unknown += 1

    return {
        "gear": len(gear),
        "filled_stats": filled_stats,
        "filled_weapon": filled_weapon,
        "filled_effects": filled_effects,
        "skill_added": skill_added,
        "still_empty_all_targets": still_empty,
        "forever_gear_effect_only": effect_only,
        "forever_gear_still_unknown": unknown,
        "examples": examples,
    }


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[2]).resolve()
    src = find_forever_src([
        Path("/tmp/item-db-src/forever"),
        Path("/tmp/item-db-src"),
        root / "tools" / "items" / "cache",
        Path(os_env("ITEM_SRC")) if os_env("ITEM_SRC") else None,
    ])
    print("src", src, "root", root)
    info = apply(root, src)
    print(json.dumps({k: v for k, v in info.items() if k != "examples"}, indent=2))
    print("examples:")
    for ex in info["examples"]:
        print(" ", ex)


def os_env(name):
    import os
    return os.environ.get(name)


if __name__ == "__main__":
    main()
