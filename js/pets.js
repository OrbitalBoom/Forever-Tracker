/* Forever Tracker — Hunter pets tab (WW-15). */
(function () {
  "use strict";

  function data() { return window.PETS_DATA || null; }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function app() { return window.ForeverApp; }

  function state() {
    var a = app();
    return a && a.getState ? a.getState() : null;
  }

  function hunterPet() {
    var s = state();
    if (!s) return { name: "", familyId: null, level: null };
    if (!s.hunterPet) s.hunterPet = { name: "", familyId: null, level: null };
    return s.hunterPet;
  }

  function savePet(patch) {
    var s = state();
    if (!s) return;
    if (!s.hunterPet) s.hunterPet = { name: "", familyId: null, level: null };
    if (patch.name != null) s.hunterPet.name = String(patch.name).slice(0, 24);
    if (patch.familyId !== undefined) s.hunterPet.familyId = patch.familyId;
    if (patch.level !== undefined) s.hunterPet.level = patch.level;
    if (app() && app().save) app().save();
  }

  function familyById(id) {
    var d = data();
    if (!d) return null;
    id = Number(id);
    for (var i = 0; i < d.families.length; i++) {
      if (d.families[i].id === id) return d.families[i];
    }
    return null;
  }

  function charLevel() {
    var s = state();
    var c = s && s.character;
    var n = c && parseInt(c.level, 10);
    return isNaN(n) ? 1 : n;
  }

  function fmtLevel(n) { return n == null ? "—" : String(n); }
  function fmtTp(n) { return n == null ? "—" : String(n); }

  function abilityTipHtml(ab, extra) {
    if (!ab) return "";
    var html = '<div class="item-tt-body">';
    html += '<div class="item-tt-name">' + escapeHtml(ab.name) + "</div>";
    if (ab.rank != null) html += '<div class="item-tt-line">Rank ' + escapeHtml(ab.rank) + "</div>";
    else if (ab.subtext) html += '<div class="item-tt-line">' + escapeHtml(ab.subtext) + "</div>";
    if (ab.level != null) html += '<div class="item-tt-req">Requires pet level ' + escapeHtml(ab.level) + "</div>";
    if (ab.trainingPoints != null) {
      html += '<div class="item-tt-line">Training points: ' + (ab.trainingPoints === 0 ? "Free" : escapeHtml(ab.trainingPoints)) + "</div>";
    }
    if (ab.desc) html += '<div class="item-tt-effect">' + escapeHtml(ab.desc) + "</div>";
    if (ab.aura) html += '<div class="item-tt-effect">' + escapeHtml(ab.aura) + "</div>";
    if (!ab.desc && !ab.aura) {
      html += '<div class="item-tt-extra">No tooltip text in the Forever client for this spell.</div>';
    } else if (ab.tokensResolved === false) {
      html += '<div class="item-tt-extra">Some tooltip tokens could not be filled from SpellEffect / SpellDuration; leftover $ tokens are shown as they appear in the client. Numbers are not invented.</div>';
    }
    var build = (data() && data().meta && data().meta.build) || "";
    html += '<div class="item-tt-extra">Forever client Spell ' + escapeHtml(ab.id) + (build ? " (build " + escapeHtml(build) + ")" : "") + ". Rank, required level, and training-point cost come from SkillLineAbility and SpellLevels.</div>";
    if (extra) html += '<div class="item-tt-extra">' + extra + "</div>";
    html += "</div>";
    return html;
  }

  var tipEl = null;
  var tipPinned = false;
  var tipTimer = null;
  var lastPointer = "mouse";

  function ensureTip() {
    if (tipEl) return tipEl;
    tipEl = document.getElementById("petAbilityTip");
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.id = "petAbilityTip";
      tipEl.className = "item-tt pet-ability-tt";
      tipEl.hidden = true;
      tipEl.setAttribute("role", "tooltip");
      document.body.appendChild(tipEl);
    }
    document.addEventListener("pointerdown", function (e) {
      lastPointer = e.pointerType || "mouse";
    }, true);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hideTip(true);
    });
    return tipEl;
  }

  function useSheet() {
    var narrow = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
    var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    return lastPointer === "touch" || (narrow && coarse);
  }

  function placeTip(anchor) {
    var el = ensureTip();
    if (el.classList.contains("is-touch-sheet")) return;
    var r = anchor.getBoundingClientRect();
    var tw = el.offsetWidth || 280;
    var th = el.offsetHeight || 120;
    var x = r.right + 12;
    var y = r.top;
    if (x + tw > window.innerWidth - 8) x = r.left - tw - 12;
    if (x < 8) x = 8;
    if (y + th > window.innerHeight - 8) y = Math.max(8, window.innerHeight - th - 8);
    if (y < 8) y = 8;
    el.style.left = x + "px";
    el.style.top = y + "px";
  }

  function showTip(anchor, ab, pin) {
    var el = ensureTip();
    el.innerHTML = '<button type="button" class="item-tt-close" data-pet-tip-close aria-label="Close">×</button>' + abilityTipHtml(ab);
    el.hidden = false;
    tipPinned = !!pin;
    el.classList.toggle("is-pinned", tipPinned);
    var sheet = tipPinned && useSheet();
    el.classList.toggle("is-touch-sheet", sheet);
    if (sheet) {
      el.style.left = "";
      el.style.top = "";
    } else {
      placeTip(anchor);
    }
    var close = el.querySelector("[data-pet-tip-close]");
    if (close) close.addEventListener("click", function () { hideTip(true); });
  }

  function hideTip(force) {
    if (!force && tipPinned) return;
    var el = ensureTip();
    el.hidden = true;
    tipPinned = false;
    el.classList.remove("is-pinned", "is-touch-sheet");
  }

  function bindAbilityTips(root) {
    if (!root) return;
    root.addEventListener("pointerenter", function (e) {
      var a = e.target.closest("[data-pet-ability]");
      if (!a || !root.contains(a)) return;
      if ((e.pointerType || lastPointer) === "touch") return;
      var ab = findAbility(Number(a.getAttribute("data-pet-ability")));
      if (!ab) return;
      showTip(a, ab, false);
    }, true);
    root.addEventListener("pointerleave", function (e) {
      var a = e.target.closest("[data-pet-ability]");
      if (!a) return;
      if (tipPinned) return;
      clearTimeout(tipTimer);
      tipTimer = setTimeout(function () { hideTip(false); }, 200);
    }, true);
    root.addEventListener("click", function (e) {
      var a = e.target.closest("[data-pet-ability]");
      if (!a || !root.contains(a)) return;
      e.preventDefault();
      var ab = findAbility(Number(a.getAttribute("data-pet-ability")));
      if (!ab) return;
      showTip(a, ab, true);
    });
    var el = ensureTip();
    el.addEventListener("pointerenter", function () { clearTimeout(tipTimer); });
    el.addEventListener("pointerleave", function () {
      if (!tipPinned) hideTip(false);
    });
  }

  function findAbility(id) {
    var d = data();
    if (!d) return null;
    var i, a;
    for (i = 0; i < (d.sharedAbilities || []).length; i++) {
      if (d.sharedAbilities[i].id === id) return d.sharedAbilities[i];
    }
    for (i = 0; i < (d.families || []).length; i++) {
      var abs = d.families[i].abilities || [];
      for (var j = 0; j < abs.length; j++) {
        if (abs[j].id === id) return abs[j];
      }
    }
    return null;
  }

  function abilityChip(ab) {
    if (!ab) return "";
    var label = escapeHtml(ab.name);
    if (ab.rank != null) label += " R" + escapeHtml(ab.rank);
    return '<button type="button" class="pet-ab" data-pet-ability="' + ab.id + '">' + label + "</button>";
  }

  function abilityRow(ab) {
    return "<tr>" +
      "<td>" + abilityChip(ab) + "</td>" +
      "<td>" + (ab.rank != null ? "Rank " + escapeHtml(ab.rank) : "—") + "</td>" +
      "<td>" + fmtLevel(ab.level) + "</td>" +
      "<td>" + (ab.trainingPoints === 0 ? "Free" : fmtTp(ab.trainingPoints)) + "</td>" +
      "</tr>";
  }

  function groupAbilities(list) {
    var by = {};
    var order = [];
    (list || []).forEach(function (ab) {
      if (!by[ab.name]) { by[ab.name] = []; order.push(ab.name); }
      by[ab.name].push(ab);
    });
    return { by: by, order: order };
  }

  function abilitiesTable(list) {
    var html = '<div class="table-wrap"><table class="pet-ab-table"><thead><tr>' +
      "<th>Ability</th><th>Rank</th><th>Pet level</th><th>Training points</th>" +
      "</tr></thead><tbody>";
    var g = groupAbilities(list);
    g.order.forEach(function (name) {
      g.by[name].forEach(function (ab) { html += abilityRow(ab); });
    });
    html += "</tbody></table></div>";
    return html;
  }

  function renderCurrentPet(d) {
    var pet = hunterPet();
    var html = '<section class="card pet-current" id="petCurrentCard">';
    html += "<h3>Current pet</h3>";
    html += '<p class="muted">Saved in this browser and included in cloud save. Family, name, and level only — stats are not invented.</p>';
    html += '<form id="petCurrentForm" class="form-grid" autocomplete="off">';
    html += '<label class="field">Name<input type="text" name="name" maxlength="24" placeholder="Pet name" value="' + escapeHtml(pet.name || "") + '"></label>';
    html += '<label class="field">Family<select name="family">';
    html += '<option value="">—</option>';
    (d.families || []).forEach(function (f) {
      html += '<option value="' + f.id + '"' + (Number(pet.familyId) === f.id ? " selected" : "") + ">" + escapeHtml(f.name) + "</option>";
    });
    html += "</select></label>";
    html += '<label class="field">Level<input type="number" name="level" min="1" max="60" placeholder="—" value="' + (pet.level != null ? escapeHtml(pet.level) : "") + '"></label>';
    html += "</form></section>";
    return html;
  }

  function renderTalentsNotice(d) {
    var html = '<section class="card pet-talents-note" id="petTalentsNote">';
    html += "<h3>Pet talents</h3>";
    if (d.meta && d.meta.hasPetTalents) {
      html += "<p>This Forever client build lists pet talent tabs. A planner would go here — but the data flag is unexpected; check TalentTab.</p>";
    } else {
      html += "<p><strong>Forever has no pet talent trees</strong> in client build " +
        escapeHtml((d.meta && d.meta.build) || "") +
        ". TalentTab in this build contains only the nine class trees (Beast Mastery, Marksmanship, and Survival for hunters). Vanilla 1.12 also had none — pets used training points and loyalty instead.</p>";
      html += "<p>Training-point costs and required levels below come from the Forever client (SkillLineAbility and SpellLevels). There is no training-point pool formula in the Forever tables we have, so a “points remaining” number is not shown.</p>";
    }
    html += "</section>";
    return html;
  }

  function renderLoyalty(d) {
    var html = '<section class="card" id="petLoyalty">';
    html += "<h3>Loyalty</h3>";
    html += '<p class="muted">Ranks and point thresholds from the Forever client PetLoyalty table (build ' +
      escapeHtml((d.meta && d.meta.build) || "") + ").</p>";
    html += '<div class="table-wrap"><table class="pet-loyalty-table"><thead><tr><th>Rank</th><th>Name</th><th>Points</th></tr></thead><tbody>';
    (d.loyalty || []).forEach(function (r) {
      if (r.unused) return;
      html += "<tr><td>" + escapeHtml(r.id) + "</td><td>" + escapeHtml(r.name) + "</td><td>" + escapeHtml(r.points) + "</td></tr>";
    });
    html += "</tbody></table></div>";
    var unused = (d.loyalty || []).filter(function (r) { return r.unused; });
    if (unused.length) {
      html += '<p class="muted">The client also lists ' +
        unused.map(function (r) { return escapeHtml(r.rawName) + " (" + escapeHtml(r.points) + ")"; }).join("; ") +
        " — these look unused and are not shown as obtainable ranks.</p>";
    }
    html += "</section>";
    return html;
  }

  function renderFamilies(d, filterText, openId) {
    var q = (filterText || "").trim().toLowerCase();
    var html = '<section class="card" id="petFamilies">';
    html += "<h3>Pet families</h3>";
    html += '<p class="muted">Diet, the family’s unique ability, and every ability that family can learn, with rank, required pet level, and training-point cost. From the Forever client CreatureFamily, ItemPetFood, and SkillLineAbility tables.</p>';
    html += '<label class="field pet-filter">Search families or abilities<input type="search" id="petFamilyFilter" placeholder="Wolf, Furious Howl…" value="' + escapeHtml(filterText || "") + '"></label>';
    var fams = d.families || [];
    fams.forEach(function (f) {
      if (q) {
        var hay = (f.name + " " + (f.diet || []).join(" ") + " " + (f.specialNames || []).join(" ") + " " +
          (f.abilities || []).map(function (a) { return a.name; }).join(" ")).toLowerCase();
        if (hay.indexOf(q) === -1) return;
      }
      var open = String(f.id) === String(openId);
      html += '<details class="pet-family"' + (open ? " open" : "") + ' data-family-id="' + f.id + '">';
      html += "<summary>";
      html += '<span class="pet-family-name">' + escapeHtml(f.name) + "</span>";
      html += '<span class="pet-family-diet">' + escapeHtml((f.diet || []).join(", ") || "—") + "</span>";
      html += '<span class="pet-family-special">' + (f.specialNames && f.specialNames.length ? escapeHtml(f.specialNames.join(", ")) : "—") + "</span>";
      html += "</summary>";
      if (!f.classicFamily) {
        html += '<p class="muted">This family is in the Forever client CreatureFamily table; it does not appear in Classic 1.12 hunter family data. No sourced Classic tame locations are listed.</p>';
      }
      if (f.specialNames && f.specialNames.length) {
        html += '<p>Special family ability: <strong>' + escapeHtml(f.specialNames.join(", ")) + "</strong></p>";
      }
      html += abilitiesTable(f.abilities);
      html += "</details>";
    });
    html += '<h4 style="margin-top:18px">Shared pet abilities</h4>';
    html += '<p class="muted">From the generic “Pet - Generic” skill line (SkillLine 270): Growl, Cower, Great Stamina, Natural Armor, and the other trainable ranks every hunter pet can learn. Bite, Claw, Dash, and Dive are on each family’s own skill line instead.</p>';
    html += abilitiesTable(d.sharedAbilities);
    html += "</section>";
    return html;
  }

  function tameRow(n, famName) {
    var lvl = n.minLevel === n.maxLevel ? String(n.minLevel) : (n.minLevel + "–" + n.maxLevel);
    var taught = (n.teaches || []).map(function (t) {
      var ab = findAbility(t.id) || t;
      return abilityChip(ab);
    }).join(" ");
    var mapBtn = n.hasSpawns && n.zone
      ? '<button type="button" class="btn btn-sm gf-map-btn" data-pet-map="' + n.id + '">Spawn map</button>'
      : '<span class="muted">No spawn data</span>';
    return "<tr>" +
      "<td>" + escapeHtml(n.name) + (n.elite ? ' <span class="muted">Elite</span>' : "") + "</td>" +
      '<td data-label="Zone">' + escapeHtml(n.zone || "—") + "</td>" +
      '<td data-label="Level">' + escapeHtml(lvl) + "</td>" +
      '<td data-label="Family">' + escapeHtml(famName || "—") + "</td>" +
      '<td data-label="Learned by taming">' + (taught || "—") + "</td>" +
      '<td data-label="Map">' + mapBtn + "</td>" +
      "</tr>";
  }

  function renderTames(d, opts) {
    opts = opts || {};
    var html = '<section class="card" id="petTames">';
    html += "<h3>Where to tame</h3>";
    html += '<p class="source-note">Notable tameable beasts that already know a hunter pet ability, so you learn that rank by taming them. ' +
      "Creature level, family, and tameable flag are from CMaNGOS classic-db; the taught spells are from Classic CreatureSpellData (1.13.7.38704) via each creature’s PetSpellDataId. " +
      "Spawn points and zone names are from NorgannonDB 1.9 (GPL-3.0). <strong>From Classic data, may differ in Forever.</strong> " +
      "Each ability rank lists the lowest-level sourced teacher (and a couple of alternates when the lowest has no zone). " +
      "Forever-only families (Fox, Core Hound) have no sourced Classic tame locations.</p>";
    html += '<div class="filter-bar pet-tame-filters">';
    html += '<label class="field">Family<select id="petTameFamily">';
    html += '<option value="">All families</option>';
    (d.families || []).forEach(function (f) {
      html += '<option value="' + f.id + '"' + (String(opts.familyId) === String(f.id) ? " selected" : "") + ">" + escapeHtml(f.name) + "</option>";
    });
    html += "</select></label>";
    html += '<label class="field check"><input type="checkbox" id="petTameAtLevel"' + (opts.atLevel ? " checked" : "") + "> Tameable at my level (" + escapeHtml(charLevel()) + ")</label>";
    html += "</div>";
    var list = d.notable || [];
    var famId = opts.familyId ? Number(opts.familyId) : null;
    var at = !!opts.atLevel;
    var hl = charLevel();
    var rows = list.filter(function (n) {
      if (famId && n.familyId !== famId) return false;
      if (at && n.minLevel > hl) return false;
      return true;
    });
    html += '<div class="table-wrap"><table class="pet-tame-table" id="petTameTable"><thead><tr>' +
      "<th>Beast</th><th>Zone</th><th>Level</th><th>Family</th><th>Learned by taming</th><th></th>" +
      "</tr></thead><tbody>";
    if (!rows.length) {
      html += '<tr><td colspan="6" class="muted">No sourced beasts match this filter.</td></tr>';
    } else {
      rows.forEach(function (n) {
        var fam = familyById(n.familyId);
        html += tameRow(n, fam && fam.name);
      });
    }
    html += "</tbody></table></div>";
    html += '<p class="muted">' + rows.length + " of " + list.length + " sourced notable beasts.</p>";
    html += "</section>";
    return html;
  }

  function sourcesFooter(d) {
    var html = '<p class="muted pet-sources">Sources: ';
    var bits = [];
    (d.meta && d.meta.sources || []).forEach(function (s) {
      bits.push(escapeHtml(s.name) + (s.build ? " " + escapeHtml(s.build) : "") + (s.license ? " (" + escapeHtml(s.license) + ")" : ""));
    });
    html += bits.join("; ") + ".</p>";
    return html;
  }

  var ui = { familyFilter: "", tameFamily: "", tameAtLevel: false, openFamily: null };

  function render() {
    var root = document.getElementById("petsRoot");
    if (!root) return;
    var d = data();
    if (!d) {
      root.innerHTML = '<p class="muted">Pet data failed to load.</p>';
      return;
    }
    var html = "";
    html += renderCurrentPet(d);
    html += renderTalentsNotice(d);
    html += renderLoyalty(d);
    html += renderFamilies(d, ui.familyFilter, ui.openFamily);
    html += renderTames(d, { familyId: ui.tameFamily, atLevel: ui.tameAtLevel });
    html += sourcesFooter(d);
    root.innerHTML = html;
    bind(root);
  }

  function bind(root) {
    bindAbilityTips(root);
    var form = document.getElementById("petCurrentForm");
    if (form) {
      form.addEventListener("input", function (e) {
        var t = e.target;
        if (t.name === "name") savePet({ name: t.value });
        if (t.name === "family") {
          var v = t.value === "" ? null : parseInt(t.value, 10);
          savePet({ familyId: isNaN(v) ? null : v });
        }
        if (t.name === "level") {
          if (t.value === "") { savePet({ level: null }); return; }
          var n = parseInt(t.value, 10);
          if (!isNaN(n) && n >= 1 && n <= 60) savePet({ level: n });
        }
      });
    }
    var filt = document.getElementById("petFamilyFilter");
    if (filt) {
      filt.addEventListener("input", function () {
        ui.familyFilter = filt.value;
      });
      filt.addEventListener("change", function () {
        ui.familyFilter = filt.value;
        var open = root.querySelector("details.pet-family[open]");
        ui.openFamily = open ? open.getAttribute("data-family-id") : null;
        render();
        var again = document.getElementById("petFamilyFilter");
        if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
      });
    }
    root.addEventListener("toggle", function (e) {
      var det = e.target.closest("details.pet-family");
      if (det && det.open) ui.openFamily = det.getAttribute("data-family-id");
    }, true);
    var tf = document.getElementById("petTameFamily");
    if (tf) tf.addEventListener("change", function () { ui.tameFamily = tf.value; render(); });
    var at = document.getElementById("petTameAtLevel");
    if (at) at.addEventListener("change", function () { ui.tameAtLevel = at.checked; render(); });
    root.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-pet-map]");
      if (!btn) return;
      openTameMap(Number(btn.getAttribute("data-pet-map")));
    });
  }

  function notableById(id) {
    var d = data();
    if (!d) return null;
    for (var i = 0; i < (d.notable || []).length; i++) {
      if (d.notable[i].id === id) return d.notable[i];
    }
    return null;
  }

  function openTameMap(id) {
    var n = notableById(id);
    if (!n || !window.GoldFarms || !GoldFarms.openCustomMap) return;
    var title = n.name + (n.zone ? " — " + n.zone : "");
    GoldFarms.openCustomMap({
      title: title,
      name: n.name,
      zone: n.zone || "",
      mapSize: n.mapSize || null,
      mobs: [{ id: n.id, name: n.name, points: n.points || [] }]
    });
  }

  window.ForeverPets = {
    render: render,
    findAbility: findAbility,
    showTip: showTip,
    hideTip: hideTip,
    abilityTipHtml: abilityTipHtml,
    openTameMap: openTameMap
  };
})();
