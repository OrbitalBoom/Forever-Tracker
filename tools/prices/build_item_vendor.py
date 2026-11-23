#!/usr/bin/env python3
"""Build a compact vendor buy/sell map from data/items/d*.js chunks.

Used by the AH flip finder to exclude vendor-cheaper items and to flag
vendor flips. Refresh when the item database is rebuilt.

Usage: python3 tools/prices/build_item_vendor.py --root .
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


def load_chunk(path: Path) -> dict:
    t = path.read_text(encoding="utf-8")
    m = re.search(r"ITEM_DETAIL_CHUNK\[\s*(\d+)\s*\]\s*=", t)
    if not m:
        return {}
    data, _ = json.JSONDecoder().raw_decode(t[m.end():].lstrip())
    return data


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", default=".")
    args = ap.parse_args()
    root = Path(args.root).resolve()
    items_dir = root / "data" / "items"
    out_map = {}
    n = 0
    for p in sorted(items_dir.glob("d*.js"), key=lambda x: int(x.stem[1:]) if x.stem[1:].isdigit() else 0):
        data = load_chunk(p)
        n += len(data)
        for iid, rec in data.items():
            buy = rec.get("buy") or 0
            sell = rec.get("sell") or 0
            if buy or sell:
                out_map[str(iid)] = [int(buy or 0), int(sell or 0)]
    if not out_map:
        print("No vendor prices found in", items_dir, file=sys.stderr)
        return 1
    body = json.dumps(out_map, separators=(",", ":"))
    dest = root / "data" / "item-vendor.js"
    dest.write_text(
        "/* Vendor buy/sell in copper [buy, sell], from data/items chunks. Built by tools/prices/build_item_vendor.py. */\n"
        "window.ITEM_VENDOR = " + body + ";\n",
        encoding="utf-8",
    )
    print("Wrote %s (%d items with vendor prices, %d chunk items, %d bytes)" % (dest, len(out_map), n, dest.stat().st_size))
    return 0


if __name__ == "__main__":
    sys.exit(main())
