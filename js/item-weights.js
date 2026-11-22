/* Rough relative stat priorities for ranking upgrades on the Items tab.
 *
 * These are not combat-log simulations and are not claimed as a sourced DPS
 * or healing model. The coefficients are simple relative weights so two
 * pieces can be sorted in this UI. They follow common Classic Era advice:
 *   - casters: spell hit is valuable early, then spell damage and spell crit
 *   - melee: hit, then strength or agility and crit, plus weapon DPS
 *   - healers: +healing, mana per 5, intellect, spirit
 *   - tanks: stamina, defense, avoidance, armor
 * Public write-ups of those qualitative priorities include Wowhead's Classic
 * class guides (https://www.wowhead.com/classic) and similar community
 * stat-priority lists. The numbers themselves are not copied from a published
 * table or sim; most of the per-spec rows were already used by this tracker
 * (moved here from js/data.js) and are kept as-is.
 *
 * The spec list matches this site's character specs and Forever talent trees
 * (js/data.js, js/talents.js, client build 1.60.1.70938). Forever has the same
 * nine classes and three trees per class as Classic; the talent data does not
 * define any extra Forever-only class tree. Labels:
 *   - Priest "Shadow" is the "Shadow Magic" tree
 *   - Shaman "Elemental" is the "Elemental Combat" tree
 *   - Druid "Feral Combat" is offered as Feral DPS and Feral Tank, because
 *     those are different roles (the site's talent presets include "Feral Cat"
 *     and "Feral Tank"). Feral DPS is the old combined Feral row without tank
 *     stats. Feral Tank keeps that row's tank-oriented keys and uses the same
 *     stamina / defense / dodge / armor scale already used for Protection.
 *
 * General role rows are unweighted averages of the grouped spec rows below,
 * rounded, for browsing when you want a role instead of one spec.
 */
(function () {
  "use strict";

  var SPECS = {
    Warrior: {
      Arms: { str: 2.2, agi: 1.1, sta: 0.4, ap: 1, crit: 8, hit: 12, dps: 2.4, armor: 0.02, skillAxes: 3, skillSwords: 3, skillMaces: 3, ilvl: 0.8 },
      Fury: { str: 2.0, agi: 1.3, sta: 0.3, ap: 1, crit: 9, hit: 12, dps: 2.6, armor: 0.02, skillSwords: 3, skillAxes: 3, ilvl: 0.8 },
      Protection: { sta: 1.8, str: 0.9, agi: 1.1, defense: 3.5, dodge: 2.2, parry: 2.2, blockChance: 2, blockValue: 0.4, block: 0.12, armor: 0.06, ap: 0.3, hit: 5, crit: 2, ilvl: 0.6 }
    },
    Paladin: {
      Holy: { int: 1.6, spi: 1.1, sta: 0.3, mp5: 2.2, healing: 1, sp: 0.4, spellCrit: 6, ilvl: 0.7 },
      Protection: { sta: 1.6, str: 0.8, agi: 0.9, defense: 3, dodge: 2, parry: 1.6, blockChance: 2.2, blockValue: 0.5, block: 0.12, armor: 0.06, int: 0.4, spellCrit: 2, sp: 0.3, ilvl: 0.6 },
      Retribution: { str: 2, agi: 1, sta: 0.4, ap: 1, crit: 8, hit: 10, int: 0.5, sp: 0.6, dps: 2.2, ilvl: 0.8 }
    },
    Hunter: {
      "Beast Mastery": { agi: 2.2, sta: 0.3, ap: 1, rap: 1, crit: 8, hit: 12, dps: 2.4, str: 0.3, ilvl: 0.8 },
      Marksmanship: { agi: 2.2, sta: 0.3, ap: 1, rap: 1, crit: 8.5, hit: 12, dps: 2.5, ilvl: 0.8 },
      Survival: { agi: 2.0, sta: 0.4, ap: 1, rap: 1, crit: 8, hit: 12, dps: 2.2, ilvl: 0.8 }
    },
    Rogue: {
      Assassination: { agi: 2.2, str: 1.0, sta: 0.3, ap: 1, crit: 8, hit: 14, dps: 2.8, skillDaggers: 3, ilvl: 0.8 },
      Combat: { agi: 2.0, str: 1.1, sta: 0.3, ap: 1, crit: 8, hit: 14, dps: 2.8, skillSwords: 3, skillMaces: 2, skillDaggers: 2, ilvl: 0.8 },
      Subtlety: { agi: 2.2, str: 1.0, sta: 0.3, ap: 1, crit: 8, hit: 14, dps: 2.6, ilvl: 0.8 }
    },
    Priest: {
      Discipline: { int: 1.4, spi: 1.2, sta: 0.3, mp5: 2, healing: 1, sp: 0.5, spellCrit: 5, spellHit: 8, ilvl: 0.7 },
      Holy: { int: 1.5, spi: 1.3, sta: 0.3, mp5: 2.2, healing: 1.1, sp: 0.35, spellCrit: 5, ilvl: 0.7 },
      Shadow: { int: 1.6, spi: 0.8, sta: 0.3, sp: 1, spShadow: 1.1, spellCrit: 8, spellHit: 12, mp5: 1, dps: 0.3, ilvl: 0.8 }
    },
    Shaman: {
      Elemental: { int: 1.6, sta: 0.3, spi: 0.4, sp: 1, spNature: 1.1, spellCrit: 8, spellHit: 12, mp5: 1, ilvl: 0.8 },
      Enhancement: { str: 1.8, agi: 1.2, sta: 0.4, ap: 1, crit: 8, hit: 12, int: 0.6, sp: 0.5, dps: 2.2, ilvl: 0.8 },
      Restoration: { int: 1.5, spi: 1.1, sta: 0.3, mp5: 2.2, healing: 1.1, sp: 0.4, spellCrit: 5, ilvl: 0.7 }
    },
    Mage: {
      Arcane: { int: 1.6, spi: 0.6, sta: 0.3, sp: 1, spArcane: 1.1, spellCrit: 8, spellHit: 12, mp5: 0.8, ilvl: 0.8 },
      Fire: { int: 1.5, spi: 0.5, sta: 0.3, sp: 1, spFire: 1.1, spellCrit: 9, spellHit: 12, mp5: 0.6, ilvl: 0.8 },
      Frost: { int: 1.5, spi: 0.5, sta: 0.3, sp: 1, spFrost: 1.1, spellCrit: 8, spellHit: 12, mp5: 0.6, ilvl: 0.8 }
    },
    Warlock: {
      Affliction: { int: 1.5, sta: 0.4, spi: 0.5, sp: 1, spShadow: 1.1, spellHit: 12, spellCrit: 6, mp5: 0.6, ilvl: 0.8 },
      Demonology: { int: 1.5, sta: 0.5, spi: 0.5, sp: 1, spShadow: 1.05, spellHit: 12, spellCrit: 7, ilvl: 0.8 },
      Destruction: { int: 1.5, sta: 0.3, spi: 0.4, sp: 1, spShadow: 1.05, spFire: 1.05, spellCrit: 9, spellHit: 12, ilvl: 0.8 }
    },
    Druid: {
      Balance: { int: 1.6, spi: 0.7, sta: 0.3, sp: 1, spNature: 1.1, spellCrit: 8, spellHit: 12, mp5: 0.8, ilvl: 0.8 },
      "Feral DPS": { agi: 2.0, str: 1.4, sta: 0.4, ap: 1, fap: 1.1, crit: 8, hit: 12, ilvl: 0.8 },
      "Feral Tank": { sta: 1.8, agi: 1.4, str: 0.9, ap: 0.3, fap: 0.4, armor: 0.06, defense: 3.5, dodge: 2.2, hit: 5, crit: 2, ilvl: 0.6 },
      Restoration: { int: 1.5, spi: 1.3, sta: 0.3, mp5: 2, healing: 1.1, sp: 0.4, spellCrit: 5, ilvl: 0.7 }
    }
  };

  /* Talent-tree and character-form names that should use another row. */
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
      ["Hunter", "Beast Mastery"], ["Hunter", "Marksmanship"], ["Hunter", "Survival"],
      ["Druid", "Feral DPS"]
    ],
    "Melee Str": [
      ["Warrior", "Arms"], ["Warrior", "Fury"], ["Paladin", "Retribution"], ["Shaman", "Enhancement"]
    ]
  };

  function averageRows(pairs) {
    var sums = {}, counts = {}, i, row, k;
    for (i = 0; i < pairs.length; i++) {
      row = SPECS[pairs[i][0]] && SPECS[pairs[i][0]][pairs[i][1]];
      if (!row) continue;
      for (k in row) {
        if (!Object.prototype.hasOwnProperty.call(row, k)) continue;
        sums[k] = (sums[k] || 0) + row[k];
        counts[k] = (counts[k] || 0) + 1;
      }
    }
    var out = {};
    for (k in sums) {
      if (!Object.prototype.hasOwnProperty.call(sums, k)) continue;
      out[k] = Math.round((sums[k] / counts[k]) * 100) / 100;
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
    sp: "Spell Damage", healing: "Healing", mp5: "Mana per 5", hp5: "Health per 5",
    defense: "Defense", dodge: "Dodge", parry: "Parry", blockChance: "Block chance",
    blockValue: "Block value", block: "Block", armor: "Armor",
    spFire: "Fire damage", spFrost: "Frost damage", spShadow: "Shadow damage",
    spNature: "Nature damage", spArcane: "Arcane damage", spHoly: "Holy damage",
    spellPen: "Spell Penetration", dps: "Weapon DPS", ilvl: "Item level",
    skillAxes: "Axe skill", skillSwords: "Sword skill", skillMaces: "Mace skill",
    skillDaggers: "Dagger skill"
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

  function specsOf(cls) {
    return Object.keys(SPECS[cls] || {});
  }

  function roleNames() {
    return Object.keys(ROLES);
  }

  function isRole(name) {
    return !!ROLES[name];
  }

  function weightsFor(cls, build) {
    if (build && ROLES[build]) return ROLES[build];
    var spec = canonSpec(cls, build);
    var bag = SPECS[cls] || {};
    if (spec && bag[spec]) return bag[spec];
    var first = Object.keys(bag)[0];
    return (first && bag[first]) || { ilvl: 1 };
  }

  function contributing(weights, item) {
    var s = (item && item.stats) || {};
    var rows = [];
    Object.keys(weights || {}).forEach(function (k) {
      if (k === "ilvl") return;
      var w = weights[k];
      if (!w) return;
      var has = (typeof s[k] === "number" && s[k]) || (k === "dps" && item && item.weapon && item.weapon.dps);
      if (!has) return;
      rows.push({ key: k, weight: w, label: STAT_LABELS[k] || k });
    });
    rows.sort(function (a, b) { return b.weight - a.weight; });
    return rows;
  }

  window.ITEM_WEIGHTS = {
    specs: SPECS,
    roles: ROLES,
    roleGroups: ROLE_GROUPS,
    aliases: ALIASES,
    labels: STAT_LABELS,
    canonSpec: canonSpec,
    specsOf: specsOf,
    roleNames: roleNames,
    isRole: isRole,
    weightsFor: weightsFor,
    contributing: contributing
  };
})();
