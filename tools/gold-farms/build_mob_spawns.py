#!/usr/bin/env python3
"""Build a compact spawn-point file for Gold > Farms mob-grind maps.

Reads NorgannonDB 1.9 packed NPC records (already stored as zone-map
percentages — this script does not invent or convert world coordinates)
and the farm list in js/gold-farms-data.js. Writes data/gold-farm-spawns.js.

NorgannonDB 1.9 (Forever flavor, 2026-11-19) is GPL-3.0 and itself
aggregates QuestieDB (GPL-3.0), pfQuest (MIT), and CMaNGOS classic-db
(GPL-3.0). See https://github.com/zmarotrix/NorgannonDB.

Usage:
  python3 tools/gold-farms/build_mob_spawns.py --root . --norgannon /tmp/norgannon
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# Allow `import norgannondb` from tools/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import norgannondb  # noqa: E402


def farm_blocks(text: str) -> list[str]:
    return re.split(r"\n  (?=\{)", text)


def parse_mob_farms(text: str) -> list[dict]:
    farms = []
    for b in farm_blocks(text):
        if not re.search(r'type:\s*"mob"', b):
            continue
        fid = re.search(r'id:\s*"([^"]+)"', b)
        name = re.search(r'name:\s*"([^"]+)"', b)
        zone = re.search(r'zone:\s*"([^"]+)"', b)
        loc = re.search(r'loc:\s*"([^"]+)"', b)
        if not (fid and name and zone):
            continue
        drop = re.search(r'dropSource:[\s\S]*?npcs:\s*"([^"]+)"', b)
        pairs = re.findall(r"([A-Za-z][A-Za-z '\-]*?)\s*\((\d+)\)", drop.group(1) if drop else "")
        farms.append({
            "id": fid.group(1),
            "name": name.group(1),
            "zone": zone.group(1),
            "loc": loc.group(1) if loc else "",
            "npcs": [(n.strip(), int(i)) for n, i in pairs],
        })
    return farms


def zone_name_index(zones: dict[int, str]) -> dict[str, list[int]]:
    out: dict[str, list[int]] = {}
    for zid, name in zones.items():
        out.setdefault(name, []).append(zid)
    return out


def parse_minimap_sizes(world_path: Path) -> dict[int, list[float]]:
    text = world_path.read_text(encoding="utf-8")
    m = re.search(r"NorgannonDB\.legacy\s*=\s*(\{.*?\}) end f\(\) end", text, re.S)
    if not m:
        return {}
    rec = norgannondb._Parser(m.group(1)).value()
    sizes = rec.get("minimapSize") if isinstance(rec, dict) else None
    out = {}
    if isinstance(sizes, dict):
        for k, v in sizes.items():
            if isinstance(v, (list, tuple)) and len(v) >= 2:
                out[int(k)] = [float(v[0]), float(v[1])]
    return out


def unique_name_index(recs: dict) -> dict[str, list[int]]:
    by: dict[str, list[int]] = {}
    for rid, rec in recs.items():
        n = rec.get("name")
        if n:
            by.setdefault(n, []).append(int(rid))
    return by


def resolve_names_from_loc(loc: str, by_name: dict[str, list[int]]) -> list[tuple[str, int]]:
    """If a farm stored no NPC id, use unique NorgannonDB names that appear
    verbatim in the location text. No fuzzy or plural matching."""
    if not loc:
        return []
    hits = []
    for name, ids in by_name.items():
        if len(ids) != 1:
            continue
        if re.search(r"(?<![A-Za-z])" + re.escape(name) + r"(?![A-Za-z])", loc):
            hits.append((len(name), name, ids[0]))
    hits.sort(reverse=True)
    # Drop a shorter name wholly contained in a longer matched name
    kept = []
    used = []
    for _, name, iid in hits:
        if any(name != longer and name in longer for longer in used):
            continue
        kept.append((name, iid))
        used.append(name)
    return kept


def points_in_zones(rec: dict, zone_ids: set[int]) -> list[list[float]]:
    spawns = rec.get("spawns") or {}
    if not isinstance(spawns, dict):
        return []
    pts = []
    seen = set()
    for z, rows in spawns.items():
        try:
            zid = int(z)
        except (TypeError, ValueError):
            continue
        if zid not in zone_ids:
            continue
        if not isinstance(rows, list):
            continue
        for p in rows:
            if not isinstance(p, (list, tuple)) or len(p) < 2:
                continue
            try:
                x, y = float(p[0]), float(p[1])
            except (TypeError, ValueError):
                continue
            # Keep the source's own rounding (typically two decimals).
            x, y = round(x, 4), round(y, 4)
            key = (x, y)
            if key in seen:
                continue
            seen.add(key)
            pts.append([x, y])
    return pts


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", default=".", help="site root")
    ap.add_argument("--norgannon", default="/tmp/norgannon", help="NorgannonDB data dir (npcs.lua, world.lua, info.lua)")
    args = ap.parse_args()
    root = Path(args.root).resolve()
    src = Path(args.norgannon)
    farms_js = root / "js" / "gold-farms-data.js"
    if not farms_js.is_file():
        print("missing", farms_js, file=sys.stderr)
        return 1
    for req in ("npcs.lua", "world.lua", "info.lua"):
        if not (src / req).is_file():
            print("missing", src / req, file=sys.stderr)
            return 1

    info = norgannondb.load_info(src / "info.lua")
    zones = norgannondb.load_zone_names(src / "world.lua")
    name_to_z = zone_name_index(zones)
    sizes = parse_minimap_sizes(src / "world.lua")
    recs = norgannondb.load_records(src / "npcs.lua")
    by_name = unique_name_index(recs)
    farms = parse_mob_farms(farms_js.read_text(encoding="utf-8"))

    out_farms = {}
    stats = {
        "farms": len(farms),
        "farmsWithSpawns": 0,
        "farmsMissing": 0,
        "mobs": 0,
        "mobsWithSpawns": 0,
        "mobsMissing": 0,
        "mobsNoRecord": 0,
        "nameResolved": 0,
        "points": 0,
    }
    missing_rows = []

    for f in farms:
        zids = name_to_z.get(f["zone"]) or []
        if not zids:
            print("warning: no zone id for", f["zone"], file=sys.stderr)
        zone_ids = set(zids)
        # Prefer the top-level zone id when several share the name (should be unique).
        primary = zids[0] if zids else None

        npcs = list(f["npcs"])
        resolved = []
        if not npcs:
            resolved = resolve_names_from_loc(f["loc"], by_name)
            npcs = list(resolved)
            stats["nameResolved"] += len(resolved)

        mobs_out = []
        farm_has = False
        for name, iid in npcs:
            stats["mobs"] += 1
            rec = recs.get(iid)
            if not rec:
                stats["mobsNoRecord"] += 1
                stats["mobsMissing"] += 1
                missing_rows.append((f["id"], iid, name, "no record"))
                mobs_out.append({"id": iid, "name": name, "points": [], "missing": "No spawn data"})
                continue
            pts = points_in_zones(rec, zone_ids) if zone_ids else []
            entry = {
                "id": iid,
                "name": rec.get("name") or name,
                "points": pts,
            }
            if any(n == name and i == iid for n, i in resolved):
                entry["resolvedFromName"] = True
            if pts:
                stats["mobsWithSpawns"] += 1
                stats["points"] += len(pts)
                farm_has = True
            else:
                stats["mobsMissing"] += 1
                entry["missing"] = "No spawn data"
                missing_rows.append((f["id"], iid, entry["name"], "no points in zone"))
            mobs_out.append(entry)

        if farm_has:
            stats["farmsWithSpawns"] += 1
        else:
            stats["farmsMissing"] += 1

        rec_farm = {
            "zone": f["zone"],
            "zoneId": primary,
            "mobs": mobs_out,
        }
        if primary in sizes:
            rec_farm["mapSize"] = sizes[primary]
        if resolved:
            rec_farm["nameResolved"] = True
        out_farms[f["id"]] = rec_farm

    meta = {
        "built": "2026-11-24",
        "norgannon": {
            "name": "NorgannonDB",
            "version": "1.9",
            "generated": (info or {}).get("generated") or "2026-11-19",
            "build": (info or {}).get("build") or "1.60.1",
            "flavor": (info or {}).get("flavor") or "Forever",
            "license": "GPL-3.0",
            "url": "https://github.com/zmarotrix/NorgannonDB",
            "sources": (info or {}).get("sources") or [
                {"name": "QuestieDB", "license": "GPL-3.0"},
                {"name": "pfQuest", "license": "MIT"},
                {"name": "cmangos classic-db", "license": "GPL-3.0"},
            ],
        },
        "disclaimer": "Spawn locations from Classic data, may differ in Forever.",
        "mapNote": "This is a schematic grid of zone-map percentages, not official zone art. Coordinates are used as published by NorgannonDB; none are invented.",
        "units": "Each point is [x, y] as a percentage of the zone map (0,0 is the top-left / north-west corner, as in the source).",
        "stats": stats,
    }

    payload = {"meta": meta, "farms": out_farms}
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    out_path = root / "data" / "gold-farm-spawns.js"
    header = (
        "/* Gold > Farms mob-grind spawn points.\n"
        " * Source: NorgannonDB 1.9 (Forever flavor, generated 2026-11-19), GPL-3.0\n"
        " *   https://github.com/zmarotrix/NorgannonDB\n"
        " * Upstream: QuestieDB 1.1.3 (GPL-3.0), pfQuest 8.0.0 (MIT),\n"
        " *   CMaNGOS classic-db (GPL-3.0). Spawn coordinates are zone-map\n"
        " *   percentages from that database — not invented, and not taken from\n"
        " *   wow-forever.gg or Wowhead.\n"
        " * Regenerated by tools/gold-farms/build_mob_spawns.py. Do not hand-edit.\n"
        " */\n"
    )
    out_path.write_text(header + "window.GOLD_FARM_SPAWNS = " + body + ";\n", encoding="utf-8")
    print(
        "Wrote %s (%d bytes): %d/%d farms have spawns, %d/%d mobs have spawns, %d points, %d name-resolved, %d missing"
        % (
            out_path,
            out_path.stat().st_size,
            stats["farmsWithSpawns"],
            stats["farms"],
            stats["mobsWithSpawns"],
            stats["mobs"],
            stats["points"],
            stats["nameResolved"],
            stats["mobsMissing"] + stats["mobsNoRecord"],
        )
    )
    for row in missing_rows:
        print("  missing:", row)
    return 0


if __name__ == "__main__":
    sys.exit(main())
