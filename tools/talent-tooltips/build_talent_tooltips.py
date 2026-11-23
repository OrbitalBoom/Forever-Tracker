#!/usr/bin/env python3
"""Build js/talent-tooltips-data.js from the live WoW: Forever client DB2.

Downloads (or reuses) wago.tools tables for the current Forever build,
maps each talent in js/talents.js to its TraitDefinition / Spell, resolves
description $tokens from SpellEffect, TraitDefinitionEffectPoints curves,
durations, and related tables, and writes a compact lookup the Talents tab
loads on demand.

Never invents numbers: a token that cannot be resolved is left in the raw
text and flagged.

Usage (from the repo root, during the Wednesday refresh):

    python3 tools/talent-tooltips/build_talent_tooltips.py
    python3 tools/talent-tooltips/build_talent_tooltips.py --cache-dir /tmp/item-db-src/forever
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TALENTS_JS = ROOT / "js" / "talents.js"
OUT_JS = ROOT / "js" / "talent-tooltips-data.js"
DEFAULT_CACHE = Path(os.environ.get("WAGO_CACHE", "/tmp/item-db-src/forever"))
DEFAULT_BUILD = os.environ.get("WAGO_BUILD", "1.60.1.71037")
USER_AGENT = (
    "ForeverTracker/1.0 (talent-tooltips; "
    "+https://orbitalboom.github.io/Forever-Tracker/)"
)
TABLES = [
    "TraitTree", "TraitNode", "TraitNodeEntry", "TraitNodeXTraitNodeEntry",
    "TraitDefinition", "TraitDefinitionEffectPoints", "TraitEdge",
    "CurvePoint",
    "Spell", "SpellName", "SpellEffect", "SpellMisc", "SpellDuration",
    "SpellRange", "SpellCastTimes", "SpellCooldowns", "SpellPower",
    "SpellLevels", "SpellAuraOptions", "SpellRadius", "SpellTargetRestrictions",
]
POWER_NAMES = {
    0: "Mana",
    1: "Rage",
    2: "Focus",
    3: "Energy",
    4: "Happiness",
    5: "Runes",
    6: "Runic Power",
}
# Tokens / identifiers that need character stats we do not have.
CHAR_STAT_MARKERS = (
    "$ap", "$rap", "$sp", "$SP", "$aph", "$apm", "$mcrit",
    "$bh", "$bc", "$mws", "$<maxAP>", "$<minDam>", "$<maxDam>",
    "$<ratio>", "$<coup>", "$<mult>", "$<minAP>",
)


def warn(msg: str) -> None:
    print(msg, file=sys.stderr)


def iint(v, default=0) -> int:
    try:
        if v is None or v == "":
            return default
        return int(float(v))
    except (TypeError, ValueError):
        return default


def fnum(v, default=0.0) -> float:
    try:
        if v is None or v == "":
            return default
        return float(v)
    except (TypeError, ValueError):
        return default


def load_csv(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def index_by(rows: list[dict], key: str) -> dict[str, dict]:
    out = {}
    for row in rows:
        out[row[key]] = row
    return out


def group_by(rows: list[dict], key: str) -> dict[str, list[dict]]:
    out = defaultdict(list)
    for row in rows:
        out[row[key]].append(row)
    return out


def fetch_build(build: str | None) -> str:
    if build:
        return build
    req = urllib.request.Request(
        "https://wago.tools/api/builds",
        headers={"User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data["wowf"][0]["version"]


def fetch_tables(cache: Path, build: str, force: bool, sleep_s: float) -> None:
    cache.mkdir(parents=True, exist_ok=True)
    (cache / "BUILD.txt").write_text(build + "\n", encoding="utf-8")
    for table in TABLES:
        dest = cache / f"{table}.csv"
        if dest.exists() and dest.stat().st_size > 80 and not force:
            continue
        url = f"https://wago.tools/db2/{table}/csv?build={build}&hotfixes=false&locale=enUS"
        print("fetch", table, url)
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/csv"})
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                body = resp.read()
        except urllib.error.HTTPError as e:
            warn(f"  {table}: HTTP {e.code}")
            continue
        dest.write_bytes(body)
        if sleep_s:
            time.sleep(sleep_s)


def load_talents(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    m = re.search(r"window\.WOW_TALENTS\s*=\s*", text)
    if not m:
        raise SystemExit(f"Could not find window.WOW_TALENTS in {path}")
    data, _ = json.JSONDecoder().raw_decode(text[m.end():])
    return data


def strip_color(text: str) -> str:
    text = re.sub(r"\|c[0-9a-fA-F]{8}", "", text, flags=re.I)
    text = re.sub(r"\|C[0-9a-fA-F]{8}", "", text)
    text = text.replace("|r", "").replace("|R", "")
    return text


def _fmt_range_bound(value: float) -> str:
    """Integer unless the bound is essentially N.5 (e.g. 46.5 to 50.5)."""
    frac = value - math.floor(value)
    if abs(frac - 0.5) < 0.02:
        return format_number(value, 1)
    return str(int(round(value)))


def format_number(value: float, precision: int | None = None) -> str:
    if value is None or (isinstance(value, float) and not math.isfinite(value)):
        return "?"
    if precision is not None:
        v = round(float(value), precision)
        if precision == 0:
            return str(int(v))
        s = f"{v:.{precision}f}"
        return s
    v = float(value)
    if abs(v - round(v)) < 1e-6:
        return str(int(round(v)))
    s = f"{v:.4f}".rstrip("0").rstrip(".")
    return s


def format_ms(ms: float, precision: int | None = None) -> str:
    if ms is None:
        return None
    sec = float(ms) / 1000.0
    if sec < 0:
        sec = abs(sec)
    if sec >= 3600 and abs(sec % 3600) < 0.05:
        hrs = int(round(sec / 3600.0))
        return "1 hr" if hrs == 1 else f"{hrs} hrs"
    if sec >= 60 and abs(sec % 60) < 0.05:
        mins = int(round(sec / 60.0))
        if mins == 1:
            return "1 min"
        return f"{mins} min"
    if sec >= 60:
        mins = sec / 60.0
        return format_number(mins, 2 if precision is None else precision) + " min"
    if precision is None:
        # Whole seconds stay whole; otherwise trim.
        if abs(sec - round(sec)) < 1e-6:
            n = int(round(sec))
            return f"{n} sec"
        return format_number(sec, 1) + " sec"
    return format_number(sec, precision) + " sec"


def format_cooldown(ms: int) -> str | None:
    if not ms:
        return None
    return format_ms(ms) + " cooldown"


def format_cast(ms: int) -> str:
    if not ms or int(ms) <= 0:
        return "Instant"
    return format_ms(ms) + " cast"


def format_range(rmax: float, display: str | None) -> str | None:
    if rmax is None:
        return None
    if rmax <= 0:
        return None
    if abs(rmax - 5) < 0.01:
        return "Melee Range"
    if rmax >= 50000:
        return None
    n = format_number(rmax)
    return f"{n} yd range"


class SpellDB:
    def __init__(self, cache: Path):
        self.cache = cache
        self.spell = index_by(load_csv(cache / "Spell.csv"), "ID")
        self.spell_name = index_by(load_csv(cache / "SpellName.csv"), "ID")
        self.effects = group_by(load_csv(cache / "SpellEffect.csv"), "SpellID")
        self.misc = group_by(load_csv(cache / "SpellMisc.csv"), "SpellID")
        self.duration = index_by(load_csv(cache / "SpellDuration.csv"), "ID")
        self.ranges = index_by(load_csv(cache / "SpellRange.csv"), "ID")
        self.cast = index_by(load_csv(cache / "SpellCastTimes.csv"), "ID")
        self.cooldowns = group_by(load_csv(cache / "SpellCooldowns.csv"), "SpellID")
        self.power = group_by(load_csv(cache / "SpellPower.csv"), "SpellID")
        self.levels = group_by(load_csv(cache / "SpellLevels.csv"), "SpellID")
        self.aura_opt = group_by(load_csv(cache / "SpellAuraOptions.csv"), "SpellID")
        self.radii = index_by(load_csv(cache / "SpellRadius.csv"), "ID") if (cache / "SpellRadius.csv").exists() else {}
        self.defs = index_by(load_csv(cache / "TraitDefinition.csv"), "ID")
        self.entries = index_by(load_csv(cache / "TraitNodeEntry.csv"), "ID")
        nxe_rows = load_csv(cache / "TraitNodeXTraitNodeEntry.csv")
        self.node_entries = group_by(nxe_rows, "TraitNodeID")
        self.effect_points = group_by(load_csv(cache / "TraitDefinitionEffectPoints.csv"), "TraitDefinitionID")
        # CurveID -> list of (rank/x, value/y) sorted
        self.curves: dict[str, list[tuple[float, float]]] = defaultdict(list)
        for row in load_csv(cache / "CurvePoint.csv"):
            self.curves[row["CurveID"]].append((fnum(row["Pos_0"]), fnum(row["Pos_1"])))
        for cid in self.curves:
            self.curves[cid].sort(key=lambda p: p[0])

    def name(self, spell_id: str) -> str:
        row = self.spell_name.get(str(spell_id))
        return (row or {}).get("Name_lang") or ""

    def desc(self, spell_id: str) -> str:
        row = self.spell.get(str(spell_id)) or {}
        return row.get("Description_lang") or ""

    def aura_desc(self, spell_id: str) -> str:
        row = self.spell.get(str(spell_id)) or {}
        return row.get("AuraDescription_lang") or ""

    def misc0(self, spell_id: str) -> dict:
        rows = self.misc.get(str(spell_id)) or []
        return rows[0] if rows else {}

    def effects_of(self, spell_id: str) -> dict[int, dict]:
        out = {}
        for row in self.effects.get(str(spell_id)) or []:
            out[iint(row.get("EffectIndex"))] = row
        return out

    def levels_of(self, spell_id: str) -> dict:
        rows = self.levels.get(str(spell_id)) or []
        return rows[0] if rows else {}

    def curve_at(self, curve_id: str, rank: int) -> float | None:
        pts = self.curves.get(str(curve_id)) or []
        if not pts:
            return None
        # Exact rank match first (Pos_0 is the rank).
        for x, y in pts:
            if abs(x - rank) < 1e-6:
                return y
        # Linear interpolate / clamp
        if rank <= pts[0][0]:
            return pts[0][1]
        if rank >= pts[-1][0]:
            return pts[-1][1]
        for i in range(1, len(pts)):
            x0, y0 = pts[i - 1]
            x1, y1 = pts[i]
            if x0 <= rank <= x1:
                if x1 == x0:
                    return y1
                t = (rank - x0) / (x1 - x0)
                return y0 + t * (y1 - y0)
        return pts[-1][1]

    def definition_for_node(self, node_id: str) -> tuple[dict | None, dict | None]:
        eids = [r["TraitNodeEntryID"] for r in self.node_entries.get(str(node_id), [])]
        if not eids:
            return None, None
        entry = self.entries.get(eids[0])
        if not entry:
            return None, None
        return self.defs.get(entry["TraitDefinitionID"]), entry

    def rank_curve_values(self, defn: dict, max_rank: int) -> dict[int, dict[str, float]]:
        """Per-rank effect values from TraitDefinitionEffectPoints curves, keyed s1/m1."""
        out: dict[int, dict[str, float]] = {r: {} for r in range(1, max_rank + 1)}
        for row in self.effect_points.get(defn["ID"], []):
            idx = iint(row.get("EffectIndex"))
            cid = row.get("CurveID")
            if not cid or cid == "0":
                continue
            for rank in range(1, max_rank + 1):
                val = self.curve_at(cid, rank)
                if val is None:
                    continue
                # 1-based tooltip index
                k = str(idx + 1)
                out[rank][f"s{k}"] = val
                out[rank][f"m{k}"] = val
                out[rank][f"w{k}"] = val
        return out

    def effect_points_at_level(self, spell_id: str, level: int, effect_index_1: int) -> float | None:
        """1-based effect index, SpellEffect plus per-level scaling. No curve."""
        effs = self.effects_of(spell_id)
        row = effs.get(effect_index_1 - 1)
        if not row:
            return None
        base = fnum(row.get("EffectBasePointsF"))
        per = fnum(row.get("EffectRealPointsPerLevel"))
        if per and per != 0:
            lv = self.levels_of(spell_id)
            base_level = iint(lv.get("BaseLevel") or lv.get("SpellLevel") or 1, 1) or 1
            # Damage/heal that scales with level: base at BaseLevel, then +per per level after.
            steps = max(0, int(level) - base_level)
            return base + per * steps
        return base

    def duration_ms(self, spell_id: str, level: int) -> float | None:
        misc = self.misc0(spell_id)
        did = misc.get("DurationIndex")
        if not did or did == "0":
            return None
        row = self.duration.get(str(did))
        if not row:
            return None
        dur = fnum(row.get("Duration"))
        per = fnum(row.get("DurationPerLevel"))
        mx = fnum(row.get("MaxDuration"))
        if per:
            lv = self.levels_of(spell_id)
            base_level = iint(lv.get("BaseLevel") or lv.get("SpellLevel") or 1, 1) or 1
            dur = dur + per * max(0, int(level) - base_level)
        if mx and mx > 0:
            dur = min(dur, mx)
        return dur

    def period_ms(self, spell_id: str, effect_index_1: int) -> float | None:
        row = self.effects_of(spell_id).get(effect_index_1 - 1)
        if not row:
            return None
        return fnum(row.get("EffectAuraPeriod")) or None

    def _radius_value(self, rid: str) -> float | None:
        if not rid or rid == "0":
            return None
        r = self.radii.get(str(rid))
        if not r:
            return None
        for k in ("RadiusMax", "Radius", "RadiusMin"):
            if r.get(k) not in (None, ""):
                v = fnum(r[k])
                if v:
                    return v
        for k, v in r.items():
            if k != "ID" and fnum(v):
                return fnum(v)
        return None

    def radius(self, spell_id: str, effect_index_1: int) -> float | None:
        """$aN: radius of effect N, falling back across RadiusIndex_0/_1.

        Forever often stores the only radius on EffectRadiusIndex_1 (Index_0 is
        0). $a2 may also refer to that second slot when the spell has one effect.
        """
        effs = self.effects_of(spell_id)
        found: list[float] = []
        for i in range(0, 16):
            row = effs.get(i)
            if not row:
                continue
            for col in ("EffectRadiusIndex_0", "EffectRadiusIndex_1"):
                v = self._radius_value(row.get(col))
                if v is not None:
                    found.append(v)
        row = effs.get(effect_index_1 - 1)
        if row:
            for col in ("EffectRadiusIndex_0", "EffectRadiusIndex_1"):
                v = self._radius_value(row.get(col))
                if v is not None:
                    return v
        if not found:
            return None
        if 1 <= effect_index_1 <= len(found):
            return found[effect_index_1 - 1]
        # Single known radius: $a2 on a one-effect spell still resolves.
        if len(found) == 1:
            return found[0]
        return None

    def effect_variance(self, spell_id: str, effect_index_1: int) -> float:
        row = self.effects_of(spell_id).get(effect_index_1 - 1) or {}
        return fnum(row.get("Variance"))

    def format_points_display(self, spell_id: str, effect_index_1: int, mid: float, letter: str) -> str:
        """Bare $s/$m/$w display. $s uses Variance for a 'min to max' range."""
        mid_a = abs(float(mid))
        if letter.lower() == "s":
            var = self.effect_variance(spell_id, effect_index_1)
            if var:
                delta = abs(mid_a * var / 2.0)
                lo = mid_a - delta
                hi = mid_a + delta
                if lo != hi:
                    return f"{_fmt_range_bound(lo)} to {_fmt_range_bound(hi)}"
                return _fmt_range_bound(lo)
        return format_number(mid_a)

    def proc(self, spell_id: str) -> dict:
        rows = self.aura_opt.get(str(spell_id)) or []
        return rows[0] if rows else {}

    def ability_header(self, spell_id: str, level: int) -> dict | None:
        misc = self.misc0(spell_id)
        if not misc:
            return None
        # SPELL_ATTR0_PASSIVE
        if iint(misc.get("Attributes_0")) & 0x40:
            return None
        # Cost
        cost = None
        cost_scales = False
        for prow in self.power.get(str(spell_id)) or []:
            pct = fnum(prow.get("PowerCostPct"))
            ptype = iint(prow.get("PowerType"))
            mana = iint(prow.get("ManaCost"))
            per = iint(prow.get("ManaCostPerLevel"))
            name = POWER_NAMES.get(ptype, "Power")
            if pct:
                if ptype == 0:
                    cost = f"{format_number(pct)}% of base mana"
                else:
                    cost = f"{format_number(pct)}% of base {name.lower()}"
            elif mana or per:
                amt = mana + per * max(0, int(level) - 1)
                # Rage is often stored in tenths; if type is Rage and mana is divisible by 10 and reasonably large, /10.
                if ptype == 1 and mana and mana % 10 == 0 and mana >= 10:
                    amt = amt / 10.0
                cost = f"{format_number(amt)} {name}"
                cost_scales = bool(per)
            break
        # Cooldown first so we can decide whether Vision Range is meaningful
        cd = None
        for crow in self.cooldowns.get(str(spell_id)) or []:
            ms = iint(crow.get("RecoveryTime")) or iint(crow.get("CategoryRecoveryTime"))
            if ms:
                cd = format_cooldown(ms)
                break
        # Range
        ridx = misc.get("RangeIndex")
        rng = None
        display = ""
        if ridx and ridx != "0":
            rrow = self.ranges.get(str(ridx))
            if rrow:
                display = rrow.get("DisplayName_lang") or ""
                rmax = fnum(rrow.get("RangeMax_0"))
                if display in ("Self Only", "Anywhere") or rmax <= 0 or rmax >= 50000:
                    rng = None
                elif display == "Vision Range" and not (cost or cd):
                    # Pet-aura leftovers; only show 100 yd when the spell also has a cost or CD
                    # (Intimidation, Bestial Wrath).
                    rng = None
                else:
                    rng = format_range(rmax, display)
        # Cast — CastingTimeIndex 18 is Base -1000000 (instant / next swing)
        cidx = misc.get("CastingTimeIndex")
        cast = "Instant"
        if cidx and cidx != "0":
            crow = self.cast.get(str(cidx))
            if crow:
                cast = format_cast(iint(crow.get("Base")))
        lv = self.levels_of(spell_id)
        req = iint(lv.get("SpellLevel") or lv.get("BaseLevel") or 0)
        is_ability = bool(cost or cd or rng or (cast != "Instant"))
        if not is_ability:
            return None
        return {
            "cost": cost,
            "range": rng,
            "cast": cast,
            "cooldown": cd,
            "reqLevel": req if req > 1 else None,
            "costScales": cost_scales,
        }


class Resolver:
    def __init__(self, db: SpellDB):
        self.db = db

    def resolve(
        self,
        text: str,
        spell_id: str,
        rank: int,
        level: int,
        rank_values: dict[str, float] | None = None,
        stack: set | None = None,
    ) -> tuple[str, list[str], bool]:
        """Return (resolved_text, unresolved_tokens, has_level_scaling)."""
        if not text:
            return "", [], False
        ctx = {
            "spell_id": str(spell_id),
            "rank": rank,
            "level": level,
            "values": dict(rank_values or {}),
            "stack": set(stack or ()),
        }
        rec = {"unresolved": [], "scaled": False}
        out = self._consume(text, ctx, rec)
        out = strip_color(out)
        out = re.sub(r"[ \t]+\n", "\n", out)
        out = re.sub(r"\n{3,}", "\n\n", out)
        return out.strip(), rec["unresolved"], rec["scaled"]

    def _consume(self, text: str, ctx: dict, rec: dict) -> str:
        out = []
        i = 0
        n = len(text)
        while i < n:
            if text[i] == "$":
                piece, j = self._token(text, i, ctx, rec)
                out.append(piece)
                i = j
            else:
                out.append(text[i])
                i += 1
        return "".join(out)

    def _token(self, text: str, i: int, ctx: dict, rec: dict) -> tuple[str, int]:
        n = len(text)
        if i + 1 >= n:
            return "$", i + 1
        nxt = text[i + 1]

        # $@spelldesc123 / $@spelltooltip123 / $@spellaura123
        if nxt == "@":
            m = re.match(r"\$@([a-zA-Z]+)(\d+)", text[i:])
            if m:
                kind, sid = m.group(1).lower(), m.group(2)
                return self._at_spell(kind, sid, ctx, rec), i + m.end()
            rec["unresolved"].append(text[i:i + 2])
            return text[i:i + 2], i + 2

        # $?condition[a][b]
        if nxt == "?":
            return self._conditional(text, i, ctx, rec)

        # ${expression} optional .N precision
        if nxt == "{":
            return self._brace(text, i, ctx, rec)

        # $/divisor;token  — token may be s1 or 20467s1
        if nxt == "/":
            m = re.match(r"\$/([0-9.]+);((?:\d+)?[A-Za-z][A-Za-z0-9]*)", text[i:])
            if m:
                div = float(m.group(1))
                token = m.group(2)
                val, ok = self._value_token(token, ctx, rec)
                if ok and div:
                    letter = re.search(r"[A-Za-z]", token).group(0)
                    idxm = re.search(r"(\d+)$", token)
                    # 20467s1 → spell 20467, not the trailing 1 as spell id
                    sid_m = re.match(r"(\d+)[A-Za-z]", token)
                    sid = sid_m.group(1) if sid_m else ctx["spell_id"]
                    idx = int(idxm.group(1)) if idxm and not token[-1:].isalpha() else 1
                    # If the token is just "s1", idx is 1; if "s", idx 1.
                    if token[-1:].isalpha():
                        idx = 1
                    else:
                        # strip leading spell id from the trailing number when present
                        tm = re.search(r"[A-Za-z](\d+)$", token)
                        idx = int(tm.group(1)) if tm else 1
                    return self.db.format_points_display(sid, idx, val / div, letter), i + m.end()
                rec["unresolved"].append(m.group(0))
                return m.group(0), i + m.end()

        # $l / $L pluralization: $lsingular:plural;
        if nxt in "lL":
            m = re.match(r"\$[lL]([^:;]+):([^;]+);", text[i:])
            if m:
                # Preceding number in `out` is not available here; the usual
                # form is "1 $lPoint:Points;" or "N $llevel:levels;". We look
                # at a preceding number later via a post-pass. For now pick
                # using a placeholder marker.
                return f"\x00L:{m.group(1)}:{m.group(2)}\x00", i + m.end()

        # $g male:female;
        if nxt in "gG":
            m = re.match(r"\$[gG]([^:;]+):([^;]+);", text[i:])
            if m:
                return m.group(1), i + m.end()

        # $12345s1 / $s1 / $d / $h / $n / $t / $c / $pl / $proccooldown
        m = re.match(
            r"\$(\d+)?([sSmMoOtTaAwWxXhHuUnNcdD]|pl|PL|proccooldown)(\d+)?",
            text[i:],
        )
        if m:
            raw = m.group(0)
            # Don't swallow following identifier chars that aren't part of it
            # (e.g. $d in "$d," is fine; "$desc" isn't a token we handle here)
            letter = m.group(2)
            # $pl and $proccooldown are special names
            val, ok, scaled = self._simple_value(m.group(1), letter, m.group(3), ctx, rec)
            rec["scaled"] = rec["scaled"] or scaled
            # Optional .N precision immediately after
            j = i + m.end()
            prec = None
            pm = re.match(r"\.(\d)", text[j:])
            # Only treat .N as precision when this is a ${} form; bare $s1.1 is rare.
            if ok:
                # $d is handled by the duration wrapper. $s uses Variance
                # ("315 to 333"); $s/$m/$w/$o display as absolute values
                # because the surrounding text already says "reduces" / "increases".
                if letter.lower() in ("s", "m", "w", "o") and prec is None:
                    sid = (m.group(1) or ctx["spell_id"])
                    idx = iint(m.group(3), 1) if m.group(3) else 1
                    if letter.lower() == "s":
                        return self.db.format_points_display(sid, idx, val, letter), j
                    return format_number(abs(val), prec), j
                return format_number(val, prec), j
            rec["unresolved"].append(raw)
            return raw, j

        # Unknown $... — take the run
        m = re.match(r"\$[^\s,.:;%)]+", text[i:])
        raw = m.group(0) if m else "$"
        rec["unresolved"].append(raw)
        return raw, i + len(raw)

    def _at_spell(self, kind: str, sid: str, ctx: dict, rec: dict) -> str:
        key = ("@", kind, sid)
        if key in ctx["stack"]:
            rec["unresolved"].append(f"$@{kind}{sid}")
            return f"$@{kind}{sid}"
        sub = dict(ctx)
        sub["spell_id"] = sid
        sub["values"] = {}  # use the target spell's own effects
        sub["stack"] = set(ctx["stack"]) | {key}
        if kind in ("spelldesc", "desc"):
            raw = self.db.desc(sid)
        elif kind in ("spellaura", "aura"):
            raw = self.db.aura_desc(sid) or self.db.desc(sid)
        elif kind in ("spelltooltip", "tooltip", "spellname"):
            raw = self.db.desc(sid) or self.db.aura_desc(sid)
        else:
            rec["unresolved"].append(f"$@{kind}{sid}")
            return f"$@{kind}{sid}"
        text, uns, scaled = Resolver(self.db).resolve(
            raw, sid, ctx["rank"], ctx["level"], sub["values"], sub["stack"]
        )
        rec["unresolved"].extend(uns)
        rec["scaled"] = rec["scaled"] or scaled
        return text

    def _conditional(self, text: str, i: int, ctx: dict, rec: dict) -> tuple[str, int]:
        # $?cond[then][else]  — cond may be a5487|a9634 or $n>0
        m = re.match(r"\$\?([^[]+)\[", text[i:])
        if not m:
            rec["unresolved"].append("$?")
            return "$?", i + 2
        cond = m.group(1)
        j = i + m.end() - 1  # at '['
        then, j = self._bracket(text, j)
        els, j = self._bracket(text, j)
        if then is None:
            rec["unresolved"].append(text[i:i + 8])
            return text[i:i + 8], i + 8
        # Evaluate known conditions only.
        known, truth = self._eval_cond(cond, ctx, rec)
        if not known:
            # If both sides are the same after color strip, use that.
            a = strip_color(then or "")
            b = strip_color(els or "")
            if a.strip() == b.strip():
                return self._consume(a, ctx, rec), j
            # Prefer a "Requires ..." line if present; don't invent a form.
            rec["unresolved"].append("$?")
            # Show both sides plainly if they differ, with a short note later.
            # Use the false/default branch (typically the "you don't have aura" warning).
            chosen = els if els is not None else then
            return self._consume(chosen, ctx, rec), j
        chosen = then if truth else (els or "")
        return self._consume(chosen, ctx, rec), j

    def _bracket(self, text: str, j: int) -> tuple[str | None, int]:
        if j >= len(text) or text[j] != "[":
            return None, j
        depth = 0
        k = j
        while k < len(text):
            if text[k] == "[":
                depth += 1
            elif text[k] == "]":
                depth -= 1
                if depth == 0:
                    return text[j + 1:k], k + 1
            k += 1
        return None, j

    def _eval_cond(self, cond: str, ctx: dict, rec: dict) -> tuple[bool, bool]:
        cond = cond.strip()
        # $?$n>0
        m = re.match(r"\$?n\s*([<>]=?|=+)\s*(-?\d+)$", cond)
        if m:
            val, ok = self._value_token("n", ctx, rec)
            if not ok:
                return False, False
            op, rhs = m.group(1), float(m.group(2))
            if op in (">",):
                return True, val > rhs
            if op in (">=",):
                return True, val >= rhs
            if op in ("<",):
                return True, val < rhs
            if op in ("<=",):
                return True, val <= rhs
            return True, val == rhs
        # aura/form conditions: unknown
        return False, False

    def _brace(self, text: str, i: int, ctx: dict, rec: dict) -> tuple[str, int]:
        if i + 2 >= len(text) or text[i + 1] != "{":
            return "$", i + 1
        depth = 0
        k = i + 1
        while k < len(text):
            if text[k] == "{":
                depth += 1
            elif text[k] == "}":
                depth -= 1
                if depth == 0:
                    expr = text[i + 2:k]
                    j = k + 1
                    prec = None
                    pm = re.match(r"\.(\d)", text[j:])
                    if pm:
                        prec = int(pm.group(1))
                        j += 2
                    val, ok = self._eval_expr(expr, ctx, rec)
                    if ok:
                        # Talent text already says "reduces by" / "increases by";
                        # show the magnitude, never a leading minus.
                        return format_number(abs(val), prec), j
                    rec["unresolved"].append(text[i:k + 1])
                    return text[i:k + 1], j
            k += 1
        rec["unresolved"].append("${")
        return "${", i + 2

    def _eval_expr(self, expr: str, ctx: dict, rec: dict) -> tuple[float, bool]:
        if any(m in expr for m in CHAR_STAT_MARKERS):
            return 0.0, False
        # Replace $tokens inside the expression with numbers.
        pieces = []
        s = expr
        i = 0
        while i < len(s):
            if s[i] == "$":
                # reuse _token but we need a numeric raw substitution
                # Parse a simple value token or /div form
                if s[i + 1:i + 2] == "/":
                    m = re.match(r"\$/([0-9.]+);((?:\d+)?[A-Za-z][A-Za-z0-9]*)", s[i:])
                    if not m:
                        return 0.0, False
                    val, ok = self._value_token(m.group(2), ctx, rec)
                    if not ok:
                        return 0.0, False
                    pieces.append("(" + repr(float(val / float(m.group(1)))) + ")")
                    i += m.end()
                    continue
                m = re.match(
                    r"\$(\d+)?([sSmMoOtTaAwWxXhHuUnNcdD]|pl|PL|proccooldown)(\d+)?",
                    s[i:],
                )
                if not m:
                    return 0.0, False
                val, ok, scaled = self._simple_value(m.group(1), m.group(2), m.group(3), ctx, rec)
                rec["scaled"] = rec["scaled"] or scaled
                if not ok:
                    return 0.0, False
                pieces.append("(" + repr(float(val)) + ")")
                i += m.end()
            else:
                ch = s[i]
                if ch in "0123456789.+-*/() \t":
                    pieces.append(ch)
                    i += 1
                else:
                    return 0.0, False
        formula = "".join(pieces)
        try:
            # Safe arith only
            val = self._safe_arith(formula)
            return float(val), True
        except Exception:
            return 0.0, False

    def _safe_arith(self, formula: str) -> float:
        import ast
        node = ast.parse(formula, mode="eval")
        def ev(n):
            if isinstance(n, ast.Expression):
                return ev(n.body)
            if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
                return float(n.value)
            if isinstance(n, ast.UnaryOp) and isinstance(n.op, (ast.UAdd, ast.USub)):
                v = ev(n.operand)
                return v if isinstance(n.op, ast.UAdd) else -v
            if isinstance(n, ast.BinOp) and isinstance(n.op, (ast.Add, ast.Sub, ast.Mult, ast.Div)):
                a, b = ev(n.left), ev(n.right)
                if isinstance(n.op, ast.Add):
                    return a + b
                if isinstance(n.op, ast.Sub):
                    return a - b
                if isinstance(n.op, ast.Mult):
                    return a * b
                if b == 0:
                    raise ZeroDivisionError
                return a / b
            if isinstance(n, ast.Expr):
                return ev(n.value)
            raise ValueError("unsafe")
        return ev(node)

    def _value_token(self, token: str, ctx: dict, rec: dict) -> tuple[float, bool]:
        m = re.match(r"(\d+)?([sSmMoOtTaAwWxXhHuUnNcdD]|pl|PL)(\d+)?$", token)
        if not m:
            return 0.0, False
        val, ok, scaled = self._simple_value(m.group(1), m.group(2), m.group(3), ctx, rec)
        rec["scaled"] = rec["scaled"] or scaled
        return val, ok

    def _simple_value(self, spell_digits, letter, idx_digits, ctx, rec) -> tuple[float, bool, bool]:
        letter = letter or ""
        L = letter.lower()
        sid = spell_digits or ctx["spell_id"]
        idx = iint(idx_digits, 1) if idx_digits else 1
        level = ctx["level"]
        rank = ctx["rank"]
        same = str(sid) == str(ctx["spell_id"])
        values = ctx["values"] if same else {}
        scaled = False

        if L == "pl":
            return float(level), True, True

        if L == "proccooldown":
            proc = self.db.proc(sid)
            ms = fnum((proc or {}).get("ProcCategoryRecovery"))
            if not ms:
                return 0.0, False, False
            return float(ms) / 1000.0, True, False

        if L == "d":
            ms = self.db.duration_ms(sid, level)
            if ms is None:
                return 0.0, False, False
            # DurationPerLevel already applied; flag scaled if that table had per-level
            lvrow = self.db.duration.get(str((self.db.misc0(sid) or {}).get("DurationIndex") or ""))
            if lvrow and fnum(lvrow.get("DurationPerLevel")):
                scaled = True
            # For $d we usually want seconds (not ms) as the replacement number,
            # because the surrounding text often says "$d." or "for $d". We'll
            # return seconds when the token is used as a standalone display, but
            # the caller format_number would print "3" and the original text has
            # no "sec". Classic tooltips typically expand $d to "3 sec" or "12 sec".
            # We handle this in the token method for $d specially. Here return ms
            # and let the caller decide? Better: return seconds for math ${$d-1}
            # and expand with "sec" for bare $d. The _token method will special-case
            # letter d after this. Return seconds.
            return float(ms) / 1000.0, True, scaled

        if L == "h":
            proc = self.db.proc(sid)
            if not proc:
                return 0.0, False, False
            return fnum(proc.get("ProcChance")), True, False

        if L == "n":
            proc = self.db.proc(sid)
            if proc and proc.get("ProcCharges") not in (None, "", "0"):
                return fnum(proc.get("ProcCharges")), True, False
            # Some tooltips use $n for charges from CumulativeAura
            if proc and proc.get("CumulativeAura") not in (None, "", "0"):
                return fnum(proc.get("CumulativeAura")), True, False
            return 0.0, False, False

        if L == "u":
            proc = self.db.proc(sid)
            if proc and proc.get("CumulativeAura") not in (None, "", "0"):
                return fnum(proc.get("CumulativeAura")), True, False
            return 0.0, False, False

        if L == "c":
            # Current combo points / a runtime value — unknown.
            return 0.0, False, False

        if L == "t":
            ms = self.db.period_ms(sid, idx)
            if not ms:
                return 0.0, False, False
            return float(ms) / 1000.0, True, False

        if L == "a":
            r = self.db.radius(sid, idx)
            if r is None:
                return 0.0, False, False
            return float(r), True, False

        if L in ("s", "m", "w", "o", "x"):
            key = f"{L}{idx}"
            # Prefer curve values for the talent's own spell.
            if same and f"s{idx}" in values:
                val = values[f"s{idx}"]
            elif same and f"m{idx}" in values:
                val = values[f"m{idx}"]
            else:
                val = self.db.effect_points_at_level(sid, level, idx)
                if val is None:
                    return 0.0, False, False
                # Flag scaling when RealPointsPerLevel is set
                row = self.db.effects_of(sid).get(idx - 1) or {}
                if fnum(row.get("EffectRealPointsPerLevel")):
                    scaled = True
            if L == "o":
                # Total over duration: points * (duration / period)
                per = self.db.period_ms(sid, idx)
                dur = self.db.duration_ms(sid, level)
                if per and dur and per > 0:
                    ticks = max(1, round(dur / per))
                    val = val * ticks
                    if self._duration_scales(sid):
                        scaled = True
            if L == "x":
                row = self.db.effects_of(sid).get(idx - 1) or {}
                val = fnum(row.get("EffectChainTargets")) or val
            return float(val), True, scaled

        return 0.0, False, False

    def _duration_scales(self, sid: str) -> bool:
        misc = self.db.misc0(sid)
        row = self.db.duration.get(str(misc.get("DurationIndex") or ""))
        return bool(row and fnum(row.get("DurationPerLevel")))


def apply_plural_markers(text: str) -> str:
    """Replace \\x00L:singular:plural\\x00 using the number just before it."""
    def repl(m):
        prefix, singular, plural = m.group(1), m.group(2), m.group(3)
        num = re.search(r"(-?\d+(?:\.\d+)?)(?!.*\d)\D*$", prefix)
        word = singular
        if num:
            try:
                v = float(num.group(1))
                if abs(v) != 1:
                    word = plural
            except ValueError:
                pass
        return prefix + word
    return re.sub(r"([^\x00]*)\x00L:([^:]+):([^\x00]+)\x00", repl, text)


def expand_duration_words(text: str, originals: str) -> str:
    """Bare $d / $12345d become '3 sec' / '1 min' rather than a bare number.

    We already resolved $d to a number of seconds. If the surrounding text
    does not already contain 'sec' or 'min' immediately after, add the unit
    when the original token was a duration token. This is applied during
    resolve for letter d in _token — see special case below. This helper
    is a no-op placeholder kept for documentation.
    """
    return text


def patch_duration_token_display(resolver: Resolver) -> None:
    """Wrap _token so bare $d / $1234d render as 'N sec' / 'N min'."""
    orig = resolver._token

    def wrapped(text, i, ctx, rec):
        m = re.match(r"\$(\d+)?([dD])(?!\w)", text[i:])
        if m and not text[i + 1:i + 2] in "{?/":
            piece, j = orig(text, i, ctx, rec)
            # If we produced a bare number, add a unit unless the next text
            # already starts with sec/min (after optional space).
            rest = text[j:]
            if re.fullmatch(r"-?\d+(?:\.\d+)?", piece or ""):
                if not re.match(r"\s*(sec|min|minute|second)", rest, re.I):
                    sec = float(piece)
                    piece = format_ms(sec * 1000.0)
            return piece, j
        return orig(text, i, ctx, rec)

    resolver._token = wrapped  # type: ignore


def normalize_text(s: str) -> str:
    s = strip_color(s or "")
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = s.replace("\u00a0", " ").replace("\u2019", "'").replace("\u2013", "-").replace("\u2014", "-")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r" *\n *", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip().rstrip(".")


def build_records(db: SpellDB, trees: list[dict], resolver: Resolver) -> tuple[dict, dict]:
    records = {}
    meta_unresolved = []
    for cls in trees:
        for tree in cls["trees"]:
            for tal in tree["talents"]:
                nid = str(tal["id"])
                defn, entry = db.definition_for_node(nid)
                if not defn:
                    meta_unresolved.append({"id": nid, "name": tal["name"], "reason": "no-trait-definition"})
                    continue
                spell_id = defn.get("VisibleSpellID") if defn.get("VisibleSpellID") not in (None, "", "0") else defn.get("SpellID")
                spell_id = str(spell_id)
                max_rank = int(tal.get("maxRank") or entry.get("MaxRanks") or 1)
                curves = db.rank_curve_values(defn, max_rank)
                raw = db.desc(spell_id) or db.aura_desc(spell_id) or ""
                # Fill curve-less effects from SpellEffect into every rank
                for r in range(1, max_rank + 1):
                    for idx, row in db.effects_of(spell_id).items():
                        k = str(idx + 1)
                        if f"s{k}" not in curves[r]:
                            # Don't pre-fill scaled effects (level-dependent).
                            if fnum(row.get("EffectRealPointsPerLevel")):
                                continue
                            val = fnum(row.get("EffectBasePointsF"))
                            curves[r][f"s{k}"] = val
                            curves[r][f"m{k}"] = val
                            curves[r][f"w{k}"] = val
                ranks_out = []
                any_unresolved = []
                for r in range(1, max_rank + 1):
                    # Resolve at a reference level 60 first to see if it scales.
                    t60, uns60, scaled = resolver.resolve(raw, spell_id, r, 60, curves[r])
                    t60 = apply_plural_markers(t60)
                    entry_r = {
                        "rank": r,
                        "text": t60,
                        "unresolved": uns60,
                        "scaled": bool(scaled),
                    }
                    if scaled:
                        by_level = {}
                        for lv in range(1, 61):
                            t, uns, _ = resolver.resolve(raw, spell_id, r, lv, curves[r])
                            t = apply_plural_markers(t)
                            by_level[str(lv)] = t
                        entry_r["byLevel"] = by_level
                        # Keep text as level-60 default
                    ranks_out.append(entry_r)
                    any_unresolved.extend(uns60)
                # Ability header at a few levels if cost scales; else once
                header60 = db.ability_header(spell_id, 60)
                header29 = db.ability_header(spell_id, 29)
                ability = header60
                rec = {
                    "id": int(tal["id"]),
                    "name": tal["name"],
                    "class": cls["name"],
                    "tree": tree["name"],
                    "maxRank": max_rank,
                    "spellId": int(spell_id) if str(spell_id).isdigit() else spell_id,
                    "reqPoints": tal.get("reqPoints") if tal.get("reqPoints") is not None else (tal["row"] - 1) * 5,
                    "prereq": tal.get("prereq"),
                    "raw": raw,
                    "ranks": ranks_out,
                    "ability": ability,
                    "abilityAt29": header29 if header29 != header60 else None,
                }
                records[nid] = rec
                if any_unresolved:
                    meta_unresolved.append({
                        "id": nid,
                        "name": tal["name"],
                        "class": cls["name"],
                        "tokens": sorted(set(any_unresolved)),
                    })
    return records, {"unresolvedTalents": meta_unresolved}


def compare_zephras(records: dict, trees: list[dict]) -> dict:
    rows = []
    exact = 0
    total = 0
    talents_exact = 0
    talents_total = 0
    for cls in trees:
        for tree in cls["trees"]:
            for tal in tree["talents"]:
                rec = records.get(str(tal["id"]))
                talents_total += 1
                if not rec:
                    continue
                all_ok = True
                zeph = tal.get("ranks") or []
                for i, z in enumerate(zeph):
                    total += 1
                    rnk = rec["ranks"][i] if i < len(rec["ranks"]) else {}
                    ours = rnk.get("text") or ""
                    # Zephras rank text uses the spell's BaseLevel (no per-level
                    # scaling applied) for level-scaling spells. Compare that
                    # first, then the level-60 text.
                    matched = normalize_text(ours) == normalize_text(z)
                    used = ours
                    if not matched and rnk.get("byLevel"):
                        for lv in ("1", "10", "20", "30", "40", "50", "60"):
                            cand = rnk["byLevel"].get(lv)
                            if cand and normalize_text(cand) == normalize_text(z):
                                matched = True
                                used = cand
                                break
                        if not matched:
                            for cand in rnk["byLevel"].values():
                                if normalize_text(cand) == normalize_text(z):
                                    matched = True
                                    used = cand
                                    break
                    if matched:
                        exact += 1
                    else:
                        all_ok = False
                        rows.append({
                            "class": cls["name"],
                            "tree": tree["name"],
                            "name": tal["name"],
                            "id": tal["id"],
                            "rank": i + 1,
                            "zephras": z,
                            "ours": used,
                            "unresolved": rnk.get("unresolved") or [],
                            "scaled": bool(rnk.get("scaled")),
                        })
                if all_ok and zeph:
                    talents_exact += 1
    return {
        "rankExact": exact,
        "rankTotal": total,
        "rankRate": (exact / total) if total else 0,
        "talentExact": talents_exact,
        "talentTotal": talents_total,
        "mismatches": rows,
    }


def wowhelm_fetch(path: str, timeout=15) -> dict | None:
    url = "https://wowhelm.com/api/v1/forever/" + path
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        warn(f"wowhelm {path}: {e}")
        return None


def tree_slug(name: str) -> str:
    return {
        "Beast Mastery": "beast-mastery",
        "Shadow Magic": "shadow",
        "Elemental Combat": "elemental",
        "Feral Combat": "feral",
    }.get(name, name.lower().replace(" ", "-"))


def compare_wowhelm(records: dict, sample: list[dict], sleep_s: float = 0.15) -> dict:
    """Compare ability headers and description against Wowhelm spell/talent tooltips.

    Wowhelm talent text uses rank-1 SpellEffect values (it even labels
    'Shows rank 1 values' on higher ranks), so description mismatches on
    multi-rank talents are expected when curves differ from SpellEffect.
    Ability cost/range/cast/cooldown on the *spell* tooltip is the check.
    """
    ability_match = 0
    ability_total = 0
    desc_match = 0
    desc_total = 0
    notes = []
    for tal in sample:
        rec = records.get(str(tal["id"]))
        if not rec:
            continue
        sid = rec.get("spellId")
        if rec.get("ability") and sid:
            ability_total += 1
            data = wowhelm_fetch(f"spells/{sid}")
            if sleep_s:
                time.sleep(sleep_s)
            if not data:
                notes.append({"name": rec["name"], "kind": "ability", "reason": "wowhelm-missing"})
                continue
            tip = (data.get("tooltip") or {}).get("lines") or []
            # Collect wowhelm left/right header bits
            wh = " | ".join(
                (ln.get("left") or "") + (("  " + ln["right"]) if ln.get("right") else "")
                for ln in tip if ln.get("tone") in ("plain", None) and ln.get("left") not in (None, "")
            )
            ours = rec["ability"]
            parts = [ours.get("cost"), ours.get("range"), ours.get("cast"), ours.get("cooldown")]
            if ours.get("reqLevel"):
                parts.append(f"Requires Level {ours['reqLevel']}")
            ok = True
            for p in parts:
                if p and p.lower() not in wh.lower() and p.replace(" cooldown", "").lower() not in wh.lower():
                    # Instant / 100 yd range / 8% of base mana should appear
                    if p == "Instant" and "instant" not in wh.lower():
                        ok = False
                    elif p != "Instant" and p.split()[0].lower() not in wh.lower():
                        ok = False
            if ok:
                ability_match += 1
            else:
                notes.append({"name": rec["name"], "kind": "ability", "ours": ours, "wowhelm": wh})
        # Description at rank 1 vs wowhelm talent path (they use SpellEffect, not curves)
        desc_total += 1
        slug = f"tooltip/talent/{tal['class'].lower()}/{tree_slug(tal['tree'])}/{tal['id']}/1"
        # URL-encode the id path
        import urllib.parse
        enc = urllib.parse.quote(f"{tal['class'].lower()}/{tree_slug(tal['tree'])}/{tal['id']}/1", safe="")
        data = wowhelm_fetch(f"tooltip/talent/{enc}")
        if sleep_s:
            time.sleep(sleep_s)
        if not data:
            continue
        lines = [ln.get("left") or "" for ln in (data.get("lines") or []) if ln.get("tone") == "effect"]
        wh_desc = "\n".join(lines)
        ours_r1 = rec["ranks"][0]["text"] if rec["ranks"] else ""
        if normalize_text(ours_r1) == normalize_text(wh_desc):
            desc_match += 1
        else:
            notes.append({
                "name": rec["name"],
                "kind": "desc-rank1",
                "ours": ours_r1,
                "wowhelm": wh_desc,
                "note": "Wowhelm talent text often uses un-curved SpellEffect (rank-1 stale) values",
            })
    return {
        "abilityMatch": ability_match,
        "abilityTotal": ability_total,
        "descMatch": desc_match,
        "descTotal": desc_total,
        "notes": notes,
    }


def pick_sample(trees: list[dict], records: dict) -> list[dict]:
    """All Hunter BM talents, plus a spread of 24+ others (tokens, abilities)."""
    sample = []
    wanted_extra = {
        ("Hunter", "Improved Stings"),
        ("Hunter", "Sniper Shot"),
        ("Hunter", "Summon Hawk"),
        ("Hunter", "Rapid Killing"),
        ("Hunter", "Lone Wolf"),
        ("Warrior", "Improved Heroic Strike"),
        ("Warrior", "Improved Slam"),
        ("Warrior", "Bestial Wrath"),  # not warrior
        ("Paladin", "Holy Shield"),
        ("Paladin", "Reckoning"),
        ("Rogue", "Mutilate"),
        ("Rogue", "Death Mark"),
        ("Priest", "Spirit Tap"),
        ("Priest", "Prayer of Mending"),
        ("Shaman", "Mana Tide Totem"),
        ("Mage", "Ice Barrier"),
        ("Mage", "Combustion"),
        ("Warlock", "Demonic Sacrifice"),
        ("Druid", "Feral Charge"),
        ("Druid", "Swiftmend"),
        ("Druid", "Moonkin Form"),
        ("Warrior", "Recklessness"),
        ("Warrior", "Last Stand"),
        ("Paladin", "Divine Shield"),  # may not be a talent
        ("Rogue", "Adrenaline Rush"),
        ("Priest", "Shadowform"),
        ("Shaman", "Shamanistic Rage"),
        ("Mage", "Icy Veins"),
        ("Warlock", "Soul Link"),
        ("Hunter", "Scatter Shot"),
        ("Hunter", "Trueshot Aura"),
    }
    for cls in trees:
        for tree in cls["trees"]:
            for tal in tree["talents"]:
                if cls["name"] == "Hunter" and tree["name"] == "Beast Mastery":
                    sample.append({"id": tal["id"], "name": tal["name"], "class": cls["name"], "tree": tree["name"]})
                elif (cls["name"], tal["name"]) in wanted_extra:
                    sample.append({"id": tal["id"], "name": tal["name"], "class": cls["name"], "tree": tree["name"]})
    # If we still have fewer than 40 talents, add ones with ability headers, then more.
    have = {(s["class"], s["name"]) for s in sample}
    if len(sample) < 40:
        for rec in records.values():
            key = (rec["class"], rec["name"])
            if key in have:
                continue
            if rec.get("ability"):
                sample.append({"id": rec["id"], "name": rec["name"], "class": rec["class"], "tree": rec["tree"]})
                have.add(key)
            if len(sample) >= 40:
                break
    if len(sample) < 40:
        for rec in records.values():
            key = (rec["class"], rec["name"])
            if key in have:
                continue
            sample.append({"id": rec["id"], "name": rec["name"], "class": rec["class"], "tree": rec["tree"]})
            have.add(key)
            if len(sample) >= 40:
                break
    return sample


def compact_record(rec: dict) -> dict:
    out = {
        "name": rec["name"],
        "class": rec["class"],
        "tree": rec["tree"],
        "maxRank": rec["maxRank"],
        "spellId": rec["spellId"],
        "reqPoints": rec["reqPoints"],
        "ranks": [],
    }
    if rec.get("prereq"):
        out["prereq"] = rec["prereq"]
    if rec.get("ability"):
        out["ability"] = rec["ability"]
    if rec.get("abilityAt29"):
        out["abilityAt29"] = rec["abilityAt29"]
    for r in rec["ranks"]:
        rr = {"text": r["text"]}
        if r.get("unresolved"):
            rr["unresolved"] = r["unresolved"]
        if r.get("scaled") and r.get("byLevel"):
            rr["scaled"] = True
            rr["byLevel"] = r["byLevel"]
        out["ranks"].append(rr)
    return out


def write_js(payload: dict, dest: Path) -> None:
    header = (
        "/* Forever talent tooltips with $tokens resolved from the live client DB2.\n"
        f" * Build {payload['meta']['build']}. Generated by\n"
        " * tools/talent-tooltips/build_talent_tooltips.py. Talent trees are from\n"
        " * Zephras (CC BY 4.0); numbers come from wago.tools Spell / Trait tables.\n"
        " * A rank whose tokens could not be fully resolved keeps the raw token\n"
        " * and is flagged `unresolved`. Loaded only on the Talents tab.\n"
        " */\n"
    )
    dest.write_text(
        header
        + "window.WOW_TALENT_TOOLTIPS_META = "
        + json.dumps(payload["meta"], ensure_ascii=False, separators=(",", ":"))
        + ";\n"
        + "window.WOW_TALENT_TOOLTIPS = "
        + json.dumps(payload["talents"], ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("Usage", 1)[0])
    ap.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE)
    ap.add_argument("--build", default=None, help="wago.tools Forever build (default: latest wowf)")
    ap.add_argument("--force-fetch", action="store_true")
    ap.add_argument("--sleep", type=float, default=0.2)
    ap.add_argument("--out", type=Path, default=OUT_JS)
    ap.add_argument("--skip-wowhelm", action="store_true")
    args = ap.parse_args()

    build = fetch_build(args.build or DEFAULT_BUILD)
    # If a build was given as default constant, still allow --build / latest.
    if args.build:
        build = args.build
    else:
        try:
            build = fetch_build(None)
        except Exception as e:
            warn(f"Could not list wago builds ({e}); using {DEFAULT_BUILD}")
            build = DEFAULT_BUILD
    print("Forever build", build)
    fetch_tables(args.cache_dir, build, args.force_fetch, args.sleep)
    db = SpellDB(args.cache_dir)
    trees = load_talents(TALENTS_JS)
    resolver = Resolver(db)
    patch_duration_token_display(resolver)
    records, extra = build_records(db, trees, resolver)
    print(f"Mapped {len(records)} / {sum(len(t['talents']) for c in trees for t in c['trees'])} talents")

    z = compare_zephras(records, trees)
    print(
        f"Zephras rank text: {z['rankExact']}/{z['rankTotal']} exact "
        f"({z['rankRate']*100:.1f}%), talents fully matching {z['talentExact']}/{z['talentTotal']}"
    )

    sample = pick_sample(trees, records)
    print(f"Validation sample: {len(sample)} talents (includes all Hunter Beast Mastery)")
    # Zephras on the sample
    sample_ids = {str(s["id"]) for s in sample}
    s_exact = s_total = 0
    for mis in z["mismatches"]:
        if str(mis["id"]) in sample_ids:
            s_total += 0  # counted below
    # recount
    for s in sample:
        rec = records.get(str(s["id"]))
        if not rec:
            continue
        # find zephras ranks
        for cls in trees:
            for tree in cls["trees"]:
                for tal in tree["talents"]:
                    if str(tal["id"]) != str(s["id"]):
                        continue
                    for i, zt in enumerate(tal.get("ranks") or []):
                        s_total += 1
                        rnk = rec["ranks"][i] if i < len(rec["ranks"]) else {}
                        ours = rnk.get("text") or ""
                        ok = normalize_text(ours) == normalize_text(zt)
                        if not ok and rnk.get("byLevel"):
                            ok = any(normalize_text(c) == normalize_text(zt) for c in rnk["byLevel"].values())
                        if ok:
                            s_exact += 1

    wh = {"abilityMatch": 0, "abilityTotal": 0, "descMatch": 0, "descTotal": 0, "notes": []}
    if not args.skip_wowhelm:
        print("Comparing ability headers and rank-1 text to Wowhelm…")
        wh = compare_wowhelm(records, sample, sleep_s=0.2)
        print(
            f"Wowhelm ability headers: {wh['abilityMatch']}/{wh['abilityTotal']}; "
            f"rank-1 descriptions: {wh['descMatch']}/{wh['descTotal']} "
            "(Wowhelm often uses un-curved SpellEffect values)"
        )

    # Unresolved counts
    talents_with_unresolved = 0
    ranks_with_unresolved = 0
    for rec in records.values():
        u = False
        for r in rec["ranks"]:
            if r.get("unresolved"):
                ranks_with_unresolved += 1
                u = True
        if u:
            talents_with_unresolved += 1
    print(f"Unresolved: {talents_with_unresolved} talents, {ranks_with_unresolved} ranks (raw tokens kept)")

    compact = {tid: compact_record(rec) for tid, rec in records.items()}
    meta = {
        "build": build,
        "source": "wago.tools DB2 (Spell, SpellEffect, SpellMisc, SpellDuration, SpellRange, "
                  "SpellCastTimes, SpellCooldowns, SpellPower, SpellLevels, SpellAuraOptions, "
                  "TraitDefinition, TraitDefinitionEffectPoints, CurvePoint)",
        "generated": time.strftime("%Y-%m-%d"),
        "talentCount": len(compact),
        "unresolvedTalents": talents_with_unresolved,
        "unresolvedRanks": ranks_with_unresolved,
        "zephrasRanksExact": z["rankExact"],
        "zephrasRanksTotal": z["rankTotal"],
        "validation": {
            "sampleTalents": len(sample),
            "sampleIncludesAllHunterBM": True,
            "zephrasSampleExact": s_exact,
            "zephrasSampleTotal": s_total,
            "wowhelmAbilityExact": wh["abilityMatch"],
            "wowhelmAbilityTotal": wh["abilityTotal"],
            "wowhelmDescRank1Exact": wh["descMatch"],
            "wowhelmDescRank1Total": wh["descTotal"],
            "wowhelmNote": (
                "Wowhelm talent descriptions use rank-1 SpellEffect values and do not "
                "apply TraitDefinitionEffectPoints curves, so multi-rank number mismatches "
                "there are expected. Zephras per-rank text is the primary description check."
            ),
        },
    }
    write_js({"meta": meta, "talents": compact}, args.out)
    print(f"Wrote {args.out} ({args.out.stat().st_size} bytes)")

    # Write a short validation report next to the script for the README / operator.
    report = {
        "build": build,
        "zephras": {k: z[k] for k in ("rankExact", "rankTotal", "rankRate", "talentExact", "talentTotal")},
        "sample": {
            "talents": [{"class": s["class"], "tree": s["tree"], "name": s["name"], "id": s["id"]} for s in sample],
            "zephrasExact": s_exact,
            "zephrasTotal": s_total,
        },
        "wowhelm": {k: wh[k] for k in wh if k != "notes"},
        "wowhelmMismatches": wh["notes"][:40],
        "unresolvedTalents": extra["unresolvedTalents"],
        "zephrasMismatchesHead": z["mismatches"][:40],
        "zephrasMismatchCount": len(z["mismatches"]),
    }
    rep_path = Path(__file__).resolve().parent / "validation-report.json"
    rep_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Validation report", rep_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
