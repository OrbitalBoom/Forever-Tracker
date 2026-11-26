/* Forever Tracker — Pets tab reference tools (?v=20261126d).
 * Confirmed numbers come from Forever client 1.60.1.71091 or official notes.
 * Community / Theoretical / Unverified items are badged and never treated as official rules.
 */
(function () {
  "use strict";

  var COMMUNITY_FOCUS = { Bite: 35, Claw: 25, Growl: 15, Cower: 15, Dash: 20, Dive: 20, "Lightning Breath": 50 };
  var COMMUNITY_CD = { Bite: 10, Growl: 5, Cower: 5, Dash: 30, Dive: 30 };
  /* Bite/Claw min–max from Forever SpellEffect: mid ± 0.5 × Variance × mid. Matches the reported ranges. */
  var BITE_RANGE = {1:[7,9],2:[16,18],3:[24,28],4:[31,37],5:[40,48],6:[49,59],7:[66,80],8:[81,99]};
  var CLAW_RANGE = {1:[4,6],2:[8,12],3:[12,16],4:[16,22],5:[21,29],6:[26,36],7:[35,49],8:[43,59]};
  var NOTABLE_SPEEDS = [
    { name: "Broken Tooth", sec: 1.0, minLevel: 37, maxLevel: 37, zone: "Badlands", family: "Cat", id: 2850, ms: 1000 },
    { name: "The Rake", sec: 1.2, minLevel: 10, maxLevel: 10, zone: "Mulgore", family: "Cat", id: 5807, ms: 1200 },
    { name: "Starving Mountain Lion", sec: 1.2, minLevel: 23, maxLevel: 24, zone: "Hillsbrad Foothills", family: "Cat", id: 2384, ms: 1200 },
    { name: "Humar the Pridelord", sec: 1.3, minLevel: 23, maxLevel: 23, zone: "The Barrens", family: "Cat", id: 5828, ms: 1300 }
  ];
  var FRENZY_SPEEDS = [
    { label: "Broken Tooth", sec: 1.0 },
    { label: "The Rake", sec: 1.2 },
    { label: "Humar", sec: 1.3 },
    { label: "Standard", sec: 2.0 },
    { label: "Slow", sec: 2.5 }
  ];
  var FRENZY = {
    duration: 8,
    hastePct: 30,
    ranks: [
      { rank: 1, chance: 20, spellId: 19621 },
      { rank: 2, chance: 40, spellId: 19622 },
      { rank: 3, chance: 60, spellId: 19623 },
      { rank: 4, chance: 80, spellId: 19624 },
      { rank: 5, chance: 100, spellId: 19625 }
    ]
  };

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function pets() { return window.PETS_DATA || {}; }

  function badge(kind, title) {
    var labels = {
      confirmed: "Confirmed",
      community: "Community tested",
      theoretical: "Theoretical",
      unverified: "Unverified"
    };
    var tip = title ? ' title="' + escapeHtml(title) + '"' : "";
    return '<span class="pg-badge pg-badge-' + kind + '"' + tip + ">" + labels[kind] + "</span>";
  }

  function charLevel() {
    var a = window.ForeverApp;
    var s = a && a.getState && a.getState();
    var n = s && s.character && parseInt(s.character.level, 10);
    if (!isNaN(n)) return Math.max(1, Math.min(60, n));
    var p = s && s.hunterPet && parseInt(s.hunterPet.level, 10);
    if (!isNaN(p)) return Math.max(1, Math.min(60, p));
    return 29;
  }

  function petFamilyId() {
    var a = window.ForeverApp;
    var s = a && a.getState && a.getState();
    var n = s && s.hunterPet && s.hunterPet.familyId;
    return n == null ? 2 : n;
  }

  function uniqueAbilities() {
    var d = pets();
    var seen = {};
    var out = [];
    function add(list) {
      (list || []).forEach(function (a) {
        var k = a.name + "#" + a.rank + "#" + a.id;
        if (seen[k]) return;
        seen[k] = true;
        out.push(a);
      });
    }
    add(d.sharedAbilities);
    (d.families || []).forEach(function (f) { add(f.abilities); });
    return out;
  }

  function ranksNamed(name) {
    return uniqueAbilities().filter(function (a) { return a.name === name; })
      .sort(function (a, b) { return (a.rank || 0) - (b.rank || 0); });
  }

  function damageFromDesc(desc) {
    if (!desc) return null;
    var m = desc.match(/causing (\d+) damage/i);
    return m ? parseInt(m[1], 10) : null;
  }

  function highestAtOrBelow(list, level) {
    var best = null;
    (list || []).forEach(function (a) {
      if (a.level != null && a.level > level) return;
      if (!best || a.rank > best.rank) best = a;
    });
    return best;
  }

  function familyRows() {
    var d = pets();
    var mods = d.familyModifiers || {};
    return (d.families || []).map(function (f) {
      var m = f.modifiers || mods[String(f.id)] || {};
      return {
        id: f.id,
        name: f.name,
        damagePct: m.damagePct || 0,
        armorPct: m.armorPct || 0,
        healthPct: m.healthPct || 0,
        spellId: m.spellId,
        special: (f.specialNames || []).filter(function (n) { return n !== "Summoning"; }).join(", "),
        diet: (f.diet || []).join(", ")
      };
    }).sort(function (a, b) { return b.damagePct - a.damagePct || a.name.localeCompare(b.name); });
  }

  function fmtPct(n) {
    if (n > 0) return "+" + n + "%";
    if (n < 0) return n + "%";
    return "0%";
  }

  /* ——— Calculators (pure, for tests) ——— */

  function specialAttack(opts) {
    var ability = opts.ability === "Claw" ? "Claw" : "Bite";
    var list = ranksNamed(ability);
    var rank = parseInt(opts.rank, 10);
    var rec = list.filter(function (a) { return a.rank === rank; })[0] || null;
    var damage = rec ? damageFromDesc(rec.desc) : null;
    var level = rec ? rec.level : null;
    var tp = rec ? rec.trainingPoints : null;
    var focusCost = opts.focusCost === "" || opts.focusCost == null ? null : Number(opts.focusCost);
    var regen = opts.regen === "" || opts.regen == null ? null : Number(opts.regen);
    var cd = opts.cooldown === "" || opts.cooldown == null ? null : Number(opts.cooldown);
    var usesPerMin = null;
    if (focusCost != null && focusCost > 0 && regen != null && regen > 0) {
      var byFocus = (regen * 60) / focusCost;
      var byCd = (cd != null && cd > 0) ? (60 / cd) : Infinity;
      usesPerMin = Math.min(byFocus, byCd);
    } else if (cd != null && cd > 0 && (focusCost == null || focusCost === 0)) {
      usesPerMin = 60 / cd;
    }
    var dps = (usesPerMin != null && damage != null) ? (usesPerMin * damage) / 60 : null;
    return {
      ability: ability,
      rank: rec ? rec.rank : rank,
      level: level,
      trainingPoints: tp,
      damage: damage,
      desc: rec ? rec.desc : null,
      usesPerMin: usesPerMin,
      dps: dps
    };
  }

  function frenzyStats(opts) {
    var crit = Number(opts.critPct);
    var swing = Number(opts.swingSec);
    var rank = parseInt(opts.rank, 10) || 5;
    var row = FRENZY.ranks.filter(function (r) { return r.rank === rank; })[0] || FRENZY.ranks[4];
    var talent = row.chance / 100;
    var critF = isFinite(crit) ? Math.max(0, Math.min(100, crit)) / 100 : 0;
    var p = critF * talent;
    var duration = FRENZY.duration;
    var haste = FRENZY.hastePct / 100;
    var expectedSwingsToProc = p > 0 && swing > 0 ? swing / p : Infinity; /* in seconds */
    var swingsInWindow = swing > 0 ? duration / swing : 0;
    var atLeastOne = p > 0 && swing > 0 ? 1 - Math.pow(1 - p, swingsInWindow) : 0;
    var uptime = 0;
    if (p > 0 && swing > 0) {
      /* Seeded Monte Carlo so the figure is deterministic and can refresh
         the 8s window, with +30% speed while the buff is up. Theoretical. */
      var seed = (opts.seed != null) ? (opts.seed >>> 0) : 1;
      function rnd() {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
      }
      var now = 0, buffUntil = -1, up = 0, limit = 50000;
      while (now < limit) {
        var speed = now < buffUntil ? (1 + haste) : 1;
        var next = Math.min(now + swing / speed, limit);
        if (buffUntil > now) up += Math.min(buffUntil, next) - now;
        now = next;
        if (now >= limit) break;
        if (rnd() < p) buffUntil = now + duration;
      }
      uptime = up / limit;
    }
    return {
      rank: row.rank,
      talentChance: row.chance,
      hastePct: FRENZY.hastePct,
      duration: duration,
      procPerSwing: p,
      expectedSecondsToProc: expectedSwingsToProc,
      atLeastOneInWindow: atLeastOne,
      uptime: uptime
    };
  }

  function trainingSum(opts) {
    var level = parseInt(opts.level, 10) || 1;
    var names = opts.names || [];
    var familyId = opts.familyId;
    var total = 0;
    var lines = [];
    names.forEach(function (name) {
      var rec = highestAtOrBelow(ranksNamed(name), level);
      if (!rec) return;
      var tp = rec.trainingPoints || 0;
      total += tp;
      lines.push({ name: rec.name, rank: rec.rank, level: rec.level, trainingPoints: tp });
    });
    if (familyId != null && opts.includeSpecial) {
      var fam = (pets().families || []).filter(function (f) { return f.id === Number(familyId); })[0];
      if (fam) {
        var specials = (fam.abilities || []).filter(function (a) {
          return (fam.specialNames || []).indexOf(a.name) !== -1 && a.name !== "Summoning";
        });
        var rec = highestAtOrBelow(specials, level);
        if (rec) {
          var tp = rec.trainingPoints || 0;
          total += tp;
          lines.push({ name: rec.name, rank: rec.rank, level: rec.level, trainingPoints: tp });
        }
      }
    }
    return { level: level, total: total, lines: lines };
  }

  function biteRange(rank) { return BITE_RANGE[rank] || null; }
  function clawRange(rank) { return CLAW_RANGE[rank] || null; }

  /* Section 3 special-attack calculator. Theoretical. B/C are Forever averages.
     Focus 35/25, Bite 10s CD, regen 10 + Bestial Discipline, and happiness are community/unverified inputs. */
  function specialAttackSpec(opts) {
    var rank = parseInt(opts.rank, 10) || 8;
    var bd = Math.max(0, Math.min(2, parseInt(opts.bestialDiscipline, 10) || 0));
    var growl = !!opts.growl;
    var happiness = Number(opts.happiness);
    var family = Number(opts.familyMult);
    var uf = Math.max(0, Math.min(5, parseInt(opts.unleashedFury, 10) || 0));
    var biteList = ranksNamed("Bite");
    var clawList = ranksNamed("Claw");
    var bRec = biteList.filter(function (a) { return a.rank === rank; })[0];
    var cRec = clawList.filter(function (a) { return a.rank === rank; })[0];
    var B = bRec ? damageFromDesc(bRec.desc) : null;
    var C = cRec ? damageFromDesc(cRec.desc) : null;
    var baseRegen = opts.baseRegen == null || opts.baseRegen === "" ? 10 : Number(opts.baseRegen);
    var R = baseRegen + bd;
    var A = growl ? (R - 3) : R;
    var M = happiness * family * (1 + 0.03 * uf);
    var biteUses = Math.min(1 / 10, A / 35);
    var biteOnly = (B != null && isFinite(M) && isFinite(A)) ? B * biteUses * M : null;
    var clawOnly = (C != null && isFinite(M) && isFinite(A)) ? (A / 25) * C * M : null;
    var combined = null;
    if (B != null && C != null && isFinite(M) && isFinite(A)) {
      combined = (B * biteUses + Math.max(0, A - 35 * biteUses) / 25 * C) * M;
    }
    return {
      rank: rank, B: B, C: C, regen: R, available: A, multiplier: M,
      biteOnly: biteOnly, clawOnly: clawOnly, combined: combined,
      happiness: happiness, family: family, unleashedFury: uf, growl: growl, bestialDiscipline: bd
    };
  }

  function frenzyProcChance(critPct, points, swingSec) {
    var p = (Number(critPct) / 100) * (Number(points) / 5);
    var n = Math.floor(8 / Number(swingSec));
    if (!isFinite(p) || p < 0 || !isFinite(n) || n < 0) return 0;
    if (p === 0 || n === 0) return 0;
    return 1 - Math.pow(1 - Math.min(1, p), n);
  }

  function trainingAllowance(level, loyalty) {
    var lv = Math.max(1, Math.min(60, parseInt(level, 10) || 1));
    var lo = Math.max(1, Math.min(6, parseInt(loyalty, 10) || 1));
    return { level: lv, loyalty: lo, total: lv * (lo - 1) };
  }

  /* ——— HTML ——— */

  function happinessHtml() {
    var html = '<details class="pg-block" id="pgHappiness"><summary>Happiness and damage ' + badge("community", "125 / 100 / 75 is widely reported in Forever guides. It is not in Forever SpellEffect data.") + "</summary>";
    html += '<p>Official Forever tooltips confirm that feeding raises happiness, food closer to the pet’s level works better, and <strong>Dismiss Pet reduces happiness by 50</strong> (spell 2641: stored 50,000 with a ÷1,000 tooltip; official database agrees). They do <em>not</em> publish the damage multipliers. Forever 1.60.1.71091 has no happiness aura whose EffectBasePointsF is 25 or −25. The 125 / 100 / 75 figures below are the usual Classic values, repeated by Warcraft Tavern, ReadyCheck (updated 23 Nov 2026), and other guides. Treat them as community-reported, not a Forever patch note.</p>';
    html += '<div class="pg-happ-bars" id="pgHappBars">';
    [{ name: "Happy", pct: 125, cls: "pg-happ-happy" }, { name: "Content", pct: 100, cls: "pg-happ-content" }, { name: "Unhappy", pct: 75, cls: "pg-happ-unhappy" }].forEach(function (h) {
      html += '<div class="pg-happ-row"><span class="pg-happ-label">' + h.name + "</span>";
      html += '<span class="pg-happ-track"><span class="' + h.cls + '" style="width:' + (h.pct / 125 * 100).toFixed(1) + '%"></span></span>';
      html += '<span class="pg-happ-pct">' + h.pct + "%</span></div>";
    });
    html += "</div>";
    html += '<p class="muted">Whether happiness still drains over time in Forever is disputed: Warcraft Tavern says a beta bug made it drop only on death; Mobalytics says it no longer decays over time and that Stay-and-run-away does not count as a dismiss. That is an open question — see the test list below.</p>';
    html += '<p>Happy versus Unhappy is 125/75 = <strong>1.667</strong>, or 66.7% more damage ' + badge("theoretical") + " if those multipliers hold.</p>";
    html += '<p><strong>Stat inheritance</strong> ' + badge("community") + " / " + badge("unverified") + ". Official deep dive (30 Sep 2026): pets get increased stats from the Hunter’s gear and no longer receive player stat buffs. No official percentages. The transferred guide’s table:</p>";
    html += '<div class="table-wrap"><table class="pg-table" id="pgInheritTable"><thead><tr><th>Hunter stat</th><th>Claimed pet inheritance</th><th>Label</th></tr></thead><tbody>';
    html += "<tr><td>Attack power</td><td>10% of the higher of melee or ranged AP (example: +200 ranged AP → +20 pet AP if ranged is higher)</td><td>" + badge("community", "Warcraft Tavern / ReadyCheck 23 Nov 2026. The guide is more specific than Tavern’s “10% of total AP.”") + "</td></tr>";
    html += "<tr><td>Critical strike chance</td><td>100%</td><td>" + badge("community") + "</td></tr>";
    html += "<tr><td>Armor</td><td>30%</td><td>" + badge("unverified") + " — not in official notes; spell 415429 stores 0 on almost every effect (only Aura 418 at 50, misc 2, meaning unknown). Not used in any score.</td></tr>";
    html += "<tr><td>Stamina</td><td>2 pet HP per point</td><td>" + badge("unverified") + " — not found in Forever SpellEffect.</td></tr>";
    html += "<tr><td>Agility</td><td>Indirectly, through AP and crit</td><td>" + badge("unverified") + "</td></tr>";
    html += "</tbody></table></div>";
    html += '<p class="muted">This page does not use 10% AP, 100% crit, 30% armor, or 2 HP/sta in ranking scores or as Forever fact.</p>';
    html += "</details>";
    return html;
  }

  function familyHtml() {
    var rows = familyRows();
    var html = '<details class="pg-block" id="pgFamilies"><summary>Family damage, armor, and health ' + badge("confirmed", "Forever Tamed Pet Passive SpellEffect, build 1.60.1.71091.") + "</summary>";
    html += "<p>These are the stored EffectBasePointsF values on each family’s unique Tamed Pet Passive (auras 79 / 142 / 133) in the Forever client. They already drive the ranking scores. Fox uses the same Tamed Pet Passive spell as Wolf (17223) on its skill line — that is in the client, not a guess. Core Hound has its own spell (444831).</p>";
    html += '<div class="table-wrap"><table class="pg-table" id="pgFamilyTable"><thead><tr><th>Family</th><th>Damage</th><th>Armor</th><th>Health</th><th>Special</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      html += '<tr data-family-id="' + r.id + '"><td>' + escapeHtml(r.name) + "</td>";
      html += '<td data-col="damage">' + fmtPct(r.damagePct) + "</td>";
      html += '<td data-col="armor">' + fmtPct(r.armorPct) + "</td>";
      html += '<td data-col="health">' + fmtPct(r.healthPct) + "</td>";
      html += "<td>" + escapeHtml(r.special || "—") + "</td></tr>";
    });
    html += "</tbody></table></div>";
    html += '<div class="pg-bars" id="pgFamilyBars">';
    rows.forEach(function (r) {
      var w = Math.min(100, Math.max(0, (r.damagePct + 15) / 30 * 100));
      html += '<div class="pg-bar-row"><span class="pg-bar-label">' + escapeHtml(r.name) + "</span>";
      html += '<span class="pg-bar-track"><span class="pg-bar-fill" style="width:' + w.toFixed(1) + '%"></span></span>';
      html += '<span class="pg-bar-val">' + fmtPct(r.damagePct) + "</span></div>";
    });
    html += "</div>";
    html += '<p>On an illustrative 100-DPS baseline those modifiers are theoretical relative damage: Cat/Raptor 110; Bird of Prey/Wind Serpent/Spider/Bat 107; Gorilla 102; Core Hound 101; the 0% families 100; Crab 95; Scorpid 94; Bear 91; Boar/Turtle 90. Cat versus Turtle is 110/90, about 22% more baseline family damage ' + badge("theoretical") + ". The transferred guide’s family table matches the Forever Tamed Pet Passive values exactly — nothing to correct there.</p>";
    html += '<p class="muted">Diet on this site comes from Forever CreatureFamily.PetFoodMask. Warcraft Tavern’s diet list differs for some families (ReadyCheck notes six); the client mask wins here. Fox diet is Meat only. Core Hound is in the client (spell 444831) but has no Classic tame entries, so tameability in Forever is still unconfirmed here.</p>';
    html += "</details>";
    return html;
  }

  function meleeHtml() {
    var html = '<details class="pg-block" id="pgMelee"><summary>Approximate white-melee model ' + badge("theoretical") + "</summary>";
    html += "<p>The transferred guide’s Classic-derived model is <code>DPS = (BaseDPS + pet AP / 14) × M</code>, where M is happiness, family, talents, and racials. It is <strong>not</strong> a verified complete Forever server formula. Do not double-count modifiers already inside BaseDPS or displayed AP. Special-ability scaling is unresolved. This page does not use that formula in the ranking scores.</p>";
    html += "</details>";
    return html;
  }

  function timelineHtml() {
    var html = '<details class="pg-block" id="pgTimeline"><summary>Attack speed and a 6-second timeline ' + badge("theoretical") + " for equal-DPS hits; speeds " + badge("community") + " / Classic-sourced</summary>";
    html += "<p>The guide reported that natural swing times are kept, but baseline melee DPS is normalized: a faster pet hits more often for less damage per hit. That is <strong>not</strong> an official Forever rule (see the ranking note). The picture below is the guide’s illustration at 30 base DPS over 6 seconds, assuming ideal swings, no misses, and no special attacks — all three land 180 damage.</p>";
    html += '<div class="table-wrap"><table class="pg-table" id="pgNotableSpeeds"><thead><tr><th>Pet</th><th>Classic swing</th><th>Level</th><th>Zone</th></tr></thead><tbody>';
    NOTABLE_SPEEDS.forEach(function (n) {
      html += "<tr><td>" + escapeHtml(n.name) + "</td><td>" + n.sec.toFixed(1) + "s (" + n.ms + " ms)</td><td>L" + n.minLevel + (n.maxLevel !== n.minLevel ? "–" + n.maxLevel : "") + "</td><td>" + escapeHtml(n.zone) + "</td></tr>";
    });
    html += "</tbody></table></div>";
    html += '<p class="muted">Those swing times match CMaNGOS MeleeBaseAttackTime for the same creatures (The Rake 1200 ms, Broken Tooth 1000 ms, Humar 1300 ms, Starving Mountain Lion 1200 ms). They are Classic-sourced and may differ in Forever. Testers have called The Rake 1.2s in Forever, but that is not a full official mapping.</p>';
    html += '<div class="pg-timeline" id="pgSpeedTimeline">';
    [{ name: "Broken Tooth 1.0s", hits: 6, dmg: 30, n: 6 }, { name: "The Rake 1.2s", hits: 5, dmg: 36, n: 5 }, { name: "Standard 2.0s", hits: 3, dmg: 60, n: 3 }].forEach(function (row) {
      html += '<div class="pg-tl-row"><span class="pg-tl-label">' + escapeHtml(row.name) + '</span><span class="pg-tl-track">';
      for (var i = 0; i < row.n; i++) {
        var left = (i / 6) * 100;
        html += '<span class="pg-tl-hit" style="left:' + left.toFixed(2) + '%" title="' + row.dmg + ' dmg"></span>';
      }
      html += '</span><span class="pg-tl-sum">' + row.n + " × " + row.dmg + " = 180</span></div>";
    });
    html += "</div>";
    html += "<p>Taming at a low level does not by itself permanently weaken the pet. The Rake can remain useful through 60 if you keep it at the Hunter’s level " + badge("community") + " recommendation.</p>";
    html += "</details>";
    return html;
  }

  function biteClawHtml() {
    var bite = ranksNamed("Bite");
    var claw = ranksNamed("Claw");
    var html = '<details class="pg-block" id="pgBiteClaw"><summary>Bite and Claw ranks ' + badge("confirmed", "Forever tooltips and SpellEffect EffectBasePointsF, plus SkillLineAbility training costs.") + "</summary>";
    html += "<p>Averages are the resolved Forever tooltip (“causing N damage”), which matches EffectBasePointsF. Min–max is also in the client: <code>mid ± ½ × Variance × mid</code>, and it matches the transferred guide’s ranges exactly. Training-point costs and required levels come from SkillLineAbility and SpellLevels. Focus cost and cooldown are <em>not</em> in the Forever tables we have, so they stay community-reported (Bite 35 Focus / 10 sec, Claw 25 Focus / no cooldown).</p>";
    html += '<div class="table-wrap"><table class="pg-table" id="pgBiteClawTable"><thead><tr><th>Rank</th><th>Level</th><th>TP</th><th>Bite</th><th>Claw</th></tr></thead><tbody>';
    for (var i = 0; i < Math.max(bite.length, claw.length); i++) {
      var b = bite[i], c = claw[i];
      var r = (b || c).rank;
      var br = biteRange(r), cr = clawRange(r);
      html += "<tr><td>" + escapeHtml(r) + "</td><td>" + escapeHtml((b || c).level) + "</td>";
      html += "<td>" + escapeHtml((b || c).trainingPoints) + "</td>";
      html += '<td data-bite-rank="' + (b ? b.rank : "") + '">' + (b && br ? br[0] + "–" + br[1] + " (avg " + damageFromDesc(b.desc) + ")" : "—") + "</td>";
      html += '<td data-claw-rank="' + (c ? c.rank : "") + '">' + (c && cr ? cr[0] + "–" + cr[1] + " (avg " + damageFromDesc(c.desc) + ")" : "—") + "</td></tr>";
    }
    html += "</tbody></table></div>";
    html += '<div class="pg-chart" id="pgBiteClawChart" aria-label="Bite and Claw average damage by minimum pet level">';
    for (var i = 0; i < bite.length; i++) {
      var b = bite[i], c = claw[i];
      var bd = damageFromDesc(b.desc), cd = c ? damageFromDesc(c.desc) : 0;
      html += '<div class="pg-col"><span class="pg-col-bite" style="height:' + (bd / 99 * 100).toFixed(1) + '%" title="Bite R' + b.rank + " avg " + bd + '"></span>';
      html += '<span class="pg-col-claw" style="height:' + (cd / 99 * 100).toFixed(1) + '%" title="Claw R' + (c && c.rank) + " avg " + cd + '"></span>';
      html += '<span class="pg-col-lbl">L' + b.level + "</span></div>";
    }
    html += "</div>";
    html += '<p class="muted"><span class="pg-swatch pg-swatch-bite"></span> Bite average &nbsp; <span class="pg-swatch pg-swatch-claw"></span> Claw average, by minimum pet level. Max-rank average damage per Focus, if the community costs hold: Bite 90/35 = 2.57; Claw 51/25 = 2.04 ' + badge("theoretical") + ".</p></details>";
    return html;
  }

  function specialCalcHtml(level) {
    var html = '<details class="pg-block" id="pgSpecialCalc"><summary>Special attack calculator ' + badge("confirmed") + " averages, " + badge("community") + " Focus, " + badge("theoretical") + " DPS</summary>";
    html += "<p>This follows the transferred guide’s section 3 specification. Bite and Claw averages are Forever data. Baseline Focus regen of 10/sec, Bestial Discipline as +1/+2 to that rate, Bite 35 Focus with a 10 sec cooldown, Claw 25 Focus with no cooldown, and happiness 0.75/1/1.25 are <strong>not</strong> in the Forever client tables — they are community starting values you can edit. Unleashed Fury at 3% per point (up to 15%) is the guide’s figure; this extract only stores EffectBasePointsF 20 on rank 1, and later ranks have no points here, so that 3% is " + badge("unverified") + " and is an editable input. Family damage is Forever. The output is theoretical special DPS only: no white swings, misses, crits, armor, or family specials.</p>";
    html += '<form class="pg-form" id="pgSpecialForm" autocomplete="off">';
    html += '<label class="field">Rank <select name="rank" id="pgSpecialRank"></select></label>';
    html += '<label class="field">Bestial Discipline <select name="bestialDiscipline" id="pgSpecialBD"><option value="0">0/2</option><option value="1">1/2</option><option value="2" selected>2/2</option></select></label>';
    html += '<label class="field">Growl every 5s <select name="growl" id="pgSpecialGrowl"><option value="off" selected>Off</option><option value="on">On (−3 Focus/sec)</option></select></label>';
    html += '<label class="field">Happiness <select name="happiness" id="pgSpecialHap"><option value="0.75">Unhappy 75%</option><option value="1">Content 100%</option><option value="1.25" selected>Happy 125%</option></select></label>';
    html += '<label class="field">Family damage <select name="familyMult" id="pgSpecialFam"></select></label>';
    html += '<label class="field">Unleashed Fury <select name="unleashedFury" id="pgSpecialUF">';
    for (var u = 0; u <= 5; u++) html += '<option value="' + u + '"' + (u === 5 ? " selected" : "") + ">" + u + "/5 (" + (u * 3) + "%)</option>";
    html += "</select></label>";
    html += '<label class="field">Base Focus/sec <input type="number" name="baseRegen" id="pgSpecialRegen" min="0" step="0.1" value="10"></label>';
    html += '<input type="hidden" name="ability" id="pgSpecialAbility" value="Bite">';
    html += '<input type="hidden" name="focusCost" id="pgSpecialFocus" value="35">';
    html += '<input type="hidden" name="cooldown" id="pgSpecialCd" value="10">';
    html += "</form>";
    html += '<div class="pg-out" id="pgSpecialOut"></div>';
    html += "</details>";
    return html;
  }

  function frenzyCalcHtml() {
    var html = '<details class="pg-block" id="pgFrenzyCalc"><summary>Frenzy probability calculator ' + badge("confirmed") + " talent numbers, " + badge("theoretical") + " chance / uptime</summary>";
    html += "<p>Forever Frenzy (19621–19625) is a 20/40/60/80/100% chance for +30% attack speed for 8 sec after a pet crit. The bars use the guide’s simplified formula: chance of at least one qualifying crit in 8 seconds from white swings, <code>1 − (1 − crit × points/5)^floor(8/s)</code>, for Broken Tooth 1.0s, The Rake 1.2s, Humar 1.3s, a 2.0s pet, and a 2.5s pet. That is <em>not</em> uptime: it ignores specials, misses, the 30% haste, and refreshes. A separate theoretical uptime (with refresh and haste) is shown under the bars for the swing you enter.</p>";
    html += '<form class="pg-form" id="pgFrenzyForm" autocomplete="off">';
    html += '<label class="field">Frenzy rank <select name="rank" id="pgFrenzyRank">';
    FRENZY.ranks.forEach(function (r) {
      html += '<option value="' + r.rank + '"' + (r.rank === 5 ? " selected" : "") + ">Rank " + r.rank + " (" + r.chance + "% on crit)</option>";
    });
    html += "</select></label>";
    html += '<label class="field">Pet crit % <input type="number" name="critPct" id="pgFrenzyCrit" min="5" max="50" step="0.1" value="20"></label>';
    html += '<label class="field">Swing time (sec) <input type="number" name="swingSec" id="pgFrenzySwing" min="0.4" max="5" step="0.05" value="1.2"></label>';
    html += "</form>";
    html += '<div class="pg-prob" id="pgFrenzyBars"></div>';
    html += '<div class="pg-out" id="pgFrenzyOut"></div>';
    html += '<p>Summon Hawk is a separate BM summon: Forever tooltip says it shares its cooldown with Arcane Shot and continues its assault for 18 sec (spell 1293248, DurationIndex 85 = 18,000 ms) ' + badge("confirmed") + ". Official 10 Nov 2026 notes: hawk melee damage increased by about 80% " + badge("confirmed") + ". Up to two hawks at once is from the official deep dive.</p>";
    html += "</details>";
    return html;
  }

  function trainingHtml(level) {
    var html = '<details class="pg-block" id="pgTraining"><summary>Training point costs ' + badge("confirmed") + " costs; earned total not in client data</summary>";
    html += "<p>The Forever client gives a training-point <em>cost</em> for each ability (SkillLineAbility). It does <strong>not</strong> store a formula for how many points a pet has earned from level and loyalty. The transferred guide uses <code>allowance = pet level × (loyalty rank − 1)</code>, so 60 at Best Friend is 300. Wowhead’s Forever pet guide (updated 19 Nov 2026) also states a maximum of 300 TP at level 60 with rank 6 loyalty. That is " + badge("community") + ", not a Forever DB2 field — the box below is the guide’s formula, clearly marked, plus a cost planner from confirmed costs.</p>";
    html += '<p>Loyalty names Rebellious through Best Friend, with Forever PetLoyalty thresholds 0 / 18,000 / 36,000 / 54,000 / 72,000 / 108,000, are ' + badge("confirmed") + " client data (progress, not training points). The guide’s minimum times (0 / 30 / 45 / 60 / 90 min for ranks 2–6) are " + badge("unverified") + " for Forever.</p>";
    html += '<form class="pg-form" id="pgAllowForm" autocomplete="off">';
    html += '<label class="field">Pet level <input type="number" name="level" id="pgAllowLevel" min="1" max="60" value="30"></label>';
    html += '<label class="field">Loyalty <select name="loyalty" id="pgAllowLoyalty">';
    ["Rebellious","Unruly","Submissive","Dependable","Faithful","Best Friend"].forEach(function (n, i) {
      html += '<option value="' + (i + 1) + '"' + (i === 5 ? " selected" : "") + ">" + (i + 1) + " " + n + "</option>";
    });
    html += "</select></label></form>";
    html += '<div class="pg-out" id="pgAllowOut"></div>';
    html += "<p>How to learn a skill from another beast " + badge("community") + " recommendation: stable your main pet, tame a beast that already knows the rank (for example Bite 3), use that ability in combat until the Hunter learns it, confirm it is in Beast Training, then abandon the temporary pet and retrieve your main one. Pet trainers generally teach Great Stamina, Natural Armor and resistances. Growl is free. Do not abandon a treasured main pet to learn a rank.</p>";
    html += '<form class="pg-form" id="pgTrainForm" autocomplete="off">';
    html += '<label class="field">Pet level <input type="number" name="level" id="pgTrainLevel" min="1" max="60" value="' + escapeHtml(level) + '"></label>';
    html += '<label class="field">Family <select name="familyId" id="pgTrainFamily"></select></label>';
    html += '<fieldset class="pg-checks" id="pgTrainChecks">';
    ["Great Stamina", "Natural Armor", "Bite", "Claw", "Dash", "Dive"].forEach(function (name) {
      var id = "pgTrain_" + name.replace(/\s+/g, "");
      html += '<label><input type="checkbox" name="ability" value="' + escapeHtml(name) + '" id="' + id + '"' + (name === "Great Stamina" || name === "Natural Armor" || name === "Bite" ? " checked" : "") + "> " + escapeHtml(name) + "</label>";
    });
    html += '<label><input type="checkbox" name="special" id="pgTrainSpecial" checked> Family special (highest rank at this level)</label>';
    html += "</fieldset></form>";
    html += '<div class="pg-out" id="pgTrainOut"></div>';
    html += "<p><strong>Great Stamina is health, not stamina points</strong> " + badge("confirmed") + ". The transferred guide listed “extra stamina” 3 / 5 / 7 / 10 / 13 / 17 / 21 / 26 / 32 / 40. Forever tooltips say <em>Health increased by</em> 30 / 50 / 70 / 100 / 130 / 170 / 210 / 260 / 320 / 400 at the same levels (SkillLineAbility TP 5, 10, 15, 25, 50, 75, 100, 125, 150, 185). Wowhead also describes Great Stamina as passive Health. Natural Armor is Armor increased by 50 … 1000 (confirmed). Resistances 30 / 60 / 90 / 120 at TP 5 / 15 / 45 / 90 match the guide " + badge("confirmed") + ".</p>";
    html += "</details>";
    return html;
  }

  function autocastHtml() {
    var html = '<details class="pg-block" id="pgAutocast"><summary>Solo and dungeon autocast ' + badge("community", "Recommendations, plus a Warcraft Tavern testing note on Bite vs Claw.") + "</summary>";
    html += "<p>These are recommendations, not Forever rules. The transferred guide said autocast follows the pet bar left to right; verify in live combat. A Warcraft Tavern author later tested bar order and could <em>not</em> confirm that slot order is obeyed, and saw Bite starved when Claw (no cooldown) and Growl were also on autocast. Treat bar order as " + badge("unverified") + ".</p>";
    html += '<div class="pg-panels" id="pgAutocastPanels">';
    html += '<div class="pg-panel"><h4>Solo Cat (guide)</h4><p>Growl autocast, Bite autocast, Claw autocast, Dash manual, Prowl manual. Prowl by hand, not automatically. Stance: send the pet to tank.</p></div>';
    html += '<div class="pg-panel"><h4>Dungeon Cat (guide)</h4><p>Growl off, Bite and Claw autocast, Dash and Prowl manual. Use Passive and manual attack/recall so the pet does not pull. Right-click a skill to toggle autocast.</p></div>';
    html += "</div>";
    html += "<ul>";
    html += "<li><strong>Solo, other families, pet tanking:</strong> Growl on; unique abilities (Charge, Shell Shield, Screech) on when you want them. If Focus dries up, prefer one of Bite or Claw rather than both until you have measured regen.</li>";
    html += "<li><strong>Dungeons, someone else is tanking:</strong> Growl off. Keep Howl, Dust Cloud, Web, or damage skills on if Focus allows.</li>";
    html += "</ul>";
    html += "<p>Useful macros " + badge("community") + ":</p>";
    html += '<pre class="pg-macro">/petattack</pre>';
    html += '<pre class="pg-macro">/petpassive\n/petfollow</pre>';
    html += '<pre class="pg-macro">/petattack\n/cast Hunter\'s Mark</pre>';
    html += '<p class="muted">Community Focus starting points — Bite 35 / 10 sec, Claw 25 / no cooldown, Growl 15 / 5 sec, Cower 15 / 5 sec, Dash and Dive 20 / 30 sec — are not Forever SpellEffect values. Confirm them on your tooltip.</p>';
    html += "</details>";
    return html;
  }

  function tiersHtml() {
    var html = '<details class="pg-block" id="pgTiers"><summary>Provisional tier rankings ' + badge("community") + " recommendations, not parses</summary>";
    html += "<p>The transferred guide’s subjective rankings (section 10), not combat-log results. Core Hound was excluded there because tameability was unconfirmed; it is in the Forever client but has no Classic tame entries. Enemy armor, fight length, and group composition will move families around. Attack speed is not treated here as extra white DPS.</p>";
    html += '<div class="table-wrap"><table class="pg-table" id="pgTierTable"><thead><tr><th>Tier</th><th>Single-target personal DPS</th><th>General solo leveling</th><th>PvP</th></tr></thead><tbody>';
    [
      ["S", "Cat, Raptor", "Cat, Raptor, Carrion Bird", "Spider, Fast Cat"],
      ["A", "Wind Serpent, Bird of Prey", "Bear, Bird of Prey, Wind Serpent", "Bat, Crocolisk, Bird of Prey, Wind Serpent"],
      ["B", "Carrion Bird, Scorpid", "Boar, Gorilla, Scorpid, Turtle, Spider", "Raptor, Crab, Hyena, Scorpid, Carrion Bird, Boar"],
      ["C", "Bear, Spider, Gorilla, Fox, Bat, Wolf, Hyena, Tallstrider, Crab, Crocolisk", "Fox, Wolf, Bat, Hyena, Tallstrider, Crab, Crocolisk", "Bear, Fox, Wolf, Turtle, Gorilla, Tallstrider"],
      ["D", "Boar, Turtle", "—", "—"]
    ].forEach(function (row) {
      html += "<tr><td>" + row[0] + "</td><td>" + escapeHtml(row[1]) + "</td><td>" + escapeHtml(row[2]) + "</td><td>" + escapeHtml(row[3]) + "</td></tr>";
    });
    html += "</tbody></table></div>";
    html += '<p class="muted">Wowhead’s Forever pet guide (19 Nov 2026) likewise puts Cat and Raptor first for leveling and dungeons, and lists Carrion Bird and Spider among PvP options. That is still a recommendation, not a parse.</p>';
    html += "</details>";
    return html;
  }

  function setupHtml() {
    var html = '<details class="pg-block" id="pgSetup"><summary>The Rake, farming, and a suggested trio ' + badge("community") + " recommendations</summary>";
    html += "<p>The transferred guide was written for a Horde Hunter interested in leveling, mining/farming, and The Rake. Suggested roles, not a guarantee that three pets fit in the stables at once (one active and two stabled is the usual cap — verify on your character):</p>";
    html += "<ul>";
    html += "<li><strong>Primary — The Rake</strong> (Cat, Mulgore, level 10). Classic swing 1.2s. Useful for leveling, questing, farming, and dungeon damage, and can stay useful to 60 if kept at the Hunter’s level. Fast swings also help with spell pushback in PvP.</li>";
    html += "<li><strong>Secondary — a Carrion Bird</strong> for multi-target fights and Demoralizing Screech. The guide illustrated “Greater Swoop” in Mulgore; <em>that name is not in this site’s tameable list</em>. Sourced Mulgore Carrion Birds are Wiry Swoop (L5–7), Swoop (L7–9), and Taloned Swoop (L8–10), all family Carrion Bird, 2.0s Classic swing.</li>";
    html += "<li><strong>Specialist — Turtle</strong>, illustrated as Oasis Snapjaw in the Barrens (L15–16, 2.0s Classic), for elite tanking and Shell Shield. A Raptor is the guide’s alternative if you want to test bleed damage.</li>";
    html += "</ul>";
    html += "</details>";
    return html;
  }

  function questionsHtml() {
    var html = '<details class="pg-block" id="pgQuestions" open><summary>Open questions and a test checklist</summary>';
    html += "<p>The transferred guide flagged live-server DPS ranking, family ability coefficients, attack-speed normalization, Focus mechanics, threat, and beta-versus-current tooltips as open. Still unverified here (build 1.60.1.71091 + official notes we read):</p>";
    html += "<ul>";
    html += "<li>Whether Happy / Content / Unhappy really multiply pet damage by 125 / 100 / 75 in the current build.</li>";
    html += "<li>Whether happiness decays over time, only on death, and/or on Dismiss Pet (50 is confirmed) versus running far away on Stay.</li>";
    html += "<li>Exact stat inheritance percentages (community 10% AP / 100% crit is not in official notes or in the stored 415429 points).</li>";
    html += "<li>Whether a faster swing currently deals more white DPS, the same DPS with smaller hits, or something else (see the ranking note).</li>";
    html += "<li>Focus costs, cooldowns, and Focus regen per second (including what 19589 “Focus regeneration increased by $s1%” does at stored 0 points).</li>";
    html += "<li>How many training points a pet has earned at a given level and loyalty.</li>";
    html += "<li>Which Faster / Slower Attack rank each beast actually receives on the server.</li>";
    html += "<li>Autocast priority rules.</li>";
    html += "</ul>";
    html += "<p><strong>Controlled tests you can run in game.</strong> To compare Cat, Raptor, and Wind Serpent, hold constant pet level, happiness, loyalty, Hunter level/equipment/talents, target level/armor/resistance, fight length, buffs, starting Focus, and Growl status. Record melee DPS, special DPS, total DPS, Focus wasted, ability use frequency, crits, misses, Frenzy uptime, and threat if you can measure it. Repeat runs. Note the patch/build and date. Split armor-heavy vs low-armor targets, and short leveling fights vs long ones. Test autocast order and confirm each ability’s rank and cost. Do not label theoretical rankings as measured data.</p>";
    html += "<ol>";
    html += "<li><strong>Happiness damage.</strong> Record white DPS (Bite/Claw autocast off) at Happy, then again at Content and Unhappy. If the multipliers hold, the ratios should be about 1.25 : 1.00 : 0.75.</li>";
    html += "<li><strong>Happiness decay.</strong> Sit out of combat for 10–20 minutes and watch the icon. Compare that to a death, a Dismiss Pet, and walking far away on Stay.</li>";
    html += "<li><strong>Inheritance.</strong> Write down your attack power and crit with no raid buffs, inspect the pet, and divide pet AP and crit by yours. Repeat after changing a piece of gear.</li>";
    html += "<li><strong>Speed and white DPS.</strong> Two pets of the same family, different swing times, melee only, same happiness. Compare DPS and damage per hit.</li>";
    html += "<li><strong>Focus regen.</strong> Empty the pet’s Focus, time how long it takes to fill, with and without Bestial Discipline.</li>";
    html += "<li><strong>Autocast.</strong> Turn Bite and Claw on together, then one at a time, and note which skill fires and whether Focus ever reaches the more expensive one.</li>";
    html += "<li><strong>Training points.</strong> At a given pet level, record unspent points at each loyalty rank (and again after a level-up) so the earned-total formula can be checked.</li>";
    html += "</ol>";
    html += "</details>";
    return html;
  }

  function renderHtml() {
    var level = charLevel();
    var html = '<section class="pet-guide" id="petGuide">';
    html += "<h3>Pet damage reference</h3>";
    html += '<p>Tools drawn from Forever client data, official notes, and community guides. Every figure is tagged: ' + badge("confirmed") + " means Forever 1.60.1.71091 or an official wow-forever.gg / Blizzard note; " + badge("community") + " means a guide or player test; " + badge("theoretical") + " means a calculator model; " + badge("unverified") + " is left out or marked. Nothing here is a sim of a live parse.</p>";
    html += happinessHtml();
    html += familyHtml();
    html += meleeHtml();
    html += timelineHtml();
    html += biteClawHtml();
    html += specialCalcHtml(level);
    html += frenzyCalcHtml();
    html += trainingHtml(level);
    html += autocastHtml();
    html += tiersHtml();
    html += setupHtml();
    html += questionsHtml();
    html += "</section>";
    return html;
  }

  function fillSpecialRanks(form) {
    var sel = form.querySelector('[name="rank"]');
    var list = ranksNamed("Bite");
    var keep = sel.value;
    sel.innerHTML = "";
    list.forEach(function (a) {
      var opt = document.createElement("option");
      opt.value = String(a.rank);
      var rng = biteRange(a.rank);
      opt.textContent = "Rank " + a.rank + " (L" + a.level + ", Bite " + (rng ? rng[0] + "–" + rng[1] : damageFromDesc(a.desc)) + ")";
      sel.appendChild(opt);
    });
    sel.value = (keep && list.some(function (a) { return String(a.rank) === keep; })) ? keep : "8";
  }

  function fillFamilyMult(form) {
    var sel = form.querySelector('[name="familyMult"]');
    if (!sel) return;
    var keep = sel.value;
    sel.innerHTML = "";
    familyRows().forEach(function (r) {
      var m = 1 + (r.damagePct || 0) / 100;
      var opt = document.createElement("option");
      opt.value = String(m);
      opt.textContent = r.name + " (" + fmtPct(r.damagePct) + ")";
      sel.appendChild(opt);
    });
    if (keep && Array.prototype.some.call(sel.options, function (o) { return o.value === keep; })) sel.value = keep;
    else sel.value = "1.1";
  }

  function renderSpecialOut(root) {
    var form = root.querySelector("#pgSpecialForm");
    if (!form) return;
    var r = specialAttackSpec({
      rank: form.rank.value,
      bestialDiscipline: form.bestialDiscipline.value,
      growl: form.growl.value === "on",
      happiness: form.happiness.value,
      familyMult: form.familyMult.value,
      unleashedFury: form.unleashedFury.value,
      baseRegen: form.baseRegen.value
    });
    var el = root.querySelector("#pgSpecialOut");
    function fmt(n) { return n == null || !isFinite(n) ? "—" : n.toFixed(2); }
    var max = Math.max(r.biteOnly || 0, r.clawOnly || 0, r.combined || 0, 0.01);
    var html = "<p>Regen R = <strong id=\"pgSpecialRegenVal\">" + fmt(r.regen) + "</strong> Focus/sec. Focus available for damage A = <strong>" + fmt(r.available) + "</strong>. Combined multiplier M = <strong>" + fmt(r.multiplier) + "</strong> (happiness × family × Unleashed Fury input).</p>";
    html += "<p>Rank " + r.rank + " averages " + badge("confirmed") + ": Bite <strong>" + r.B + "</strong>, Claw <strong>" + r.C + "</strong>.</p>";
    html += '<div class="pg-dps-bars" id="pgSpecialBars">';
    [["Bite-only", r.biteOnly, "pgSpecialBite"], ["Claw-only", r.clawOnly, "pgSpecialClaw"], ["Combined", r.combined, "pgSpecialCombined"]].forEach(function (row) {
      var w = (row[1] || 0) / max * 100;
      html += '<div class="pg-bar-row"><span class="pg-bar-label">' + row[0] + '</span><span class="pg-bar-track"><span class="pg-bar-fill" style="width:' + w.toFixed(1) + '%"></span></span><span class="pg-bar-val" id="' + row[2] + '">' + fmt(row[1]) + "</span></div>";
    });
    html += "</div>";
    html += '<p class="muted">Figures are theoretical special DPS, not a live parse. Hidden id pgSpecialUses is not used for this model.</p>';
    el.innerHTML = html;
  }

  function renderFrenzyOut(root) {
    var form = root.querySelector("#pgFrenzyForm");
    if (!form) return;
    var crit = form.critPct.value;
    var points = parseInt(form.rank.value, 10) || 5;
    var bars = root.querySelector("#pgFrenzyBars");
    if (bars) {
      var html = "";
      FRENZY_SPEEDS.forEach(function (s) {
        var p = frenzyProcChance(crit, points, s.sec);
        var pct = (p * 100).toFixed(1);
        html += '<div class="pg-bar-row"><span class="pg-bar-label">' + escapeHtml(s.label) + " " + s.sec.toFixed(1) + 's</span><span class="pg-bar-track"><span class="pg-bar-fill" style="width:' + pct + '%"></span></span>';
        html += '<span class="pg-bar-val" data-frenzy-speed="' + s.sec + '">' + pct + "%</span></div>";
      });
      bars.innerHTML = html;
    }
    var r = frenzyStats({ critPct: crit, swingSec: form.swingSec.value, rank: points });
    var el = root.querySelector("#pgFrenzyOut");
    var procPct = (r.procPerSwing * 100).toFixed(2);
    var upPct = (r.uptime * 100).toFixed(1);
    var atLeast = (r.atLeastOneInWindow * 100).toFixed(1);
    var eta = isFinite(r.expectedSecondsToProc) ? r.expectedSecondsToProc.toFixed(2) + "s" : "never";
    el.innerHTML = "<p>For the swing you entered: proc chance per swing <strong id=\"pgFrenzyProc\">" + procPct + "%</strong>. Expected time to a proc: <strong>" + eta + "</strong>. Chance of at least one proc in 8s at that base swing (no floor in this line uses duration/swing): <strong>" + atLeast + "%</strong>.</p>" +
      "<p>Theoretical uptime (refreshes, +30% speed while up): <strong id=\"pgFrenzyUptime\">" + upPct + "%</strong>.</p>";
  }

  function fillTrainFamily(form) {
    var sel = form.querySelector("#pgTrainFamily");
    var cur = String(petFamilyId());
    sel.innerHTML = "";
    (pets().families || []).forEach(function (f) {
      var opt = document.createElement("option");
      opt.value = String(f.id);
      opt.textContent = f.name;
      if (String(f.id) === cur) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function renderTrainOut(root) {
    var form = root.querySelector("#pgTrainForm");
    if (!form) return;
    var names = [];
    form.querySelectorAll('input[name="ability"]:checked').forEach(function (c) { names.push(c.value); });
    var r = trainingSum({
      level: form.level.value,
      names: names,
      familyId: form.familyId.value,
      includeSpecial: form.querySelector("#pgTrainSpecial").checked
    });
    var el = root.querySelector("#pgTrainOut");
    if (!r.lines.length) {
      el.innerHTML = "<p>Select at least one ability.</p>";
      return;
    }
    var rows = r.lines.map(function (l) {
      return "<tr><td>" + escapeHtml(l.name) + " R" + l.rank + "</td><td>L" + l.level + "</td><td>" + l.trainingPoints + " TP</td></tr>";
    }).join("");
    el.innerHTML = '<div class="table-wrap"><table class="pg-table" id="pgTrainTable"><thead><tr><th>Ability</th><th>Rank at this level</th><th>Cost</th></tr></thead><tbody>' +
      rows + "</tbody></table></div><p>Total: <strong id=\"pgTrainTotal\">" + r.total + "</strong> training points " + badge("confirmed") + " (sum of those costs only).</p>";
  }

  function renderAllowOut(root) {
    var form = root.querySelector("#pgAllowForm");
    if (!form) return;
    var r = trainingAllowance(form.level.value, form.loyalty.value);
    var el = root.querySelector("#pgAllowOut");
    el.innerHTML = "<p>Guide formula: " + r.level + " × (" + r.loyalty + " − 1) = <strong id=\"pgAllowTotal\">" + r.total + "</strong> training points " + badge("community") + ". Not a Forever client field.</p>";
  }

  function bind(root) {
    var box = root.querySelector("#petGuide") || root;
    var sForm = box.querySelector("#pgSpecialForm");
    if (sForm) {
      fillSpecialRanks(sForm);
      fillFamilyMult(sForm);
      sForm.addEventListener("change", function () { renderSpecialOut(box); });
      sForm.addEventListener("input", function () { renderSpecialOut(box); });
      renderSpecialOut(box);
    }
    var fForm = box.querySelector("#pgFrenzyForm");
    if (fForm) {
      fForm.addEventListener("input", function () { renderFrenzyOut(box); });
      fForm.addEventListener("change", function () { renderFrenzyOut(box); });
      renderFrenzyOut(box);
    }
    var tForm = box.querySelector("#pgTrainForm");
    if (tForm) {
      fillTrainFamily(tForm);
      tForm.addEventListener("input", function () { renderTrainOut(box); });
      tForm.addEventListener("change", function () { renderTrainOut(box); });
      renderTrainOut(box);
    }
    var aForm = box.querySelector("#pgAllowForm");
    if (aForm) {
      aForm.addEventListener("input", function () { renderAllowOut(box); });
      aForm.addEventListener("change", function () { renderAllowOut(box); });
      renderAllowOut(box);
    }
  }

  window.PetGuide = {
    renderHtml: renderHtml,
    bind: bind,
    specialAttack: specialAttack,
    specialAttackSpec: specialAttackSpec,
    frenzyStats: frenzyStats,
    frenzyProcChance: frenzyProcChance,
    trainingSum: trainingSum,
    trainingAllowance: trainingAllowance,
    biteRange: biteRange,
    clawRange: clawRange,
    familyRows: familyRows,
    ranksNamed: ranksNamed,
    damageFromDesc: damageFromDesc,
    COMMUNITY_FOCUS: COMMUNITY_FOCUS,
    FRENZY: FRENZY
  };
})();
