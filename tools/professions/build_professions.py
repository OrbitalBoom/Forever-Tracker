#!/usr/bin/env python3
"""Build js/professions-data.js for the Professions tab.

Sources (see README "Professions data"):
  * LibProfessionDB (MIT) Forever tree: recipes, reagents, skill-up colours,
    required skill, recipe items, recipe sources (Forever's own vendors plus
    Vanilla-derived trainer/drop sources, flagged unconfirmed).
  * wago.tools DB2 exports of the live Forever client (wowf build): item names,
    quality, vendor buy/sell prices, recipe yields, NumSkillUps.
  * CMaNGOS classic-db (GPL-3.0) npc_vendor: which items vendors sell (Classic;
    Forever-new items unknown).
  * Blizzard hotfix notes for server-side recipe changes not in client data.

Usage: python3 build_professions.py <LibProfessionDB Data/Forever dir> <wago csv dir> <vendor_items.json> <out.js>
"""
import csv, json, re, sys, os, datetime

LPDB, WAGO, VENDOR_JSON, OUT = sys.argv[1:5]
WAGO_BUILD = os.environ.get("WAGO_BUILD", "")
LPDB_VERSION = os.environ.get("LPDB_VERSION", "")

PROFS = {171: "Alchemy", 164: "Blacksmithing", 333: "Enchanting", 202: "Engineering",
         165: "Leatherworking", 197: "Tailoring", 185: "Cooking", 129: "First Aid", 186: "Mining"}
FILES = {171: "Alchemy", 164: "Blacksmithing", 333: "Enchanting", 202: "Engineering",
         165: "Leatherworking", 197: "Tailoring", 185: "Cooking", 129: "Firstaid", 186: "Mining"}

# ---------- tiny Lua table parser ----------
TOK = re.compile(r'\s*(?:(--[^\n]*)|(\[)|(\])|(\{)|(\})|(=)|(,)|("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?)|(true|false|nil)|([A-Za-z_][A-Za-z0-9_]*))', re.S)

def tokens(s):
    pos = 0
    out = []
    while pos < len(s):
        m = TOK.match(s, pos)
        if not m:
            if s[pos:].strip() == "":
                break
            raise ValueError("lua parse at %d: %r" % (pos, s[pos:pos + 40]))
        pos = m.end()
        if m.group(1):
            continue
        for i, k in enumerate(["[", "]", "{", "}", "=", ","], start=2):
            if m.group(i):
                out.append((k, None)); break
        else:
            if m.group(8): out.append(("v", json.loads(m.group(8))))
            elif m.group(9): out.append(("v", float(m.group(9)) if "." in m.group(9) else int(m.group(9))))
            elif m.group(10): out.append(("v", {"true": True, "false": False, "nil": None}[m.group(10)]))
            elif m.group(11): out.append(("id", m.group(11)))
    return out

def parse_table(toks, i):
    assert toks[i][0] == "{"
    i += 1
    res = {}
    arr = []
    while toks[i][0] != "}":
        if toks[i][0] == "[":
            key = toks[i + 1][1]; assert toks[i + 2][0] == "]" and toks[i + 3][0] == "="
            i += 4
            val, i = parse_value(toks, i)
            res[key] = val
        elif toks[i][0] == "id" and toks[i + 1][0] == "=":
            key = toks[i][1]; i += 2
            val, i = parse_value(toks, i)
            res[key] = val
        else:
            val, i = parse_value(toks, i)
            arr.append(val)
        if toks[i][0] == ",":
            i += 1
    if arr and not res:
        return arr, i + 1
    if arr:
        res["_arr"] = arr
    return res, i + 1

def parse_value(toks, i):
    if toks[i][0] == "{":
        return parse_table(toks, i)
    return toks[i][1], i + 1

def lua_calls(path):
    """Return list of (funcName, [args]) for lib:Func(...) calls in a file."""
    s = open(path, encoding="utf-8").read()
    out = []
    for m in re.finditer(r'lib:(\w+)\(', s):
        start = m.end()
        # find matching paren
        depth = 1; j = start; instr = False
        while depth:
            c = s[j]
            if instr:
                if c == "\\": j += 1
                elif c == '"': instr = False
            elif c == '"': instr = True
            elif c == "(": depth += 1
            elif c == ")": depth -= 1
            j += 1
        toks = tokens(s[start:j - 1])
        args = []; i = 0
        while i < len(toks):
            v, i = parse_value(toks, i)
            args.append(v)
            if i < len(toks) and toks[i][0] == ",":
                i += 1
        out.append((m.group(1), args))
    return out

core = os.path.join(LPDB, "_core")
enus = os.path.join(LPDB, "enUS")

def read_csv(name):
    with open(os.path.join(WAGO, name + ".csv"), newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))

# ---------- wago client tables ----------
items = {}
for r in read_csv("ItemSparse"):
    items[int(r["ID"])] = {
        "name": r["Display_lang"], "q": int(r.get("OverallQualityID") or 0),
        "buy": int(r.get("BuyPrice") or 0), "sell": int(r.get("SellPrice") or 0),
        "vstack": int(r.get("VendorStackCount") or 1) or 1,
    }
yields = {}
for r in read_csv("SpellEffect"):
    if r["Effect"] == "24" and int(r.get("EffectItemType") or 0):
        sid = int(r["SpellID"])
        base = float(r.get("EffectBasePointsF") or r.get("EffectBasePoints") or 0)
        die = int(float(r.get("EffectDieSides") or 0))
        lo = max(1, int(round(base)))
        hi = max(lo, int(round(base)) + max(0, die - 1)) if die > 1 else lo
        # Classic DB2 stores BasePoints = n-1 with DieSides 1 in some builds; normalise below
        yields.setdefault(sid, (int(r["EffectItemType"]), base, die))
cooldowns = {}
try:
    for r in read_csv("SpellCooldowns"):
        ms = max(int(r.get("RecoveryTime") or 0), int(r.get("CategoryRecoveryTime") or 0))
        if ms >= 600000:
            cooldowns[int(r["SpellID"])] = ms
except FileNotFoundError:
    pass
skillups = {}
for r in read_csv("SkillLineAbility"):
    try:
        skillups[int(r["Spell"])] = int(r.get("NumSkillUps") or 1) or 1
    except ValueError:
        pass

def recipe_yield(spell, crafted):
    y = yields.get(spell)
    if not y:
        return 1, 1
    item, base, die = y
    # wago exports EffectBasePointsF as the real value (e.g. 1.0 for one item)
    b = int(round(base))
    if b <= 0:
        b = 1
    if die and die > 1:
        return b, b + die - 1
    return b, b

# ---------- vendor-sold items ----------
vend = json.load(open(VENDOR_JSON))
vendor_unlimited = set(vend["unlimited"])

# ---------- LibProfessionDB ----------
sources = {}; vendor_costs = {}; source_factions = {}
for fn in ("Sources.lua", "VendorSources.lua"):
    for name, args in lua_calls(os.path.join(core, fn)):
        if name == "LoadSources":
            for sid, src in args[0].items():
                cur = sources.setdefault(sid, {})
                for k, v in src.items():
                    if isinstance(v, list):
                        cur.setdefault(k, [])
                        cur[k] = sorted(set(cur[k]) | set(v))
                    else:
                        cur[k] = v
                if fn == "VendorSources.lua":
                    cur["fv"] = 1  # Forever's own recorded vendor
        elif name == "LoadVendorCosts":
            vendor_costs.update(args[0])
        elif name == "LoadSourceFactions":
            source_factions.update(args[0])
source_names = {}
for name, args in lua_calls(os.path.join(core, "SourceNames.lua")) + lua_calls(os.path.join(core, "VendorSources.lua")):
    if name == "LoadSourceNames":
        source_names.update(args[0])
recipe_items = {}
for name, args in lua_calls(os.path.join(core, "RecipeItems.lua")):
    if name == "LoadRecipeItems":
        recipe_items.update(args[0])
acquire = {}
for name, args in lua_calls(os.path.join(core, "AcquireMethods.lua")):
    if name == "LoadAcquireMethods":
        acquire.update(args[0])
hidden = set()
for name, args in lua_calls(os.path.join(core, "HiddenRecipes.lua")):
    if name == "LoadHiddenRecipes":
        hidden |= set(args[0].keys())

# ---------- server-side hotfix overrides (Blizzard hotfix notes) ----------
# Each entry is applied only if the client data still shows the old value.
HOTFIX_URL = "https://news.blizzard.com/en-us/article/24315281/wow-forever-hotfixes-november-17-2026"
BAG_FIX = {  # recipe name -> (bolt item id, old count, new count)
    "Red Mageweave Bag": (4339, 4, 5), "Green Silk Pack": (4305, 4, 5), "Black Silk Pack": (4305, 5, 6),
    "Green Woolen Bag": (2997, 4, 5), "Red Woolen Bag": (2997, 4, 5),
}
# recipe name -> (profession id, source kinds, source note) for recipes the data has no source for
SOURCE_FIX = {
    # Nov 17, 2026: "The quest 'The Old Ways' now grants the Orcish War Leggings recipe via an item ...
    # a replacement from Sumi inside the nearby blacksmithing hut once the quest is completed."
    "Orcish War Leggings": (164, "q", "Quest: The Old Ways (replacement from Sumi after the quest)"),
}
applied_fixes = []

out_profs = {}
used_items = set()
stats = {}
for pid, pname in PROFS.items():
    corefile = os.path.join(core, FILES[pid] + ".lua")
    namefile = os.path.join(enus, FILES[pid] + ".lua")
    recs = {}; borrowed = set()
    for name, args in lua_calls(corefile):
        if name == "LoadCore":
            recs.update(args[1])
        elif name == "LoadBorrowed" and args[0] == "requiredSkill":
            borrowed |= set(args[2])
    names = {}
    for name, args in lua_calls(namefile):
        if name == "LoadNames":
            for k, v in args[1].items():
                names[k] = v.get("name")
    rows = []
    for sid, r in sorted(recs.items()):
        if sid in hidden:
            continue
        d = r.get("difficulty") or []
        if len(d) != 4:
            continue
        crafted = r.get("craftedItemId") or 0
        reag = r.get("reagents") or {}
        if isinstance(reag, list):
            continue
        name = names.get(sid) or (items.get(crafted, {}).get("name")) or ("Spell %d" % sid)
        reagents = [[int(k), int(v)] for k, v in sorted(reag.items())]
        if name in BAG_FIX and pid == 197:
            bolt, old, new = BAG_FIX[name]
            for rg in reagents:
                if rg[0] == bolt and rg[1] == old:
                    rg[1] = new
                    applied_fixes.append("%s: %d->%d bolts" % (name, old, new))
        if name == "Tanning Rack" and pid == 165 and r.get("requiredSkill", d[0]) == 140:
            d = [x - 15 for x in d]
            r["requiredSkill"] = 125
            applied_fixes.append("Tanning Rack: required skill 140->125, colours -15")
        src = sources.get(sid, {})
        kinds = "".join(k for k in "tvqcd" if k in src)
        if acquire.get(sid) == 1:
            kinds = "a" + kinds  # learned automatically with the profession
        fix_note = None
        if name in SOURCE_FIX and SOURCE_FIX[name][0] == pid and not kinds:
            kinds, fix_note = SOURCE_FIX[name][1], SOURCE_FIX[name][2]
            applied_fixes.append("%s: source -> %s" % (name, fix_note))
        teach_item = r.get("itemId") or recipe_items.get(sid) or 0
        flags = 0
        if sid in borrowed: flags |= 1           # requiredSkill borrowed from Vanilla (unconfirmed)
        if r.get("requiredSpec"): flags |= 2     # needs a specialisation
        if src and not src.get("fv"): flags |= 4  # sources are Vanilla's, not confirmed in Forever
        if src.get("fv"): flags |= 8              # sold by a Forever vendor (recorded in game)
        if not crafted: flags |= 16               # no item (enchant/campfire object etc.)
        if "requiredSkill" not in r and d[0] <= 1 and d[1] > 1:
            flags |= 64                           # skill to learn unknown (tiers not anchored)
        if sid in cooldowns: flags |= 128         # has a cooldown (e.g. transmutes, Mooncloth)
        ylo, yhi = recipe_yield(sid, crafted)
        vc = vendor_costs.get(sid)
        cost = None
        if vc:
            for npc, offers in vc.items():
                for o in offers:
                    if "g" in o:
                        cost = o["g"] if cost is None else min(cost, o["g"])
                    elif "c" in o and cost is None:
                        cost = "c%d:%d" % (o["c"], o.get("n", 0))
        srcnpcs = []
        for k in ("t", "v"):
            for npc in (src.get(k) or [])[:4]:
                nm = source_names.get(npc)
                if nm:
                    fac = source_factions.get(npc)
                    srcnpcs.append(nm + (" (" + fac + ")" if fac else ""))
        row = {
            "id": sid, "n": name, "i": crafted, "y": [ylo, yhi], "d": d,
            "r": r.get("requiredSkill", 0), "g": reagents, "s": kinds,
            "ti": teach_item, "f": flags, "u": skillups.get(sid, 1),
        }
        if fix_note: srcnpcs = [fix_note] + srcnpcs
        if srcnpcs: row["sn"] = srcnpcs[:3]
        if src.get("dn") or src.get("d"): row["dn"] = src.get("dn") or len(src.get("d", []))
        if cost is not None: row["vc"] = cost
        if r.get("requiredSpec"): row["sp"] = r["requiredSpec"]
        if sid in cooldowns: row["cd"] = round(cooldowns[sid] / 3600000, 1)
        rows.append(row)
        used_items.add(crafted); used_items.add(teach_item)
        for g in reagents: used_items.add(g[0])
    out_profs[pid] = {"name": pname, "recipes": rows}
    stats[pname] = len(rows)

used_items.discard(0)
# Names for server-sent items missing from the client's ItemSparse table
# (optional; e.g. Forever Goblin's /api/items list, itself from Blizzard's API).
extra_names = {}
if os.environ.get("EXTRA_NAMES") and os.path.exists(os.environ["EXTRA_NAMES"]):
    for row in json.load(open(os.environ["EXTRA_NAMES"]))["items"]:
        extra_names[row[0]] = (row[1], row[2])
item_out = {}
missing = 0
for iid in sorted(used_items):
    it = items.get(iid)
    if not it:
        missing += 1
        nm, q = extra_names.get(iid, ("Item %d" % iid, 1))
        item_out[iid] = [nm, q, 0, 0, 1 if iid in vendor_unlimited else 0, 1]
        continue
    item_out[iid] = [it["name"], it["q"], it["buy"], it["sell"], 1 if iid in vendor_unlimited else 0, it["vstack"]]

meta = {
    "built": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
    "clientBuild": WAGO_BUILD, "lpdbVersion": LPDB_VERSION,
    "counts": stats, "hotfixesApplied": applied_fixes, "hotfixSource": HOTFIX_URL,
    "itemsMissingFromClient": missing,
    "itemFields": ["name", "quality", "vendorBuyCopper", "vendorSellCopper", "soldByVendor", "vendorStack"],
}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("/* Generated by tools/professions/build_professions.py. Do not hand-edit. See README for sources & licenses. */\n")
    f.write("window.PROF_DATA = ")
    json.dump({"meta": meta, "professions": out_profs, "items": item_out}, f, separators=(",", ":"), ensure_ascii=False)
    f.write(";\n")
print(json.dumps(meta, indent=1))
