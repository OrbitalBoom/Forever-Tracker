#!/usr/bin/env python3
"""Derive Forever item stat, armor, and weapon amounts from live client DB2s.

Validated (build 1.60.1.71037) against Classic Wowhead/CMaNGOS amounts on items
that exist in Forever ItemSparse, and against Wowhelm live Forever tooltips.

  value = halfup(RandPropPoints[ilvl][Good|Superior|Epic][slotIndex]
                 * StatPercentEditor / 10000)

  Combat-rating types are then divided by the TBC level-60 coefficients
  (the same numbers the Forever tooltip uses to print a percent):
    crit / spellCrit 14, hit 10, spellHit 8, dodge 12, parry 15, blockChance 5.

  armor = halfup(ItemArmorTotal[ilvl][subclass] * ItemArmorQuality[ilvl][quality]
                 * ArmorLocation[invType][subclass])
          + bonus
  Shields use ItemArmorShield[ilvl][quality] instead of the set-total formula.
  Bonus armor is the type-50 StatPercentEditor allocation (same formula as
  other stats). QualityModifier is not used for armor: some pieces have a
  leftover QM with no +Armor line on the live tooltip, and weapons use QM
  for unique damage.

  weapon DPS comes from ItemDamageTwoHand for two-hand slots, otherwise
  ItemDamageOneHand (Forever tooltips for bows, guns, wands, and thrown
  also follow the one-hand table). Then:
    min = floor(dps * speed * (1 - DmgVariance/2))
    max = halfup(dps * speed * (1 + DmgVariance/2))
  Weapons with a non-zero QualityModifier have unique damage and are not derived.

Never invent numbers: if a table row is missing, skip that component.
"""
from __future__ import annotations

import csv
import math
from pathlib import Path

STAT_KEY = {
    1: "health", 3: "agi", 4: "str", 5: "int", 6: "spi", 7: "sta",
    12: "defense", 13: "dodge", 14: "parry", 15: "blockChance",
    16: "hit", 17: "hit", 18: "spellHit", 19: "crit", 20: "crit", 21: "spellCrit",
    22: "hit", 23: "spellCrit",
    31: "hit", 32: "crit",
    38: "ap", 39: "rap", 40: "fap", 41: "healing", 42: "sp", 43: "mp5",
    44: "arp", 45: "sp", 47: "spellPen", 48: "blockValue",
    # 46 hp5 is stored but does not match Classic tooltip amounts; omit it.
    51: "fireRes", 52: "frostRes", 53: "holyRes", 54: "shadowRes", 55: "natureRes", 56: "arcaneRes",
    84: "spHoly", 85: "spFire", 86: "spNature", 87: "spFrost", 88: "spShadow", 89: "spArcane",
}

# Validated; spellHit / 8 follows the TBC level-60 table (no Classic overlap in this build).
RATING_DIV = {
    "crit": 14, "spellCrit": 14,
    "hit": 10, "spellHit": 8,
    "dodge": 12, "parry": 15, "blockChance": 5,
}

# InventoryType -> RandPropPoints column 0-4, fitted on 2747 Classic-stat items in Sparse.
INV_RPP = {
    1: 0, 5: 0, 7: 0, 17: 0, 20: 0,          # head, chest, legs, 2H, robe
    3: 1, 6: 1, 8: 1, 10: 1, 12: 1,          # shoulder, waist, feet, hands, trinket
    2: 2, 9: 2, 11: 2, 14: 2, 16: 2, 23: 2,  # neck, wrist, finger, shield, back, holdable
    13: 3, 21: 3, 22: 3,                     # 1H, main-hand, off-hand
    15: 4, 25: 4, 26: 4, 28: 4,              # bow, thrown, gun/wand/crossbow, relic
}

QUALITY_BAND = {0: "Good", 1: "Good", 2: "Good", 3: "Superior", 4: "Epic", 5: "Epic", 6: "Epic"}

# ArmorLocation / ItemArmorTotal subclass columns. Cloaks (inv 16) use cloth.
SUB_ARMOR = {
    1: ("Cloth", "Clothmodifier"),
    2: ("Leather", "Leathermodifier"),
    3: ("Mail", "Chainmodifier"),
    4: ("Plate", "Platemodifier"),
}

# Two-hand weapon subclasses (axe, mace, polearm, sword, staff). Inv 17 always uses 2H.
TWO_HAND_SUB = {1, 5, 6, 8, 10}

# Skill-like bonusStat types we can turn into effect lines (amounts use the same budget formula).
SKILL_TYPES = {
    90: "Increased {weapon} +{n}.",
    112: "Increased Herbalism +{n}.",
    113: "Increased Mining +{n}.",
    114: "Increased Skinning +{n}.",
    117: "Increased Fishing +{n}.",
}

WEAPON_SKILL_NAME = {
    0: "One-Handed Axes", 1: "Two-Handed Axes", 2: "Bows", 3: "Guns",
    4: "One-Handed Maces", 5: "Two-Handed Maces", 6: "Polearms",
    7: "One-Handed Swords", 8: "Two-Handed Swords", 10: "Staves",
    13: "Fist Weapons", 14: "Miscellaneous", 15: "Daggers",
    16: "Thrown", 17: "Crossbows", 18: "Wands",
}

SOURCE = "forever-client-derived"


def halfup(x: float) -> int:
    return int(math.floor(x + 0.5))


def _f(v, default=0.0) -> float:
    try:
        if v is None or v == "":
            return default
        return float(v)
    except (TypeError, ValueError):
        return default


def _i(v, default=0) -> int:
    return int(_f(v, default))


def load_csv_by_id(path: Path) -> dict:
    out = {}
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            out[int(row["ID"])] = row
    return out


class ForeverClientStats:
    def __init__(self, src: Path):
        src = Path(src)
        # Accept either src/forever/*.csv or src/*.csv
        forever = src / "forever" if (src / "forever" / "ItemSparse.csv").exists() else src
        if not (forever / "ItemSparse.csv").exists():
            raise FileNotFoundError("ItemSparse.csv not found under " + str(src))
        self.dir = forever
        self.sparse = load_csv_by_id(forever / "ItemSparse.csv")
        self.items = load_csv_by_id(forever / "Item.csv")
        self.rpp = load_csv_by_id(forever / "RandPropPoints.csv")
        self.armor_q = load_csv_by_id(forever / "ItemArmorQuality.csv")
        self.armor_t = load_csv_by_id(forever / "ItemArmorTotal.csv")
        self.armor_s = load_csv_by_id(forever / "ItemArmorShield.csv")
        self.armor_loc = load_csv_by_id(forever / "ArmorLocation.csv")
        self.dmg_1h = load_csv_by_id(forever / "ItemDamageOneHand.csv")
        self.dmg_2h = load_csv_by_id(forever / "ItemDamageTwoHand.csv")

    def budgets(self, ilvl: int, quality: int):
        row = self.rpp.get(ilvl)
        if not row:
            return None
        band = QUALITY_BAND.get(quality, "Epic")
        return [int(row[f"{band}_{i}"]) for i in range(5)]

    def allocs(self, row: dict) -> list[tuple[int, int]]:
        out = []
        for i in range(10):
            typ = _i(row.get(f"StatModifier_bonusStat_{i}"))
            ed = _i(row.get(f"StatPercentEditor_{i}"))
            if typ > 0 and ed:
                out.append((typ, ed))
        return out

    def derive_stats(self, item_id: int) -> dict:
        row = self.sparse.get(item_id)
        if not row:
            return {}
        ilvl = _i(row.get("ItemLevel"))
        q = _i(row.get("OverallQualityID"))
        inv = _i(row.get("InventoryType"))
        b = self.budgets(ilvl, q)
        if not b:
            return {}
        bud = b[INV_RPP.get(inv, 2)]
        stats = {}
        for typ, ed in self.allocs(row):
            key = STAT_KEY.get(typ)
            if not key:
                continue
            raw = halfup(bud * ed / 10000.0)
            if key in RATING_DIV:
                val = round(raw / RATING_DIV[key], 1)
                if val == int(val):
                    val = int(val)
                if val:
                    stats[key] = val
            else:
                if raw:
                    stats[key] = stats.get(key, 0) + raw
        return stats

    def bonus_armor(self, item_id: int) -> int:
        row = self.sparse.get(item_id)
        if not row:
            return 0
        # type 50: extra / bonus armor. Do not use QualityModifier here.
        ilvl = _i(row.get("ItemLevel"))
        q = _i(row.get("OverallQualityID"))
        inv = _i(row.get("InventoryType"))
        b = self.budgets(ilvl, q)
        if not b:
            return 0
        bud = b[INV_RPP.get(inv, 2)]
        raw = 0
        for typ, ed in self.allocs(row):
            if typ == 50:
                raw += halfup(bud * ed / 10000.0)
        return raw

    def derive_armor(self, item_id: int) -> int | None:
        row = self.sparse.get(item_id)
        it = self.items.get(item_id)
        if not row or not it:
            return None
        ilvl = _i(row.get("ItemLevel"))
        q = _i(row.get("OverallQualityID"))
        inv = _i(row.get("InventoryType"))
        sub = _i(it.get("SubclassID"))
        if inv == 14:
            srow = self.armor_s.get(ilvl)
            if not srow:
                return None
            base = _f(srow.get(f"Quality_{q}"))
        else:
            tot = self.armor_t.get(ilvl)
            aq = self.armor_q.get(ilvl)
            loc = self.armor_loc.get(inv)
            if not (tot and aq and loc):
                return None
            if sub in SUB_ARMOR:
                tcol, lcol = SUB_ARMOR[sub]
            elif inv == 16:
                tcol, lcol = "Cloth", "Clothmodifier"
            else:
                return None
            locm = _f(loc.get(lcol))
            if locm == 0:
                return None
            base = _f(tot.get(tcol)) * _f(aq.get(f"Qualitymod_{q}")) * locm
        total = halfup(base) + self.bonus_armor(item_id)
        return total if total else None

    def _dps_row(self, item_id: int):
        row = self.sparse.get(item_id)
        it = self.items.get(item_id)
        if not row or not it:
            return None
        delay = _f(row.get("ItemDelay"))
        if delay <= 0:
            return None
        if _f(row.get("QualityModifier")) != 0:
            return None  # unique / non-table damage
        ilvl = _i(row.get("ItemLevel"))
        q = _i(row.get("OverallQualityID"))
        inv = _i(row.get("InventoryType"))
        sub = _i(it.get("SubclassID"))
        table = self.dmg_2h if (inv == 17 or sub in TWO_HAND_SUB) else self.dmg_1h
        trow = table.get(ilvl)
        if not trow:
            return None
        dps = _f(trow.get(f"Quality_{q}"))
        if dps <= 0:
            return None
        var = _f(row.get("DmgVariance"))
        return dps, delay / 1000.0, var

    def derive_weapon(self, item_id: int) -> dict | None:
        got = self._dps_row(item_id)
        if not got:
            return None
        dps, speed, var = got
        avg = dps * speed
        mn = int(math.floor(avg * (1 - var / 2)))
        mx = halfup(avg * (1 + var / 2))
        if mx < mn:
            mx = mn
        # Display DPS from the table (one or two decimals) — matches Wowhelm's
        # "(N damage per second)" more closely than (min+max)/2/speed.
        shown = round(dps, 2)
        if shown == int(shown):
            shown = int(shown)
        sp = round(speed, 2)
        if abs(sp - speed) > 0.001:
            sp = round(speed, 3)
        return {"min": mn, "max": mx, "speed": sp, "dps": shown}

    def skill_effects(self, item_id: int) -> list[str]:
        row = self.sparse.get(item_id)
        it = self.items.get(item_id)
        if not row:
            return []
        ilvl = _i(row.get("ItemLevel"))
        q = _i(row.get("OverallQualityID"))
        inv = _i(row.get("InventoryType"))
        b = self.budgets(ilvl, q)
        if not b:
            return []
        bud = b[INV_RPP.get(inv, 2)]
        sub = _i(it.get("SubclassID")) if it else 0
        weapon = WEAPON_SKILL_NAME.get(sub, "weapon skill")
        out = []
        for typ, ed in self.allocs(row):
            tmpl = SKILL_TYPES.get(typ)
            if not tmpl:
                continue
            raw = halfup(bud * ed / 10000.0)
            if raw:
                out.append("Equip: " + tmpl.format(n=raw, weapon=weapon))
        return out

    def derive(self, item_id: int) -> dict:
        """Return {stats, weapon, skill_effects} with any components that exist."""
        stats = self.derive_stats(item_id)
        armor = self.derive_armor(item_id)
        if armor:
            stats["armor"] = armor
        weapon = self.derive_weapon(item_id)
        return {
            "stats": stats,
            "weapon": weapon,
            "skill_effects": self.skill_effects(item_id),
        }


def find_forever_src(roots: list[Path]) -> Path:
    for root in roots:
        if not root:
            continue
        root = Path(root)
        if (root / "ItemSparse.csv").exists():
            return root
        if (root / "forever" / "ItemSparse.csv").exists():
            return root / "forever"
    raise FileNotFoundError("ItemSparse.csv not found in " + ", ".join(map(str, roots)))
