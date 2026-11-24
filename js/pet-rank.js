/* Forever Tracker — Pet ranking (attack speed, family modifiers, roles). */
(function () {
  "use strict";

  var BASELINE_MS = 2000; /* CMaNGOS Pet.cpp: mDmg = (GetAttackTime(BASE_ATTACK) * petlevel) / 2000 */

  /* Unique family abilities only. Points come from each ability's Forever tooltip text, not from opinion. */
  var ABILITY_ROLES = {
    "Furious Howl": { support: 12, why: "increases melee attack power of party or raid members" },
    "Shell Shield": { tank: 12, why: "reduces damage the pet takes" },
    "Charge": { tank: 6, dps: 6, why: "charges, immobilizes the target, and adds melee attack power to the next attack" },
    "Prowl": { dps: 6, why: "first attack from stealth receives a damage bonus" },
    "Web": { tank: 6, dps: 6, why: "immobilizes and deals Nature damage" },
    "Swipe": { dps: 6, why: "deals damage to nearby enemies" },
    "Dismember": { support: 12, dps: 6, why: "deals damage and reduces healing taken" },
    "Demoralizing Screech": { support: 12, dps: 6, why: "deals damage and lowers enemy melee attack power" },
    "Pinch": { tank: 6, dps: 6, why: "deals damage and slows movement" },
    "Thunderstomp": { dps: 6, why: "deals Nature damage to nearby enemies" },
    "Savage Rend": { dps: 6, why: "causes a bleed" },
    "Dust Cloud": { support: 12, why: "reduces the target's armor" },
    "Scorpid Poison": { dps: 6, why: "stacking Nature damage over time" },
    "Sonic Blast": { support: 12, dps: 6, why: "deals Nature damage and increases casting time" },
    "Tendon Rip": { tank: 6, dps: 6, why: "bleed and movement slow" },
    "Mine!": { support: 12, dps: 6, why: "deals damage and disarms" },
    "Lightning Breath": { dps: 6, why: "instant Nature damage" },
    "Lava Breath": { support: 12, dps: 6, why: "Fire damage and reduced casting speed" },
    "Trickster's Dance": { tank: 12, dps: 6, why: "increases Dodge and decreases time between attacks" }
  };

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function data() { return window.PETS_DATA || {}; }

  function familyById(id) {
    var fams = data().families || [];
    id = Number(id);
    for (var i = 0; i < fams.length; i++) if (fams[i].id === id) return fams[i];
    return null;
  }

  function modifiersOf(familyId) {
    var map = data().familyModifiers || {};
    var m = map[String(familyId)];
    if (m) return m;
    var fam = familyById(familyId);
    return (fam && fam.modifiers) || { damagePct: 0, armorPct: 0, healthPct: 0 };
  }

  function fmtPct(n) {
    if (n == null || n === 0) return "0%";
    return (n > 0 ? "+" : "") + n + "%";
  }

  function swingsPerMin(ms) {
    if (!ms || ms <= 0) return null;
    return 60000 / ms;
  }

  /* Forever client Faster/Slower Attack passives (build 1.60.1.71091).
     Tooltip: "Increases/Decreases attack speed by $s1%." EffectAura 9, EffectBasePointsF as listed.
     Mapped to a 2.0s baseline (2.0 / (1 + pct/100)). Only used when Classic MeleeBaseAttackTime is within 20ms of a step. */
  var FOREVER_SPEED = [
    { ms: 1000, name: "Faster Attack VII", pct: 100, id: 1263110 },
    { ms: 1200, name: "Faster Attack VI", pct: 67, id: 1263109 },
    { ms: 1300, name: "Faster Attack V", pct: 54, id: 1263107 },
    { ms: 1400, name: "Faster Attack IV", pct: 43, id: 1263104 },
    { ms: 1500, name: "Faster Attack III", pct: 33, id: 1263102 },
    { ms: 1600, name: "Faster Attack II", pct: 25, id: 1263100 },
    { ms: 1700, name: "Faster Attack I", pct: 17, id: 1263099 },
    { ms: 2000, name: null, pct: 0, id: null },
    { ms: 2400, name: "Slower Attack I", pct: -17, id: 1263111 },
    { ms: 2500, name: "Slower Attack II", pct: -20, id: 1263113 },
    { ms: 2700, name: "Slower Attack III", pct: -26, id: 1263114 }
  ];

  function foreverSpeedPassive(ms) {
    if (!ms) return null;
    var best = null, bestD = 21;
    for (var i = 0; i < FOREVER_SPEED.length; i++) {
      var d = Math.abs(FOREVER_SPEED[i].ms - ms);
      if (d < bestD) { bestD = d; best = FOREVER_SPEED[i]; }
    }
    return (best && best.name) ? best : null;
  }

  function scoreBeast(beast) {
    var mods = modifiersOf(beast.familyId);
    var fam = familyById(beast.familyId);
    var tank = (mods.armorPct || 0) + (mods.healthPct || 0);
    var dps = (mods.damagePct || 0);
    var support = 0;
    var reasons = [];
    var tags = [];

    if (mods.armorPct || mods.healthPct || mods.damagePct) {
      var bits = [];
      if (mods.damagePct) bits.push(fmtPct(mods.damagePct) + " damage");
      if (mods.armorPct) bits.push(fmtPct(mods.armorPct) + " armor");
      if (mods.healthPct) bits.push(fmtPct(mods.healthPct) + " health");
      reasons.push((fam ? fam.name : "Family") + " Tamed Pet Passive: " + bits.join(", "));
    }

    var seen = {};
    (fam && fam.specialNames || []).forEach(function (name) {
      var rule = ABILITY_ROLES[name];
      if (!rule || seen[name]) return;
      seen[name] = true;
      tank += rule.tank || 0;
      dps += rule.dps || 0;
      support += rule.support || 0;
      reasons.push(name + ": " + rule.why + " (Forever tooltip)");
    });

    var ms = beast.attackTimeMs;
    var spm = swingsPerMin(ms);
    if (spm != null) {
      var sec = (ms / 1000).toFixed(ms % 100 === 0 ? 1 : 2);
      var passive = foreverSpeedPassive(ms);
      var bit = "Classic-sourced swing " + sec + "s (" + spm.toFixed(1) + " swings/min)";
      if (passive) bit += "; matches Forever " + passive.name + " (" + (passive.pct > 0 ? "+" : "") + passive.pct + "% attack speed on a 2.0s baseline)";
      bit += ". Swing rate is real in Forever, but Blizzard has not published whether that changes white DPS in the current build — it is not counted in this damage score";
      reasons.push(bit);
    } else {
      reasons.push("No sourced attack time for this creature");
    }

    if (tank > 0) tags.push("Tank");
    if (dps > 0) tags.push("DPS");
    if (support > 0) tags.push("Support");

    return {
      tank: Math.round(tank * 10) / 10,
      dps: Math.round(dps * 10) / 10,
      support: Math.round(support * 10) / 10,
      tags: tags,
      reasons: reasons,
      attackTimeMs: ms || null,
      swingsPerMin: spm
    };
  }

  function charLevel() {
    var a = window.ForeverApp;
    var s = a && a.getState && a.getState();
    var n = s && s.character && parseInt(s.character.level, 10);
    return isNaN(n) ? 1 : Math.max(1, Math.min(60, n));
  }

  var ui = { level: null, role: "all", sort: "auto", family: "" };

  function effectiveLevel() {
    var n = parseInt(ui.level, 10);
    if (isNaN(n)) return charLevel();
    return Math.max(1, Math.min(60, n));
  }

  function listBeasts() {
    return data().tameable || [];
  }

  function filtered() {
    var level = effectiveLevel();
    var role = (ui.role || "all").toLowerCase();
    var famId = ui.family ? Number(ui.family) : null;
    var out = [];
    listBeasts().forEach(function (b) {
      if (b.minLevel > level) return;
      if (famId && b.familyId !== famId) return;
      var sc = scoreBeast(b);
      if (role !== "all" && sc.tags.indexOf(role === "dps" ? "DPS" : role.charAt(0).toUpperCase() + role.slice(1)) === -1) return;
      out.push({ beast: b, score: sc });
    });
    var sort = ui.sort === "auto"
      ? (role === "tank" ? "tank" : role === "support" ? "support" : role === "dps" ? "dps" : "dps")
      : ui.sort;
    out.sort(function (a, b) {
      if (sort === "tank") return b.score.tank - a.score.tank || (b.score.attackTimeMs || 0) - (a.score.attackTimeMs || 0) || a.beast.name.localeCompare(b.beast.name);
      if (sort === "support") return b.score.support - a.score.support || b.score.dps - a.score.dps || a.beast.name.localeCompare(b.beast.name);
      if (sort === "speed") {
        var sa = a.score.attackTimeMs || 99999, sb = b.score.attackTimeMs || 99999;
        return sa - sb || b.score.dps - a.score.dps || a.beast.name.localeCompare(b.beast.name);
      }
      if (sort === "level") return a.beast.minLevel - b.beast.minLevel || a.beast.name.localeCompare(b.beast.name);
      if (sort === "name") return a.beast.name.localeCompare(b.beast.name);
      /* dps default */
      return b.score.dps - a.score.dps || (a.score.attackTimeMs || 99999) - (b.score.attackTimeMs || 99999) || a.beast.name.localeCompare(b.beast.name);
    });
    return out;
  }

  function fmtSpeed(ms) {
    if (!ms) return "—";
    var sec = ms / 1000;
    var label = (ms % 100 === 0) ? sec.toFixed(1) + "s" : sec.toFixed(3).replace(/0+$/, "") + "s";
    return label + " <span class=\"muted\">(" + ms + " ms)</span>";
  }

  function rolePills(tags) {
    if (!tags.length) return '<span class="muted">—</span>';
    return tags.map(function (t) {
      return '<span class="pet-role pet-role-' + t.toLowerCase() + '">' + escapeHtml(t) + "</span>";
    }).join(" ");
  }

  function formulaHtml() {
    var src = data().attackSpeed || {};
    var html = '<details class="pet-rank-formula" id="petRankFormula"><summary>Scoring formula and sources</summary>';
    html += "<ol>";
    html += "<li><strong>Family body.</strong> Tank score starts at (armor % + health %). DPS score starts at damage %. These percentages are the stored EffectBasePointsF values on each family’s unique Tamed Pet Passive (DND) in the Forever client (auras 79 = damage, 142 = armor, 133 = health, identified from other Forever tooltip text). A +10 here adds 10 to that role’s score. Growl, Cower, and the shared stamina/armor ranks are available to every hunter pet and are not scored.</li>";
    html += "<li><strong>Unique family abilities.</strong> Only the family’s special ability (Furious Howl, Shell Shield, and so on) is scored, from its Forever tooltip: +12 Tank if it reduces damage the pet takes or increases Dodge; +6 Tank if it charges, roots, immobilizes, or slows movement; +12 Support if it buffs party or raid attack power, or reduces enemy attack power, armor, healing taken, or disarms / lengthens casts; +6 DPS if it deals damage, a bleed, a poison, or a first-attack bonus. One ability can add to more than one role. Dash and Dive are movement-only and are not scored. <em>Summoning</em> has no tooltip text in the client, so it adds nothing.</li>";
    html += "<li><strong>Attack speed is not added to the DPS score.</strong> Forever does not use the CMaNGOS Classic formula as a published rule for this game. In the Forever client (build 1.60.1.71091), every pet family also has spell 409365 (Tamed Pet Passive, aura text “Attack speed.”, EffectAura 319, stored points 0) and “Hunter Pet Scaling” (spell 415429), and the generic pet skill line has Faster Attack I–VII and Slower Attack I–III: tooltips “Increases/Decreases attack speed by $s1%,” EffectAura 9, points +17, +25, +33, +43, +54, +67, +100 and −17, −20, −26. On a 2.0s baseline those are about 1.7s down to 1.0s, and 2.4s / 2.5s / 2.7s. Official development notes (Nov 2, 2026) say hunter pets have innate Attack Speed passives and should not lose them when untrained. Swing times in this table are each creature’s Classic <code>MeleeBaseAttackTime</code> (CMaNGOS), labeled Classic; when that time matches one of those Forever steps, the matching passive is named. Which passive a given beast actually receives is applied by the server and is not in the client table. Blizzard has not published whether a faster swing deals more white DPS, the same DPS with smaller hits, or something else. Early beta testers measured more DPS on faster pets of the same family (before build 1.60.1.70450). Testers after that build have reported similar family DPS while swing speeds still differ. Those later tests are not official notes, so this score does not treat speed as extra (or equal) white damage.</li>";
    html += "<li><strong>Speed can still matter for Beast Mastery.</strong> Forever’s Frenzy talent (spell 19621 and ranks) gives the pet a 20/40/60/80/100% chance to gain a 30% attack speed increase for 8 sec after a critical strike. More swings mean more chances to crit and to trigger Frenzy. Go for the Throat (the TBC talent that returns Focus on pet crits) is not in Forever’s hunter talent tree. Pets in Forever do use Focus (Tamed Pet Passive aura text: “Focus regeneration increased by $s1%”).</li>";
    html += "<li><strong>Role tags.</strong> Tank, DPS, or Support is shown when that score is greater than 0. The list can be filtered to one tag and is sorted by that role’s score (or by the sort control, including faster attack first).</li>";
    html += "</ol>";
    html += "<p>CMaNGOS (GPL-3.0) <code>Pet.cpp</code> does scale per-swing damage with attack time, which would keep average white DPS the same. That is Classic emulator code, not a Forever patch note, and early Forever tests did not match it. This page no longer presents that formula as a Forever rule.</p>";
    if (src.label) html += '<p class="muted">' + escapeHtml(src.label) + "</p>";
    html += "</details>";
    return html;
  }

  function renderHtml() {
    if (ui.level == null) ui.level = charLevel();
    var level = effectiveLevel();
    var fams = data().families || [];
    var rows = filtered();
    var totalAtLevel = 0;
    listBeasts().forEach(function (b) { if (b.minLevel <= level) totalAtLevel++; });

    var html = '<section class="card pet-rank" id="petRank">';
    html += "<h3>Pet ranking</h3>";
    html += "<p>Beasts you can tame at the selected hunter level, ranked from sourced Forever family modifiers (Tamed Pet Passive) and unique family abilities (Forever tooltips). " +
      "A hunter can tame a beast only if that beast’s level is at or below the hunter’s; this list includes a creature when its <em>minimum</em> level is ≤ the filter (a level range that goes higher means some individuals may be too high). " +
      "Attack speed is shown for each beast, but it is <strong>not</strong> added to the DPS score: Blizzard has not published a Forever rule that faster pets deal more white damage, or the same damage. Spawn locations and the swing times themselves are Classic-sourced and may differ in Forever. The formula at the bottom of this section is not a sim.</p>";
    html += '<div class="pet-rank-callout" id="petRankForeverNote">';
    html += "<p><strong>Forever attack speed, as far as the sources go:</strong> pets do not all swing at 2.0 seconds. Official notes (Nov 2, 2026) say pets have innate Attack Speed passives. The Forever client has Faster Attack I–VII and Slower Attack I–III (attack speed +17% to +100%, or −17% to −26%, on a 2.0s baseline). Whether a faster swing currently deals more white DPS is <em>not</em> an official Forever rule. Player tests before build 1.60.1.70450 measured more DPS on faster pets of the same family; tests after that build have reported similar family DPS while the pets still swung at different speeds. Faster pets still land more auto-attacks, which means more crit chances and — for Beast Mastery — more chances to proc Frenzy (+30% pet attack speed for 8 sec after a crit). Go for the Throat is not in Forever’s hunter talents.</p>";
    html += "</div>";
    html += '<form class="pet-rank-filters filter-bar" id="petRankFilters" autocomplete="off">';
    html += '<label class="field">Hunter level<input type="number" id="petRankLevel" name="level" min="1" max="60" value="' + escapeHtml(level) + '"></label>';
    html += '<label class="field">Family<select id="petRankFamily"><option value="">All families</option>';
    fams.forEach(function (f) {
      html += '<option value="' + f.id + '"' + (String(ui.family) === String(f.id) ? " selected" : "") + ">" + escapeHtml(f.name) + "</option>";
    });
    html += "</select></label>";
    html += '<label class="field">Sort<select id="petRankSort">';
    [["auto", "Auto (by role tab)"], ["dps", "DPS score"], ["tank", "Tank score"], ["support", "Support score"], ["speed", "Faster attack first"], ["level", "Tame level"], ["name", "Name"]].forEach(function (o) {
      html += '<option value="' + o[0] + '"' + (ui.sort === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
    });
    html += "</select></label>";
    html += "</form>";
    html += '<div class="pet-rank-tabs" role="tablist" aria-label="Pet role">';
    [["all", "All"], ["tank", "Tank"], ["dps", "DPS"], ["support", "Support"]].forEach(function (tab) {
      html += '<button type="button" class="btn btn-sm pet-rank-tab' + (ui.role === tab[0] ? " is-active" : "") +
        '" data-rank-role="' + tab[0] + '" aria-pressed="' + (ui.role === tab[0] ? "true" : "false") + '">' + tab[1] + "</button>";
    });
    html += "</div>";
    html += '<p class="muted" id="petRankCount">Showing ' + rows.length + " of " + totalAtLevel + " tameable beasts at hunter level " + level + " (" + listBeasts().length + " sourced Classic creatures; Fox and Core Hound have no Classic tame entries).</p>";

    html += '<div class="table-wrap"><table class="pet-rank-table" id="petRankTable"><thead><tr>';
    html += "<th>#</th><th>Beast</th><th>Family</th><th>Level</th><th>Zone</th><th>Attack</th><th>Learned by taming</th><th>Role</th><th>Why</th>";
    html += "</tr></thead><tbody>";
    if (!rows.length) {
      html += '<tr><td colspan="9" class="muted">No sourced tameable beasts match this filter.</td></tr>';
    } else {
      rows.forEach(function (row, i) {
        var b = row.beast, sc = row.score;
        var fam = familyById(b.familyId);
        var lvl = b.minLevel === b.maxLevel ? String(b.minLevel) : (b.minLevel + "–" + b.maxLevel);
        var taught = (b.teaches || []).map(function (t) {
          return '<button type="button" class="pet-ab" data-pet-ability="' + t.id + '">' +
            escapeHtml(t.name) + (t.rank != null ? " R" + escapeHtml(t.rank) : "") + "</button>";
        }).join(" ");
        var mapBtn = b.hasSpawns && b.zone
          ? '<button type="button" class="btn btn-sm gf-map-btn" data-pet-map="' + b.id + '">Spawn map</button>'
          : "";
        var famBtn = fam
          ? '<button type="button" class="pet-ab pet-fam-tip" data-pet-family="' + fam.id + '">' + escapeHtml(fam.name) + "</button>"
          : "—";
        html += "<tr>";
        html += "<td data-label=\"Rank\">" + (i + 1) + "</td>";
        html += "<td data-label=\"Beast\">" + escapeHtml(b.name) + (b.elite ? ' <span class="muted">Elite</span>' : "") + "</td>";
        html += '<td data-label="Family">' + famBtn + "</td>";
        html += '<td data-label="Level">' + escapeHtml(lvl) + "</td>";
        html += '<td data-label="Zone">' + escapeHtml(b.zone || "—") + (mapBtn ? " " + mapBtn : ' <span class="muted">No spawn data</span>') + "</td>";
        html += '<td data-label="Attack speed">' + fmtSpeed(b.attackTimeMs) + "</td>";
        html += '<td data-label="Learned by taming">' + (taught || "—") + "</td>";
        html += '<td data-label="Role">' + rolePills(sc.tags) + "</td>";
        html += '<td data-label="Why"><span class="pet-rank-why">' + escapeHtml(sc.reasons.join(" · ")) + "</span></td>";
        html += "</tr>";
      });
    }
    html += "</tbody></table></div>";
    html += '<p class="muted">Family modifiers from Forever Tamed Pet Passive SpellEffect (build 1.60.1.71091). Swing times from CMaNGOS MeleeBaseAttackTime, labeled Classic — they may differ in Forever. Attack speed is not treated as extra white DPS in the score; see the formula below.</p>';
    html += formulaHtml();
    html += "</section>";
    return html;
  }

  function familyTipHtml(fam) {
    if (!fam) return "";
    var mods = fam.modifiers || modifiersOf(fam.id) || {};
    var html = '<div class="item-tt-body">';
    html += '<div class="item-tt-name">' + escapeHtml(fam.name) + "</div>";
    html += '<div class="item-tt-line">Diet: ' + escapeHtml((fam.diet || []).join(", ") || "—") + "</div>";
    if (fam.specialNames && fam.specialNames.length) {
      html += '<div class="item-tt-line">Special: ' + escapeHtml(fam.specialNames.join(", ")) + "</div>";
    }
    html += '<div class="item-tt-effect">Tamed Pet Passive: ' +
      fmtPct(mods.damagePct) + " damage, " + fmtPct(mods.armorPct) + " armor, " + fmtPct(mods.healthPct) + " health</div>";
    if (mods.spellId) {
      html += '<div class="item-tt-extra">Forever client Tamed Pet Passive (DND) spell ' + escapeHtml(mods.spellId) +
        " (build " + escapeHtml((data().meta && data().meta.build) || "") + "). Values are stored SpellEffect fields.</div>";
    }
    html += "</div>";
    return html;
  }

  function bind(root) {
    var level = document.getElementById("petRankLevel");
    if (level) level.addEventListener("change", function () {
      ui.level = level.value;
      if (window.ForeverPets) ForeverPets.render();
    });
    var fam = document.getElementById("petRankFamily");
    if (fam) fam.addEventListener("change", function () { ui.family = fam.value; if (window.ForeverPets) ForeverPets.render(); });
    var sort = document.getElementById("petRankSort");
    if (sort) sort.addEventListener("change", function () { ui.sort = sort.value; if (window.ForeverPets) ForeverPets.render(); });
    if (root) {
      root.addEventListener("click", function (e) {
        var tab = e.target.closest("[data-rank-role]");
        if (tab) {
          ui.role = tab.getAttribute("data-rank-role");
          if (window.ForeverPets) ForeverPets.render();
        }
        var famBtn = e.target.closest("[data-pet-family]");
        if (famBtn && window.ForeverPets && ForeverPets.showTip) {
          e.preventDefault();
          var f = familyById(Number(famBtn.getAttribute("data-pet-family")));
          var el = document.getElementById("petAbilityTip");
          if (!el) { ForeverPets.showTip(famBtn, { name: f && f.name, desc: "" }, true); el = document.getElementById("petAbilityTip"); }
          if (el) {
            el.innerHTML = '<button type="button" class="item-tt-close" data-pet-tip-close aria-label="Close">×</button>' + familyTipHtml(f);
            el.hidden = false;
            el.classList.add("is-pinned");
            var close = el.querySelector("[data-pet-tip-close]");
            if (close) close.addEventListener("click", function () { ForeverPets.hideTip(true); });
            /* place via showTip's placement by temporarily using a dummy, then overwrite */
          }
        }
      });
    }
  }

  window.PetRank = {
    renderHtml: renderHtml,
    bind: bind,
    scoreBeast: scoreBeast,
    filtered: filtered,
    effectiveLevel: effectiveLevel,
    ui: ui,
    ABILITY_ROLES: ABILITY_ROLES,
    familyTipHtml: familyTipHtml,
    modifiersOf: modifiersOf
  };
})();
