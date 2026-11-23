# Stat weights (Items tab upgrade finder)

Everything in `js/item-weights.js` scores items with **published** weights. Nothing is hand-tuned.

## Published (copied unchanged)

All 28 specs of all 9 classes, every stat the item database has:

- Pawn, "WoW Classic Era, Burning Crusade Classic, Wrath Classic, and Forever scales curated by HawsJon",
  `ClassicHawsJon.lua`, section `VgerCore.IsForever`, repo commit `c170b9d18369c4a720bad1ac21c48b0d32ab6873`
  (2026-11-12). https://github.com/VgerMods/Pawn/blob/c170b9d18369c4a720bad1ac21c48b0d32ab6873/ClassicHawsJon.lua
- Pawn is (c) Travis Spomer, licensed CC BY-NC-ND 3.0. The numbers are credited and not altered; this is a
  non-commercial fan tracker. Revisit if the licence is a problem.
- `tools/stat-weights/build_stat_weights.py` parses the Lua (copy at `tools/stat-weights/ClassicHawsJon.lua`)
  into `js/stat-weights-data.js` (generated; do not edit). Rating terms (`HitRatingPer*1`, ...) use Pawn's own
  Classic/Forever level-60 conversions: hit 9.37931, spell hit 8, crit 8.5, spell crit 8, haste 8.03,
  expertise 2.34483, armor pen 3.75, defense 1.5, dodge 9.44, parry 9.44, block 6.9. Units: weight per 1 point of
  the stat on the tooltip; crit, hit, dodge, parry, block chance are per 1%.

Cross-checks (not used in scoring): Wowhead Forever Beast Mastery stat priority
(https://www.wowhead.com/forever/guide/classes/hunter/beast-mastery/stat-priority-pve-dps: Hit, Crit, Haste,
Agility, Intellect, AP, Spirit, Stamina), SixtySim leveling weights (https://sixtysim.com, Hunter BM at levels 25 to
30 put MP5 and Intellect above Agility).

## Derived (formulas)

| Adjustment | Formula | Source |
| --- | --- | --- |
| Level (Agility's crit share) | `Agi(L) = Agi(60) + (1/AgiPerCrit(L) - 1/AgiPerCrit(60)) * CritWeight`, `AgiPerCrit(L) = a1*(60-L)/59 + a60*(L-1)/59` | level-1 and level-60 Agi per 1% crit per class: https://wow-guides.com/knowledge/attributes ; linear interpolation as in the `wow_world_base` crate (https://docs.rs/wow_world_base) |
| Weapon DPS by slot | ranged slot uses RangedDps, main/one/two hand use MeleeDps, off hand uses 0.5 x MeleeDps | https://warcraft.wiki.gg/wiki/Attack_power (off hand deals 50%, 1 DPS = 14 AP) |
| Hunter melee weapons | melee DPS weight 0 (stat sticks) | https://www.wowhead.com/classic/guide/wow-classic-best-hunter-weapons |
| Feral Druid melee weapons | melee DPS weight 0 (forms ignore weapon damage) | Pawn's own Classic Era table has Feral MeleeDps 0 |
| Spell Power (`sp`) | SpellDamage + Healing | item "spell power" is damage and healing |
| Race: Human | Spirit weight x1.10 (The Human Spirit) | https://foreverdiff.com/races/ , https://wowforevertierlist.com/races/racials |
| Race: Tauren | Stamina weight x1.05 (Endurance, +5% total Health) | same, plus Wowhead Forever hunter page (10.5 HP per Stamina) |
| Role rows | mean of the sourced spec rows, missing stat = 0 | derived |

Race effects that are flat or not item stats (Human +1% crit, Dwarf +1% hit, Night Elf +1% dodge, Gnome +5%
max mana, Skyborne +2% haste, Orc/Troll/Undead pet and healing racials) do not change a per-point weight.
Weapon-skill racials were removed in Forever.

## Not covered (stays 0)

- Haste, Expertise, Armor Penetration, Resilience, Mana, Health items: no such stats in the item database.
- Wand DPS: Pawn weights it 0 for casters, so wands score on stats only.
- Rogue/Warrior thrown, bow and gun DPS: Pawn gives RangedDps 0 for those specs, so ranged weapons score on stats only.
- Level scaling for spell crit per Intellect, dodge per Agility, armor mitigation, Spirit regen: no level table sourced,
  level-60 values are used.
- Level-1 anchors come from wow-guides (1.12 data) and differ from the `wow_world_base` crate for a few classes.
