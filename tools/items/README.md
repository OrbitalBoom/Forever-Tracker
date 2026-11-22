# Rebuilding the item database

The Items tab reads generated files under `data/items/` (a compact search index, a gear list for the upgrade finder, and lazily loaded detail chunks). Regenerating them is part of the Wednesday data refresh.

## 1. Download sources into a cache directory

```bash
SRC=tools/items/cache   # or any folder; pass it as ITEM_SRC
mkdir -p "$SRC/norgannon" "$SRC/cmangos"

# Live Forever client item tables (wago.tools DB2)
B=$(curl -s https://wago.tools/api/builds | python3 -c "import json,sys;print(json.load(sys.stdin)['wowf'][0]['version'])")
export WAGO_BUILD=$B
for t in ItemSparse Item SpellItemEnchantment RandPropPoints; do
  curl -sL -o "$SRC/$t.csv" "https://wago.tools/db2/$t/csv?build=$B&hotfixes=false&locale=enUS"
done
# Classic Era random-suffix tables. Forever 1.60 has no ItemRandomProperties / ItemRandomSuffix.
mkdir -p "$SRC/era" "$SRC/forever"
echo "$B" > "$SRC/forever/BUILD.txt"
E=$(curl -s https://wago.tools/api/builds | python3 -c "import json,sys;print(json.load(sys.stdin)['wow_classic_era'][0]['version'])")
echo "$E" > "$SRC/era/BUILD.txt"
for t in ItemSparse Item ItemRandomProperties SpellItemEnchantment; do
  curl -sL -o "$SRC/era/$t.csv" "https://wago.tools/db2/$t/csv?build=$E&hotfixes=false&locale=enUS"
done
# Optional copies used by tools/items/build_suffixes.py
cp -f "$SRC/ItemSparse.csv" "$SRC/forever/ItemSparse.csv"
cp -f "$SRC/Item.csv" "$SRC/forever/Item.csv"
cp -f "$SRC/SpellItemEnchantment.csv" "$SRC/forever/SpellItemEnchantment.csv" 2>/dev/null || true

# NorgannonDB (GPL-3.0) — Forever drops, vendors, quests, recipes
# https://github.com/zmarotrix/NorgannonDB
for f in items npcs objects quests recipes world info; do
  curl -sL -o "$SRC/norgannon/${f}.lua" \
    "https://raw.githubusercontent.com/zmarotrix/NorgannonDB/master/data/${f}.lua"
done

# CMaNGOS classic-db (GPL-3.0) — Classic-reference stat/weapon amounts
curl -sL -o "$SRC/cmangos/ClassicDB.sql.gz" \
  "https://github.com/cmangos/classic-db/raw/master/Full_DB/ClassicDB_1_12_1_z2815.sql.gz"

# Optional: keep the previous Wowhead Classic tooltip cache (named-item stats/effects)
# Copy js/items.js here *before* the first rebuild that replaces that file, or keep
# tools/items/wow-classic-tooltips.js (shipped with this repo; the pre-rebuild Wowhead Classic tooltip cache).
```

`js/professions-data.js` is already in the tree and is reused for Forever recipe reagents.

## 2. Generate

```bash
ITEM_SRC=$SRC WAGO_BUILD=$B python3 tools/items/build_items.py
```

Writes `data/items/meta.js`, `index.js`, `gear.js`, `suffixes.js` (lazy-loaded random-suffix tables), and `d0.js`… chunk files, and a stub `js/items.js`. After a rebuild, bump the `?v=` query on the script tags in `index.html` (including `js/item-db.js`).

The upgrade finder only uses Forever-confirmed gear (items that have a player-facing `ItemSparse` row in the live client) plus the character's custom items. Classic-reference pieces stay searchable and are labelled as such. Numeric stats come from Classic tooltip or CMaNGOS `item_template` rows when those exist — the Forever client stores allocation weights, not raw amounts, so amounts are not invented.

Live auction prices are *not* stored in these files; the UI reads `data/prices.js` and the `prices-data` branch. After this database exists, `tools/prices/fetch_prices.py` also keeps AH rows for item ids in the index (the hourly workflow itself is unchanged).
