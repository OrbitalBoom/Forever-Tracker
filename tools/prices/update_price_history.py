#!/usr/bin/env python3
"""Merge the current data/prices.json snapshot into a compact 7-day rolling
history of marketValue, written to data/price-history.json + .js.

The prices-data branch is force-pushed as a single commit, so git history
there is not kept. This file is the history: each run unions the previous
price-history.json from prices-data (if any) with the copy in the repo
checkout (data/price-history.json on main, when present), drops samples
older than 7 days, appends the new snapshot, and writes the result back.
Samples are keyed by timestamp (the newest value wins when two sources
share a time). prices.json itself is unchanged.

Usage:
  python3 tools/prices/update_price_history.py --root . --prev /tmp/price-history.prev.json
  python3 tools/prices/update_price_history.py --root . --import-dir /tmp/price-snaps
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

WINDOW_DAYS = 7


def parse_iso(s: str) -> datetime:
    if not s:
        return datetime.now(timezone.utc)
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s)


def load_prices(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def market_value(row) -> int | None:
    if row is None:
        return None
    if isinstance(row, list):
        v = row[1] if len(row) > 1 else None
    else:
        v = row.get("marketValue")
    if v is None:
        return None
    v = int(v)
    return v if v > 0 else None


UNITS = (
    "copper; each items[id] entry is marketValue at the matching samples[] timestamp, "
    "or null if the item was not in that snapshot"
)
SOURCE = (
    "Rolling marketValue from the US Normal Horde price snapshots. Kept in this file "
    "because the prices-data branch is force-pushed and has no git history."
)


def _stamp(s) -> str | None:
    if not s:
        return None
    if isinstance(s, dict):
        s = s.get("updated")
    return s or None


def _when(ts) -> datetime | None:
    ts = _stamp(ts)
    if not ts:
        return None
    try:
        return parse_iso(ts)
    except ValueError:
        return None


def _history_updated(h: dict) -> datetime:
    w = _when(h.get("updated"))
    if w:
        return w
    samples = h.get("samples") or []
    if samples:
        w = _when(samples[-1])
        if w:
            return w
    return datetime.min.replace(tzinfo=timezone.utc)


def snapshot_to_history(snapshot: dict) -> dict:
    """Turn a prices.json snapshot into a one-sample history file."""
    updated = snapshot.get("updated") or snapshot.get("fetched")
    items = {}
    for iid, row in (snapshot.get("items") or {}).items():
        mv = market_value(row)
        if mv is not None:
            items[str(iid)] = [mv]
    return {
        "schema": snapshot.get("schema") or 1,
        "region": snapshot.get("region") or "US",
        "ruleset": snapshot.get("ruleset") or "Normal",
        "faction": snapshot.get("faction") or "Horde",
        "house": snapshot.get("house") or 114,
        "houseName": snapshot.get("houseName") or "Horde Auction House",
        "windowDays": snapshot.get("windowDays") or WINDOW_DAYS,
        "units": snapshot.get("units") or UNITS,
        "source": snapshot.get("source") or SOURCE,
        "updated": updated,
        "sampleCount": 1,
        "itemCount": len(items),
        "samples": [{"updated": updated}],
        "items": items,
    }


def merge_histories(*histories, window_days: int = WINDOW_DAYS) -> dict | None:
    """Union history files by sample timestamp.

    When two samples share a timestamp, the value from the history with the
    later `updated` field wins. Samples older than window_days before the
    newest remaining sample are dropped. Item arrays are rebuilt aligned to
    the merged sample list (null where an item was missing).
    """
    sources = [h for h in histories if h and h.get("samples") and h.get("items")]
    if not sources:
        return None
    sources = sorted(sources, key=_history_updated)

    # datetime -> {updated: str, values: {item_id: marketValue|None}}
    slots: dict[datetime, dict] = {}
    for h in sources:
        samples = h["samples"]
        items = h["items"]
        for i, s in enumerate(samples):
            ts = _stamp(s)
            when = _when(ts)
            if when is None:
                continue
            slot = slots.setdefault(when, {"updated": ts, "values": {}})
            slot["updated"] = ts
            for iid, arr in items.items():
                if not isinstance(arr, list) or i >= len(arr):
                    continue
                slot["values"][str(iid)] = arr[i]

    if not slots:
        return None
    newest = max(slots)
    cutoff = newest - timedelta(days=window_days)
    kept = sorted(t for t in slots if t >= cutoff)
    samples_out = [{"updated": slots[t]["updated"]} for t in kept]
    ids = set()
    for t in kept:
        ids.update(slots[t]["values"])
    items_out: dict[str, list] = {}
    for iid in ids:
        col = [slots[t]["values"].get(iid) for t in kept]
        if any(v is not None for v in col):
            items_out[iid] = col

    def meta(key, default=None):
        for h in reversed(sources):
            if h.get(key) not in (None, ""):
                return h[key]
        return default

    return {
        "schema": meta("schema", 1),
        "region": meta("region", "US"),
        "ruleset": meta("ruleset", "Normal"),
        "faction": meta("faction", "Horde"),
        "house": meta("house", 114),
        "houseName": meta("houseName", "Horde Auction House"),
        "windowDays": window_days,
        "units": meta("units", UNITS),
        "source": meta("source", SOURCE),
        "updated": slots[kept[-1]]["updated"],
        "sampleCount": len(samples_out),
        "itemCount": len(items_out),
        "samples": samples_out,
        "items": items_out,
    }


def merge(prev: dict | None, snapshot: dict, window_days: int = WINDOW_DAYS) -> dict:
    hist = merge_histories(prev, snapshot_to_history(snapshot), window_days=window_days)
    if hist is None:
        raise ValueError("cannot merge price history: no samples")
    return hist


def write_history(hist: dict, root: Path) -> None:
    data_dir = root / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    body = json.dumps(hist, separators=(",", ":"), ensure_ascii=False)
    (data_dir / "price-history.json").write_text(body + "\n", encoding="utf-8")
    (data_dir / "price-history.js").write_text(
        "/* 7-day rolling marketValue history; regenerated by tools/prices/update_price_history.py */\n"
        "window.PRICE_HISTORY = " + body + ";\n",
        encoding="utf-8",
    )
    print(
        "Wrote price history: %d samples, %d items, %d bytes (window %d days, latest %s)"
        % (hist["sampleCount"], hist["itemCount"], len(body), hist["windowDays"], hist["updated"])
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", default=".", help="site root (contains data/prices.json)")
    ap.add_argument("--prev", default=None, help="previous price-history.json, if any")
    ap.add_argument("--import-dir", default=None, help="directory of past prices.json snapshots to replay (oldest first by updated)")
    ap.add_argument("--window-days", type=int, default=WINDOW_DAYS)
    args = ap.parse_args()
    root = Path(args.root).resolve()

    if args.import_dir:
        snaps = []
        for p in Path(args.import_dir).glob("*.json"):
            d = load_prices(p)
            if d.get("items") and d.get("updated"):
                snaps.append(d)
        snaps.sort(key=lambda d: d["updated"])
        if not snaps:
            print("No snapshots in", args.import_dir, file=sys.stderr)
            return 1
        hist = None
        for d in snaps:
            hist = merge(hist, d, args.window_days)
        write_history(hist, root)
        return 0

    prices_path = root / "data" / "prices.json"
    if not prices_path.is_file():
        print("missing", prices_path, file=sys.stderr)
        return 1
    snapshot = load_prices(prices_path)
    prev = None
    if args.prev:
        pp = Path(args.prev)
        if pp.is_file() and pp.stat().st_size > 20:
            try:
                prev = load_prices(pp)
            except json.JSONDecodeError as e:
                print("warning: could not read previous history (%s); starting a new window" % e, file=sys.stderr)

    # Also union the checkout copy (main's data/price-history.json). A first
    # prices-data run has no previous file and would otherwise publish a
    # one-sample window, wiping the seed history the site already ships.
    seed = None
    seed_path = root / "data" / "price-history.json"
    if seed_path.is_file() and seed_path.stat().st_size > 20:
        try:
            if not (args.prev and Path(args.prev).resolve() == seed_path.resolve()):
                cand = load_prices(seed_path)
                if cand.get("samples") and isinstance(cand.get("items"), dict):
                    seed = cand
        except (json.JSONDecodeError, OSError) as e:
            print("warning: could not read checkout price history (%s); continuing without it" % e, file=sys.stderr)

    hist = merge_histories(prev, seed, snapshot_to_history(snapshot), window_days=args.window_days)
    if hist is None:
        print("history merge produced no samples", file=sys.stderr)
        return 1
    write_history(hist, root)
    return 0


if __name__ == "__main__":
    sys.exit(main())
