/* Item stat weights for the Items tab upgrade finder.
 *
 * WEIGHTS: SOURCED.  Every per-spec number below comes from a published
 * Classic/Forever stat-weight table, not from this tracker's author.
 *
 * 1. Spec tables (all 9 classes, all 28 specs, every stat the item database
 *    has): Pawn's Classic scales for the WoW: Forever client, curated by
 *    HawsJon.  File ClassicHawsJon.lua, section `VgerCore.IsForever`
 *      https://github.com/VgerMods/Pawn/blob/c170b9d18369c4a720bad1ac21c48b0d32ab6873/ClassicHawsJon.lua
 *    The values are copied unchanged into js/stat-weights-data.js by
 *    tools/stat-weights/build_stat_weights.py.  Units: weight per 1 point of the
 *    stat as shown on an item tooltip (crit/hit/dodge/parry/block are per 1%),
 *    with the spec's main stat about 1.  Pawn is (c) Travis Spomer, CC BY-NC-ND
 *    3.0; the numbers are credited and not altered.  These are level-60 scales.
 *
 * 2. Derived on top of those tables (formulas, nothing invented):
 *    a. Level.  Agility is partly crit.  The Agility needed per 1% crit rises
 *       with level, so a point of Agility is worth a little more crit at lower
 *       level.  Agi(L) = Agi(60) + (1/AgiPerCrit(L) - 1/AgiPerCrit(60)) * CritWeight,
 *       with AgiPerCrit linearly interpolated between the level-1 and level-60
 *       values (the interpolation the 1.12 client tables follow; same formula as
 *       the open-source wow_world_base crate, `base_melee_crit`).  Level-1 and
 *       level-60 values per class: https://wow-guides.com/knowledge/attributes
 *       (read from the 1.12 data).  Other level-dependent conversions (spell
 *       crit per Intellect, dodge per Agility, armor mitigation, spirit regen)
 *       have no table we could source, so they stay at the level-60 values.
 *    b. Weapon DPS by slot.  Pawn gives separate weights for melee weapon DPS
 *       and ranged weapon DPS.  Ranged slot -> ranged DPS; main hand / one hand
 *       / two hand -> melee DPS; off hand -> half of melee DPS, because a
 *       dual-wield off hand deals 50% damage (Attack power page, "Offhand
 *       Damage = [(Weapon DPS + AP/14) * Weapon Speed] / 2",
 *       https://warcraft.wiki.gg/wiki/Attack_power).
 *    c. Stat-stick weapons.  Hunters do not fight in melee, so their melee
 *       weapon DPS is set to 0 (Wowhead Classic: melee weapons are stat sticks,
 *       https://www.wowhead.com/classic/guide/wow-classic-best-hunter-weapons).
 *       Pawn's Forever table gives Hunters a melee DPS weight (2.0 for Beast
 *       Mastery / Marksmanship, 6.0 for Survival); this is a deliberate override.
 *       Feral Druid melee weapon DPS is set to 0 too: forms use their own
 *       damage, only the weapon's stats and Feral Attack Power count.  Pawn's
 *       own Classic Era table has Feral MeleeDps = 0, its Forever table has 5-6.
 *    d. Spell Power (damage and healing).  Item "sp" counts damage and
 *       healing, so its weight is Pawn's SpellDamage + Healing for that spec.
 *    e. Race (WoW: Forever racials, not Classic's): only racials that
 *       multiply an item stat change a weight.  Human "The Human Spirit"
 *       +10% Spirit -> Spirit weight x1.10.  Tauren "Endurance" +5% total
 *       Health -> Stamina weight x1.05.  Flat bonuses (Human +1% crit, Dwarf
 *       +1% hit, Night Elf +1% dodge) and non-stat racials do not change
 *       a per-point weight.  Weapon-skill racials (Human/Orc/Dwarf/Troll) no
 *       longer exist in Forever.  Sources: https://foreverdiff.com/races/
 *       (client racial spells), https://wowforevertierlist.com/races/racials,
 *       https://www.wowhead.com/forever/guide/classes/hunter/beast-mastery/stat-priority-pve-dps
 *       (Tauren: 10.5 Health per Stamina).
 *    f. Role rows ("Melee Agi", "Healer", ...) are plain averages of the
 *       sourced spec rows (a missing stat counts as 0).
 *
 * Stats with no source weight stay at 0 (not counted).  Item level is not a
 * stat and is no longer scored.
 */
(function () {
  "use strict";

  var DATA = window.STAT_WEIGHT_DATA || { specs: {}, source: {} };

  /* Pawn stat name -> item database key.  `sp` is handled separately. */
  var KEY_MAP = {
    Strength: "str", Agility: "agi", Stamina: "sta", Intellect: "int", Spirit: "spi",
    Ap: "ap", Rap: "rap", FeralAp: "fap",
    HitRating: "hit", CritRating: "crit", SpellHitRating: "spellHit", SpellCritRating: "spellCrit",
    Healing: "healing", Mp5: "mp5", Hp5: "hp5",
    FireSpellDamage: "spFire", FrostSpellDamage: "spFrost", ShadowSpellDamage: "spShadow",
    NatureSpellDamage: "spNature", ArcaneSpellDamage: "spArcane", HolySpellDamage: "spHoly",
    SpellPenetration: "spellPen", Armor: "armor", DefenseRating: "defense",
    DodgeRating: "dodge", ParryRating: "parry", BlockRating: "blockChance", BlockValue: "blockValue",
    FireResist: "fireRes", FrostResist: "frostRes", ArcaneResist: "arcaneRes",
    ShadowResist: "shadowRes", NatureResist: "natureRes"
  };

  /* Pawn names this site's specs differently. */
  var PAWN_SPEC = { "Feral DPS": "Feral (Damage)", "Feral Tank": "Feral (Tank)" };
  var OUR_SPEC = { "Feral (Damage)": "Feral DPS", "Feral (Tank)": "Feral Tank" };

  function convert(row) {
    var out = {}, k, v;
    for (k in row) {
      if (!Object.prototype.hasOwnProperty.call(row, k)) continue;
      v = row[k];
      if (KEY_MAP[k]) out[KEY_MAP[k]] = v;
    }
    out.sp = (row.SpellDamage || 0) + (row.Healing || 0);
    out.block = row.BlockValue || 0;           /* shield "Block" value = Pawn BlockValue */
    out._meleeDps = (row.MeleeDps || 0) + (row.Dps || 0);
    out._rangedDps = (row.RangedDps || 0) + (row.Dps || 0);
    return out;
  }

  var SPECS = {};
  Object.keys(DATA.specs || {}).forEach(function (cls) {
    SPECS[cls] = {};
    Object.keys(DATA.specs[cls]).forEach(function (pawnName) {
      SPECS[cls][OUR_SPEC[pawnName] || pawnName] = convert(DATA.specs[cls][pawnName]);
    });
  });

  /* Deliberate departures from Pawn's melee DPS weight (see header, item c). */
  var STAT_STICK_MELEE = {
    "Hunter": "Hunters do not melee; melee weapons are stat sticks",
    "Druid:Feral DPS": "Feral forms ignore weapon damage; only the weapon's stats count",
    "Druid:Feral Tank": "Feral forms ignore weapon damage; only the weapon's stats count"
  };
  function isStatStick(cls, spec) {
    return !!(STAT_STICK_MELEE[cls] || STAT_STICK_MELEE[cls + ":" + spec]);
  }
  Object.keys(SPECS).forEach(function (cls) {
    Object.keys(SPECS[cls]).forEach(function (spec) {
      if (isStatStick(cls, spec)) SPECS[cls][spec]._meleeDps = 0;
    });
  });

  /* Agility per 1% crit at level 1 and at level 60, per class.
     https://wow-guides.com/knowledge/attributes (read from the 1.12 data). */
  var AGI_PER_CRIT = {
    Warrior: [4, 20], Paladin: [4.65, 19.76], Hunter: [4.6, 52.91], Rogue: [2.3, 28.99],
    Priest: [10, 20], Shaman: [6.06, 19.68], Mage: [11.11, 19.46], Warlock: [6.67, 20], Druid: [4.88, 20]
  };
  function agiPerCrit(cls, level) {
    var t = AGI_PER_CRIT[cls];
    if (!t) return null;
    var L = Math.max(1, Math.min(60, Number(level) || 60));
    return t[0] * (60 - L) / 59 + t[1] * (L - 1) / 59;
  }

  /* Racial multipliers that scale an item stat in Forever. */
  var RACE_MODS = {
    "Human": { spi: 1.10, note: "The Human Spirit: +10% Spirit" },
    "Tauren": { sta: 1.05, note: "Endurance: +5% total Health" }
  };
  var RACE_NOTES = {
    "Human": "The Human Spirit +10% Spirit (Spirit weight x1.10). Ruthless +1% crit is flat, so no change.",
    "Dwarf": "Artisan's Precision +1% hit is flat: no weight change.",
    "Night Elf": "Quickness +1% dodge is flat: no weight change.",
    "Gnome": "Expansive Mind is +5% max mana (not Intellect) in Forever: no sourced weight change.",
    "Orc": "No racial changes an item-stat weight (Axe Specialization is gone in Forever).",
    "Undead": "No racial changes an item-stat weight.",
    "Tauren": "Endurance +5% total Health (Stamina weight x1.05).",
    "Troll": "No racial changes an item-stat weight (Bow and Throwing Specialization are gone in Forever).",
    "High Order Skyborne": "Wind Blessed +2% haste: haste is not an item stat here, so no weight change.",
    "Windshaper Skyborne": "Wind Blessed +2% haste: haste is not an item stat here, so no weight change."
  };

  /* Spell crit per Intellect, dodge per Agility, armor, spirit regen: level-60 values (no level source). */

  var ALIASES = {
    "Shadow Magic": "Shadow",
    "Elemental Combat": "Elemental",
    "Feral Combat": "Feral DPS",
    "Feral": "Feral DPS",
    "Feral Cat": "Feral DPS",
    "Feral Tank": "Feral Tank"
  };

  var ROLE_GROUPS = {
    "Caster DPS": [
      ["Warlock", "Affliction"], ["Warlock", "Demonology"], ["Warlock", "Destruction"],
      ["Mage", "Arcane"], ["Mage", "Fire"], ["Mage", "Frost"],
      ["Priest", "Shadow"], ["Shaman", "Elemental"], ["Druid", "Balance"]
    ],
    "Healer": [
      ["Paladin", "Holy"], ["Priest", "Discipline"], ["Priest", "Holy"],
      ["Shaman", "Restoration"], ["Druid", "Restoration"]
    ],
    "Tank": [
      ["Warrior", "Protection"], ["Paladin", "Protection"], ["Druid", "Feral Tank"]
    ],
    "Melee Agi": [
      ["Rogue", "Assassination"], ["Rogue", "Combat"], ["Rogue", "Subtlety"],
      ["Druid", "Feral DPS"]
    ],
    "Melee Str": [
      ["Warrior", "Arms"], ["Warrior", "Fury"], ["Paladin", "Retribution"], ["Shaman", "Enhancement"]
    ]
  };

  function averageRows(pairs) {
    var sums = {}, rows = [], i, row, k;
    for (i = 0; i < pairs.length; i++) {
      row = SPECS[pairs[i][0]] && SPECS[pairs[i][0]][pairs[i][1]];
      if (row) rows.push(row);
    }
    for (i = 0; i < rows.length; i++) {
      for (k in rows[i]) {
        if (Object.prototype.hasOwnProperty.call(rows[i], k)) sums[k] = (sums[k] || 0) + rows[i][k];
      }
    }
    var out = {};
    for (k in sums) {
      if (Object.prototype.hasOwnProperty.call(sums, k)) out[k] = Math.round((sums[k] / rows.length) * 1000) / 1000;
    }
    return out;
  }

  var ROLES = {};
  Object.keys(ROLE_GROUPS).forEach(function (name) {
    ROLES[name] = averageRows(ROLE_GROUPS[name]);
  });

  var STAT_LABELS = {
    str: "Strength", agi: "Agility", sta: "Stamina", int: "Intellect", spi: "Spirit",
    ap: "Attack Power", rap: "Ranged Attack Power", fap: "Feral Attack Power",
    crit: "Crit chance", hit: "Hit chance", spellCrit: "Spell Crit", spellHit: "Spell Hit",
    sp: "Spell Power", healing: "Healing", mp5: "Mana per 5", hp5: "Health per 5",
    defense: "Defense", dodge: "Dodge", parry: "Parry", blockChance: "Block chance",
    blockValue: "Block value", block: "Block value", armor: "Armor",
    spFire: "Fire damage", spFrost: "Frost damage", spShadow: "Shadow damage",
    spNature: "Nature damage", spArcane: "Arcane damage", spHoly: "Holy damage",
    spellPen: "Spell Penetration", dps: "Weapon DPS", ilvl: "Item level",
    fireRes: "Fire resistance", frostRes: "Frost resistance", natureRes: "Nature resistance",
    shadowRes: "Shadow resistance", arcaneRes: "Arcane resistance"
  };

  function canonSpec(cls, name) {
    if (!name) return null;
    var aliased = ALIASES[name] || name;
    var bag = SPECS[cls] || {};
    if (bag[aliased]) return aliased;
    if (bag[name]) return name;
    var keys = Object.keys(bag), i;
    for (i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() === String(aliased).toLowerCase()) return keys[i];
    }
    return null;
  }

  function specsOf(cls) { return Object.keys(SPECS[cls] || {}); }
  function roleNames() { return Object.keys(ROLES); }
  function isRole(name) { return !!ROLES[name]; }

  function isMeleeWeaponSlot(slotId) {
    return slotId === "mainhand" || slotId === "offhand" || slotId === "onehand" || slotId === "twohand";
  }

  function round3(n) { return Math.round(n * 1000) / 1000; }

  /* The adjusted weights for a class + spec (or role), optionally for a slot,
     a character level and a race.  Returns a plain {itemKey: weight} object. */
  function weightsFor(cls, build, slotId, ctx) {
    ctx = ctx || {};
    var base, isR = !!(build && ROLES[build]), spec = null, bag, first, k;
    if (isR) base = ROLES[build];
    else {
      spec = canonSpec(cls, build);
      bag = SPECS[cls] || {};
      if (spec && bag[spec]) base = bag[spec];
      else {
        first = Object.keys(bag)[0];
        spec = first || null;
        base = (first && bag[first]) || {};
      }
    }
    var w = {};
    for (k in base) {
      if (Object.prototype.hasOwnProperty.call(base, k) && k.charAt(0) !== "_") w[k] = base[k];
    }
    /* a. level: Agility's crit share */
    var lvl = Number(ctx.level);
    if (!isR && lvl >= 1 && lvl < 60 && w.agi && w.crit) {
      var a60 = agiPerCrit(cls, 60), aL = agiPerCrit(cls, lvl);
      if (a60 && aL) w.agi = w.agi + (1 / aL - 1 / a60) * w.crit;
    }
    /* e. race */
    var mods = ctx.race && RACE_MODS[ctx.race];
    if (mods) {
      for (k in mods) {
        if (k !== "note" && w[k]) w[k] = w[k] * mods[k];
      }
    }
    /* b./c. weapon DPS by slot */
    var melee = base._meleeDps || 0, ranged = base._rangedDps || 0;
    if (slotId === "ranged") w.dps = ranged;
    else if (slotId === "offhand") w.dps = melee * 0.5;
    else w.dps = melee;
    for (k in w) {
      if (Object.prototype.hasOwnProperty.call(w, k)) w[k] = round3(w[k]);
    }
    return w;
  }

  function contributing(weights, item) {
    var s = (item && item.stats) || {};
    var rows = [];
    Object.keys(weights || {}).forEach(function (k) {
      if (k === "ilvl") return;
      var wv = weights[k];
      if (!wv) return;
      var has = (typeof s[k] === "number" && s[k]) || (k === "dps" && item && item.weapon && item.weapon.dps);
      if (!has) return;
      rows.push({ key: k, weight: wv, label: STAT_LABELS[k] || k });
    });
    rows.sort(function (a, b) { return b.weight - a.weight; });
    return rows;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* HTML for the small "Weights: sourced, see info" popover. */
  function infoHtml(cls, build, ctx) {
    ctx = ctx || {};
    var src = DATA.source || {};
    var out = [];
    out.push("<p><strong>Where the numbers come from.</strong> Per-spec stat weights for every class and spec, as published for the WoW: Forever client in the " +
      '<a href="' + esc(src.url) + '" target="_blank" rel="noopener">Pawn Classic scales (HawsJon)</a>, ' +
      "Forever section, Pawn commit " + esc(String(src.commit || "").slice(0, 7)) + " (" + esc(src.commitDate) + "). " +
      "Values are copied unchanged. They are level-60 scales; this is a Classic/Forever-sourced linear score, not a simulation.</p>");
    var adj = [];
    var lv = Number(ctx.level);
    if (cls && lv >= 1 && lv < 60 && AGI_PER_CRIT[cls]) {
      adj.push("<li><strong>Level " + lv + ":</strong> Agility's crit share is rescaled for level (about " +
        (Math.round(agiPerCrit(cls, lv) * 10) / 10) + " Agility per 1% crit now, " + AGI_PER_CRIT[cls][1] +
        " at 60). Data: <a href=\"https://wow-guides.com/knowledge/attributes\" target=\"_blank\" rel=\"noopener\">wow-guides.com</a>, interpolated as in the <a href=\"https://docs.rs/wow_world_base\" target=\"_blank\" rel=\"noopener\">wow_world_base</a> formulas. Other conversions stay at level 60.</li>");
    }
    if (ctx.race) {
      adj.push("<li><strong>" + esc(ctx.race) + ":</strong> " + esc(RACE_NOTES[ctx.race] || "No racial changes an item-stat weight.") + "</li>");
    }
    if (cls === "Hunter") adj.push("<li><strong>Hunter melee weapons</strong> count their stats only (DPS weight 0). Ranged weapon DPS uses the sourced weight.</li>");
    if (cls === "Druid") adj.push("<li><strong>Feral weapons</strong> count their stats only (DPS weight 0).</li>");
    adj.push("<li><strong>Off-hand weapons</strong> count half the melee DPS weight (off-hand hits deal 50% damage).</li>");
    out.push("<ul class=\"weights-info-list\">" + adj.join("") + "</ul>");
    out.push('<p class="muted">Also used: ' +
      '<a href="https://warcraft.wiki.gg/wiki/Attack_power" target="_blank" rel="noopener">Warcraft Wiki: Attack power</a>, ' +
      '<a href="https://www.wowhead.com/classic/guide/wow-classic-best-hunter-weapons" target="_blank" rel="noopener">Wowhead: Hunter weapons</a>, ' +
      '<a href="https://foreverdiff.com/races/" target="_blank" rel="noopener">foreverdiff.com races</a>, ' +
      '<a href="https://wowforevertierlist.com/races/racials" target="_blank" rel="noopener">Forever racials</a>. ' +
      "Not counted: haste, expertise and weapon skill (not in this item data), wand DPS for casters (the source weights it 0), item level.</p>");
    return out.join("");
  }

  window.ITEM_WEIGHTS = {
    specs: SPECS,
    roles: ROLES,
    roleGroups: ROLE_GROUPS,
    aliases: ALIASES,
    labels: STAT_LABELS,
    source: DATA.source || {},
    raceMods: RACE_MODS,
    raceNotes: RACE_NOTES,
    agiPerCrit: agiPerCrit,
    canonSpec: canonSpec,
    specsOf: specsOf,
    roleNames: roleNames,
    isRole: isRole,
    weightsFor: weightsFor,
    isMeleeWeaponSlot: isMeleeWeaponSlot,
    isStatStick: isStatStick,
    contributing: contributing,
    infoHtml: infoHtml
  };
})();
