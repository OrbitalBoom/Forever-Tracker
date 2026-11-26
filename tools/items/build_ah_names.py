#!/usr/bin/env python3
"""Build a compact name overlay for AH flip rows whose item IDs are not in
data/items/index.js. Names come only from the Forever client ItemSparse table
(wago.tools). IDs with no Display_lang are omitted so the UI can hide them
instead of showing “Item 763528”. Do not invent names."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
QUALITY = {0: "poor", 1: "common", 2: "uncommon", 3: "rare", 4: "epic", 5: "legendary"}
WEAPON_SUB = {0: "axe", 1: "axe", 2: "bow", 3: "gun", 4: "mace", 5: "mace", 6: "polearm",
              7: "sword", 8: "sword", 10: "staff", 13: "fist", 15: "dagger", 16: "thrown",
              18: "crossbow", 19: "wand", 20: "fishing"}
ARMOR_SUB = {0: "misc", 1: "cloth", 2: "leather", 3: "mail", 4: "plate", 6: "shield"}
CONSUMABLE_SUB = {0: "consumable", 1: "potion", 2: "elixir", 3: "flask", 5: "food", 8: "other"}
TRADE_SUB = {0: "trade", 1: "parts", 2: "explosive", 3: "device", 5: "cloth", 6: "leather",
             7: "metal", 8: "herb", 9: "reagent", 10: "elemental", 11: "other", 12: "enchanting"}
GEAR_INV = {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 21, 22, 23, 25, 26}
INV_SLOT = {1: "head", 2: "neck", 3: "shoulder", 4: "shirt", 5: "chest", 6: "waist",
            7: "legs", 8: "feet", 9: "wrist", 10: "hands", 11: "finger", 13: "trinket",
            14: "offhand", 15: "ranged", 16: "back", 17: "twohand", 21: "mainhand",
            22: "offhand", 23: "held", 25: "thrown", 26: "ranged"}
BUILD = "1.60.1.71139"


def load_json_js_array(path: Path, assign: str):
    text = path.read_text(encoding="utf-8")
    m = re.search(rf"{re.escape(assign)}\s*=\s*(\[.*\])\s*;?\s*$", text, re.S)
    if not m:
        raise SystemExit(f"could not parse {path}")
    return json.loads(m.group(1))


def load_csv(path: Path) -> dict:
    rows = {}
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                rows[int(row["ID"])] = row
            except (TypeError, ValueError, KeyError):
                continue
    return rows


def iint(v, default=0) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def item_type(class_id: int, sub: int, inv: int) -> str:
    if class_id == 2:
        return WEAPON_SUB.get(sub, "misc")
    if class_id == 4:
        if inv == 23:
            return "held"
        return ARMOR_SUB.get(sub, "misc")
    if class_id == 0:
        return CONSUMABLE_SUB.get(sub, "consumable")
    if class_id == 7:
        return TRADE_SUB.get(sub, "trade")
    return {5: "reagent", 6: "ammo", 9: "recipe", 12: "quest", 13: "key", 15: "misc"}.get(class_id, "misc")


def category(class_id: int, inv: int, typ: str) -> str:
    if class_id in (12, 13) or typ in ("quest", "key"):
        return "quest"
    if inv in GEAR_INV and class_id in (2, 4):
        return "gear"
    if class_id == 0:
        return "consumable"
    if class_id in (5, 7):
        return "reagent"
    if typ in ("herb", "ore", "leather", "cloth", "elemental", "meat", "enchanting", "metal", "parts"):
        return "reagent"
    if typ == "recipe":
        return "reagent"
    return "other"


def main() -> None:
    sparse_path = Path("/tmp/forever-71139/ItemSparse.csv")
    item_path = Path("/tmp/forever-71139/Item.csv")
    if not sparse_path.exists() or not item_path.exists():
        raise SystemExit("missing /tmp/forever-71139 ItemSparse.csv / Item.csv")

    index = load_json_js_array(ROOT / "data/items/index.js", "window.ITEM_INDEX")
    in_index = {int(it["id"]) for it in index}
    prices = json.loads((ROOT / "data/prices.json").read_text(encoding="utf-8"))
    priced = sorted(int(i) for i in prices.get("items", {}))
    sparse = load_csv(sparse_path)
    items = load_csv(item_path)

    named = {}
    unnamed = []
    for iid in priced:
        if iid in in_index:
            continue
        rec = sparse.get(iid)
        name = ((rec or {}).get("Display_lang") or "").strip()
        if not name:
            unnamed.append(iid)
            continue
        it = items.get(iid) or {}
        class_id = iint(it.get("ClassID"))
        sub = iint(it.get("SubclassID"))
        inv = iint(rec.get("InventoryType"), iint(it.get("InventoryType")))
        typ = item_type(class_id, sub, inv)
        q = QUALITY.get(iint(rec.get("OverallQualityID")), "common")
        icon = iint(it.get("IconFileDataID")) or None
        slot = INV_SLOT.get(inv)
        entry = {
            "n": name,
            "q": q,
            "cat": category(class_id, inv, typ),
            "src": "itemsparse",
        }
        if icon:
            entry["icon"] = icon
        if slot:
            entry["slot"] = slot
        il = iint(rec.get("ItemLevel"))
        rl = iint(rec.get("RequiredLevel"))
        sell = iint(rec.get("SellPrice"))
        if il:
            entry["il"] = il
        if rl:
            entry["rl"] = rl
        if sell:
            entry["sell"] = sell
        if typ and typ != "misc":
            entry["typ"] = typ
        named[str(iid)] = entry

    out = {
        "build": BUILD,
        "source": "wago.tools Forever ItemSparse + Item (build " + BUILD + ")",
        "priced": len(priced),
        "missingFromIndex": len(named) + len(unnamed),
        "named": len(named),
        "unnamed": unnamed,
    }
    dest = ROOT / "data/items/ah-names.js"
    body = (
        "/* Generated by tools/items/build_ah_names.py from Forever client ItemSparse "
        + BUILD
        + ". Do not hand-edit. Names are only included when Display_lang is present. */\n"
        + "window.AH_ITEM_META = "
        + json.dumps(named, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
        + "window.AH_ITEM_META_INFO = "
        + json.dumps(out, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    dest.write_text(body, encoding="utf-8")
    print("wrote", dest, "named", len(named), "unnamed", len(unnamed), "bytes", dest.stat().st_size)
    print("unnamed sample", unnamed[:12], "..." if len(unnamed) > 12 else "")


if __name__ == "__main__":
    main()
