# Hunter pet data builder

Generates `js/pets-data.js` (families, diet, abilities, loyalty, XP-to-level, and notable tame sources).

```bash
python3 tools/pets/build_pets.py --root . \
  --cache /tmp/forever-71091-pets \
  --cmangos /tmp/item-db-src/cmangos/ClassicDB.sql.gz \
  --norgannon /tmp/norgannon \
  --spelldata /tmp/forever-71091-pets/CreatureSpellData-classic-1.13.7.38704.csv
```

Sources:

- wago.tools DB2 for WoW: Forever **1.60.1.71091** — CreatureFamily, ItemPetFood, PetLoyalty, TalentTab (pet-talent check), SkillLineAbility, Spell / SpellLevels / SpellEffect, LevelExperience.
- Forever does **not** ship CreatureSpellData (`Table not found` on wago for this build). Taught-on-tame spells come from Classic CreatureSpellData **1.13.7.38704** plus CMaNGOS `creature_template.PetSpellDataId`.
- CMaNGOS classic-db (GPL-3.0) and NorgannonDB 1.9 (GPL-3.0) for tameable beasts, zones, and spawn points. Label as Classic data, may differ in Forever.

Do not invent ranks, levels, coordinates, or training-point pools.
