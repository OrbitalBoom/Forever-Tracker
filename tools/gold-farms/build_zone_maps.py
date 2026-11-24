#!/usr/bin/env python3
"""Build zone-map images for Gold > Farms spawn maps from the live Forever client.

Downloads UiMap / UiMapArtTile / WorldMapOverlay tables and the matching BLP
tiles from wago.tools (the same source used for item and talent DB2 extraction),
stitches the classic 4x3 256px tiles, crops to the 1002x668 WorldMap frame
that NorgannonDB/Questie percentages use, composites exploration overlays,
and writes compressed WebP files to data/zone-maps/.

Game map art © Blizzard Entertainment. Used the same way this site already
uses Forever client icon renders from render.worldofwarcraft.com.

Usage:
  python3 tools/gold-farms/build_zone_maps.py --root . --build 1.60.1.71091
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from PIL import Image, BlpImagePlugin  # noqa: F401  (register BLP)

USER_AGENT = (
    "ForeverTracker/1.0 (zone-maps; "
    "+https://orbitalboom.github.io/Forever-Tracker/)"
)
WAGO = "https://wago.tools"
FRAME_W, FRAME_H = 1002, 668
TILE = 256
COLS, ROWS = 4, 3

# Farm-zone uiMapIds (NorgannonDB world.lua uiMapId, confirmed against UiMap).
ZONE_UIMAPS = {
    "Arathi Highlands": 1417,
    "The Hinterlands": 1425,
    "Tanaris": 1446,
    "Badlands": 1418,
    "Dustwallow Marsh": 1445,
    "Feralas": 1444,
    "Thousand Needles": 1441,
    "Western Plaguelands": 1422,
    "Azshara": 1447,
    "Searing Gorge": 1427,
    "Silithus": 1451,
    "Un'Goro Crater": 1449,
    "Eastern Plaguelands": 1423,
}


def slug(name: str) -> str:
    s = name.lower().replace("'", "").replace("'", "")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def fetch_bytes(url: str, timeout: int = 90) -> bytes:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "*/*"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def latest_wowf() -> str:
    data = json.loads(fetch_bytes(f"{WAGO}/api/builds", timeout=30).decode("utf-8"))
    return data["wowf"][0]["version"]


def load_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def ensure_table(dest: Path, name: str, build: str) -> Path:
    dest.mkdir(parents=True, exist_ok=True)
    path = dest / f"{name}.csv"
    if path.is_file() and path.stat().st_size > 50:
        return path
    url = f"{WAGO}/db2/{name}/csv?build={build}&hotfixes=false&locale=enUS"
    print("GET", name)
    path.write_bytes(fetch_bytes(url))
    return path


def download_blp(fid: int, raw_dir: Path, build: str) -> Path:
    path = raw_dir / f"{fid}.blp"
    if path.is_file() and path.stat().st_size > 100 and path.read_bytes()[:4] == b"BLP2":
        return path
    url = f"{WAGO}/api/casc/{fid}?download&version={build}"
    last_err = None
    for attempt in range(5):
        try:
            data = fetch_bytes(url, timeout=60)
            if data[:4] != b"BLP2":
                raise ValueError(f"not a BLP2 (magic={data[:8]!r}, {len(data)} bytes)")
            path.write_bytes(data)
            return path
        except Exception as e:
            last_err = e
            time.sleep(1.5 + attempt * 2)
    raise RuntimeError(f"failed to download FileDataID {fid}: {last_err}")


def open_blp(path: Path) -> Image.Image:
    im = Image.open(path)
    return im.convert("RGBA")


def stitch_tiles(tiles: list[tuple[int, int, Path]], width: int, height: int, tile_w: int, tile_h: int) -> Image.Image:
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for row, col, path in tiles:
        tile = open_blp(path)
        canvas.paste(tile, (col * tile_w, row * tile_h))
    return canvas


def build_overlay(ov_tiles: list[tuple[int, int, Path]], tex_w: int, tex_h: int, tile_w: int = TILE, tile_h: int = TILE) -> Image.Image:
    if not ov_tiles:
        return Image.new("RGBA", (max(tex_w, 1), max(tex_h, 1)), (0, 0, 0, 0))
    max_r = max(r for r, c, p in ov_tiles)
    max_c = max(c for r, c, p in ov_tiles)
    grid = Image.new("RGBA", ((max_c + 1) * tile_w, (max_r + 1) * tile_h), (0, 0, 0, 0))
    for row, col, path in ov_tiles:
        tile = open_blp(path)
        grid.paste(tile, (col * tile_w, row * tile_h))
    return grid.crop((0, 0, tex_w, tex_h))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", default=".")
    ap.add_argument("--build", default=None, help="wago.tools Forever build (default: latest wowf)")
    ap.add_argument("--cache-dir", default="/tmp/zone-maps-src")
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()
    root = Path(args.root).resolve()
    cache = Path(args.cache_dir)
    db2 = cache / "db2"
    raw = cache / "raw"
    raw.mkdir(parents=True, exist_ok=True)

    build = args.build or latest_wowf()
    print("Forever build", build)

    for table in (
        "UiMap",
        "UiMapArt",
        "UiMapArtTile",
        "UiMapXMapArt",
        "UiMapArtStyleLayer",
        "WorldMapOverlay",
        "WorldMapOverlayTile",
    ):
        ensure_table(db2, table, build)

    uimap = {int(r["ID"]): r for r in load_csv(db2 / "UiMap.csv")}
    xart = load_csv(db2 / "UiMapXMapArt.csv")
    art_rows = {int(r["ID"]): r for r in load_csv(db2 / "UiMapArt.csv")}
    tiles = load_csv(db2 / "UiMapArtTile.csv")
    overlays = load_csv(db2 / "WorldMapOverlay.csv")
    ovtiles = load_csv(db2 / "WorldMapOverlayTile.csv")

    # UiMapID -> default (phase 0) art id
    art_for_map: dict[int, int] = {}
    for r in xart:
        uid = int(r["UiMapID"])
        if int(r.get("PhaseID") or 0) == 0:
            art_for_map[uid] = int(r["UiMapArtID"])

    tiles_by_art: dict[int, list] = {}
    for t in tiles:
        if int(t["LayerIndex"]) != 0:
            continue
        tiles_by_art.setdefault(int(t["UiMapArtID"]), []).append(t)

    ov_by_art: dict[int, list] = {}
    for o in overlays:
        ov_by_art.setdefault(int(o["UiMapArtID"]), []).append(o)
    ovt_by_ov: dict[int, list] = {}
    for t in ovtiles:
        if int(t["LayerIndex"]) != 0:
            continue
        ovt_by_ov.setdefault(int(t["WorldMapOverlayID"]), []).append(t)

    jobs = []
    fids: set[int] = set()
    for name, uid in ZONE_UIMAPS.items():
        row = uimap.get(uid)
        if not row:
            print("MISSING UiMap", name, uid, file=sys.stderr)
            continue
        if row.get("Name_lang") != name:
            print("warning: UiMap name", row.get("Name_lang"), "!=", name)
        aid = art_for_map.get(uid)
        if not aid:
            print("MISSING art", name, uid, file=sys.stderr)
            continue
        base = tiles_by_art.get(aid) or []
        ovs = ov_by_art.get(aid) or []
        for t in base:
            fids.add(int(t["FileDataID"]))
        for o in ovs:
            for t in ovt_by_ov.get(int(o["ID"]), []):
                fids.add(int(t["FileDataID"]))
        jobs.append((name, uid, aid, base, ovs))

    print(f"Downloading {len(fids)} BLP tiles…")
    fid_paths: dict[int, Path] = {}
    failed = []
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        fut = {ex.submit(download_blp, fid, raw, build): fid for fid in sorted(fids)}
        done = 0
        for f in as_completed(fut):
            fid = fut[f]
            done += 1
            try:
                fid_paths[fid] = f.result()
            except Exception as e:
                failed.append((fid, str(e)))
            if done % 40 == 0 or done == len(fids):
                print(f"  {done}/{len(fids)}")
    if failed:
        print("FAILED downloads:", failed, file=sys.stderr)
        return 1

    out_dir = root / "data" / "zone-maps"
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = {
        "build": build,
        "source": "wago.tools DB2 (UiMap, UiMapArt, UiMapArtTile, UiMapXMapArt, WorldMapOverlay, WorldMapOverlayTile) and CASC BLP tiles for the live WoW: Forever client",
        "credit": "Zone map art © Blizzard Entertainment. Decoded from the Forever client (same source this site already uses for item and talent data via wago.tools).",
        "frame": {"width": FRAME_W, "height": FRAME_H},
        "units": "NorgannonDB/Questie zone percentages (0,0 = top-left / NW) are relative to this 1002x668 WorldMap frame.",
        "maps": {},
    }

    for name, uid, aid, base, ovs in jobs:
        # Stitch 4x3 tiles then crop to the 1002x668 map frame.
        tile_list = [
            (int(t["RowIndex"]), int(t["ColIndex"]), fid_paths[int(t["FileDataID"])])
            for t in base
        ]
        stitched = stitch_tiles(tile_list, COLS * TILE, ROWS * TILE, TILE, TILE)
        frame = stitched.crop((0, 0, FRAME_W, FRAME_H))
        for o in ovs:
            tex_w, tex_h = int(o["TextureWidth"]), int(o["TextureHeight"])
            ox, oy = int(o["OffsetX"]), int(o["OffsetY"])
            ot = [
                (int(t["RowIndex"]), int(t["ColIndex"]), fid_paths[int(t["FileDataID"])])
                for t in ovt_by_ov.get(int(o["ID"]), [])
            ]
            if not ot or tex_w <= 0 or tex_h <= 0:
                continue
            ov_im = build_overlay(ot, tex_w, tex_h)
            frame.paste(ov_im, (ox, oy), ov_im)

        rgb = frame.convert("RGB")
        fname = slug(name) + ".webp"
        dest = out_dir / fname
        rgb.save(dest, "WEBP", quality=82, method=6)
        manifest["maps"][str(uid)] = {
            "name": name,
            "uiMapId": uid,
            "artId": aid,
            "file": "data/zone-maps/" + fname,
            "width": FRAME_W,
            "height": FRAME_H,
            "bytes": dest.stat().st_size,
            "baseTiles": len(base),
            "overlays": len(ovs),
        }
        print(f"Wrote {dest} ({dest.stat().st_size} bytes) for {name}")

    # Also key by zone name for the UI.
    by_name = {v["name"]: {**v} for v in manifest["maps"].values()}
    manifest["byName"] = by_name

    js_path = out_dir / "index.js"
    body = json.dumps(manifest, ensure_ascii=False, indent=2)
    js_path.write_text(
        "/* Zone maps for Gold > Farms. Art © Blizzard Entertainment.\n"
        f" * Built from Forever client {build} via wago.tools (DB2 + CASC BLP tiles).\n"
        " * Regenerated by tools/gold-farms/build_zone_maps.py. Do not hand-edit.\n"
        " */\n"
        "window.ZONE_MAPS = " + body + ";\n",
        encoding="utf-8",
    )
    (out_dir / "index.json").write_text(body + "\n", encoding="utf-8")
    print("Wrote", js_path, "maps", len(manifest["maps"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
