# Talent tooltips from the live Forever client

`build_talent_tooltips.py` builds `js/talent-tooltips-data.js` for the Talents tab: Classic-style tooltips with real numbers at the selected character (or preview) level.

The calculator does not parse `$tokens` in the browser. This script resolves them ahead of time from the Forever client DB2 so the tab only does a lookup. The data file is lazy-loaded when the Talents tab is first opened.

## Wednesday refresh

From the repo root:

```bash
python3 tools/talent-tooltips/build_talent_tooltips.py
```

Useful options:

```bash
# Reuse a local DB2 cache (the item-database cache is fine)
python3 tools/talent-tooltips/build_talent_tooltips.py --cache-dir /tmp/item-db-src/forever

# Pin a build (default is the latest wowf version from https://wago.tools/api/builds)
python3 tools/talent-tooltips/build_talent_tooltips.py --build 1.60.1.71037

# Skip the Wowhelm sample (faster; Zephras rank-text checks still run)
python3 tools/talent-tooltips/build_talent_tooltips.py --skip-wowhelm
```

Then bump the `?v=` query on the script and stylesheet tags in `index.html` (the Talents tab loads `js/talent-tooltips-data.js` with the same `?v=` as `js/app.js`).

The script prints a Zephras match rate, a sample that always includes every Hunter Beast Mastery talent, a Wowhelm ability-header check (unless skipped), and how many talents still have unresolved tokens. A fuller report is written to `tools/talent-tooltips/validation-report.json`.

## What it reads

Tables are downloaded from [wago.tools](https://wago.tools) for the current (or pinned) Forever `wowf` build, `hotfixes=false`, `locale=enUS`:

- Mapping: `TraitNode`, `TraitNodeXTraitNodeEntry`, `TraitNodeEntry`, `TraitDefinition`, `TraitDefinitionEffectPoints`, `CurvePoint`
- Text and numbers: `Spell`, `SpellName`, `SpellEffect`, `SpellMisc`, `SpellDuration`, `SpellRange`, `SpellCastTimes`, `SpellCooldowns`, `SpellPower`, `SpellLevels`, `SpellAuraOptions`, `SpellRadius`

Forever reworked the trees, so this uses the client’s `Spell.Description_lang` and trait curves, not Classic Talent / TalentTab rows (those exist in the build as leftovers and are ignored). Talent layout and names still come from `js/talents.js` (Zephras, CC BY 4.0); only the tooltip numbers and resolved text are rebuilt here.

Per-rank values prefer `TraitDefinitionEffectPoints` curves. When a spell has `EffectRealPointsPerLevel`, the tooltip stores a level 1–60 table and the UI picks the selected level. `$s` effects with a `Variance` field display as a min–max range. Tokens that need character stats (`$rap`, `$ap`, `$<maxAP>`, and similar) are left raw with a short note in the tooltip. Do not invent numbers.

## Validation

The builder compares every rank’s resolved text to the Zephras rank strings already in `js/talents.js`. Level-scaling spells are compared at the spell’s base level as well as 60, because Zephras listings typically show the un-scaled (base-level) figures. Wowhelm talent descriptions often use un-curved rank-1 `SpellEffect` values (they even label higher ranks “Shows rank 1 values”), so they are a secondary check — useful for ability cost / range / cast / cooldown, not for per-rank curve numbers.
