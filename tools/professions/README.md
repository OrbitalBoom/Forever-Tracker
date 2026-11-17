# Rebuilding js/professions-data.js

```bash
# 1. LibProfessionDB (MIT) - latest file from CurseForge project 1558781
curl -sL -o lpdb.zip "https://www.curseforge.com/api/v1/mods/1558781/files/<fileId>/download"
unzip -q lpdb.zip -d lpdb          # uses lpdb/ProfessionDB/Data/Forever

# 2. wago.tools DB2 CSVs for the live Forever client (product "wowf")
B=$(curl -s https://wago.tools/api/builds | python3 -c "import json,sys;print(json.load(sys.stdin)['wowf'][0]['version'])")
mkdir -p db2 && for t in ItemSparse SpellEffect SkillLineAbility SpellCooldowns; do
  curl -s -o db2/$t.csv "https://wago.tools/db2/$t/csv?build=$B"; done

# 3. Vendor-sold items: tools/professions/vendor_items.json (from CMaNGOS classic-db npc_vendor, GPL-3.0)

# 4. Optional names for server-only items: curl -s https://forevergoblin.trade/api/items -o fgi.json

EXTRA_NAMES=fgi.json WAGO_BUILD=$B LPDB_VERSION="ProfessionDB-vX (Forever tree)" \
  python3 tools/professions/build_professions.py lpdb/ProfessionDB/Data/Forever db2 \
  tools/professions/vendor_items.json js/professions-data.js
```

Bump the `?v=` query on the script tags in index.html after rebuilding.
