/* Gold Farming section. Reads window.GOLD_FARMS and the same PRICE_DATA
 * feed as the Profession guide. Does not invent drop rates. Gold/hour without
 * a published kill rate is estimated from gold/kill × a user-adjustable
 * kills-per-minute assumption (default 2/min) and is labeled as an estimate. */
(function () {
  var TYPE_LABEL = {
    mob: "Mob grind",
    gathering: "Gathering",
    cloth: "Cloth farm",
    instance: "Dungeon",
    craft: "Craft / AH"
  };
  var PILL_TYPES = [
    { id: "all", label: "All" },
    { id: "mob", label: "Mob grind" },
    { id: "gathering", label: "Gathering" },
    { id: "instance", label: "Dungeon" }
  ];
  var TOP_N = 5;
  var DEFAULT_KPM = 2;
  var KPM_MIN = 0.5;
  var KPM_MAX = 6;
  var KPM_STEP = 0.5;
  var bound = false;
  var helpers = {};
  var expandedId = null;
  var showAllRows = false;

  function escapeHtml(s) {
    if (helpers.escapeHtml) return helpers.escapeHtml(s);
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Match a farm drop name to an item ID. Exact after light normalization only —
     never a typo-guess. Ambiguous names stay unmatched. */
  var _itemById = null;
  var _itemByName = null;
  function normItemName(s) {
    return String(s || "").toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, " ").trim();
  }
  function rebuildItemMaps() {
    _itemById = {};
    _itemByName = {};
    (window.ITEM_INDEX || []).forEach(function (it) {
      _itemById[String(it.id)] = it;
      var k = normItemName(it.n);
      if (!k) return;
      (_itemByName[k] = _itemByName[k] || []).push(it);
    });
  }
  function matchItemName(name) {
    if (!name) return null;
    if (!_itemByName) rebuildItemMaps();
    var hits = _itemByName[normItemName(name)] || [];
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) {
      var conf = hits.filter(function (it) { return it.f === 1; });
      if (conf.length === 1) return conf[0];
    }
    return null;
  }
  function resolveLoot(l) {
    if (!l) return null;
    if (!_itemById) rebuildItemMaps();
    if (l.id != null && l.id !== "") {
      var rec = _itemById[String(l.id)];
      /* Only hook a tooltip when the id is in the item DB. A farm id that is
         missing from the index is left as plain text — never a guessed item. */
      if (rec) return { id: l.id, quality: rec.q, index: rec, how: "id" };
      return null;
    }
    var m = matchItemName(l.name);
    return m ? { id: m.id, quality: m.q, index: m, how: "name" } : null;
  }
  function itemLinkHtml(name, resolved) {
    if (!resolved || resolved.id == null) return escapeHtml(name);
    var q = resolved.quality ? " q-" + resolved.quality : "";
    return '<a class="gf-item-link' + q + '" href="#item-' + resolved.id +
      '" data-item-id="' + resolved.id + '" data-item-pin="1">' + escapeHtml(name) + "</a>";
  }
  function lootLineHtml(spot) {
    var loot = spot.loot || [];
    if (!loot.length) return "See details for loot";
    var parts = loot.slice(0, 3).map(function (l) { return itemLinkHtml(l.name, resolveLoot(l)); });
    return parts.join(", ") + (loot.length > 3 ? "…" : "");
  }

  function goldText(copper, opts) {
    opts = opts || {};
    var n = Math.round(Number(copper) || 0);
    var sign = n < 0 ? "-" : "";
    n = Math.abs(n);
    var g = Math.floor(n / 10000), s = Math.floor((n % 10000) / 100), c = n % 100;
    if (opts.compact) {
      if (g && (s || !opts.dropZero)) return sign + g + "g " + s + "s";
      if (g) return sign + g + "g";
      if (s && c) return sign + s + "s " + c + "c";
      if (s) return sign + s + "s";
      return sign + c + "c";
    }
    if (g) return sign + g + "g " + s + "s " + c + "c";
    if (s) return sign + s + "s " + c + "c";
    return sign + c + "c";
  }
  function goldShortHtml(copper) {
    var n = Math.round(Number(copper) || 0);
    var sign = n < 0 ? "-" : "";
    var abs = Math.abs(n);
    var g = Math.floor(abs / 10000), s = Math.floor((abs % 10000) / 100), c = abs % 100;
    if (g) {
      return sign + '<span class="money-g">' + g + "g</span> <span class=\"money-s\">" + s + "s</span>";
    }
    if (s) {
      return sign + '<span class="money-s">' + s + "s</span>" +
        (c ? ' <span class="money-c">' + c + "c</span>" : "");
    }
    return sign + '<span class="money-c">' + c + "c</span>";
  }
  function formatGoldHtml(copper) {
    if (helpers.formatGold) return helpers.formatGold(copper);
    return escapeHtml(goldText(copper));
  }
  function state() {
    return (window.ForeverApp && window.ForeverApp.getState && window.ForeverApp.getState()) || helpers.state || {};
  }
  function persist() {
    if (helpers.save) helpers.save();
    else if (window.ForeverApp && window.ForeverApp.save) window.ForeverApp.save();
  }

  function defaultPrefs() {
    return {
      followLevel: true,
      viewLevel: null,
      typeFilter: "all",
      favsOnly: false,
      showAllGroups: false,
      hideDungeons: false,
      killsPerMin: DEFAULT_KPM
    };
  }
  function prefs() {
    var st = state();
    if (!st.goldFarmPrefs || typeof st.goldFarmPrefs !== "object") st.goldFarmPrefs = {};
    if (!Array.isArray(st.goldFarmFavs)) st.goldFarmFavs = [];
    var d = defaultPrefs();
    var p = st.goldFarmPrefs;
    Object.keys(d).forEach(function (k) {
      if (p[k] == null) p[k] = d[k];
    });
    return p;
  }

  function charFaction() {
    var race = (state().character || {}).race || "";
    var races = (window.DATA && window.DATA.races) || [];
    for (var i = 0; i < races.length; i++) {
      if (races[i].name === race) return (races[i].faction || "").toLowerCase();
    }
    return "horde";
  }
  function charClass() { return (state().character || {}).class || ""; }
  function charLevel() {
    var n = parseInt((state().character || {}).level, 10);
    return isNaN(n) ? 1 : Math.max(1, Math.min(60, n));
  }
  function isFav(id) {
    return (state().goldFarmFavs || []).indexOf(id) !== -1;
  }

  var GATHER_PROFS = { Herbalism: 1, Mining: 1, Skinning: 1, Fishing: 1 };
  // Classic gathering skill for herbs and ore. Wowhead Classic herbalism / mining
  // leveling guides (already cited in gold-farms-data.js).
  var ITEM_PROF = {
    2447: { prof: "Herbalism", skill: 1, name: "Peacebloom" },
    765: { prof: "Herbalism", skill: 1, name: "Silverleaf" },
    2449: { prof: "Herbalism", skill: 15, name: "Earthroot" },
    785: { prof: "Herbalism", skill: 50, name: "Mageroyal" },
    2450: { prof: "Herbalism", skill: 70, name: "Briarthorn" },
    2453: { prof: "Herbalism", skill: 85, name: "Bruiseweed" },
    3820: { prof: "Herbalism", skill: 85, name: "Stranglekelp" },
    3355: { prof: "Herbalism", skill: 115, name: "Wild Steelbloom" },
    3369: { prof: "Herbalism", skill: 120, name: "Grave Moss" },
    3356: { prof: "Herbalism", skill: 125, name: "Kingsblood" },
    3357: { prof: "Herbalism", skill: 150, name: "Liferoot" },
    3818: { prof: "Herbalism", skill: 160, name: "Fadeleaf" },
    3821: { prof: "Herbalism", skill: 170, name: "Goldthorn" },
    3358: { prof: "Herbalism", skill: 185, name: "Khadgar's Whisker" },
    3819: { prof: "Herbalism", skill: 195, name: "Wintersbite" },
    4625: { prof: "Herbalism", skill: 205, name: "Firebloom" },
    8831: { prof: "Herbalism", skill: 210, name: "Purple Lotus" },
    8836: { prof: "Herbalism", skill: 220, name: "Arthas' Tears" },
    8838: { prof: "Herbalism", skill: 230, name: "Sungrass" },
    8839: { prof: "Herbalism", skill: 235, name: "Blindweed" },
    8846: { prof: "Herbalism", skill: 250, name: "Gromsblood" },
    8845: { prof: "Herbalism", skill: 260, name: "Ghost Mushroom" },
    13464: { prof: "Herbalism", skill: 260, name: "Golden Sansam" },
    13463: { prof: "Herbalism", skill: 270, name: "Dreamfoil" },
    13467: { prof: "Herbalism", skill: 270, name: "Icecap" },
    13465: { prof: "Herbalism", skill: 280, name: "Mountain Silversage" },
    13466: { prof: "Herbalism", skill: 285, name: "Plaguebloom" },
    13468: { prof: "Herbalism", skill: 300, name: "Black Lotus" },
    2770: { prof: "Mining", skill: 1, name: "Copper Ore" },
    2835: { prof: "Mining", skill: 1, name: "Rough Stone" },
    2771: { prof: "Mining", skill: 65, name: "Tin Ore" },
    2836: { prof: "Mining", skill: 65, name: "Coarse Stone" },
    2775: { prof: "Mining", skill: 75, name: "Silver Ore" },
    2772: { prof: "Mining", skill: 125, name: "Iron Ore" },
    2838: { prof: "Mining", skill: 125, name: "Heavy Stone" },
    2776: { prof: "Mining", skill: 155, name: "Gold Ore" },
    3858: { prof: "Mining", skill: 175, name: "Mithril Ore" },
    7912: { prof: "Mining", skill: 175, name: "Solid Stone" },
    7911: { prof: "Mining", skill: 230, name: "Truesilver Ore" },
    10620: { prof: "Mining", skill: 230, name: "Thorium Ore" },
    12365: { prof: "Mining", skill: 230, name: "Dense Stone" },
    11370: { prof: "Mining", skill: 230, name: "Dark Iron Ore" },
    12360: { prof: "Mining", skill: 230, name: "Arcanite Bar" }
  };
  // Forever Scarce mats: no published skill beyond the parent node. Count as the
  // profession only, no numeric gate.
  ITEM_PROF[249399] = { prof: "Herbalism", name: "Frilled Lichen" };
  ITEM_PROF[249391] = { prof: "Mining", name: "Pyrite" };

  function normalizeProfName(name) {
    return String(name || "").toLowerCase().replace(/[^a-z]/g, "");
  }
  function charProfessions() {
    return (state().professions || []).filter(function (p) { return p && p.name; });
  }
  function hasProfsFilled() {
    return charProfessions().length > 0;
  }
  function skillOf(name) {
    var want = normalizeProfName(name);
    var list = charProfessions();
    for (var i = 0; i < list.length; i++) {
      if (normalizeProfName(list[i].name) === want) {
        var n = parseInt(list[i].skill, 10);
        return isNaN(n) ? 0 : Math.max(0, Math.min(300, n));
      }
    }
    return null;
  }
  function hasProfession(name) {
    return skillOf(name) != null;
  }
  function isGatheringProf(name) {
    return !!GATHER_PROFS[name];
  }
  // Classic skinning: mobs 11–20 need (level−10)×10; 21+ need level×5;
  // levels 5–10 need 1. Warcraft Wiki; wow-professions Classic skinning guide.
  function skinningSkillForLevel(lvl) {
    lvl = parseInt(lvl, 10);
    if (isNaN(lvl) || lvl < 1) return null;
    if (lvl <= 10) return 1;
    if (lvl <= 20) return (lvl - 10) * 10;
    return lvl * 5;
  }
  function parseMobLevelLow(s) {
    if (!s) return null;
    var m = String(s).match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }
  function lootProfInfo(l, spot) {
    if (!l) return null;
    if (l.reqProf) return { prof: l.reqProf, skill: l.reqSkill != null ? l.reqSkill : null };
    if (l.prof) return { prof: l.prof, skill: l.skill != null ? l.skill : null };
    if (l.kind === "skin") return { prof: "Skinning", skill: null };
    if (l.kind === "herb") return { prof: "Herbalism", skill: null };
    if (l.kind === "ore" || l.kind === "mine") return { prof: "Mining", skill: null };
    // Node / route farms only: being in a mob's drop table does not require Mining or Herbalism.
    if (spot && spot.type === "gathering") {
      var mapped = l.id ? ITEM_PROF[l.id] : null;
      if (mapped) return { prof: mapped.prof, skill: mapped.skill != null ? mapped.skill : null };
    }
    return null;
  }
  function skillNeedForSpot(spot, prof) {
    if (spot.profSkills && spot.profSkills[prof] != null) return spot.profSkills[prof];
    if (spot.skillRequired && (spot.professions || [])[0] === prof) return spot.skillRequired;
    if (prof === "Skinning") {
      var low = parseMobLevelLow(spot.mobLevel);
      return skinningSkillForLevel(low);
    }
    // Lowest known node skill among this spot's loot for that profession.
    var min = null;
    (spot.loot || []).forEach(function (l) {
      var info = lootProfInfo(l, spot);
      if (!info || info.prof !== prof || info.skill == null) return;
      if (min == null || info.skill < min) min = info.skill;
    });
    return min;
  }
  function requiredProfSpec(spot) {
    var all = (spot.professions || []).slice();
    var any = [];
    if (!all.length && spot.type === "gathering") {
      any = (spot.bonusProfs || []).filter(isGatheringProf);
    }
    return { all: all, any: any };
  }
  function profStatus(spot) {
    var filled = hasProfsFilled();
    var spec = requiredProfSpec(spot);
    var missing = [];
    var lowSkill = [];
    var uses = [];
    function check(name, mode) {
      if (!filled) return mode === "all" ? true : false;
      if (!hasProfession(name)) {
        if (mode === "all") missing.push(name);
        return false;
      }
      var need = skillNeedForSpot(spot, name);
      var have = skillOf(name);
      if (need != null && have < need) {
        lowSkill.push({ name: name, need: need, have: have });
        return false;
      }
      uses.push(name);
      return true;
    }
    var okAll = true;
    spec.all.forEach(function (n) { if (!check(n, "all")) okAll = false; });
    var okAny = !spec.any.length;
    if (spec.any.length) {
      spec.any.forEach(function (n) { if (check(n, "any")) okAny = true; });
      if (!okAny && filled) {
        var haveNone = spec.any.every(function (n) { return !hasProfession(n); });
        if (haveNone) missing = missing.concat(spec.any);
      }
    }
    // Bonus gathering on a mob grind: not required, but listed under "uses" if they can skin.
    if (filled && spot.type !== "gathering") {
      (spot.bonusProfs || []).forEach(function (n) {
        if (uses.indexOf(n) !== -1) return;
        if (!hasProfession(n)) return;
        var need = skillNeedForSpot(spot, n);
        var have = skillOf(n);
        if (need != null && have < need) return;
        uses.push(n);
      });
    }
    var ok = !filled || (okAll && (okAny || !spec.any.length));
    return {
      filled: filled,
      missing: missing,
      lowSkill: lowSkill,
      uses: uses,
      ok: ok,
      requiredAny: spec.any,
      requiredAll: spec.all
    };
  }
  function lootIncluded(l, spot, pst) {
    var info = lootProfInfo(l, spot);
    if (!info) return { include: true, prof: null };
    if (!hasProfsFilled()) return { include: true, prof: info.prof };
    if (!hasProfession(info.prof)) return { include: false, prof: info.prof, reason: "missing" };
    var need = info.skill != null ? info.skill : skillNeedForSpot(spot, info.prof);
    var have = skillOf(info.prof);
    if (need != null && have < need) return { include: false, prof: info.prof, reason: "skill", need: need, have: have };
    return { include: true, prof: info.prof };
  }


  function viewLevel() {
    var p = prefs();
    if (p.followLevel || p.viewLevel == null) return charLevel();
    var n = parseInt(p.viewLevel, 10);
    if (isNaN(n)) return charLevel();
    return Math.max(1, Math.min(60, n));
  }
  function setViewLevel(n, follow) {
    var p = prefs();
    n = Math.max(1, Math.min(60, parseInt(n, 10) || 1));
    if (follow) {
      p.followLevel = true;
      p.viewLevel = null;
    } else {
      p.followLevel = false;
      p.viewLevel = n;
    }
  }

  function clampKpm(n) {
    n = parseFloat(n);
    if (isNaN(n)) n = DEFAULT_KPM;
    n = Math.round(n / KPM_STEP) * KPM_STEP;
    return Math.max(KPM_MIN, Math.min(KPM_MAX, n));
  }
  function killsPerMin() {
    return clampKpm(prefs().killsPerMin);
  }
  function setKillsPerMin(n) {
    prefs().killsPerMin = clampKpm(n);
  }
  function kpmLabel(n) {
    return (Math.round(n * 10) / 10) % 1 === 0 ? String(Math.round(n)) : String(Math.round(n * 10) / 10);
  }
  // Global slider value, scaled by an optional sourced per-spot override.
  function killsPerMinFor(spot) {
    var user = killsPerMin();
    var base = spot && spot.estimatedKillsPerMin != null ? Number(spot.estimatedKillsPerMin) : DEFAULT_KPM;
    if (isNaN(base) || base <= 0) base = DEFAULT_KPM;
    return Math.round(base * (user / DEFAULT_KPM) * 10) / 10;
  }
  function estimatedHourly(spot, live) {
    live = live || liveOf(spot);
    if (live.perKill == null) return null;
    if (live.perHour != null) return null;
    if (sourcedHourly(spot) != null) return null;
    var kpm = killsPerMinFor(spot);
    return { copper: Math.round(live.perKill * kpm * 60), kpm: kpm };
  }

  function priceOf(id) {
    if (window.priceEntry) return window.priceEntry(id);
    var items = window.PRICE_DATA && window.PRICE_DATA.items;
    var p = items && (items[id] || items[String(id)]);
    if (p && Array.isArray(p)) p = { minBuyout: p[0], marketValue: p[1], quantity: p[2], soldPerDay: p.length > 3 ? p[3] : null };
    return p && (p.marketValue || p.minBuyout) ? p : null;
  }

  function liveOf(spot) {
    var loot = spot.loot || [];
    var priced = [];
    var breakdown = [];
    var expected = 0;
    var used = 0;
    var unpriced = 0;
    var pst = profStatus(spot);
    var omittedProfs = {};
    loot.forEach(function (l) {
      if (l.kind === "quest" || l.skipGold) {
        return;
      }
      var gate = lootIncluded(l, spot, pst);
      if (!gate.include) {
        if (gate.prof) omittedProfs[gate.prof] = gate;
        return;
      }
      var p = l.id ? priceOf(l.id) : null;
      var qty = l.qty != null ? l.qty : 1;
      var unit = p ? p.marketValue : (l.vendor != null ? l.vendor : null);
      var priceKind = p ? "AH" : (unit != null ? "vendor" : null);
      if (p) {
        priced.push({ id: l.id, name: l.name, marketValue: p.marketValue, chance: l.chance, qty: qty });
      } else if (l.id) {
        unpriced++;
      }
      if (l.chance != null && unit != null) {
        var ev = unit * l.chance * qty;
        expected += ev;
        used++;
        breakdown.push({
          id: l.id,
          name: l.name,
          chance: l.chance,
          qty: qty,
          price: unit,
          priceKind: priceKind,
          ev: ev,
          yieldPerKill: !!l.yieldPerKill,
          kind: l.kind || "drop",
          chanceNote: l.chanceNote || "",
          becauseProf: gate.prof || null
        });
      }
    });
    if (spot.coinPerKill) {
      expected += spot.coinPerKill;
      used++;
      breakdown.push({
        name: "Coin drop",
        chance: 1,
        qty: 1,
        price: spot.coinPerKill,
        priceKind: "coin",
        ev: spot.coinPerKill,
        chanceNote: spot.coinNote || "Wowhead Classic average money dropped."
      });
    }
    if (spot.vendorTrashPerKill) {
      expected += spot.vendorTrashPerKill;
      used++;
      breakdown.push({
        name: "Grey / unsold vendor trash",
        chance: 1,
        qty: 1,
        price: spot.vendorTrashPerKill,
        priceKind: "vendor",
        ev: spot.vendorTrashPerKill,
        chanceNote: spot.vendorTrashNote || "Expected vendor value of grey and other unsold drops."
      });
    }
    var kph = spot.sourced && spot.sourced.killsPerHour;
    return {
      perKill: used ? Math.round(expected) : null,
      perHour: used && kph ? Math.round(expected * kph) : null,
      priced: priced,
      breakdown: breakdown,
      used: used,
      unpriced: unpriced,
      kph: kph || null,
      omittedProfs: omittedProfs
    };
  }

  function sourcedHourly(spot) {
    var s = spot.sourced || {};
    if (s.goldPerHour != null) return s.goldPerHour;
    if (s.perKill != null && s.killsPerHour) return Math.round(s.perKill * s.killsPerHour);
    return null;
  }

  function headline(spot) {
    var live = liveOf(spot);
    var sourcedHr = sourcedHourly(spot);
    var sourced = spot.sourced || {};
    if (live.perHour != null) {
      return { copper: live.perHour, unit: "/hr", kind: "live", live: live };
    }
    if (sourcedHr != null && !(live.omittedProfs && Object.keys(live.omittedProfs).length)) {
      return { copper: sourcedHr, unit: "/hr", kind: "sourced", live: live };
    }
    var est = estimatedHourly(spot, live);
    if (est) {
      return { copper: est.copper, unit: "/hr", kind: "estimated", live: live, kpm: est.kpm };
    }
    if (live.perKill != null) {
      return { copper: live.perKill, unit: "/kill", kind: "live", live: live };
    }
    if (sourced.perKill != null) {
      return { copper: sourced.perKill, unit: "/kill", kind: "sourced", live: live };
    }
    return { copper: null, unit: "", kind: "none", live: live };
  }

  function sortParts(spot) {
    var h = headline(spot);
    if (h.unit === "/hr" && h.copper != null) return { tier: 2, n: h.copper };
    if (h.unit === "/kill" && h.copper != null) return { tier: 1, n: h.copper };
    return { tier: 0, n: 0 };
  }
  function sortKey(spot) {
    var p = sortParts(spot);
    return p.tier * 1e12 + p.n;
  }

  function isDungeonFarm(spot) {
    return spot.instance === "dungeon" || spot.instance === "raid" || spot.instance === "mixed";
  }
  function dungeonTag(spot) {
    if (!isDungeonFarm(spot)) return "";
    var name = spot.instanceName || "instance";
    var label = spot.instance === "raid" ? "Raid: " + name : "Dungeon: " + name;
    if (spot.instance === "mixed") label += " (some mobs)";
    return '<span class="kind-tag gf-dungeon-tag">' + escapeHtml(label) + "</span>";
  }
  function pillMatches(spot, typeFilter) {
    if (typeFilter === "all") return true;
    if (typeFilter === "mob") return (spot.type === "mob" || spot.type === "cloth") && !isDungeonFarm(spot);
    if (typeFilter === "instance") return isDungeonFarm(spot);
    return spot.type === typeFilter;
  }
  function factionOk(spot, p) {
    if (p.showAllGroups) return true;
    var f = (spot.faction || "both").toLowerCase();
    return f === "both" || f === charFaction();
  }
  function classOk(spot, p) {
    if (p.showAllGroups) return true;
    var list = spot.classes || ["any"];
    if (list.indexOf("any") !== -1) return true;
    return list.indexOf(charClass()) !== -1;
  }
  function levelFits(spot, L) {
    return spot.levelMin <= L && L <= spot.levelMax;
  }
  function levelDist(spot, L) {
    if (levelFits(spot, L)) return 0;
    if (L < spot.levelMin) return spot.levelMin - L;
    return L - spot.levelMax;
  }
  function isContested(spot) {
    var t = ((spot.risk || "") + " " + (spot.factionNote || "")).toLowerCase();
    return /contested|\bpvp\b|gank/.test(t);
  }

  function filterBase(opts) {
    opts = opts || {};
    var p = prefs();
    var L = viewLevel();
    return (window.GOLD_FARMS || []).filter(function (spot) {
      if (p.favsOnly && !isFav(spot.id)) return false;
      if (p.hideDungeons && isDungeonFarm(spot)) return false;
      if (!pillMatches(spot, p.typeFilter)) return false;
      if (!factionOk(spot, p)) return false;
      if (!classOk(spot, p)) return false;
      if (!opts.ignoreLevel && !levelFits(spot, L)) return false;
      if (hasProfsFilled() && !opts.ignoreProf) {
        var stt = profStatus(spot);
        if (opts.lockedOnly) return !stt.ok;
        if (!stt.ok) return false;
      }
      return true;
    });
  }
  function lockedAtLevel() {
    if (!hasProfsFilled()) return [];
    return sorted(filterBase({ lockedOnly: true }));
  }
  function sorted(list) {
    return list.slice().sort(function (a, b) {
      var d = sortKey(b) - sortKey(a);
      if (d) return d;
      return a.levelMin - b.levelMin || a.name.localeCompare(b.name);
    });
  }
  function filtered() {
    return sorted(filterBase());
  }
  function closest(limit) {
    var L = viewLevel();
    var list = filterBase({ ignoreLevel: true }).map(function (spot) {
      return { spot: spot, dist: levelDist(spot, L) };
    }).filter(function (x) { return x.dist > 0; });
    list.sort(function (a, b) {
      return a.dist - b.dist || sortKey(b.spot) - sortKey(a.spot);
    });
    return list.slice(0, limit || TOP_N);
  }

  function priceStamp() {
    var d = window.PRICE_DATA || {};
    if (!d.updated) return "US Normal Horde auction snapshot";
    return "US Normal Horde AH, " + d.updated.replace("T", " ").replace("Z", " UTC") +
      (d.source ? " (" + d.source.split(",")[0] + ")" : "");
  }

  function lootNames(spot) {
    return (spot.loot || []).map(function (l) { return l.name; }).filter(Boolean);
  }

  function ensureShell(root) {
    if (root.dataset.ready) return;
    root.innerHTML =
      '<div class="gf-toolbar" id="goldFarmToolbar"></div>' +
      '<p class="muted" id="goldFarmContext"></p>' +
      '<div id="goldFarmResults"></div>' +
      '<details class="gf-about" id="goldFarmAbout"></details>';
    root.dataset.ready = "1";
    bind(root);
  }

  function renderToolbar() {
    var box = document.getElementById("goldFarmToolbar");
    if (!box) return;
    var p = prefs();
    var L = viewLevel();
    var following = !!p.followLevel || p.viewLevel == null;
    var pills = PILL_TYPES.map(function (t) {
      var on = p.typeFilter === t.id ? " is-on" : "";
      return '<button type="button" class="gf-pill' + on + '" data-gf-type="' + t.id + '"' +
        (on ? ' aria-pressed="true"' : ' aria-pressed="false"') + ">" + escapeHtml(t.label) + "</button>";
    }).join("") +
      '<button type="button" class="gf-pill' + (p.favsOnly ? " is-on" : "") + '" data-gf-favs' +
      (p.favsOnly ? ' aria-pressed="true"' : ' aria-pressed="false"') + ">★ Favorites</button>";
    var reset = following ? "" :
      '<button type="button" class="gf-text-btn" id="gfUseMyLevel">My level (' + charLevel() + ")</button>";
    box.innerHTML =
      '<div class="gf-level" role="group" aria-label="Farm level">' +
        '<button type="button" class="gf-step" id="gfLvlDown" aria-label="Lower level">−</button>' +
        '<label class="gf-level-label">Level ' +
          '<input type="number" id="gfLevel" min="1" max="60" step="1" value="' + L + '">' +
        "</label>" +
        '<button type="button" class="gf-step" id="gfLvlUp" aria-label="Higher level">+</button>' +
        reset +
      "</div>" +
      '<div class="gf-level gf-kpm" role="group" aria-label="Kills per minute">' +
        '<button type="button" class="gf-step" id="gfKpmDown" aria-label="Fewer kills per minute">−</button>' +
        '<label class="gf-level-label">Kills/min ' +
          '<input type="number" id="gfKpm" min="' + KPM_MIN + '" max="' + KPM_MAX +
            '" step="' + KPM_STEP + '" value="' + kpmLabel(killsPerMin()) + '">' +
        "</label>" +
        '<button type="button" class="gf-step" id="gfKpmUp" aria-label="More kills per minute">+</button>' +
      "</div>" +
      '<div class="gf-pills" role="group" aria-label="Farm type">' + pills + "</div>" +
      '<label class="check gf-hide-dungeons"><input type="checkbox" id="gfHideDungeons"' +
        (p.hideDungeons ? " checked" : "") + '> Hide dungeon farms</label>';
  }

  function renderContext() {
    var el = document.getElementById("goldFarmContext");
    if (!el) return;
    var p = prefs();
    var fac = charFaction();
    var facLabel = fac ? fac.charAt(0).toUpperCase() + fac.slice(1) : "";
    var cls = charClass() || "your class";
    var line;
    if (p.showAllGroups) {
      line = 'Showing every class and faction. <button type="button" class="gf-text-btn" id="gfToggleGroups">Use my class &amp; faction (' +
        escapeHtml(facLabel + " " + cls) + ")</button>";
    } else {
      line = "For " + escapeHtml(facLabel + " " + cls) +
        '. <button type="button" class="gf-text-btn" id="gfToggleGroups">Show all classes/factions</button>';
    }
    if (!hasProfsFilled()) {
      line += '<br><span class="gf-prof-hint">Add your professions on the <a href="#professions">Professions tab</a> to hide farms you cannot gather and to count only your skinning, mining, and herbalism yields.</span>';
    } else {
      var bits = charProfessions().map(function (pr) {
        return pr.name + (pr.skill != null ? " " + pr.skill : "");
      });
      line += ' <span class="gf-prof-using">Using your ' + escapeHtml(bits.join(", ")) + ".</span>";
    }
    if (p.hideDungeons) {
      line += ' <span class="gf-filter-note">Dungeon and raid farms are hidden.</span>';
    }
    el.innerHTML = line;
  }

  function renderAbout() {
    var el = document.getElementById("goldFarmAbout");
    if (!el) return;
    var meta = window.GOLD_FARMS_META || {};
    var open = el.open;
    el.innerHTML =
      "<summary>About these numbers</summary>" +
      "<p>" + escapeHtml(meta.disclaimer ||
        "Gold per hour moves with the Auction House and with how fast you can pull. Sourced figures are snapshots, not promises. Live values are computed from current AH prices and the drop rates a source listed.") +
      "</p>" +
      "<p>The big number is gold per hour. When a guide published a kills/hour figure, that rate is used and the row keeps its usual look. When there is gold per kill but no published kill rate, this site estimates gold/hour as gold/kill × kills/min × 60, marked with a ~ and an est. tag. " +
      escapeHtml(priceStamp()) + ".</p>" +
      "<p>The default is " + kpmLabel(DEFAULT_KPM) + " kills per minute (" + (DEFAULT_KPM * 60) +
        "/hour) for a typical solo, at-level, single-pull grind. That matches ByteTavern’s “two kills a minute” linen-farm assumption and sits in the 100–150 kills/hour range Classic guides often use (Conquest Capped’s mid-level farms assume 100/hour). Pack, AoE, and slow elite camps will differ — use the Kills/min control, which is saved with your character. It does not change rows that already have a sourced kill rate. Nothing here invents drop rates.</p>" +
      "<p>When you add professions on the Professions tab, gathering farms you cannot do move out of the top list, and gold/kill only counts skinning, mining, or herbalism yields you can actually gather. If no professions are listed, every farm is shown as before.</p>" +
      "<p>A farm is tagged Dungeon when its listed creatures spawn inside an instance in NorgannonDB (spawn area / map, not continent maps 0/1/530). Hide dungeon farms also hides raids and any farm that mixes instance and open-world mobs. Counts in this list follow that checkbox.</p>" +
      "<p>Bug exploits, duplication, and other play that breaks Blizzard's terms of use are not listed.</p>";
    el.open = open;
  }

  function bind(root) {
    if (bound) return;
    bound = true;
    root.addEventListener("change", function (e) {
      var t = e.target;
      if (t && t.id === "gfHideDungeons") {
        prefs().hideDungeons = !!t.checked;
        persist();
        showAllRows = false;
        refresh();
      }
    });
    root.addEventListener("click", function (e) {
      var t = e.target;
      if (!t) return;
      var step = t.closest && t.closest(".gf-step");
      if (step) {
        if (step.id === "gfKpmDown" || step.id === "gfKpmUp") {
          var nextK = killsPerMin() + (step.id === "gfKpmDown" ? -KPM_STEP : KPM_STEP);
          setKillsPerMin(nextK);
          persist();
          refresh();
          return;
        }
        if (step.id === "gfLvlDown" || step.id === "gfLvlUp") {
          var cur = viewLevel();
          var next = step.id === "gfLvlDown" ? cur - 1 : cur + 1;
          setViewLevel(next, false);
          persist();
          showAllRows = false;
          refresh();
          return;
        }
      }
      if (t.id === "gfUseMyLevel") {
        setViewLevel(charLevel(), true);
        persist();
        showAllRows = false;
        refresh();
        return;
      }
      var pill = t.closest && t.closest("[data-gf-type]");
      if (pill) {
        prefs().typeFilter = pill.getAttribute("data-gf-type");
        persist();
        showAllRows = false;
        refresh();
        return;
      }
      if (t.closest && t.closest("[data-gf-favs]")) {
        prefs().favsOnly = !prefs().favsOnly;
        persist();
        showAllRows = false;
        refresh();
        return;
      }
      if (t.id === "gfToggleGroups") {
        prefs().showAllGroups = !prefs().showAllGroups;
        persist();
        showAllRows = false;
        refresh();
        return;
      }
      if (t.id === "gfShowMore") {
        showAllRows = true;
        renderResults();
        return;
      }
      if (t.id === "gfShowLess") {
        showAllRows = false;
        renderResults();
        return;
      }
      if (t.closest && t.closest("a[data-item-id], [data-item-pin]")) return;
      var mapBtn = t.closest && t.closest("[data-gf-map]");
      if (mapBtn) {
        e.preventDefault();
        e.stopPropagation();
        openFarmMap(mapBtn.getAttribute("data-gf-map"));
        return;
      }
      var star = t.closest && t.closest("[data-gf-fav]");
      if (star) {
        e.preventDefault();
        e.stopPropagation();
        toggleFav(star.getAttribute("data-gf-fav"));
        persist();
        renderResults();
        return;
      }
      var main = t.closest && t.closest("[data-gf-toggle]");
      if (main) {
        var id = main.getAttribute("data-gf-toggle");
        expandedId = expandedId === id ? null : id;
        renderResults();
      }
    });
    root.addEventListener("change", function (e) {
      if (!e.target) return;
      if (e.target.id === "gfLevel") {
        setViewLevel(e.target.value, false);
        persist();
        showAllRows = false;
        refresh();
      }
      if (e.target.id === "gfKpm") {
        setKillsPerMin(e.target.value);
        persist();
        refresh();
      }
    });
    root.addEventListener("keydown", function (e) {
      if (e.target && e.target.closest && e.target.closest("a[data-item-id], [data-item-pin]")) return;
      var main = e.target && e.target.closest && e.target.closest("[data-gf-toggle]");
      if (!main) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        var id = main.getAttribute("data-gf-toggle");
        expandedId = expandedId === id ? null : id;
        renderResults();
      }
    });
  }

  function toggleFav(id) {
    var st = state();
    if (!Array.isArray(st.goldFarmFavs)) st.goldFarmFavs = [];
    var i = st.goldFarmFavs.indexOf(id);
    if (i === -1) st.goldFarmFavs.push(id);
    else st.goldFarmFavs.splice(i, 1);
  }

  function fmtPct(chance) {
    var n = chance * 100;
    if (n >= 1) return (Math.round(n * 10) / 10) + "%";
    return (Math.round(n * 100) / 100) + "%";
  }
  function fmtQty(qty) {
    if (qty == null) return "1";
    if (Math.abs(qty - Math.round(qty)) < 1e-6) return String(Math.round(qty));
    return String(Math.round(qty * 100) / 100);
  }
  function breakdownHtml(spot, live) {
    var rows = (live.breakdown || []).slice().sort(function (a, b) { return b.ev - a.ev; });
    rows = rows.filter(function (r) {
      return r.ev >= 1 || r.priceKind === "coin" || !r.id;
    });
    if (!rows.length) return lootHtml(spot);
    var body = rows.map(function (r) {
      var isFlat = r.priceKind === "coin" || !r.id;
      var pct = isFlat ? "—" : (r.yieldPerKill ? "expected /kill" : fmtPct(r.chance));
      var qty = isFlat ? "—" : (r.yieldPerKill ? fmtQty(r.chance) : fmtQty(r.qty));
      var priceLabel = r.priceKind === "coin"
        ? goldText(r.price, { compact: true })
        : ((r.priceKind === "AH" ? "AH " : "vendor ") + goldText(r.price, { compact: true }));
      var resolved = r.id ? resolveLoot({ id: r.id, name: r.name }) : resolveLoot({ name: r.name });
      var name = itemLinkHtml(r.name, resolved);
      if (r.becauseProf && hasProfsFilled()) {
        name += ' <span class="gf-because">your ' + escapeHtml(r.becauseProf) + "</span>";
      }
      return "<tr>" +
        "<td>" + name + "</td>" +
        "<td>" + escapeHtml(pct) + "</td>" +
        "<td>" + escapeHtml(qty) + "</td>" +
        "<td>" + escapeHtml(priceLabel) + "</td>" +
        '<td class="gf-ev">' + goldText(r.ev, { compact: true }) + "</td>" +
        "</tr>";
    }).join("");
    var cite = spot.dropSource && spot.dropSource.citation
      ? '<p class="gf-break-note">' + escapeHtml(spot.dropSource.citation) + "</p>"
      : "";
    var omitted = live.omittedProfs && Object.keys(live.omittedProfs);
    if (omitted && omitted.length && hasProfsFilled()) {
      cite += '<p class="gf-break-note">' + escapeHtml(
        omitted.map(function (n) {
          var g = live.omittedProfs[n];
          if (g && g.reason === "skill") {
            return n + " yields are left out — you have " + g.have + ", this camp needs " + g.need + ".";
          }
          return n + " yields are left out — you don't have " + n + ".";
        }).join(" ")
      ) + "</p>";
    }
    return '<table class="gf-break"><thead><tr>' +
      "<th>Item</th><th>Drop %</th><th>Avg qty</th><th>Price</th><th>Est. /kill</th>" +
      "</tr></thead><tbody>" + body + "</tbody></table>" + cite;
  }
  function lootHtml(spot) {
    var loot = spot.loot || [];
    if (!loot.length) return '<p class="muted">No priced loot list — see the source notes.</p>';
    var rows = loot.map(function (l) {
      var p = l.id ? priceOf(l.id) : null;
      var bits = [];
      if (l.yieldPerKill && l.chance != null) bits.push("expected " + fmtQty(l.chance) + "/kill");
      else if (l.chance != null) bits.push(fmtPct(l.chance));
      if (!l.yieldPerKill && l.qty && l.qty !== 1) bits.push("×" + fmtQty(l.qty));
      if (p) bits.push("AH " + goldText(p.marketValue, { compact: true }));
      else if (l.vendor != null) bits.push("vendor " + goldText(l.vendor, { compact: true }));
      else if (l.id) bits.push("no AH price in this snapshot");
      var resolved = resolveLoot(l);
      var label = itemLinkHtml(l.name, resolved);
      if (!resolved) label = "<span>" + escapeHtml(l.name) + "</span>";
      return "<li>" + label +
        (bits.length ? ' <span class="muted">(' + escapeHtml(bits.join(" · ")) + ")</span>" : "") + "</li>";
    });
    return "<ul class=\"gf-loot\">" + rows.join("") + "</ul>";
  }

  function valueBlock(spot, live) {
    var parts = [];
    if (live.perHour != null) {
      parts.push('<div class="gf-live"><span class="kicker">Live value</span><strong>' +
        goldShortHtml(live.perHour) + "/hr</strong>" +
        (live.perKill != null ? '<div class="gf-kill-line">Gold per kill ' + goldShortHtml(live.perKill) + "</div>" : "") +
        '<div class="muted">Computed from this site\'s ' + escapeHtml(priceStamp()) +
        " × sourced drop chances, at the source\'s " + live.kph + " kills/hour assumption.</div></div>");
    } else if (live.perKill != null) {
      var est = estimatedHourly(spot, live);
      if (est) {
        parts.push('<div class="gf-live"><span class="kicker">Estimated gold per hour</span><strong>' +
          '<span class="gf-approx">~</span>' + goldShortHtml(est.copper) + "/hr</strong>" +
          '<div class="gf-formula">' + goldText(live.perKill, { compact: true }) + "/kill × " +
            kpmLabel(est.kpm) + " kills/min × 60 = ~" + goldText(est.copper, { compact: true }) + "/hr</div>" +
          '<div class="muted">Gold per kill uses this site\'s ' + escapeHtml(priceStamp()) +
          " × sourced drop chances. No published kills/hour for this camp, so this hour figure uses the Kills/min control" +
          (Math.abs(est.kpm - DEFAULT_KPM) < 1e-6 ? " (default " + kpmLabel(DEFAULT_KPM) + "/min)." : ".") +
          "</div></div>");
      } else {
        parts.push('<div class="gf-live"><span class="kicker">Gold per kill</span><strong>' +
          goldShortHtml(live.perKill) + "/kill</strong>" +
          '<div class="muted">Computed from this site\'s ' + escapeHtml(priceStamp()) +
          " × sourced drop chances and average stacks, plus coin and vendor trash when those are sourced.</div></div>");
      }
    } else if (live.priced.length) {
      parts.push('<div class="gf-live"><span class="kicker">Live AH prices</span><strong>' +
        live.priced.length + " item" + (live.priced.length === 1 ? "" : "s") + " priced</strong>" +
        '<div class="muted">Current ' + escapeHtml(priceStamp()) +
        ". No combined gold/hour is computed because this source did not list drop rates and a kill rate together.</div></div>");
    } else {
      parts.push('<div class="gf-live"><span class="kicker">Live value</span><strong>No priced loot in this snapshot</strong>' +
        '<div class="muted">The listed items are missing from the current auction feed, or this method has no item list.</div></div>');
    }
    var s = spot.sourced || {};
    var srcBits = [];
    if (s.goldPerHour != null) srcBits.push("about " + goldText(s.goldPerHour) + "/hr");
    if (s.perKill != null) srcBits.push(goldText(s.perKill) + "/kill");
    if (srcBits.length) {
      parts.push('<div class="gf-sourced"><span class="kicker">Sourced snapshot</span><strong>' +
        escapeHtml(srcBits.join(" · ")) + "</strong>" +
        '<div class="muted">' + escapeHtml([s.date, s.realm, s.goldPerHourNote || s.perKillNote || s.note].filter(Boolean).join(" — ")) +
        "</div></div>");
    } else if (s.note) {
      parts.push('<div class="gf-sourced"><span class="kicker">Sourced note</span>' +
        '<div class="muted">' + escapeHtml((s.date ? s.date + " — " : "") + s.note) + "</div></div>");
    }
    return parts.join("");
  }

  function detailHtml(spot, live) {
    var tag = spot.tag === "forever"
      ? '<span class="badge gf-tag-forever">Forever-confirmed</span>'
      : '<span class="badge gf-tag-classic">Classic-era, likely applies</span>';
    var type = '<span class="badge">' + escapeHtml(TYPE_LABEL[spot.type] || spot.type) + "</span>";
    var fac = (spot.faction || "both");
    var facLabel = fac === "both" ? "Both factions" : fac.charAt(0).toUpperCase() + fac.slice(1);
    var classes = (spot.classes || ["any"]).join(", ");
    var req = (spot.professions || []);
    var bonus = (spot.bonusProfs || []);
    var profLine = req.length ? "Requires " + req.join(", ") : "No required profession";
    if (bonus.length) profLine += " · bonus: " + bonus.join(", ");
    var sources = (spot.sources || []).map(function (src) {
      var label = (src.site ? src.site + " — " : "") + (src.title || src.url);
      var when = src.date ? " (" + src.date + ")" : "";
      return '<li><a href="' + escapeHtml(src.url) + '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(label) + "</a>" + escapeHtml(when) + "</li>";
    }).join("");
    return '<div class="gf-detail">' +
      '<div class="gf-tags">' + tag + type + "</div>" +
      mapBtnHtml(spot, { prominent: true }) +
      (spot.loc ? '<p>' + escapeHtml(spot.loc) + "</p>" : "") +
      '<p class="gf-meta">' + escapeHtml(facLabel) + " · " + escapeHtml(classes) +
        " · " + escapeHtml(profLine) +
        (spot.mobLevel ? " · mobs " + escapeHtml(spot.mobLevel) : "") + "</p>" +
      (spot.factionNote ? '<p class="muted">' + escapeHtml(spot.factionNote) + "</p>" : "") +
      breakdownHtml(spot, live) +
      valueBlock(spot, live) +
      (spot.risk ? '<div class="gf-risk"><span class="kicker">Risk</span> ' + escapeHtml(spot.risk) + "</div>" : "") +
      (sources ? '<ul class="gf-sources">' + sources + "</ul>" : "") +
      "</div>";
  }

  function needTag(spot) {
    var stt = profStatus(spot);
    if (stt.filled && stt.uses.length) {
      var use = stt.uses.length === 1 ? "Uses your " + stt.uses[0]
        : "Uses your " + stt.uses.slice(0, -1).join(", ") + " & " + stt.uses[stt.uses.length - 1];
      return '<span class="badge gf-uses">' + escapeHtml(use) + "</span>";
    }
    if (stt.lowSkill.length) {
      return stt.lowSkill.map(function (x) {
        return '<span class="badge gf-need">' + escapeHtml("Needs " + x.name + " " + x.need + " (you have " + x.have + ")") + "</span>";
      }).join("");
    }
    var req = (spot.professions || []).concat(stt.requiredAny || []);
    // unique
    req = req.filter(function (n, i) { return req.indexOf(n) === i; });
    if (!req.length) return "";
    var label = req.length === 1 ? "Needs " + req[0] : "Needs " + req.slice(0, -1).join(", ") + " & " + req[req.length - 1];
    return '<span class="badge gf-need">' + escapeHtml(label) + "</span>";
  }

  function rowHtml(spot, rank, opts) {
    opts = opts || {};
    var h = headline(spot);
    var fav = isFav(spot.id);
    var open = expandedId === spot.id;
    var lootLine = lootLineHtml(spot);
    var goldInner;
    if (h.copper != null) {
      var approx = h.kind === "estimated" ? '<span class="gf-approx">~</span>' : "";
      var tag = h.kind === "estimated" ? "est. /hr" : ("est. " + h.unit);
      goldInner = "<strong>" + approx + goldShortHtml(h.copper) + "</strong><span class=\"gf-est\">" + tag + "</span>";
      if (h.unit === "/hr" && h.live && h.live.perKill != null) {
        goldInner += '<span class="gf-kill-sub">' + goldText(h.live.perKill, { compact: true }) + "/kill</span>";
      }
    } else {
      goldInner = '<strong class="gf-na">—</strong><span class="gf-est">no estimate yet</span>';
    }
    var warn = isContested(spot)
      ? '<span class="gf-warn" title="Contested or PvP" aria-label="Contested or PvP">⚠</span>'
      : "";
    var extra = opts.dist
      ? '<div class="muted">Best around Lv ' + spot.levelMin + "–" + spot.levelMax + " (" + opts.dist + " level" + (opts.dist === 1 ? "" : "s") + " away)</div>"
      : "";
    var lockedCls = opts.locked ? " is-locked" : "";
    return '<li class="gf-row' + (fav ? " is-fav" : "") + (open ? " is-open" : "") + lockedCls + '" data-farm="' + escapeHtml(spot.id) + '">' +
      '<div class="gf-row-main" data-gf-toggle="' + escapeHtml(spot.id) + '" role="button" tabindex="0" aria-expanded="' + (open ? "true" : "false") + '">' +
        '<span class="gf-rank">' + rank + "</span>" +
        '<div class="gf-row-body">' +
          '<div class="gf-row-title">' + escapeHtml(spot.name) + warn + needTag(spot) + dungeonTag(spot) +
            (spot.eliteOpenWorld ? '<span class="kind-tag gf-elite-tag">Elite</span>' : "") + "</div>" +
          '<div class="gf-row-sub">' + escapeHtml(spot.zone) + " · Lv " + spot.levelMin + "–" + spot.levelMax +
            " · " + lootLine + mapBtnHtml(spot) + "</div>" +
          extra +
        "</div>" +
        '<div class="gf-row-gold">' + goldInner + "</div>" +
        '<button type="button" class="gf-star-btn' + (fav ? " is-on" : "") + '" data-gf-fav="' + escapeHtml(spot.id) + '" aria-label="' +
          (fav ? "Remove from favorites" : "Add to favorites") + '" aria-pressed="' + (fav ? "true" : "false") + '">' +
          (fav ? "★" : "☆") + "</button>" +
      "</div>" +
      (open ? detailHtml(spot, h.live) : "") +
      "</li>";
  }

  function renderResults() {
    var box = document.getElementById("goldFarmResults");
    if (!box) return;
    var lockedOpen = !!(document.getElementById("gfLockedProfs") && document.getElementById("gfLockedProfs").open);
    var p = prefs();
    var L = viewLevel();
    var rows = filtered();
    var typeLabel = (PILL_TYPES.filter(function (t) { return t.id === p.typeFilter; })[0] || {}).label || "All";
    var html = "";

    if (!rows.length) {
      if (p.favsOnly && !(state().goldFarmFavs || []).length) {
        html = '<p class="gf-empty">Star a farm to save it here. Favorites stay with your character.</p>';
      } else if (p.favsOnly) {
        html = '<p class="gf-empty">None of your favorites fit level ' + L +
          (p.typeFilter !== "all" ? " in " + escapeHtml(typeLabel) : "") +
          (p.hideDungeons ? " (dungeon farms hidden)" : "") + ".</p>";
        var nearFav = closest(TOP_N);
        if (nearFav.length) {
          html += '<p class="muted">Closest favorites or matches:</p><ol class="gf-list">';
          nearFav.forEach(function (x, i) { html += rowHtml(x.spot, i + 1, { dist: x.dist }); });
          html += "</ol>";
        }
      } else {
        html = '<p class="gf-empty">No farms sit right at level ' + L +
          (p.typeFilter !== "all" ? " for " + escapeHtml(typeLabel) : "") +
          (p.hideDungeons ? " (dungeon farms hidden)" : "") + ". Here are the closest ones.</p>";
        var near = closest(TOP_N);
        if (near.length) {
          html += '<ol class="gf-list">';
          near.forEach(function (x, i) { html += rowHtml(x.spot, i + 1, { dist: x.dist }); });
          html += "</ol>";
        } else {
          html += '<p class="muted">Nothing else matched these filters.</p>';
        }
      }
      html += lockedSectionHtml();
      box.innerHTML = html;
    restoreLockedOpen(lockedOpen);
      return;
    }

    var visible = showAllRows ? rows : rows.slice(0, TOP_N);
    var hidden = rows.length - visible.length;
    html = '<ol class="gf-list">';
    visible.forEach(function (spot, i) { html += rowHtml(spot, i + 1); });
    html += "</ol>";
    if (hidden > 0) {
      html += '<button type="button" class="btn gf-more" id="gfShowMore">Show more (' + hidden + ")</button>";
    } else if (showAllRows && rows.length > TOP_N) {
      html += '<button type="button" class="btn gf-more" id="gfShowLess">Show less</button>';
    }
    html += lockedSectionHtml();
    box.innerHTML = html;
    restoreLockedOpen(lockedOpen);
  }

  function restoreLockedOpen(wasOpen) {
    var el = document.getElementById("gfLockedProfs");
    if (el && wasOpen) el.open = true;
  }
  function lockedSectionHtml() {
    if (!hasProfsFilled()) return "";
    var locked = lockedAtLevel();
    if (!locked.length) return "";
    var missingN = 0, skillN = 0;
    locked.forEach(function (spot) {
      var s = profStatus(spot);
      if (s.missing.length) missingN++;
      else if (s.lowSkill.length) skillN++;
    });
    var title;
    if (missingN && skillN) {
      title = "Needs a profession you don't have or a higher skill (" + locked.length + ")";
    } else if (skillN) {
      title = "Needs a higher skill (" + locked.length + ")";
    } else {
      title = "Needs a profession you don't have (" + locked.length + ")";
    }
    var inner = '<ol class="gf-list gf-locked-list">';
    locked.forEach(function (spot, i) { inner += rowHtml(spot, i + 1, { locked: true }); });
    inner += "</ol>";
    return '<details class="gf-locked" id="gfLockedProfs"><summary>' + escapeHtml(title) + "</summary>" + inner + "</details>";
  }

  var itemIndexReady = false;
  var itemIndexTried = false;
  function ensureItemIndex() {
    if (itemIndexReady || itemIndexTried) return;
    if (window.ItemDB && ItemDB.ensure) {
      itemIndexTried = true;
      ItemDB.ensure().then(function () {
        itemIndexReady = true;
        _itemById = null;
        _itemByName = null;
        renderResults();
      }).catch(function () { /* drop names stay plain if the index cannot load */ });
      return;
    }
    /* item-db.js loads after this file; retry until it appears. */
    setTimeout(ensureItemIndex, 50);
  }
  function refresh() {
    renderToolbar();
    renderContext();
    renderResults();
    renderAbout();
    ensureItemIndex();
  }

  function render(st, opts) {
    helpers = opts || {};
    if (st) helpers.state = st;
    var root = document.getElementById("goldFarms");
    if (!root) return;
    if (!Array.isArray(state().goldFarmFavs)) state().goldFarmFavs = [];
    prefs();
    ensureShell(root);
    refresh();
    ensureSpawns();
  }


  /* ---------- Mob-grind spawn map ---------- */
  var MOB_COLORS = ["#e8c547", "#5eb8ff", "#ff8a5b", "#7ee0a0", "#d7a0ff", "#ff6b8a", "#f0d48a", "#8ad4d4"];
  var spawnsLoading = null;
  var zoneMapsLoading = null;
  var mapKeyHandler = null;
  var lastMapDraw = null;

  function cacheVer() {
    var tag = document.querySelector('script[src*="js/gold-farms.js"], script[src*="js/app.js"]');
    var src = tag && (tag.getAttribute("src") || "");
    var m = src && src.match(/[?&]v=([^&]+)/);
    return m ? m[1] : "20261124d";
  }
  function ensureSpawns() {
    if (window.GOLD_FARM_SPAWNS) return Promise.resolve(window.GOLD_FARM_SPAWNS);
    if (spawnsLoading) return spawnsLoading;
    spawnsLoading = new Promise(function (resolve) {
      var s = document.createElement("script");
      s.src = "data/gold-farm-spawns.js?v=" + encodeURIComponent(cacheVer());
      s.onload = function () { resolve(window.GOLD_FARM_SPAWNS || { farms: {}, meta: {} }); };
      s.onerror = function () { spawnsLoading = null; resolve({ farms: {}, meta: {}, loadError: true }); };
      document.head.appendChild(s);
    });
    return spawnsLoading;
  }
  function ensureZoneMaps() {
    if (window.ZONE_MAPS) return Promise.resolve(window.ZONE_MAPS);
    if (zoneMapsLoading) return zoneMapsLoading;
    zoneMapsLoading = new Promise(function (resolve) {
      var s = document.createElement("script");
      s.src = "data/zone-maps/index.js?v=" + encodeURIComponent(cacheVer());
      s.onload = function () { resolve(window.ZONE_MAPS || null); };
      s.onerror = function () { zoneMapsLoading = null; resolve(null); };
      document.head.appendChild(s);
    });
    return zoneMapsLoading;
  }
  function zoneMapEntry(rec) {
    var maps = window.ZONE_MAPS;
    if (!maps || !rec) return null;
    if (rec.zone && maps.byName && maps.byName[rec.zone]) return maps.byName[rec.zone];
    return null;
  }
  function mapBtnHtml(spot, opts) {
    if (!spot || spot.type !== "mob") return "";
    opts = opts || {};
    var label = opts.prominent ? "Show spawn map" : "Spawn map";
    var cls = "gf-map-btn" + (opts.prominent ? " gf-map-btn-wide" : "");
    return ' <button type="button" class="' + cls + '" data-gf-map="' + escapeHtml(spot.id) +
      '" aria-label="Show spawn map for ' + escapeHtml(spot.name) + '">' + label + "</button>";
  }
  function spawnRecord(id) {
    var data = window.GOLD_FARM_SPAWNS || {};
    return (data.farms && data.farms[id]) || null;
  }
  function spawnMeta() {
    return (window.GOLD_FARM_SPAWNS && window.GOLD_FARM_SPAWNS.meta) || {};
  }

  function mapModalHtml(farmId) {
    var spots = window.GOLD_FARMS || [];
    var spot = null;
    for (var i = 0; i < spots.length; i++) {
      if (spots[i].id === farmId) { spot = spots[i]; break; }
    }
    var rec = spawnRecord(farmId);
    var meta = spawnMeta();
    var title = spot ? spot.name : "Spawn map";
    var zone = (rec && rec.zone) || (spot && spot.zone) || "";
    var html = '<div id="gfFarmMap">';
    html += '<div class="gf-map-head">';
    html += "<h3 id=\"gfFarmMapTitle\">" + escapeHtml(title) + "</h3>";
    html += '<button type="button" class="btn gf-map-close" data-close aria-label="Close spawn map">Close</button>';
    html += "</div>";
    var art = zoneMapEntry(rec);
    if (zone) html += '<p class="gf-map-zone">' + escapeHtml(zone) + "</p>";
    html += '<p class="muted gf-map-note">' + escapeHtml(meta.disclaimer || "Spawn locations from Classic data, may differ in Forever.") + " ";
    html += escapeHtml(meta.mapNote || "Zone maps are Forever client art (© Blizzard Entertainment). If a map image cannot be loaded, a schematic grid is shown instead. Coordinates are used as published by NorgannonDB; none are invented.") + "</p>";

    var mobs = (rec && rec.mobs) || [];
    var any = mobs.some(function (m) { return m.points && m.points.length; });
    if (!rec || (window.GOLD_FARM_SPAWNS && window.GOLD_FARM_SPAWNS.loadError)) {
      html += '<p class="gf-map-empty">No spawn data</p>';
    } else if (!mobs.length) {
      html += '<p class="gf-map-empty">No spawn data</p>';
    } else if (!any) {
      html += '<ul class="gf-map-legend" id="gfFarmMapLegend">';
      mobs.forEach(function (m) {
        html += '<li class="is-missing"><span class="gf-map-swatch" style="background:#555"></span>' +
          escapeHtml(m.name) + " — No spawn data</li>";
      });
      html += "</ul>";
      html += '<p class="gf-map-empty">No spawn data</p>';
    } else {
      var ratio = 1.5;
      if (rec.mapSize && rec.mapSize[0] && rec.mapSize[1]) ratio = rec.mapSize[0] / rec.mapSize[1];
      html += '<div class="gf-map-stage" id="gfFarmMapStage" style="aspect-ratio:' + ratio + '">';
      if (art && art.file) {
        html += '<img class="gf-map-art" id="gfFarmMapArt" alt="" src="' + escapeHtml(art.file) + "?v=" + encodeURIComponent(cacheVer()) + '" hidden>';
      }
      html += '<canvas id="gfFarmMapCanvas" aria-label="Spawn map of ' + escapeHtml(zone || title) + '"></canvas>';
      html += '<svg class="gf-map-markers" id="gfFarmMapMarkers" aria-hidden="true"></svg>';
      html += '<div class="gf-map-tip" id="gfFarmMapTip" hidden></div>';
      html += '<div class="gf-map-compass" aria-hidden="true"><span>N</span></div>';
      html += '<span class="gf-map-axis gf-map-axis-x" aria-hidden="true">West — East</span>';
      html += '<span class="gf-map-axis gf-map-axis-y" aria-hidden="true">N — S</span>';
      html += "</div>";
      html += '<ul class="gf-map-legend" id="gfFarmMapLegend">';
      mobs.forEach(function (m, i) {
        var color = MOB_COLORS[i % MOB_COLORS.length];
        var count = (m.points && m.points.length) || 0;
        var miss = !count;
        html += '<li><button type="button" class="gf-map-leg-btn' + (miss ? " is-missing" : "") +
          '" data-mob-index="' + i + '" aria-pressed="true">';
        html += '<span class="gf-map-swatch" style="background:' + (miss ? "#555" : color) + '"></span>';
        html += '<span class="gf-map-leg-name">' + escapeHtml(m.name) + "</span>";
        html += miss
          ? '<span class="gf-map-leg-count">No spawn data</span>'
          : '<span class="gf-map-leg-count">' + count + " spawn" + (count === 1 ? "" : "s") + "</span>";
        html += "</button></li>";
      });
      html += "</ul>";
      html += '<label class="gf-map-grid-toggle"><input type="checkbox" id="gfFarmMapGrid"> Show grid</label>';
    }
    var src = meta.norgannon;
    html += '<p class="muted gf-map-credit">';
    if (art) html += "Zone map art © Blizzard Entertainment (Forever client). ";
    if (src) {
      html += 'Spawn data: <a href="' + escapeHtml(src.url || "https://github.com/zmarotrix/NorgannonDB") +
        '" target="_blank" rel="noopener noreferrer">NorgannonDB ' + escapeHtml(src.version || "") +
        "</a> (" + escapeHtml(src.license || "GPL-3.0") + "), QuestieDB and CMaNGOS classic-db.";
    }
    html += "</p>";
    html += "</div>";
    return html;
  }

  function bindFarmMap(farmId) {
    var rec = spawnRecord(farmId);
    var canvas = document.getElementById("gfFarmMapCanvas");
    var stage = document.getElementById("gfFarmMapStage");
    var tip = document.getElementById("gfFarmMapTip");
    var legend = document.getElementById("gfFarmMapLegend");
    if (mapKeyHandler) document.removeEventListener("keydown", mapKeyHandler);
    mapKeyHandler = function (e) {
      if (e.key === "Escape") {
        if (window.ForeverApp) ForeverApp.closeModal();
        document.removeEventListener("keydown", mapKeyHandler);
        mapKeyHandler = null;
      }
    };
    document.addEventListener("keydown", mapKeyHandler);
    var closeBtn = document.querySelector("#gfFarmMap .gf-map-close");
    if (closeBtn) try { closeBtn.focus(); } catch (err) {}
    if (!canvas || !stage || !rec) return;

    var mobs = rec.mobs || [];
    var visible = mobs.map(function (m) { return !!(m.points && m.points.length); });
    var active = null; /* hovered point */
    var artImg = document.getElementById("gfFarmMapArt");
    var gridCb = document.getElementById("gfFarmMapGrid");
    var showGrid = false;
    if (gridCb) {
      gridCb.addEventListener("change", function () {
        showGrid = !!gridCb.checked;
        draw();
      });
    }
    function artReady() {
      return !!(artImg && artImg.getAttribute("data-failed") !== "1" && artImg.complete && artImg.naturalWidth > 0);
    }
    if (artImg) {
      function onArtLoad() {
        artImg.hidden = false;
        artImg.removeAttribute("data-failed");
        stage.classList.add("has-art");
        draw();
      }
      artImg.addEventListener("load", onArtLoad);
      artImg.addEventListener("error", function () {
        artImg.hidden = true;
        artImg.setAttribute("data-failed", "1");
        stage.classList.remove("has-art");
        draw();
      });
      if (artImg.complete) {
        if (artImg.naturalWidth > 0) onArtLoad();
        else {
          artImg.hidden = true;
          artImg.setAttribute("data-failed", "1");
        }
      }
    }

    function layout() {
      var w = stage.clientWidth;
      var h = stage.clientHeight;
      if (w < 20 || h < 20) return { w: 0, h: 0, dpr: 1, pad: 0 };
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      /* Real zone art already includes the WorldMap 1002x668 frame, so fill the 3:2 stage with pad 0.
         The schematic fallback keeps a 28px gutter for axis labels. */
      return { w: w, h: h, dpr: dpr, pad: artReady() ? 0 : 28 };
    }
    function toPx(pt, L) {
      var x = L.pad + (pt[0] / 100) * (L.w - L.pad * 2);
      var y = L.pad + (pt[1] / 100) * (L.h - L.pad * 2);
      return { x: x, y: y };
    }
    function draw() {
      var L = layout();
      if (!L.w) {
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(draw);
        return;
      }
      var ctx = canvas.getContext("2d");
      ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
      ctx.clearRect(0, 0, L.w, L.h);
      var left = L.pad, top = L.pad, rw = L.w - L.pad * 2, rh = L.h - L.pad * 2;
      var useArt = artReady();
      if (!useArt) {
        /* schematic field (fallback if the zone image is missing or failed to load) */
        ctx.fillStyle = "#16110c";
        ctx.fillRect(0, 0, L.w, L.h);
        ctx.fillStyle = "#1c1610";
        ctx.fillRect(left, top, rw, rh);
        ctx.strokeStyle = "rgba(212,180,76,0.35)";
        ctx.lineWidth = 1;
        ctx.strokeRect(left + 0.5, top + 0.5, rw - 1, rh - 1);
      }
      if (!useArt || showGrid) {
        ctx.strokeStyle = useArt ? "rgba(232,197,71,0.22)" : "rgba(212,180,76,0.14)";
        ctx.lineWidth = 1;
        ctx.font = "10px sans-serif";
        ctx.fillStyle = useArt ? "rgba(232,197,71,0.8)" : "rgba(232,197,71,0.55)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (var g = 0; g <= 10; g++) {
          var gx = left + (g / 10) * rw;
          var gy = top + (g / 10) * rh;
          ctx.beginPath();
          ctx.moveTo(gx + 0.5, top);
          ctx.lineTo(gx + 0.5, top + rh);
          ctx.moveTo(left, gy + 0.5);
          ctx.lineTo(left + rw, gy + 0.5);
          ctx.stroke();
          if (g % 2 === 0) {
            ctx.fillText(String(g * 10), gx, useArt ? top + rh - 8 : top + rh + 12);
            ctx.save();
            ctx.textAlign = "right";
            ctx.fillText(String(g * 10), useArt ? left + 16 : left - 6, gy);
            ctx.restore();
          }
        }
      }
      /* heat, then dots — only real points */
      var heatR = Math.max(14, Math.min(rw, rh) * 0.035);
      var heatA = useArt ? 0.55 : 0.45;
      function hexRgb(hex) {
        var h = hex.replace("#", "");
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
      }
      mobs.forEach(function (m, i) {
        if (!visible[i] || !m.points) return;
        var rgb = hexRgb(MOB_COLORS[i % MOB_COLORS.length]);
        m.points.forEach(function (pt) {
          var p = toPx(pt, L);
          var grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, heatR);
          grd.addColorStop(0, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + heatA + ")");
          grd.addColorStop(1, "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0)");
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(p.x, p.y, heatR, 0, Math.PI * 2);
          ctx.fill();
        });
      });
      /* Marker dots are SVG .gf-map-marker elements, counted in tests. */
      if (active) {
        var ap = toPx(active.pt, L);
        ctx.beginPath();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.arc(ap.x, ap.y, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
      /* Countable marker elements (one per published point actually drawn). */
      var svg = document.getElementById("gfFarmMapMarkers");
      var drawnMobs = [];
      var totalDrawn = 0;
      if (svg) {
        svg.setAttribute("viewBox", "0 0 " + L.w + " " + L.h);
        svg.setAttribute("width", String(L.w));
        svg.setAttribute("height", String(L.h));
        var ns = "http://www.w3.org/2000/svg";
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        mobs.forEach(function (m, i) {
          var color = MOB_COLORS[i % MOB_COLORS.length];
          var n = 0;
          if (visible[i] && m.points && m.points.length) {
            m.points.forEach(function (pt) {
              var p = toPx(pt, L);
              var c = document.createElementNS(ns, "circle");
              c.setAttribute("class", "gf-map-marker");
              c.setAttribute("data-mob-index", String(i));
              c.setAttribute("data-mob-id", String(m.id));
              c.setAttribute("data-color", color);
              c.setAttribute("data-x", String(pt[0]));
              c.setAttribute("data-y", String(pt[1]));
              c.setAttribute("cx", String(p.x));
              c.setAttribute("cy", String(p.y));
              c.setAttribute("r", "4");
              c.setAttribute("fill", color);
              c.setAttribute("stroke", "rgba(20,14,8,0.7)");
              c.setAttribute("stroke-width", "1");
              svg.appendChild(c);
              n++;
            });
          }
          drawnMobs.push({ id: m.id, name: m.name, color: color, expected: (m.points && m.points.length) || 0, drawn: n });
          totalDrawn += n;
        });
      } else {
        mobs.forEach(function (m, i) {
          var n = (visible[i] && m.points) ? m.points.length : 0;
          drawnMobs.push({ id: m.id, name: m.name, color: MOB_COLORS[i % MOB_COLORS.length], expected: (m.points && m.points.length) || 0, drawn: n });
          totalDrawn += n;
        });
      }
      lastMapDraw = {
        farmId: farmId,
        total: totalDrawn,
        mobs: drawnMobs,
        art: useArt,
        artSrc: (artImg && artImg.getAttribute("src")) || null,
        artSize: useArt ? [artImg.naturalWidth, artImg.naturalHeight] : null,
        pad: L.pad
      };
      canvas.setAttribute("data-gf-drawn", String(totalDrawn));
      canvas.setAttribute("data-gf-drawn-mobs", drawnMobs.map(function (d) { return d.id + ":" + d.drawn; }).join(","));
      canvas.setAttribute("data-gf-art", useArt ? "1" : "0");
    }
    function hit(clientX, clientY) {
      var L = layout();
      if (!L.w) return null;
      var rect = canvas.getBoundingClientRect();
      var x = clientX - rect.left;
      var y = clientY - rect.top;
      var best = null, bestD = 16;
      mobs.forEach(function (m, i) {
        if (!visible[i] || !m.points) return;
        m.points.forEach(function (pt) {
          var p = toPx(pt, L);
          var d = Math.hypot(p.x - x, p.y - y);
          if (d < bestD) { bestD = d; best = { mob: m, index: i, pt: pt, px: p }; }
        });
      });
      return best;
    }
    function showTip(info, clientX, clientY) {
      if (!tip) return;
      if (!info) { tip.hidden = true; return; }
      var x = info.pt[0], y = info.pt[1];
      tip.innerHTML = "<strong>" + escapeHtml(info.mob.name) + "</strong> · " +
        x.toFixed(1) + ", " + y.toFixed(1);
      tip.hidden = false;
      var stageRect = stage.getBoundingClientRect();
      var tx = clientX - stageRect.left + 12;
      var ty = clientY - stageRect.top + 12;
      if (tx + tip.offsetWidth + 8 > stage.clientWidth) tx = clientX - stageRect.left - tip.offsetWidth - 12;
      if (ty + tip.offsetHeight + 8 > stage.clientHeight) ty = clientY - stageRect.top - tip.offsetHeight - 12;
      tip.style.left = Math.max(4, tx) + "px";
      tip.style.top = Math.max(4, ty) + "px";
    }
    function setActive(info, ev) {
      active = info;
      draw();
      if (ev) showTip(info, ev.clientX, ev.clientY);
      else if (!info) showTip(null);
    }

    canvas.addEventListener("mousemove", function (ev) {
      setActive(hit(ev.clientX, ev.clientY), ev);
    });
    canvas.addEventListener("mouseleave", function () { setActive(null); });
    canvas.addEventListener("click", function (ev) {
      var info = hit(ev.clientX, ev.clientY);
      setActive(info, ev);
    });
    canvas.addEventListener("touchstart", function (ev) {
      if (!ev.changedTouches || !ev.changedTouches[0]) return;
      var tch = ev.changedTouches[0];
      ev.preventDefault();
      setActive(hit(tch.clientX, tch.clientY), tch);
    }, { passive: false });

    if (legend) {
      legend.addEventListener("click", function (ev) {
        var btn = ev.target.closest && ev.target.closest("[data-mob-index]");
        if (!btn) return;
        var i = Number(btn.getAttribute("data-mob-index"));
        if (mobs[i] && (!mobs[i].points || !mobs[i].points.length)) return;
        visible[i] = !visible[i];
        btn.setAttribute("aria-pressed", visible[i] ? "true" : "false");
        btn.classList.toggle("is-off", !visible[i]);
        setActive(null);
        draw();
      });
    }
    var ro = null;
    if (typeof ResizeObserver === "function") {
      ro = new ResizeObserver(function () { draw(); });
      ro.observe(stage);
    }
    draw();
  }

  function openFarmMap(id) {
    if (!id) return;
    Promise.all([ensureSpawns(), ensureZoneMaps()]).then(function () {
      if (!window.ForeverApp || !ForeverApp.openModal) return;
      ForeverApp.openModal(mapModalHtml(id));
      bindFarmMap(id);
    });
  }


  window.GoldFarms = {
    render: render,
    liveOf: liveOf,
    filtered: filtered,
    viewLevel: viewLevel,
    headline: headline,
    killsPerMin: killsPerMin,
    estimatedHourly: estimatedHourly,
    DEFAULT_KPM: DEFAULT_KPM,
    profStatus: profStatus,
    hasProfsFilled: hasProfsFilled,
    skillOf: skillOf,
    openMap: openFarmMap,
    lastMapDraw: function () { return lastMapDraw; }
  };
})();
