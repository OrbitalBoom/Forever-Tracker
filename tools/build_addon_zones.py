#!/usr/bin/env python3
"""Build Forever Tracker add-on chapters for new zones missing from RestedXP/OpenXP.

Uses already-fetched local data only (Zephras list + zone pages, forever-quests, ForeverDB).
Does not invent quests or coordinates. Personal non-commercial local use.
"""
from __future__ import annotations

import json
import math
import re
from collections import defaultdict
from html import unescape
from pathlib import Path

SRC = Path("/tmp/wowdata/quests")
LEVELING_JS = Path("/workspace/wow-forever/js/leveling-data.js")
STATS = Path("/workspace/wow-forever/tools/addon-zone-stats.json")

HUB_RADIUS = 6.0  # map %; pickups this close are batched

FPS = {
    "Riverglades": {
        "Horde": {"name": "Rog'mar", "npc": "Grakna, Wind Rider Master", "x": 59.6, "y": 45.1},
        "Alliance": {"name": "Farholde Keep", "npc": None, "x": 60.6, "y": 81.6},
    },
    "Mount Hyjal": {
        "Horde": {"name": "Summit of Eternity", "npc": None, "x": 68.6, "y": 44.1, "also": "Tainted Foothills (55.1, 82.5)"},
        "Alliance": {"name": "Summit of Eternity", "npc": None, "x": 68.6, "y": 44.1, "also": "Tainted Foothills (55.1, 82.5)"},
    },
}

# After which Combined chapter to insert, and travel wording (known EK/Kalimdor connections only).
SPLICE = {
    "Riverglades": {
        "Horde": {
            "after": ["34-36 Stranglethorn Vale"],
            "travel": "From Stranglethorn Vale, travel to Riverglades (new Eastern Kingdoms zone, typical quests 36–45). Horde flight point: Rog'mar (59.6, 45.1).",
            "lv": 35,
        },
        "Alliance": {
            "after": ["34-35 Stranglethorn Vale", "34-36 Stranglethorn Vale"],
            "travel": "From Stranglethorn Vale, travel to Riverglades (new Eastern Kingdoms zone, typical quests 36–45). Alliance flight point: Farholde Keep (60.6, 81.6).",
            "lv": 35,
        },
        "window": (35, 45),
    },
    "Shen'dralas": {
        "Horde": {
            "after": ["39-40 Desolace"],
            "travel": "From Desolace, enter Shen'dralas (new Kalimdor zone between Desolace and Mulgore; no flight point is recorded in the local data).",
            "lv": 40,
        },
        "Alliance": {
            "after": ["40-41 Shen'dralas"],
            "travel": "Continue in Shen'dralas for the remaining Forever quests not covered by OpenXP's short 40–41 chapter. No flight point is recorded in the local data.",
            "lv": 40,
        },
        "window": (38, 45),
    },
    "Mount Hyjal": {
        "Horde": {
            "after": ["54-55 Winterspring"],
            "travel": "From Winterspring, travel to Mount Hyjal (client range 55–60). Flight points (both sides): Summit of Eternity (68.6, 44.1) and Tainted Foothills (55.1, 82.5).",
            "lv": 55,
        },
        "Alliance": {
            "after": ["54-55 Winterspring"],
            "travel": "From Winterspring, travel to Mount Hyjal (client range 55–60). Flight points (both sides): Summit of Eternity (68.6, 44.1) and Tainted Foothills (55.1, 82.5).",
            "lv": 55,
        },
        "window": (55, 60),
    },
}

ZONE_PAGES = {
    "Riverglades": SRC / "zep-zone-16591.html",
    "Shen'dralas": SRC / "zep-zone-16651.html",
    "Mount Hyjal": SRC / "zep-zone-616.html",
}
ZONE_SLUGS = {
    "riverglades": "Riverglades",
    "shen-dralas": "Shen'dralas",
    "mount-hyjal": "Mount Hyjal",
}

# OpenXP Alliance 40-41 stub quest IDs (positive).
OXP_SHEN_IDS = {92844, 93035, 93037, 92841, 93034}

ADDON_LABEL = "Forever Tracker add-on (auto-optimized, not RestedXP/OpenXP)"

# ~2–3 level windows. A quest of level L is placed in the first band whose
# start is at least L-2 (i.e. the player is expected to be within ~2 levels).
# Border levels belong to the earlier band. Empty bands are omitted.
LEVEL_BANDS = {
    "Riverglades": [(35, 37), (38, 40), (41, 43), (44, 45), (46, 47)],
    "Shen'dralas": [(38, 40), (41, 43), (44, 45)],
    "Mount Hyjal": [(55, 57), (58, 60)],
}


def parse_master_list():
    """Zephras public quest list already fetched (giver coords + side)."""
    html = (SRC / "zep-quests.html").read_text(errors="replace")
    out = {}
    for row in re.findall(r"<tr[\s\S]*?</tr>", html):
        place = re.search(r'data-place="([^"]*)"', row)
        if not place:
            continue
        slug = place.group(1).lower()
        zone = ZONE_SLUGS.get(slug)
        if not zone:
            continue
        mid = re.search(r"/forever/enUS/quest/(\d+)/\">([^<]+)", row)
        if not mid:
            continue
        qid = int(mid.group(1))
        name = unescape(mid.group(2))
        level = re.search(r'data-level="([^"]*)"', row)
        giver = re.search(r'data-giver="([^"]*)"', row)
        side = re.search(r'data-side="([^"]*)"', row)
        coord = re.search(r'<span class="cell-sub">\s*\(([^)]+)\)', row)
        xy = None
        if coord:
            parts = coord.group(1).split(",")
            try:
                xy = (float(parts[0].strip()), float(parts[1].strip()))
            except (ValueError, IndexError):
                xy = None
        lv = level.group(1) if level else ""
        out[qid] = {
            "id": qid,
            "name": name,
            "zone": zone,
            "level": int(lv) if lv.isdigit() else None,
            "giver": unescape(giver.group(1)).title() if giver and giver.group(1) else None,
            "side": (side.group(1) if side and side.group(1) else "") or "",
            "xy": xy,
        }
    return out


def parse_zone_page(zone, path):
    """Zone page (already fetched) may fill a giver coord the list missed."""
    html = path.read_text(errors="replace")
    extra = {}
    for row in re.findall(r"<tr[^>]*data-name[\s\S]*?</tr>", html):
        mid = re.search(r"/forever/enUS/quest/(\d+)/\">([^<]+)", row)
        if not mid:
            continue
        qid = int(mid.group(1))
        coord = re.search(r'<span class="cell-sub">\s*\(([^)]+)\)', row)
        xy = None
        if coord:
            parts = coord.group(1).split(",")
            try:
                xy = (float(parts[0].strip()), float(parts[1].strip()))
            except (ValueError, IndexError):
                xy = None
        giver = re.search(r'data-giver="([^"]*)"', row)
        level = re.search(r'data-level="([^"]*)"', row)
        lv = level.group(1) if level else ""
        extra[qid] = {
            "id": qid,
            "name": unescape(mid.group(2)),
            "zone": zone,
            "xy": xy,
            "giver": unescape(giver.group(1)).title() if giver and giver.group(1) else None,
            "level": int(lv) if lv.isdigit() else None,
        }
    return extra


def load_fq_meta():
    fq = json.loads((SRC / "fq-quests.json").read_text())
    meta = {}
    for k, rec in fq.items():
        try:
            qid = int(rec.get("id") or k)
        except (TypeError, ValueError):
            continue
        meta[qid] = {
            "pre": list(rec.get("preQuestSingle") or []) + list(rec.get("preQuestGroup") or []),
            "exclusiveTo": list(rec.get("exclusiveTo") or []),
            "requiredRaces": rec.get("requiredRaces"),
            "requiredLevel": rec.get("requiredLevel"),
            "name": rec.get("name"),
        }
    return meta


def merge_quests():
    master = parse_master_list()
    fq = load_fq_meta()
    for zone, path in ZONE_PAGES.items():
        extra = parse_zone_page(zone, path)
        for qid, e in extra.items():
            if qid not in master:
                master[qid] = {
                    "id": qid,
                    "name": e["name"],
                    "zone": zone,
                    "level": e["level"],
                    "giver": e["giver"],
                    "side": "",
                    "xy": e["xy"],
                }
            else:
                if master[qid]["xy"] is None and e["xy"]:
                    master[qid]["xy"] = e["xy"]
                if not master[qid].get("giver") and e.get("giver"):
                    master[qid]["giver"] = e["giver"]
                if master[qid]["level"] is None and e["level"] is not None:
                    master[qid]["level"] = e["level"]
            rec = fq.get(qid)
            if rec:
                master[qid]["pre"] = [p for p in rec["pre"] if isinstance(p, int) or str(p).isdigit()]
                master[qid]["exclusiveTo"] = rec["exclusiveTo"]
                master[qid]["requiredLevel"] = rec["requiredLevel"]
            else:
                master[qid].setdefault("pre", [])
                master[qid].setdefault("exclusiveTo", [])
                master[qid].setdefault("requiredLevel", None)
    return master


def side_ok(side, faction):
    s = (side or "").lower()
    if s in ("", "both"):
        return None  # unknown
    if s in ("h", "horde"):
        return faction == "Horde"
    if s in ("a", "alliance"):
        return faction == "Alliance"
    return None


def in_window(q, lo, hi):
    lv = q.get("level") or q.get("requiredLevel")
    if lv is None or lv == 0:
        return False
    # small slack; outliers go unverified
    return (lo - 2) <= lv <= (hi + 2)


def dist(a, b):
    if not a or not b or a[0] is None or b[0] is None:
        return None
    return math.hypot(a[0] - b[0], a[1] - b[1])


def exclusive_filter(quests):
    byid = {q["id"]: q for q in quests}
    drop = set()
    for q in quests:
        for other in q.get("exclusiveTo") or []:
            try:
                oid = int(other)
            except (TypeError, ValueError):
                continue
            if oid in byid and q["id"] not in drop and oid not in drop:
                a, b = q, byid[oid]
                keep = a if (a.get("level") or 99, a["id"]) <= (b.get("level") or 99, b["id"]) else b
                drop.add(a["id"] if keep is b else b["id"])
    return [q for q in quests if q["id"] not in drop]


def nn_order(quests, start_xy):
    """Nearest-neighbor on pickup coords, batching same-hub pickups, waiting on pre in the set."""
    ids = {q["id"] for q in quests}
    pre = {q["id"]: [int(p) for p in (q.get("pre") or []) if int(p) in ids] for q in quests}
    byid = {q["id"]: q for q in quests}
    remaining = set(ids)
    ordered = []
    cur = start_xy
    naive_len = opt_len = 0
    last = start_xy
    naive = sorted(quests, key=lambda q: (q.get("level") or 99, q.get("name") or "", q["id"]))
    for q in naive:
        xy = q.get("xy")
        if last and xy:
            d = dist(last, xy)
            if d is not None:
                naive_len += d
            last = xy
        elif xy:
            last = xy

    while remaining:
        ready = [byid[i] for i in remaining if all(p not in remaining for p in pre[i])]
        if not ready:
            ready = [byid[i] for i in remaining]

        def key(q):
            d = dist(cur, q.get("xy")) if q.get("xy") else None
            return (0 if d is not None else 1, d if d is not None else 0, q.get("level") or 99, q["id"])

        ready.sort(key=key)
        pick = ready[0]
        # batch other ready pickups at the same hub
        hub = pick.get("xy")
        batch = [pick]
        if hub:
            for q in ready[1:]:
                if q.get("xy") and dist(hub, q["xy"]) is not None and dist(hub, q["xy"]) <= HUB_RADIUS:
                    batch.append(q)
            batch.sort(key=lambda q: (dist(hub, q["xy"]) or 0, q.get("level") or 99, q["id"]))
        for q in batch:
            if q["id"] not in remaining:
                continue
            xy = q.get("xy")
            if cur and xy:
                d = dist(cur, xy)
                if d is not None:
                    opt_len += d
            if xy:
                cur = xy
            ordered.append(q)
            remaining.remove(q["id"])
    return ordered, naive_len, opt_len


def compact_step(kind, zone, lv, title, detail, x, y, ss, qids, tags, sid):
    return [
        kind,
        zone,
        int(lv or 1),
        title,
        detail or "",
        x,
        y,
        ss or "",
        qids or [],
        "",
        tags,
        sid,
    ]


def assign_band(lv, bands):
    for lo, hi in bands:
        if lo <= lv <= hi:
            return (lo, hi)
    if not bands:
        return None
    if lv < bands[0][0]:
        return bands[0]
    return bands[-1]


def chapter_key(zone, faction, band=None, unverified=False):
    if unverified:
        return "addon||{} unverified ({})".format(zone, faction)
    if band:
        return "addon||{} {}-{} ({})".format(zone, band[0], band[1], faction)
    return "addon||{} ({})".format(zone, faction)


def zone_chapter_keys(zone, faction, chapters):
    return [k for k, ch in chapters if ch.get("zone") == zone and ch.get("faction") == faction]


def pack_chapter(name, zone, faction, steps, meta=None):
    return {
        "name": name,
        "group": "Forever Tracker add-on",
        "source": "addon",
        "zone": zone,
        "faction": faction,
        "stepCount": len(steps),
        "steps": steps,
        "meta": meta or {},
    }


def emit_quest_step(zone, q, prefix, start_lv, tags="addon|newzone"):
    xy = q.get("xy")
    x, y = (xy if xy else (None, None))
    bits = []
    if "unverified" in tags:
        if q.get("unverified_reasons"):
            bits.append("Unverified: " + "; ".join(q["unverified_reasons"]) + ".")
        if q.get("giver") and xy:
            bits.append("Giver {} at {}, {}.".format(q["giver"], xy[0], xy[1]))
        elif q.get("giver"):
            bits.append("Giver {} (no coordinates).".format(q["giver"]))
        if q.get("side"):
            bits.append("Listed side: {}.".format(q["side"]))
        if q.get("level"):
            bits.append("Quest level {}.".format(q["level"]))
    else:
        giver = q.get("giver")
        if giver and xy:
            bits.append("Accept from {} at {}, {}.".format(giver, x, y))
        elif xy:
            bits.append("Accept at {}, {}.".format(x, y))
        else:
            bits.append("Accept this quest.")
        bits.append("Do the objectives.")
        bits.append("Turn in (turn-in coordinates were not in the local snapshot — use the quest giver if they take it back, or the in-game tracker).")
        if q.get("level"):
            bits.append("Quest level {}.".format(q["level"]))
    return compact_step(
        "quest", zone, q.get("level") or start_lv,
        q["name"],
        " ".join(bits),
        x, y, "zephras-list" if xy else "",
        [q["id"]],
        tags,
        prefix + "q:" + str(q["id"]),
    )


def travel_length(quests, start_xy):
    total = 0
    cur = start_xy
    for q in quests:
        xy = q.get("xy")
        if cur and xy:
            d = dist(cur, xy)
            if d is not None:
                total += d
        if xy:
            cur = xy
    return total


def build_zone_chapters(zone, faction, quests, travel_text, start_lv):
    """Build consecutive level-band sub-chapters for one zone/faction.

    Quest step IDs stay addon:{Zone}:{H|A}:q:{id} so existing checkboxes persist.
    Intro, travel, and flight-path steps stay on the first band with the same IDs.
    """
    lo, hi = SPLICE[zone]["window"]
    fp = (FPS.get(zone) or {}).get(faction)
    start_xy = (fp["x"], fp["y"]) if fp else None
    prefix = "addon:{}:{}:".format(zone, faction[0])
    bands = LEVEL_BANDS[zone]

    verified, unverified = [], []
    for q in quests:
        fac = side_ok(q.get("side"), faction)
        has_xy = bool(q.get("xy"))
        window_ok = in_window(q, lo, hi)
        reasons = []
        if fac is False:
            continue
        if fac is None:
            reasons.append("faction missing")
        if not has_xy:
            reasons.append("coords missing")
        if not window_ok:
            reasons.append("level missing or outside {}–{}".format(lo, hi))
        q = dict(q)
        q["unverified_reasons"] = reasons
        if reasons:
            unverified.append(q)
        else:
            verified.append(q)

    verified = exclusive_filter(verified)
    unverified = exclusive_filter(unverified)

    by_band = {b: [] for b in bands}
    for q in verified:
        lv = q.get("level") or q.get("requiredLevel") or start_lv
        by_band[assign_band(lv, bands)].append(q)

    naive_all = sorted(verified, key=lambda q: (q.get("level") or 99, q.get("name") or "", q["id"]))
    naive_len = travel_length(naive_all, start_xy)

    band_results = []
    cur = start_xy
    all_ordered = []
    for b in bands:
        qs = by_band[b]
        if not qs:
            continue
        ordered, _bnaive, _bopt = nn_order(qs, cur)
        band_opt = travel_length(ordered, cur)
        band_naive = travel_length(sorted(qs, key=lambda q: (q.get("level") or 99, q.get("name") or "", q["id"])), cur)
        band_results.append({
            "band": b,
            "ordered": ordered,
            "naiveTravel": round(band_naive, 1),
            "optimizedTravel": round(band_opt, 1),
            "travelReducedPct": round((1 - band_opt / band_naive) * 100, 1) if band_naive else None,
        })
        all_ordered.extend(ordered)
        if ordered and ordered[-1].get("xy"):
            cur = ordered[-1]["xy"]

    opt_len = travel_length(all_ordered, start_xy)
    reduced = round((1 - opt_len / naive_len) * 100, 1) if naive_len else None

    # Expected-level check: at the start of band [blo, bhi], the player is
    # expected to be at least blo (or the zone arrival level, whichever is higher).
    violations = []
    expected = start_lv
    for rec in band_results:
        blo, bhi = rec["band"]
        expected = max(expected, blo)
        for q in rec["ordered"]:
            qlv = q.get("level") or 0
            ahead = qlv - expected
            if ahead > 2:
                violations.append({
                    "id": q["id"], "name": q["name"], "questLevel": qlv,
                    "expected": expected, "ahead": ahead, "band": list(rec["band"]),
                })

    out = []
    first = True
    for rec in band_results:
        blo, bhi = rec["band"]
        steps = []
        if first:
            steps.append(compact_step(
                "note", zone, start_lv,
                "{} — {}".format(zone, ADDON_LABEL),
                "This chapter is an auto-optimized add-on built from local Forever quest data (already-fetched Zephras list and zone pages; forever-quests / ForeverDB had no records for this zone). Quests are grouped into 2–3 level bands so a step is not offered more than about two levels before its quest level; within each band a nearest-neighbor / same-hub batching heuristic is used on pickup coordinates. Prerequisites and exclusiveTo are applied only when present in the local catalog (none were found for these quests). Nothing here is a RestedXP or OpenXP route, and no quest or coordinate was invented.",
                None, None, "", [], "addon|newzone", prefix + "intro",
            ))
            steps.append(compact_step(
                "travel", zone, start_lv,
                "Travel to " + zone,
                travel_text,
                start_xy[0] if start_xy else None,
                start_xy[1] if start_xy else None,
                "zephras-list" if start_xy else "",
                [],
                "addon|newzone",
                prefix + "travel",
            ))
            if fp:
                also = fp.get("also")
                detail = "Get the {} flight path".format(fp["name"])
                if fp.get("npc"):
                    detail += " from {} ".format(fp["npc"])
                detail += " at {}, {}.".format(fp["x"], fp["y"])
                if also:
                    detail += " Also discover {}.".format(also)
                steps.append(compact_step(
                    "fp", zone, start_lv,
                    "Get the flight path — " + fp["name"],
                    detail,
                    fp["x"], fp["y"], "zephras-list", [],
                    "addon|newzone", prefix + "fp",
                ))
                if zone == "Mount Hyjal":
                    steps.append(compact_step(
                        "fp", zone, start_lv,
                        "Get the flight path — Tainted Foothills",
                        "Also discover the Tainted Foothills flight point (both sides) at 55.1, 82.5.",
                        55.1, 82.5, "zephras-list", [],
                        "addon|newzone", prefix + "fp-tainted",
                    ))
            first = False
        else:
            steps.append(compact_step(
                "note", zone, blo,
                "Continue in {} ({}–{} band)".format(zone, blo, bhi),
                "Stay in {}. This band covers quests of level {}–{}. Pickup order inside the band is auto-optimized (nearest neighbor, same-hub batching).".format(zone, blo, bhi),
                None, None, "", [], "addon|newzone",
                prefix + "band:{}-{}".format(blo, bhi),
            ))
        for q in rec["ordered"]:
            steps.append(emit_quest_step(zone, q, prefix, blo))
        title = "{} {}–{} — {}".format(zone, blo, bhi, ADDON_LABEL)
        key = chapter_key(zone, faction, rec["band"])
        meta = {
            "label": ADDON_LABEL,
            "band": [blo, bhi],
            "verified": len(rec["ordered"]),
            "naiveTravel": rec["naiveTravel"],
            "optimizedTravel": rec["optimizedTravel"],
            "travelReducedPct": rec["travelReducedPct"],
        }
        out.append((key, pack_chapter(title, zone, faction, steps, meta)))

    if unverified:
        steps = [compact_step(
            "note", zone, hi,
            "Unverified / optional — " + zone,
            "These quests are listed in the local Zephras snapshot for this zone but are missing a faction tag, coordinates, or a level in the expected range. They are optional and were not placed in the optimized path. Do them only if they appear for your character.",
            None, None, "", [],
            "addon|newzone|optional|unverified",
            prefix + "unverified-header",
        )]
        unverified.sort(key=lambda q: (q.get("level") or 99, q.get("name") or "", q["id"]))
        for q in unverified:
            steps.append(emit_quest_step(zone, q, prefix, hi, "addon|newzone|optional|unverified"))
        title = "{} — unverified / optional — {}".format(zone, ADDON_LABEL)
        key = chapter_key(zone, faction, unverified=True)
        out.append((key, pack_chapter(title, zone, faction, steps, {
            "label": ADDON_LABEL,
            "unverified": len(unverified),
        })))

    zone_meta = {
        "label": ADDON_LABEL,
        "verified": len(all_ordered),
        "unverified": len(unverified),
        "questCount": len(all_ordered) + len(unverified),
        "steps": sum(ch["stepCount"] for _, ch in out),
        "naiveTravel": round(naive_len, 1),
        "optimizedTravel": round(opt_len, 1),
        "travelReducedPct": reduced,
        "window": [lo, hi],
        "bands": [
            {
                "band": list(rec["band"]),
                "verified": len(rec["ordered"]),
                "first": rec["ordered"][0]["name"] if rec["ordered"] else None,
                "firstLevel": rec["ordered"][0].get("level") if rec["ordered"] else None,
                "levels": sorted({q.get("level") for q in rec["ordered"] if q.get("level")}),
                "naiveTravel": rec["naiveTravel"],
                "optimizedTravel": rec["optimizedTravel"],
                "travelReducedPct": rec["travelReducedPct"],
            }
            for rec in band_results
        ],
        "maxAhead": max((v["ahead"] for v in violations), default=0),
        "violations": violations,
    }
    return out, all_ordered, unverified, zone_meta


def parse_ch_levels(name):
    m = re.match(r"^(\d+)\s*-\s*(\d+)", name or "")
    if m:
        return int(m.group(1)), int(m.group(2))
    return None


# Overlap skip windows are the splice bands (not the full quest windows),
# so Riverglades does not mark mid-40s OpenXP that sits with Shen'dralas.
OVERLAP_WINDOWS = {
    "Riverglades": (35, 39),
    "Shen'dralas": (40, 43),
    "Mount Hyjal": (55, 60),
}

def overlap_names(chapter_names, window, after_name, protected, addon_names):
    lo, hi = window
    out = []
    seen_after = after_name is None
    for n in chapter_names:
        if n in addon_names or n.startswith("Forever Tracker add-on") or "add-on" in n:
            continue
        if after_name and n == after_name:
            seen_after = True
            continue
        if not seen_after:
            continue
        if n in protected:
            continue
        rng = parse_ch_levels(n)
        if not rng:
            continue
        a, b = rng
        if lo <= a <= hi:
            out.append(n)
    return out


def insert_after(chapters, after_candidates, new_keys):
    """Insert one or more chapter keys after the first matching name."""
    if isinstance(new_keys, str):
        new_keys = [new_keys]
    names = [(i, k.split("||", 1)[-1]) for i, k in enumerate(chapters)]
    idx = None
    matched = None
    for cand in after_candidates:
        for i, n in names:
            if n == cand:
                idx = i
                matched = cand
                break
        if idx is not None:
            break
    if idx is None:
        return chapters, None
    out = chapters[: idx + 1] + list(new_keys) + chapters[idx + 1 :]
    return out, matched


def main():
    allq = merge_quests()
    by_zone = defaultdict(list)
    for q in allq.values():
        by_zone[q["zone"]].append(q)

    # Alliance Shen: only if we add quests OpenXP misses
    shen_ids = {q["id"] for q in by_zone["Shen'dralas"]}
    shen_extra = shen_ids - OXP_SHEN_IDS
    build_alliance_shen = len(shen_extra) > 0
    print("Shen catalog", len(shen_ids), "OpenXP stub", sorted(OXP_SHEN_IDS & shen_ids), "extra", len(shen_extra))

    chapters = {}
    stats = {"zones": {}, "gaps": []}
    quest_names = {}

    for zone, qs in by_zone.items():
        factions = ["Horde", "Alliance"]
        if zone == "Shen'dralas" and not build_alliance_shen:
            factions = ["Horde"]
        for fac in factions:
            travel = SPLICE[zone][fac]["travel"]
            lv = SPLICE[zone][fac]["lv"]
            pool = qs
            # Alliance Shen add-on: include extras plus the OpenXP ones so the path is complete;
            # the OpenXP stub can be skipped as overlapping.
            built, verified, unverified, zone_meta = build_zone_chapters(zone, fac, pool, travel, lv)
            keys_here = []
            for key, ch in built:
                chapters[key] = ch
                keys_here.append(key)
            for q in verified + unverified:
                quest_names[str(q["id"])] = q["name"]
            rec = {
                "faction": fac,
                "verified": zone_meta["verified"],
                "unverified": zone_meta["unverified"],
                "steps": zone_meta["steps"],
                "travel": zone_meta,
                "bands": zone_meta["bands"],
                "keys": keys_here,
                "violations": zone_meta["violations"],
                "questIdsVerified": [q["id"] for q in verified],
                "questIdsUnverified": [q["id"] for q in unverified],
            }
            if zone == "Shen'dralas" and fac == "Alliance":
                rec["openxpStubIds"] = sorted(OXP_SHEN_IDS)
                rec["extraVsOpenXP"] = len(shen_extra)
            stats["zones"].setdefault(zone, {})[fac] = rec
            print("{} {}: verified={} unverified={} steps={} travel {}->{} ({}% less) bands={} maxAhead={} violations={}".format(
                zone, fac, zone_meta["verified"], zone_meta["unverified"], zone_meta["steps"],
                zone_meta["naiveTravel"], zone_meta["optimizedTravel"],
                zone_meta["travelReducedPct"],
                [(b["band"], b["verified"], b["firstLevel"], b["first"]) for b in zone_meta["bands"]],
                zone_meta["maxAhead"], len(zone_meta["violations"])))

    # Patch leveling-data.js
    text = LEVELING_JS.read_text()
    data = json.loads(text[text.find("{") : text.rfind("}") + 1])
    # Drop stale add-on chapter keys (including the pre-band single-chapter keys).
    for k in [k for k in data["chapters"] if k.startswith("addon||")]:
        del data["chapters"][k]
    for k, ch in chapters.items():
        data["chapters"][k] = {
            "name": ch["name"],
            "group": ch["group"],
            "source": "addon",
            "stepCount": ch["stepCount"],
            "steps": ch["steps"],
        }
    names = data.setdefault("questNames", {})
    names.update(quest_names)
    data.setdefault("coordLabels", {})["zephras-list"] = "Zephras list (already-fetched snapshot)"

    splices = {}
    for rid, rec in data["routes"].items():
        if rec.get("source") != "combined":
            continue
        fac = rec.get("faction")
        # Drop prior add-on keys so a rebuild can re-insert at the same points.
        keys = [k for k in (rec.get("chapters") or []) if not k.startswith("addon||")]
        names_only = [k.split("||", 1)[-1] for k in keys]
        protected = set()
        for z, cfg in SPLICE.items():
            for side in ("Horde", "Alliance"):
                protected.update(cfg[side]["after"])
        added = []
        for zone, cfg in SPLICE.items():
            if zone == "Shen'dralas" and fac == "Alliance" and not build_alliance_shen:
                continue
            zkeys = (stats.get("zones", {}).get(zone, {}).get(fac, {}) or {}).get("keys") or []
            zkeys = [k for k in zkeys if k in data["chapters"]]
            if not zkeys:
                continue
            after = cfg[fac]["after"]
            new_keys, matched = insert_after(keys, after, zkeys)
            if matched is None:
                splices.setdefault(rid, []).append({"zone": zone, "error": "no splice point", "tried": after})
                continue
            keys = new_keys
            window = OVERLAP_WINDOWS[zone]
            addon_names = {data["chapters"][k]["name"] for k in zkeys}
            overlaps = overlap_names(names_only, window, matched, protected, addon_names)
            # The OpenXP Alliance 40-41 Shen'dralas stub is superseded by the fuller add-on.
            if zone == "Shen'dralas" and fac == "Alliance" and matched == "40-41 Shen'dralas":
                if "40-41 Shen'dralas" not in overlaps:
                    overlaps = ["40-41 Shen'dralas"] + overlaps
            added.append({"zone": zone, "after": matched, "key": zkeys[0], "keys": zkeys, "overlaps": overlaps, "window": list(window), "questWindow": list(cfg["window"])})
        rec["chapters"] = keys
        rec["chapterNames"] = [k.split("||", 1)[-1] for k in keys]
        rec["stepCount"] = sum((data["chapters"].get(k) or {}).get("stepCount") or 0 for k in keys if not k.startswith("__handoff__"))
        rec["addonSplices"] = added
        if added:
            splices[rid] = added

    data.setdefault("meta", {})["addonZones"] = {
        "label": ADDON_LABEL,
        "toggle": "includeNewZones",
        "defaultOn": True,
        "sources": [
            "Already-fetched Zephras quest list and zone pages (build 1.60.1.70938 snapshot, 2026-11-17)",
            "tyler3497/forever-quests and ForeverDB snapshot were checked; they have no Riverglades / Shen'dralas / Mount Hyjal records",
        ],
        "levelBands": LEVEL_BANDS,
        "gaps": [
            "forever-quests and ForeverDB have no records for these zones, so there are no preQuestSingle / preQuestGroup / exclusiveTo / turn-in coordinates from those dumps.",
            "Zephras list tags (data-also=chain) are too loose to treat as a prerequisite graph and were not used as chains.",
            "Many quests have no faction tag (especially Shen'dralas and Mount Hyjal); those are optional/unverified at the end of each chapter.",
            "Turn-in and objective coordinates were not in the local snapshot; only pickup/giver points (and published flight points) are shown.",
            "A Riverglades level-58 outlier and Hyjal entries with no level are in the unverified list.",
        ],
    }
    stats["gaps"] = data["meta"]["addonZones"]["gaps"]
    stats["splicesExample"] = {
        "combined|speedrun|Undead": splices.get("combined|speedrun|Undead"),
        "combined|speedrun|Human": splices.get("combined|speedrun|Human"),
    }

    LEVELING_JS.write_text("window.WOW_LEVELING = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
    STATS.write_text(json.dumps(stats, indent=2, ensure_ascii=False))
    print("wrote", LEVELING_JS, "bytes", LEVELING_JS.stat().st_size)
    print("combined routes spliced", sum(1 for r, rec in data["routes"].items() if rec.get("source")=="combined" and rec.get("addonSplices")))


if __name__ == "__main__":
    main()
