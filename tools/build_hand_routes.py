#!/usr/bin/env python3
"""Parse public RestedXP + OpenXP Forever guides into compact JS for the local tracker.

Personal non-commercial use. Both sources are CC BY-NC-SA 4.0.
Does not touch paid RestedXP import strings.
"""
from __future__ import annotations

import csv
import json
import re
import sys
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path

RXP_ROOT = Path("/tmp/guides/RXPGuides")
OXP_ROOT = Path("/tmp/guides/OpenXP")
OUT_JS = Path("/workspace/wow-forever/js/leveling-data.js")
OUT_STATS = Path("/workspace/wow-forever/tools/hand-route-stats.json")
FQ_PATH = Path("/tmp/wowdata/quests/fq-quests.json")
CSV_BOUNDS = RXP_ROOT / "Scripts/UiMapAssignment.1.15.9.69722.csv"

RACES = [
    ("Undead", "Horde", "Scourge", "Horde"),
    ("Orc", "Horde", "Orc", "Horde"),
    ("Troll", "Horde", "Troll", "Horde"),
    ("Tauren", "Horde", "Tauren", "Horde"),
    ("Windshaper Skyborne", "Horde", "Skyborne", "Horde"),
    ("Human", "Alliance", "Human", "Alliance"),
    ("Dwarf", "Alliance", "Dwarf", "Alliance"),
    ("Gnome", "Alliance", "Gnome", "Alliance"),
    ("Night Elf", "Alliance", "NightElf", "Alliance"),
    ("High Order Skyborne", "Alliance", "Skyborne", "Alliance"),
]
CLASSES = ["Warrior", "Paladin", "Hunter", "Rogue", "Priest", "Shaman", "Mage", "Warlock", "Druid"]
# Tokens that appear in << tags but are not race/class/faction filters we evaluate as identity.
IGNORE_TOKENS = {
    "NONE", "MALE", "FEMALE", "SOD", "SOM", "ERA", "FOREVER", "CLASSIC", "TBC",
    "WOTLK", "CATA", "DF", "RETAIL", "MOP", "ENUS", "ENG",
}

STARTS = {
    "speedrun": {
        "Human": ("RestedXP Forever Guide (A)", "1-6 Northshire"),
        "NightElf": ("RestedXP Forever Guide (A)", "1-6 Shadowglen"),
        "Dwarf": ("RestedXP Forever Guide (A)", "1-5 Coldridge Valley"),
        "Gnome": ("RestedXP Forever Guide (A)", "1-5 Coldridge Valley"),
        "Orc": ("RestedXP Forever Guide (H)", "1-6 Durotar"),
        "Troll": ("RestedXP Forever Guide (H)", "1-6 Durotar"),
        "Scourge": ("RestedXP Forever Guide (H)", "1-6 Tirisfal Glades"),
        "Tauren": ("RestedXP Forever Guide (H)", "1-6 Mulgore"),
        "Skyborne": ("RestedXP Forever Guide (A)", "1-9 Zephras Isle"),  # group swapped by faction later
    },
    "dungeon": {
        "Human": ("RestedXP Forever Dungeon Guide (A)", "1-6 Northshire"),
        "NightElf": ("RestedXP Forever Dungeon Guide (A)", "1-6 Shadowglen"),
        "Dwarf": ("RestedXP Forever Dungeon Guide (A)", "1-5 Coldridge Valley"),
        "Gnome": ("RestedXP Forever Dungeon Guide (A)", "1-5 Coldridge Valley"),
        "Orc": ("RestedXP Forever Dungeon Guide (H)", "1-6 Durotar"),
        "Troll": ("RestedXP Forever Dungeon Guide (H)", "1-6 Durotar"),
        "Scourge": ("RestedXP Forever Dungeon Guide (H)", "1-6 Tirisfal Glades"),
        "Tauren": ("RestedXP Forever Dungeon Guide (H)", "1-6 Mulgore"),
        "Skyborne": ("RestedXP Forever Dungeon Guide (A)", "1-9 Zephras Isle"),
    },
}

MAGE_STARTS = {
    "Human": ("RestedXP Alliance Mage", "1-10 Elwynn Forest Mage AoE"),
    "Gnome": ("RestedXP Alliance Mage", "1-10 Dun Morogh Mage AoE"),
    # ADV pack (Human/Gnome); also used if the standard pack next is missing
    "HumanADV": ("RestedXP ADV AoE Alliance Mage", "1-10 ADV Elwynn Forest Human Mage AoE"),
    "GnomeADV": ("RestedXP ADV AoE Alliance Mage", "1-10 ADV Dun Morogh Gnome Mage AoE"),
}

HANDOFF = {
    "Horde": ("RestedXP Forever Guide (H)", "22-23 Hillsbrad/Alterac"),
    "Alliance": ("RestedXP Forever Guide (A)", "21-22 Ashenvale"),
}

NEW_ZONES = ["Zephras Isle", "Riverglades", "Shen'dralas", "Mount Hyjal", "Hyjal"]


def git_head(repo: Path):
    import subprocess
    h = subprocess.check_output(["git", "-C", str(repo), "log", "-1", "--format=%H|%cI|%s"], text=True).strip()
    sha, iso, subj = h.split("|", 2)
    return {"sha": sha, "date": iso, "subject": subj}


def load_map_tables():
    # Names from RXP forever db.lua
    text = (RXP_ROOT / "DB/forever/db.lua").read_text(errors="replace")
    name_to_id = {}
    for m in re.finditer(r'\["([^"]+)"\]\s*=\s*(\d+)', text):
        # only the mapId table region — take all numeric assignments then keep unique
        name_to_id[m.group(1)] = int(m.group(2))
    # Keep likely map ids (1000-3000 typical for classic+forever continent maps)
    # The file has other tables; filter to known continent maps and anything we see in guides.
    id_to_name = {}
    # Re-parse just addon.mapId block
    block = re.search(r"addon\.mapId\s*=\s*\{(.*?)\n\}", text, re.S)
    name_to_id = {}
    if block:
        for m in re.finditer(r'\["([^"]+)"\]\s*=\s*(\d+)', block.group(1)):
            name_to_id[m.group(1)] = int(m.group(2))
            id_to_name[int(m.group(2))] = m.group(1)
    # Extra names used by OpenXP
    extras = {
        "Shen'dralas": 16651,
        "Riverglades": 16591,
        "Mount Hyjal": 616,
        "Hillsbrad/Alterac": 1424,
        "Hillsbrad Foothills": 1424,
    }
    for n, i in extras.items():
        name_to_id.setdefault(n, i)
        id_to_name.setdefault(i, n)

    bounds = {}
    with CSV_BOUNDS.open() as f:
        for r in csv.DictReader(f):
            mid = int(r["UiMapID"])
            bounds[mid] = (
                float(r["Region_1"]),
                float(r["Region_4"]),
                float(r["Region_0"]),
                float(r["Region_3"]),
            )
    return name_to_id, id_to_name, bounds


def world_to_pct(bounds, map_id, wx, wy):
    b = bounds.get(int(map_id))
    if not b:
        return None
    minX, maxX, minY, maxY = b
    if maxX == minX or maxY == minY:
        return None
    x = (maxX - wx) / (maxX - minX) * 100
    y = (maxY - wy) / (maxY - minY) * 100
    if -5 <= x <= 105 and -5 <= y <= 105:
        return (round(x, 1), round(y, 1))
    return None


def load_quest_names():
    names = {}
    if FQ_PATH.exists():
        data = json.loads(FQ_PATH.read_text())
        for k, v in data.items():
            if isinstance(v, dict) and v.get("name"):
                names[int(v.get("id") or k)] = v["name"]
    return names


# ---------- RXP condition language (addon.applies) ----------
def applies(text, race, class_, faction, game="FOREVER"):
    if not text:
        return True
    return _parse_applies(text, race, class_, faction, game)


def _parse_applies(text, race, class_, faction, game):
    # Parentheses
    def repl(m):
        op, inner = m.group(1), m.group(2)
        ok = _parse_applies(inner, race, class_, faction, game)
        return class_ if (ok != (op == "!")) else "NULL"

    prev = None
    while prev != text:
        prev = text
        text = re.sub(r"(!?)\(\s*(.*?)\s*\)", repl, text)
    is_match = False
    class_u = class_.upper()
    game_u = game.upper()
    for alt in re.split(r"/", text):
        v = True
        for entry in re.findall(r"!?[\w\d]+", alt):
            state = False
            if entry.startswith("!"):
                entry = entry[1:]
                state = True
            if not entry:
                v = False
                break
            if entry == "Undead":
                entry = "Scourge"
            upper = entry.upper()
            if upper == "DK":
                upper = "DEATHKNIGHT"
            # Ignore season/gender tokens so they don't fail the AND
            if upper in IGNORE_TOKENS:
                ident = True
            else:
                ident = (
                    upper == class_u
                    or entry == race
                    or entry == faction
                    or upper == game_u
                    or entry == game
                )
            # v is true when (not ident) == state? Wait, original:
            # v = (not(ident) == state)
            # state=False (positive): v = ident
            # state=True (negated): v = not ident
            v = (not ident) if state else ident
            if not v:
                break
        if v:
            is_match = True
            break
    return is_match


# ---------- text cleanup ----------
COLOR = re.compile(r"\|c[0-9A-Fa-f]{8}")
TEXTURE = re.compile(r"\|T[^|]*\|t")
RXP_COLOR = re.compile(r"\|cRXP_[A-Z]+_")
BAR = re.compile(r"\|r")
NPC_ID = re.compile(r"::\d+")


def clean_text(s: str) -> str:
    if not s:
        return ""
    s = TEXTURE.sub("", s)
    s = RXP_COLOR.sub("", s)
    s = COLOR.sub("", s)
    s = BAR.sub("", s)
    s = NPC_ID.sub("", s)
    s = s.replace("|n", " ").replace("\\n", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


# ---------- parse lua guide files ----------
STEP_START = re.compile(r"^step(?:\s+(.*))?$")
HEADER = re.compile(r"^#(\w+)\s*(=?)(.*)$")
DOT = re.compile(r"^\.(\S+)\s*(.*)$")
GOTO = re.compile(
    r"^\.goto\s+(\S+?),\s*([-\d.]+),\s*([-\d.]+)(?:,\s*([-\d.]+))?(?:,\s*(\S+))?(.*)$"
)
C_COMMENT = re.compile(r"--c:([^,]+),([-\d.]+),([-\d.]+)")


def split_guides(text: str):
    parts = re.split(r"RXPGuides\.RegisterGuide\(\[\[", text)
    out = []
    for p in parts[1:]:
        block = p.split("]]", 1)[0]
        out.append(block)
    return out


def parse_header_lines(block: str, race, class_, faction):
    header = {}
    for raw in block.splitlines():
        line = raw.strip()
        if line.startswith("step"):
            break
        # strip lua comments except we may have none in headers
        if "<<" in line:
            code, tag = re.match(r"(.*?)<<\s*(.*)$", line).groups()
            if not applies(tag.strip(), race, class_, faction):
                continue
            line = code.strip()
        m = HEADER.match(line)
        if m:
            tag, _eq, val = m.group(1), m.group(2), m.group(3).strip()
            if tag not in header:
                header[tag] = val
    return header


def iter_raw_steps(block: str):
    """Yield (when, lines, start_lineno) for each step in a guide block (no applies yet)."""
    lines = block.splitlines()
    i = 0
    # skip header
    while i < len(lines) and not lines[i].strip().startswith("step"):
        i += 1
    while i < len(lines):
        raw = lines[i]
        line = raw.strip()
        m = STEP_START.match(line)
        if not m:
            i += 1
            continue
        rest = (m.group(1) or "").strip()
        when = None
        if rest.startswith("<<"):
            when = rest[2:].strip()
        elif "<<" in rest:
            when = rest.split("<<", 1)[1].strip()
        start = i + 1  # 1-based? use file-relative later
        body = []
        i += 1
        while i < len(lines) and not lines[i].strip().startswith("step"):
            body.append(lines[i])
            i += 1
        yield when, body, start


def parse_goto(line, name_to_id, id_to_name, bounds):
    """Return (zone, x, y, src) or None."""
    # Keep a possible --c comment
    c_m = C_COMMENT.search(line)
    m = GOTO.match(line.strip())
    if not m:
        # try looser
        m2 = re.match(r"^\.goto\s+(\S+)", line.strip())
        if not m2:
            return None
        return None
    zone_tok, xs, ys, rad, opt, rest = m.groups()
    try:
        x0, y0 = float(xs), float(ys)
    except ValueError:
        return None

    # Prefer author --c percentages
    if c_m:
        zname = c_m.group(1).strip()
        return zname, round(float(c_m.group(2)), 1), round(float(c_m.group(3)), 1), "guide"

    # mapId/instance,worldX,worldY
    wm = re.match(r"^(\d+)/(\d+)$", zone_tok)
    if wm:
        mid = int(wm.group(1))
        zname = id_to_name.get(mid, str(mid))
        pct = world_to_pct(bounds, mid, x0, y0)
        if pct:
            return zname, pct[0], pct[1], "guide-world"
        return zname, None, None, "world-unconverted"

    # map id or zone name with percent coords
    if re.match(r"^\d+$", zone_tok):
        mid = int(zone_tok)
        zname = id_to_name.get(mid, str(mid))
    else:
        zname = zone_tok.replace("_", " ")
        mid = name_to_id.get(zname)
    # percent if values look like 0-100 (allow slight overshoot)
    if -5 <= x0 <= 105 and -5 <= y0 <= 105:
        return zname, round(x0, 1), round(y0, 1), "guide"
    # maybe world without slash
    if mid and bounds.get(mid) and (abs(x0) > 105 or abs(y0) > 105):
        pct = world_to_pct(bounds, mid, x0, y0)
        if pct:
            return zname, pct[0], pct[1], "guide-world"
    return zname, None, None, "missing"


def extract_quest_ids(line):
    ids = []
    m = re.match(r"^\.(accept|turnin|complete|abandon)\s+(-?\d+)", line.strip())
    if m:
        ids.append(int(m.group(2)))
    return ids


def step_kind_and_bits(body_lines):
    kinds = []
    texts = []
    qids = []
    tags = []
    gotos = []  # raw, filled later
    zone_hint = None
    for raw in body_lines:
        line = raw.strip()
        if not line or line.startswith("--"):
            continue
        # trailing lua comments except --c
        if "<<" in line:
            # line-level condition handled by caller usually; keep text
            line = re.sub(r"\s*<<\s*.*$", "", line).strip()
            if not line:
                continue
        extra = ""
        if ">>" in line:
            pre, extra = line.split(">>", 1)
            line_cmd = pre.strip()
            extra = clean_text(extra)
        else:
            line_cmd = line
        if line.startswith("*") or line.startswith("+"):
            texts.append(clean_text(line[1:]))
            continue
        if line.startswith(">>"):
            texts.append(clean_text(line[2:]))
            continue
        hm = HEADER.match(line)
        if hm:
            tag, _, val = hm.group(1), hm.group(2), hm.group(3).strip()
            if tag in ("sod", "som", "season"):
                tags.append("sod")
            elif tag in ("hardcore",):
                tags.append("hardcore")
            elif tag in ("softcore",):
                tags.append("softcore")
            elif tag in ("optional",):
                tags.append("optional")
            elif tag in ("sticky",):
                tags.append("sticky")
            elif tag == "completewith":
                tags.append("completewith")
                if val:
                    texts.append("Do this until: " + val)
            elif tag == "hidewindow":
                tags.append("hidewindow")
            elif tag == "label":
                tags.append("label:" + val)
            elif tag == "include":
                kinds.append("include")
                texts.append(val)
            elif tag in ("era", "forever", "classic"):
                pass
            continue
        dm = DOT.match(line_cmd if ">>" in raw.strip() else line)
        if dm:
            tag, args = dm.group(1), dm.group(2)
            if tag == "goto":
                kinds.append("goto")
                gotos.append(raw.strip())
            elif tag == "accept":
                kinds.append("accept")
                qids += extract_quest_ids(line_cmd)
                if extra:
                    texts.append("Accept " + extra.replace("Accept ", "", 1) if not extra.lower().startswith("accept") else extra)
                elif qids:
                    texts.append("Accept quest " + str(abs(qids[-1])))
            elif tag == "turnin":
                kinds.append("turnin")
                qids += extract_quest_ids(line_cmd)
                if extra:
                    texts.append(extra if extra.lower().startswith("turn") else "Turn in " + extra)
                elif qids:
                    texts.append("Turn in quest " + str(abs(qids[-1])))
            elif tag == "complete":
                kinds.append("complete")
                qids += extract_quest_ids(line_cmd)
                texts.append(extra or clean_text(args) or "Complete objectives")
            elif tag == "hs":
                kinds.append("hearth")
                texts.append(extra or "Hearth")
            elif tag == "home":
                kinds.append("hearth")
                texts.append(extra or ("Set your hearth" + (": " + clean_text(args) if args else "")))
            elif tag == "fp":
                kinds.append("fp")
                texts.append("Get the flight path" + ((" — " + clean_text(args)) if args else "") or extra)
            elif tag == "fly":
                kinds.append("fly")
                texts.append(extra or ("Fly to " + clean_text(args)))
            elif tag in ("zone", "subzone"):
                kinds.append("travel")
                zone_hint = clean_text(args.split(">>")[0] if ">>" in args else args) or zone_hint
                texts.append(extra or ("Travel to " + (zone_hint or clean_text(args))))
            elif tag == "xp":
                kinds.append("grind")
                texts.append(extra or ("Grind: " + clean_text(args)))
            elif tag == "train":
                kinds.append("train")
                texts.append(extra or "Train class spells")
            elif tag == "vendor":
                kinds.append("vendor")
                texts.append(extra or "Visit the vendor")
            elif tag in ("collect", "collectmultiple"):
                kinds.append("collect")
                texts.append(extra or clean_text(args))
            elif tag in ("target", "mob", "unitscan"):
                if args:
                    texts.append(("Target " if tag == "target" else "Mob: ") + clean_text(re.sub(r"::\d+", "", args)))
            elif tag in ("isOnQuest", "isQuestComplete", "isQuestTurnedIn", "isQuestAvailable",
                         "isQuestNotComplete", "isQuestNotOn", "xp", "money", "itemcount",
                         "aura", "subzoneskip", "zoneskip", "maxlevel", "minlevel",
                         "cooldown", "skipgossipid", "destroy", "use", "enchant",
                         "bankdeposit", "bankwithdraw", "emote", "gossip", "skipgossip",
                         "timer", "dungeon", "enabledungeon", "disablequest", "quest"):
                if extra:
                    texts.append(extra)
            elif extra:
                texts.append(extra)
            continue
        if line.startswith("#"):
            continue
        # narrative
        if line.startswith(">>"):
            texts.append(clean_text(line[2:]))
    return kinds, texts, qids, tags, gotos, zone_hint


def pick_kind(kinds):
    order = ["accept", "turnin", "complete", "hearth", "fly", "fp", "travel", "grind", "train", "vendor", "collect", "goto"]
    for k in order:
        if k in kinds:
            if k in ("accept", "turnin", "complete"):
                return "quest"
            if k == "goto":
                return "travel"
            return k
    return "note"


def parse_files(paths, source_label, name_to_id, id_to_name, bounds, quest_names):
    """Parse files into a dict (group, name) -> chapter dict with raw steps (when kept)."""
    chapters = {}
    for path in paths:
        text = Path(path).read_text(errors="replace")
        # Don't strip comments globally; --c is needed. Strip only full-line comments later.
        for block in split_guides(text):
            # header without player filter (keep all #next variants)
            raw_header = {}
            nexts = []  # list of (when, value)
            groups = []
            for raw in block.splitlines():
                line = raw.strip()
                if line.startswith("step"):
                    break
                when = None
                if "<<" in line:
                    code, tag = re.match(r"(.*?)<<\s*(.*)$", line).groups()
                    when = tag.strip()
                    line = code.strip()
                m = HEADER.match(line)
                if not m:
                    continue
                tag, _, val = m.group(1), m.group(2), m.group(3).strip()
                if tag == "next":
                    nexts.append((when, val))
                elif tag == "group":
                    groups.append((when, val))
                    if "group" not in raw_header:
                        raw_header["group"] = val
                else:
                    raw_header.setdefault(tag, val)
            name = raw_header.get("name")
            if not name:
                continue
            # default group if missing
            group = raw_header.get("group") or "Ungrouped"
            steps = []
            for when, body, start in iter_raw_steps(block):
                # include directive may live in body
                include = None
                for bl in body:
                    hm = HEADER.match(bl.strip())
                    if hm and hm.group(1) == "include":
                        include = hm.group(3).strip()
                        break
                kinds, texts, qids, tags, gotos, zone_hint = step_kind_and_bits(body)
                # skip sod-only
                if "sod" in tags and not any(t in tags for t in ()):
                    # if the step is tagged sod (and not also era/forever which we didn't record), skip
                    pass
                coords = []
                for g in gotos:
                    parsed = parse_goto(g, name_to_id, id_to_name, bounds)
                    if parsed:
                        coords.append(parsed)
                # pick first coord with x,y else first
                coord = None
                for c in coords:
                    if c[1] is not None:
                        coord = c
                        break
                if not coord and coords:
                    coord = coords[0]
                zone = (coord[0] if coord else zone_hint) or ""
                # title: prefer a real instruction over completewith placeholders
                title = ""
                for cand in texts:
                    if cand.startswith("Do this until:") and len(texts) > 1:
                        continue
                    title = cand
                    break
                if not title:
                    if include:
                        title = "Include " + include
                    elif "accept" in kinds:
                        title = "Accept quest"
                    elif "turnin" in kinds:
                        title = "Turn in quest"
                    else:
                        title = pick_kind(kinds).title()
                # resolve quest names
                detail_bits = texts[1:] if len(texts) > 1 else []
                named = []
                for qid in qids:
                    qn = quest_names.get(abs(qid))
                    if qn:
                        named.append((abs(qid), qn))
                if named and title:
                    # if title is generic, use catalog name
                    pass
                kind = "include" if include else pick_kind(kinds)
                if "hidewindow" in tags and kind == "note" and not include and not qids:
                    continue
                if when and when.strip().lower().startswith("skip"):
                    continue
                sx = sy = ss = None
                if coord:
                    sx, sy, ss = coord[1], coord[2], coord[3]
                steps.append({
                    "when": when,
                    "kind": kind,
                    "title": title[:200],
                    "detail": " ".join(detail_bits)[:400] if detail_bits else "",
                    "zone": zone,
                    "x": sx,
                    "y": sy,
                    "ss": ss,
                    "q": [abs(q) for q in qids],
                    "tags": tags,
                    "include": include,
                    "line": start,
                })
            key = (group, name)
            rec = {
                "group": group,
                "name": name,
                "source": source_label,
                "header": raw_header,
                "nexts": nexts,
                "groups": groups,
                "defaultfor": raw_header.get("defaultfor"),
                "enabledFor": raw_header.get("enabledFor") if False else None,
                "steps": steps,
                "file": str(path),
            }
            # enabledFor may be a bare << line in the header
            # capture from original block
            en = None
            for raw in block.splitlines():
                s = raw.strip()
                if s.startswith("step"):
                    break
                m = re.match(r"^<<\s*(.*)$", s)
                if m:
                    en = m.group(1).strip()
                    break
            rec["enabledFor"] = en
            chapters[key] = rec
            # also index by name-only for lookup flexibility
    return chapters


def chapter_applies(ch, race, class_, faction):
    if ch.get("enabledFor") and not applies(ch["enabledFor"], race, class_, faction):
        return False
    df = ch.get("defaultfor")
    # defaultfor is "this is the default start for X", not a hard exclusive,
    # except when it clearly excludes the player (e.g. "none none"). We still
    # skip if defaultfor is present and has race tokens that don't include us
    # AND has no class-only purpose... Actually many mid-route chapters have
    # defaultfor !Hunter !Shaman, which IS a hard filter for who should use
    # that chapter (Orc hunters skip Silverpine). Treat defaultfor like applies.
    if df and not applies(df, race, class_, faction):
        return False
    return True


def pick_group(ch, race, class_, faction):
    for when, val in ch.get("groups") or []:
        if applies(when, race, class_, faction):
            return val
    return ch["group"]


def pick_next(ch, race, class_, faction):
    for when, val in ch.get("nexts") or []:
        if applies(when, race, class_, faction):
            return val
    return None


def find_chapter(index, group, name):
    if (group, name) in index:
        return index[(group, name)]
    # fuzzy: strip leading zeros in level range
    def norm(s):
        return re.sub(r"\s+", " ", s).strip()
    nname = norm(name)
    # try any group with that exact name
    for (g, n), ch in index.items():
        if n == name or n == nname:
            if not group or g == group:
                return ch
    for (g, n), ch in index.items():
        if n == name or n == nname:
            return ch
    return None


def walk_next_value(index, current, nxt, race, class_, faction):
    """Resolve a #next string (possibly group\\name; alternatives) to a chapter."""
    if not nxt:
        return None
    group = current["group"]
    for part in re.split(r"\s*;\s*", nxt):
        part = part.strip()
        if not part:
            continue
        g, n = group, part
        if "\\" in part:
            g, n = part.split("\\", 1)
            g, n = g.strip(), n.strip()
        ch = find_chapter(index, g, n)
        if ch and chapter_applies(ch, race, class_, faction):
            return ch
        # try without group
        ch = find_chapter(index, None, n)
        if ch and chapter_applies(ch, race, class_, faction):
            return ch
    return None


def expand_includes(steps, index, race, class_, faction, seen=None):
    seen = seen if seen is not None else set()
    out = []
    for st in steps:
        if st.get("include"):
            inc = st["include"]
            # skip *includes
            if inc.startswith("*"):
                continue
            group = None
            name = inc
            m = re.match(r"(.*?)\s*\\\s*(.*)$", inc)
            if m:
                group, name = m.group(1).strip(), m.group(2).strip()
            start_at = stop_at = None
            mm = re.match(r"(.*)@([^@\-]+)-?([^@\-]*)$", name)
            if mm:
                name, start_at, stop_at = mm.group(1), mm.group(2), mm.group(3) or None
                start_at = start_at or None
                stop_at = stop_at or None
            ch = find_chapter(index, group, name) if group else find_chapter(index, None, name)
            if not ch:
                st2 = dict(st)
                st2["kind"] = "note"
                st2["title"] = "Missing include: " + inc
                out.append(st2)
                continue
            key = (ch["group"], ch["name"])
            if key in seen:
                continue
            seen.add(key)
            inner = ch["steps"]
            # label range
            if start_at:
                i0 = next((i for i, s in enumerate(inner) if any(t == "label:" + start_at or t == "label:"+start_at for t in s.get("tags") or [])), None)
                if i0 is not None:
                    inner = inner[i0:]
            if stop_at:
                i1 = next((i for i, s in enumerate(inner) if any(t == "label:" + stop_at for t in s.get("tags") or [])), None)
                if i1 is not None:
                    inner = inner[: i1 + 1]
            # inherit when
            expanded = expand_includes(inner, index, race, class_, faction, seen)
            if st.get("when"):
                for s in expanded:
                    if s.get("when"):
                        s = dict(s)
                        s["when"] = "(" + st["when"] + ") (" + s["when"] + ")"
                    else:
                        s = dict(s)
                        s["when"] = st["when"]
                    out.append(s)
            else:
                out.extend(expanded)
            seen.discard(key)
        else:
            out.append(st)
    return out


def level_from_name(name):
    m = re.match(r"^(\d+)\s*-\s*(\d+)", name or "")
    if m:
        return int(m.group(1)), int(m.group(2))
    return 1, 60


def assemble_route(index, start_group, start_name, race, class_, faction, source_mode, handoff_to=None):
    ch = find_chapter(index, start_group, start_name)
    if not ch:
        # Skyborne group A vs H
        if race == "Skyborne":
            alt = start_group.replace("(A)", "(H)") if "(A)" in start_group else start_group.replace("(H)", "(A)")
            ch = find_chapter(index, alt, start_name)
    if not ch:
        return [], ["missing start %s\\%s" % (start_group, start_name)]

    keys = []
    notes = []
    seen = set()
    cur = ch
    handoff_at = None
    while cur:
        key = (cur["group"], cur["name"])
        if key in seen:
            notes.append("cycle at " + cur["name"])
            break
        seen.add(key)
        keys.append(key)
        nxt = pick_next(cur, race, class_, faction)
        nxt_ch = walk_next_value(index, cur, nxt, race, class_, faction) if nxt else None
        if nxt_ch:
            cur = nxt_ch
            continue
        # missing next — maybe hand off
        if source_mode == "combined" and handoff_to and nxt:
            hg, hn = handoff_to
            # faction-correct OpenXP late start
            hch = find_chapter(index, hg, hn)
            if hch:
                handoff_at = len(keys)
                keys.append(("__handoff__", "Handoff to OpenXP"))
                cur = hch
                continue
        if nxt:
            notes.append("end: next not found: " + nxt)
        break
    return keys, notes, handoff_at if 'handoff_at' in dir() else None


# The above assemble returns 3 values but I used a messy handoff_at. I'll fix in the call site after rewrite of assemble.

def collect_paths(kind):
    if kind == "rxp_speedrun":
        root = RXP_ROOT / "Guides/forever"
        return [p for p in root.glob("*.lua") if "Mage" not in p.name and "ADV" not in p.name]
    if kind == "rxp_dungeon":
        return list((RXP_ROOT / "Guides/forever/dungeon").glob("*.lua")) + \
               [p for p in (RXP_ROOT / "Guides/forever").glob("*.lua") if "Mage" not in p.name and "ADV" not in p.name]
    if kind == "rxp_mage":
        return list((RXP_ROOT / "Guides/forever").glob("*Mage*.lua")) + list((RXP_ROOT / "Guides/forever").glob("*ADV*.lua"))
    if kind == "openxp_early":
        return list((OXP_ROOT / "Guides/forever").glob("*.lua"))
    if kind == "openxp_late":
        return [p for p in (OXP_ROOT / "Guides/openxp").glob("*.lua") if not p.name.startswith("Dungeons") and not p.name.startswith("Extras")]
    if kind == "openxp_dungeons":
        return list((OXP_ROOT / "Guides/openxp").glob("Dungeons-*.lua"))
    raise ValueError(kind)


def compact_step(st, chapter_key, idx, quest_names):
    q = st.get("q") or []
    # Improve title with catalog name if generic
    title = st["title"]
    if q and quest_names.get(q[0]) and title.lower() in ("accept quest", "turn in quest", "complete objectives", "quest"):
        prefix = "Accept" if st["kind"] == "quest" and title.lower().startswith("accept") else ("Turn in" if title.lower().startswith("turn") else "")
        title = (prefix + " " if prefix else "") + quest_names[q[0]]
    row = [
        st["kind"],
        st.get("zone") or "",
        title,
        st.get("detail") or "",
        st.get("x"),
        st.get("y"),
        st.get("ss") or "",
        q,
        st.get("when") or "",
        "|".join(t for t in (st.get("tags") or []) if not t.startswith("label:")),
        f"{chapter_key}:{st.get('line', idx)}",
    ]
    return row


def main():
    rxp_meta = git_head(RXP_ROOT)
    oxp_meta = git_head(OXP_ROOT)
    name_to_id, id_to_name, bounds = load_map_tables()
    quest_names = load_quest_names()
    print("maps", len(name_to_id), "bounds", len(bounds), "quests", len(quest_names))
    print("RXP", rxp_meta)
    print("OpenXP", oxp_meta)

    rxp_speed = parse_files(collect_paths("rxp_speedrun"), "rxp", name_to_id, id_to_name, bounds, quest_names)
    rxp_dung = parse_files(collect_paths("rxp_dungeon"), "rxp-dungeon", name_to_id, id_to_name, bounds, quest_names)
    rxp_mage = parse_files(collect_paths("rxp_mage"), "rxp-mage", name_to_id, id_to_name, bounds, quest_names)
    oxp_early = parse_files(collect_paths("openxp_early"), "openxp", name_to_id, id_to_name, bounds, quest_names)
    oxp_late = parse_files(collect_paths("openxp_late"), "openxp", name_to_id, id_to_name, bounds, quest_names)
    oxp_dng = parse_files(collect_paths("openxp_dungeons"), "openxp-dungeon", name_to_id, id_to_name, bounds, quest_names)

    print("parsed chapters:",
          "rxp", len(rxp_speed), "dung", len(rxp_dung), "mage", len(rxp_mage),
          "oxp early", len(oxp_early), "late", len(oxp_late), "oxp dung", len(oxp_dng))

    # Combined index: current RXP early overrides older OpenXP copies; late OpenXP added
    def merge(*dicts):
        out = {}
        for d in dicts:
            out.update(d)
        return out

    idx_combined_speed = merge(oxp_late, rxp_speed)  # rxp early wins on same keys if we update after? 
    # If same (group,name) exists in both, we want RXP (more current). merge last-wins:
    idx_combined_speed = merge(oxp_early, oxp_late, rxp_speed)  # wait oxp early same keys as rxp — last should be rxp
    idx_combined_speed = merge(oxp_late, rxp_speed)

    idx_oxp = merge(oxp_early, oxp_late)
    idx_rxp = dict(rxp_speed)
    idx_combined_dung = merge(oxp_late, rxp_dung)  # dungeon early + openxp late
    idx_oxp_dung_extra = oxp_dng
    idx_mage = merge(oxp_late, rxp_speed, rxp_mage)  # mage pack then handoff

    def start_for(variant, race_tok, faction):
        table = STARTS["dungeon" if variant == "dungeon" else "speedrun"]
        g, n = table[race_tok]
        if race_tok == "Skyborne":
            g = g.replace("(A)", "(H)") if faction == "Horde" else g.replace("(H)", "(A)")
            if "(A)" not in g and "(H)" not in g:
                pass
            if faction == "Horde" and "(A)" in g:
                g = g.replace("(A)", "(H)")
            if faction == "Alliance" and "(H)" in g:
                g = g.replace("(H)", "(A)")
        return g, n

    def walk(index, start, race, class_, faction, mode):
        g, n = start
        ch = find_chapter(index, g, n)
        if not ch and race == "Skyborne":
            alt = g.replace("(A)", "(H)") if "(A)" in g else g.replace("(H)", "(A)")
            ch = find_chapter(index, alt, n)
        if not ch:
            return [], ["missing start %s\\%s" % (g, n)], None
        keys, notes = [], []
        seen = set()
        handoff_at = None
        cur = ch
        while cur:
            key = (cur["group"], cur["name"])
            if key in seen:
                notes.append("cycle at " + cur["name"])
                break
            seen.add(key)
            keys.append(key)
            nxt = pick_next(cur, race, class_, faction)
            nxt_ch = walk_next_value(index, cur, nxt, race, class_, faction) if nxt else None
            if nxt_ch:
                cur = nxt_ch
                continue
            if mode == "combined" and nxt:
                hg, hn = HANDOFF[faction]
                hch = find_chapter(index, hg, hn)
                if not hch:
                    # try any group
                    hch = find_chapter(index, None, hn)
                if hch and (hch["group"], hch["name"]) not in seen:
                    handoff_at = len(keys)
                    cur = hch
                    notes.append("handoff after %s, missing next was: %s" % (key[1], nxt))
                    continue
            if nxt:
                notes.append("stopped, next not found: " + nxt)
            break
        return keys, notes, handoff_at

    # Use Warrior as a representative when pre-walking chapter lists (class-specific nexts still stored in chapters).
    # For hunters/shamans, next may differ — we store per-race-and-class? That's a lot.
    # Better: walk per (race, class) would multiply routes. Instead walk with a "generic" class
    # and also produce hunter/shaman variants when #next differs.
    #
    # Practical approach: walk once per race with class=Warrior (default), and additionally
    # store alternate route keys for Hunter and Shaman (and Paladin if it diverges) when the
    # chapter sequence differs. UI picks the matching class list.

    SPECIAL_CLASSES = ["Warrior", "Hunter", "Shaman", "Paladin", "Mage", "Priest", "Rogue", "Warlock", "Druid"]

    routes = {}
    parse_notes = {}
    all_chapter_keys_used = set()

    def store_route(rid, keys, notes, handoff_at, meta):
        routes[rid] = {
            **meta,
            "chapters": ["{}||{}".format(g, n) for g, n in keys],
            "handoffAt": handoff_at,
            "notes": notes,
        }
        parse_notes[rid] = notes
        all_chapter_keys_used.update(keys)

    # Combined + RXP + OpenXP  ×  speedrun/dungeon  × races × (classes if sequence differs)
    configs = [
        ("combined", "speedrun", idx_combined_speed, True),
        ("combined", "dungeon", idx_combined_dung, True),
        ("rxp", "speedrun", idx_rxp, False),
        ("rxp", "dungeon", idx_combined_dung if False else rxp_dung, False),
        ("openxp", "speedrun", idx_oxp, True),
    ]

    for source, variant, index, do_handoff in configs:
        for race_name, faction, race_tok, fac2 in RACES:
            sequences = {}
            for cls in SPECIAL_CLASSES:
                # skip illegal-ish combos? Keep all; applies will just yield fewer steps.
                keys, notes, handoff_at = walk(
                    index, start_for(variant, race_tok, faction),
                    race_tok, cls, faction,
                    "combined" if do_handoff and source in ("combined", "openxp") else source,
                )
                sequences[cls] = (keys, notes, handoff_at)
            # collapse identical sequences to a race-level default (Warrior)
            default = sequences["Warrior"]
            store_route(
                f"{source}|{variant}|{race_name}",
                default[0], default[1], default[2],
                {"source": source, "variant": variant, "race": race_name, "faction": faction,
                 "defaultForUser": race_name == "Undead", "class": "any"},
            )
            for cls, seq in sequences.items():
                if [k for k in seq[0]] != [k for k in default[0]]:
                    store_route(
                        f"{source}|{variant}|{race_name}|{cls}",
                        seq[0], seq[1], seq[2],
                        {"source": source, "variant": variant, "race": race_name, "faction": faction,
                         "defaultForUser": False, "class": cls},
                    )

    # Mage AoE variant (RestedXP), then OpenXP handoff for combined
    for race_name, faction, race_tok, _ in RACES:
        if faction == "Alliance" and race_tok in ("Human", "Gnome"):
            start = MAGE_STARTS[race_tok]
            keys, notes, handoff_at = walk(idx_mage, start, race_tok, "Mage", faction, "combined")
            store_route(
                f"combined|mageaoe|{race_name}|Mage",
                keys, notes, handoff_at,
                {"source": "combined", "variant": "mageaoe", "race": race_name, "faction": faction,
                 "class": "Mage", "defaultForUser": False},
            )
            keys2, notes2, _ = walk(rxp_mage, start, race_tok, "Mage", faction, "rxp")
            store_route(
                f"rxp|mageaoe|{race_name}|Mage",
                keys2, notes2, None,
                {"source": "rxp", "variant": "mageaoe", "race": race_name, "faction": faction,
                 "class": "Mage", "defaultForUser": False},
            )
        elif faction == "Horde":
            # 1-12 speedrun then Horde Mage 12-17
            keys_a, notes_a, _ = walk(rxp_speed, start_for("speedrun", race_tok, faction), race_tok, "Mage", faction, "rxp")
            keys_b, notes_b, handoff_at = walk(
                idx_mage, ("RestedXP Horde Mage AoE", "12-17 The Barrens AoE"),
                race_tok, "Mage", faction, "combined",
            )
            # stitch: take early keys until a Barrens 12-17 chapter, then mage pack
            stitched = []
            for g, n in keys_a:
                if n.startswith("12-17 The Barrens") or n.startswith("12-16 The Barrens"):
                    break
                stitched.append((g, n))
            # prepend a synthetic note via handoffAt into mage
            stitched += keys_b
            store_route(
                f"combined|mageaoe|{race_name}|Mage",
                stitched, notes_a + ["Horde Mage AoE starts at 12"] + notes_b, len([k for k in keys_a if not (k[1].startswith("12-17") or k[1].startswith("12-16"))]) if False else len(stitched) - len(keys_b),
                {"source": "combined", "variant": "mageaoe", "race": race_name, "faction": faction,
                 "class": "Mage", "defaultForUser": False},
            )



    def index_for(source, variant):
        if source == "combined" and variant == "dungeon":
            return idx_combined_dung
        if source == "combined" and variant == "mageaoe":
            return idx_mage
        if source == "combined":
            return idx_combined_speed
        if source == "rxp" and variant == "dungeon":
            return rxp_dung
        if source == "rxp" and variant == "mageaoe":
            return idx_mage
        if source == "rxp":
            return idx_rxp
        if source == "openxp":
            return idx_oxp
        return idx_combined_speed

    # Resolve include-only wrapper chapters to their targets so routes share step text.

    def unwrap_keys(keys, index, race, class_, faction):
        out = []
        for g, n in keys:
            if g == "__handoff__":
                out.append((g, n))
                continue
            ch = find_chapter(index, g, n)
            if not ch:
                out.append((g, n))
                continue
            real = [s for s in ch["steps"] if s.get("include") or s["kind"] != "note" or s.get("title")]
            includes = [s for s in ch["steps"] if s.get("include")]
            others = [s for s in ch["steps"] if not s.get("include") and s.get("kind") not in ("note",) or (not s.get("include") and (s.get("q") or s.get("x") or s.get("kind") not in ("note","include")))]
            # If the chapter is only includes (plus maybe empty notes), splice targets
            if includes and not any((not s.get("include")) and s.get("kind") != "note" for s in ch["steps"]):
                for s in includes:
                    if s.get("when") and not applies(s["when"], race, class_, faction):
                        continue
                    inc = s["include"]
                    gg, nn = g, inc
                    if "\\" in inc:
                        gg, nn = inc.split("\\", 1)
                        gg, nn = gg.strip(), nn.strip()
                    nn = re.sub(r"@.*$", "", nn)
                    tgt = find_chapter(index, gg, nn) or find_chapter(index, None, nn)
                    if tgt:
                        out.append((tgt["group"], tgt["name"]))
                    else:
                        out.append((gg, nn))
            else:
                out.append((g, n))
        # unique consecutive
        dedup = []
        for k in out:
            if not dedup or dedup[-1] != k:
                dedup.append(k)
        return dedup

    # Collect every chapter we need, expand includes *inside* mixed chapters (keep when)
    needed = {}  # (group,name) -> chapter from some index
    def remember(index, keys):
        for g, n in keys:
            if g == "__handoff__":
                continue
            if (g, n) in needed:
                continue
            ch = find_chapter(index, g, n)
            if ch:
                needed[(g, n)] = ch

    route_keys = {}
    for rid, rec in routes.items():
        source, variant = rec["source"], rec["variant"]
        idx = index_for(source, variant)
        race_name = rec["race"]
        faction = rec["faction"]
        race_tok = next(r[2] for r in RACES if r[0] == race_name)
        cls = rec.get("class") if rec.get("class") and rec.get("class") != "any" else "Warrior"
        keys = [(c.split("||", 1)[0], c.split("||", 1)[1]) for c in rec["chapters"]]
        keys = unwrap_keys(keys, idx, race_tok, cls, faction)
        route_keys[rid] = keys
        remember(idx, keys)
        # also remember include targets of mixed chapters
        for g, n in keys:
            ch = find_chapter(idx, g, n)
            if not ch:
                continue
            for s in ch["steps"]:
                if s.get("include"):
                    inc = s["include"]
                    gg, nn = g, inc
                    if "\\" in inc:
                        gg, nn = inc.split("\\", 1)
                    nn = re.sub(r"@.*$", "", nn.strip())
                    tgt = find_chapter(idx, gg.strip(), nn) or find_chapter(idx, None, nn)
                    if tgt:
                        needed[(tgt["group"], tgt["name"])] = tgt

    # Expand includes inside mixed chapters once (retain when; no race filter)
    emitted_chapters = {}
    for (g, n), ch in needed.items():
        # Use a wide index: merge all
        wide = merge(idx_combined_dung, idx_combined_speed, idx_mage, idx_oxp, rxp_dung, oxp_dng)
        expanded = expand_includes(ch["steps"], wide, "Human", "Warrior", "Alliance")
        # The expand used Alliance/Human only to recurse; it does not drop `when`.
        # Re-expand is race-agnostic already. Good.
        rows = []
        lv0, _ = level_from_name(n)
        for i, st in enumerate(expanded):
            row = compact_step(st, "{}||{}".format(g, n), i, quest_names)
            row.insert(2, lv0)
            rows.append(row)
        emitted_chapters["{}||{}".format(g, n)] = {
            "name": n,
            "group": g,
            "source": ch.get("source"),
            "stepCount": len(rows),
            "steps": rows,
        }

    emitted_routes = {}
    catalog_used = {}
    def newz_count(chapter_names):
        z = {k: 0 for k in ["Zephras Isle", "Riverglades", "Shen'dralas", "Mount Hyjal"]}
        for key in chapter_names:
            ch = emitted_chapters.get(key)
            if not ch:
                continue
            blob = (ch["name"] + " " + " ".join(s[1] or "" for s in ch["steps"])).lower()
            # also titles
            blob += " " + " ".join(s[3] or "" for s in ch["steps"][:40]).lower()
            for nz in list(z):
                if nz.lower() in blob or (nz == "Mount Hyjal" and "hyjal" in ch["name"].lower()):
                    # count matching steps
                    z[nz] += sum(1 for s in ch["steps"] if nz.lower() in ((s[1] or "") + " " + (s[3] or "") + " " + ch["name"]).lower() or (nz=="Mount Hyjal" and "hyjal" in ((s[1] or "")+" "+ch["name"]).lower()))
        return z

    for rid, rec in routes.items():
        keys = route_keys[rid]
        chnames = ["{}||{}".format(g, n) for g, n in keys]
        step_count = 0
        quest_refs = 0
        for k in chnames:
            ch = emitted_chapters.get(k)
            if not ch:
                continue
            step_count += ch["stepCount"]
            for row in ch["steps"]:
                qs = row[8] if len(row) > 8 else []
                quest_refs += len(qs)
                for q in qs:
                    if q in quest_names:
                        catalog_used[str(q)] = quest_names[q]
        emitted_routes[rid] = {
            "source": rec["source"],
            "variant": rec["variant"],
            "race": rec["race"],
            "faction": rec["faction"],
            "class": rec.get("class") or "any",
            "defaultForUser": rec.get("defaultForUser") or False,
            "chapters": chnames,
            "chapterNames": [n for g, n in keys if g != "__handoff__"],
            "handoffAt": rec.get("handoffAt"),
            "stepCount": step_count,
            "questRefs": quest_refs,
            "newZones": newz_count(chnames),
            "parseNotes": rec.get("notes") or [],
        }

    # OpenXP dungeon side pack — chapter keys only, plus store those chapters
    dungeon_side = {"Alliance": [], "Horde": []}
    for (g, n), ch in oxp_dng.items():
        faction = "Alliance" if "Alliance" in (ch.get("file") or "") else "Horde"
        key = "{}||{}".format(g, n)
        if key not in emitted_chapters:
            rows = []
            lv0, _ = level_from_name(n)
            for i, st in enumerate(ch["steps"]):
                row = compact_step(st, key, i, quest_names)
                row.insert(2, lv0)
                rows.append(row)
            emitted_chapters[key] = {"name": n, "group": g, "source": "openxp-dungeon", "stepCount": len(rows), "steps": rows}
        dungeon_side[faction].append(key)

    def coverage_for(source, variant):
        out = {}
        for rec in emitted_routes.values():
            if rec["source"] == source and rec["variant"] == variant and rec["class"] in ("any", "Warrior"):
                out[rec["race"]] = {
                    "faction": rec["faction"],
                    "steps": rec["stepCount"],
                    "questRefs": rec["questRefs"],
                    "chapters": rec["chapterNames"],
                    "newZones": rec["newZones"],
                    "handoffAt": rec["handoffAt"],
                    "parseNotes": rec["parseNotes"],
                }
        return out

    stats = {
        "rxp": rxp_meta,
        "openxp": oxp_meta,
        "choice": "Combined default uses current RestedXP free Forever routes through ~21 Alliance / ~22 Horde, then OpenXP 21–60. OpenXP's copies of the early RXP files lag the current RXP commit (OpenXP forked from b9f2e254, 2026-11-07). Mage AoE is the public RestedXP Mage pack, then the same OpenXP handoff.",
        "combinedSpeedrun": coverage_for("combined", "speedrun"),
        "combinedDungeon": coverage_for("combined", "dungeon"),
        "rxpSpeedrun": coverage_for("rxp", "speedrun"),
        "openxpSpeedrun": coverage_for("openxp", "speedrun"),
        "chapterCount": len(emitted_chapters),
        "routeCount": len(emitted_routes),
    }
    agg = {z: {"races": [], "steps": 0} for z in ["Zephras Isle", "Riverglades", "Shen'dralas", "Mount Hyjal"]}
    for rec in emitted_routes.values():
        if rec["source"] != "combined" or rec["variant"] != "speedrun" or rec["class"] not in ("any", "Warrior"):
            continue
        for z, n in rec["newZones"].items():
            if n:
                agg[z]["races"].append(rec["race"])
                agg[z]["steps"] += n
    stats["newZonesOverall"] = agg
    gaps = [
        "Riverglades does not appear in the imported RestedXP free or OpenXP 1–60 routes.",
        "Mount Hyjal does not appear in the imported RestedXP free or OpenXP 1–60 routes.",
        "Shen'dralas appears only on the Alliance OpenXP 40–41 chapter; it is not in the Horde OpenXP route or the RestedXP free routes.",
        "Zephras Isle is covered in the Skyborne 1–9 / 9–13 (Alliance) or 9–12 (Horde) RestedXP chapters.",
        "LevelForge community 1–60 chains were not imported: the addon is MIT, but individual guide authors keep their rights and there is no clear redistribution license for bundling those routes here.",
        "The user's paid RestedXP string was not used or decrypted.",
        "OpenXP 1.x (RestedXP-based, CC BY-NC-SA 4.0) ends at tag v1.3.66, which is what is imported here. OpenXP 2.0+ replaced it with PoleStar's 1–60 route (fitzforge/polestar, GPL-3.0); that is a different route under a different license and has not been imported. It does not cover Riverglades, Shen'dralas, or Mount Hyjal either.",
        "RestedXP added a WIP 'Skyborne V2' Zephras Isle route (1-9 / 9-13 Zephras Isle V2). Both the original and V2 are marked default for Skyborne in RestedXP's files, so the Skyborne start here stays on the original chapters.",
    ]
    stats["parsingGaps"] = gaps

    meta = {
        "builtAt": "2026-11-25",
        "levelCap": 60,
        "schema": 2,
        "defaultSource": "combined",
        "defaultVariant": "speedrun",
        "defaultRace": "Undead",
        "licenses": "CC BY-NC-SA 4.0 (RestedXP Guides and OpenXP). Personal non-commercial local use only. Share-alike; credit both projects.",
        "rxp": rxp_meta,
        "openxp": oxp_meta,
        "openxpUpstream": "b9f2e254c1604f70fd6ddca1dae61dd84156cd13 (2026-11-07)",
        "choice": stats["choice"],
        "gaps": gaps,
        "attribution": "Leveling routes: RestedXP Guides (https://github.com/RestedXP/RXPGuides) and OpenXP (https://github.com/mjared123/OpenXP), both CC BY-NC-SA 4.0. OpenXP is a community derivative of RestedXP's free guides and is not affiliated with or endorsed by RestedXP. Quest names from tyler3497/forever-quests (GPL-3.0).",
    }

    payload = {
        "meta": meta,
        "races": [{"name": n, "faction": f} for n, f, _, _ in RACES],
        "sources": [
            {"id": "combined", "label": "Combined (RestedXP free, then OpenXP)"},
            {"id": "rxp", "label": "RestedXP free (ends ~21–22)"},
            {"id": "openxp", "label": "OpenXP 1–60"},
        ],
        "variants": [
            {"id": "speedrun", "label": "Speedrun"},
            {"id": "dungeon", "label": "Dungeon Guide"},
            {"id": "mageaoe", "label": "Mage AoE (RestedXP)", "class": "Mage"},
        ],
        "coordLabels": {
            "guide": "From the guide",
            "guide-world": "From the guide (converted from world coords)",
            "world-unconverted": "World coords in the guide (not converted)",
            "missing": "Coords missing",
        },
        "chapters": emitted_chapters,
        "routes": emitted_routes,
        "dungeonSide": dungeon_side,
        "questNames": catalog_used,
    }

    OUT_JS.write_text("window.WOW_LEVELING = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n")
    OUT_STATS.write_text(json.dumps(stats, indent=2, ensure_ascii=False))
    print("wrote", OUT_JS, "bytes", OUT_JS.stat().st_size)
    print("chapters", len(emitted_chapters), "routes", len(emitted_routes))
    for rec in emitted_routes.values():
        if rec["source"] == "combined" and rec["variant"] == "speedrun" and rec["class"] in ("any", "Warrior"):
            print(f"  {rec['race']:24} steps={rec['stepCount']:4} chapters={len(rec['chapterNames']):3} new={rec['newZones']} handoff={rec['handoffAt']}")



if __name__ == "__main__":
    main()
