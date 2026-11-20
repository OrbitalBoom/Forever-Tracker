/* Gold Farming section. Reads window.GOLD_FARMS and the same PRICE_DATA
 * feed as the Profession guide. Does not invent drop rates or gold/hour. */
(function () {
  var TYPE_LABEL = {
    mob: "Mob grind",
    gathering: "Gathering route",
    cloth: "Cloth farm",
    instance: "Instance farm",
    craft: "Craft / AH"
  };
  var CLASS_OPTS = ["Warrior", "Paladin", "Hunter", "Rogue", "Priest", "Shaman", "Mage", "Warlock", "Druid"];
  var PROF_OPTS = ["Skinning", "Herbalism", "Mining", "Fishing", "Cooking", "Tailoring", "First Aid", "Alchemy", "Enchanting", "Leatherworking", "Blacksmithing", "Engineering"];
  var bound = false;
  var helpers = {};

  function escapeHtml(s) {
    if (helpers.escapeHtml) return helpers.escapeHtml(s);
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function goldText(copper) {
    var n = Math.round(Number(copper) || 0);
    var sign = n < 0 ? "-" : "";
    n = Math.abs(n);
    var g = Math.floor(n / 10000), s = Math.floor((n % 10000) / 100), c = n % 100;
    if (g) return sign + g + "g " + s + "s " + c + "c";
    if (s) return sign + s + "s " + c + "c";
    return sign + c + "c";
  }
  function formatGold(copper) { return goldText(copper); }
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
      slack: 5,
      classFilter: "mine",
      profFilter: "all",
      typeFilter: "all",
      factionFilter: "mine",
      favsOnly: false,
      sort: "live"
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
    p.slack = Math.max(0, Math.min(20, parseInt(p.slack, 10) || 0));
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
    return isNaN(n) ? 1 : n;
  }
  function charProfs() {
    return (state().professions || []).map(function (p) { return p.name; }).filter(Boolean);
  }
  function isFav(id) {
    return (state().goldFarmFavs || []).indexOf(id) !== -1;
  }

  function priceOf(id) {
    var items = window.PRICE_DATA && window.PRICE_DATA.items;
    var p = items && items[id];
    return p && p.marketValue ? p : null;
  }

  function liveOf(spot) {
    var loot = spot.loot || [];
    var priced = [];
    var expected = 0;
    var used = 0;
    var unpriced = 0;
    loot.forEach(function (l) {
      var p = l.id ? priceOf(l.id) : null;
      var qty = l.qty != null ? l.qty : 1;
      if (p) {
        priced.push({ id: l.id, name: l.name, marketValue: p.marketValue, chance: l.chance, qty: qty });
        if (l.chance != null) {
          expected += p.marketValue * l.chance * qty;
          used++;
        }
      } else if (l.id) {
        unpriced++;
      }
    });
    var kph = spot.sourced && spot.sourced.killsPerHour;
    return {
      perKill: used ? Math.round(expected) : null,
      perHour: used && kph ? Math.round(expected * kph) : null,
      priced: priced,
      used: used,
      unpriced: unpriced,
      kph: kph || null
    };
  }

  function sourcedHourly(spot) {
    var s = spot.sourced || {};
    if (s.goldPerHour != null) return s.goldPerHour;
    if (s.perKill != null && s.killsPerHour) return Math.round(s.perKill * s.killsPerHour);
    return null;
  }
  function liveSortKey(spot) {
    var lv = liveOf(spot);
    if (lv.perHour != null) return lv.perHour;
    if (lv.perKill != null) return lv.perKill;
    return -1;
  }
  function sourcedSortKey(spot) {
    var h = sourcedHourly(spot);
    if (h != null) return h;
    if (spot.sourced && spot.sourced.perKill != null) return spot.sourced.perKill;
    return -1;
  }

  function factionOk(spot, p) {
    if (p.factionFilter === "all") return true;
    var want = p.factionFilter === "mine" ? charFaction() : p.factionFilter;
    var f = (spot.faction || "both").toLowerCase();
    return f === "both" || f === want;
  }
  function classOk(spot, p) {
    if (p.classFilter === "all") return true;
    var cls = p.classFilter === "mine" ? charClass() : p.classFilter;
    var list = spot.classes || ["any"];
    if (list.indexOf("any") !== -1) return true;
    return list.indexOf(cls) !== -1;
  }
  function profOk(spot, p) {
    if (p.profFilter === "all") return true;
    var req = spot.professions || [];
    var bonus = spot.bonusProfs || [];
    var all = req.concat(bonus);
    if (p.profFilter === "mine") {
      if (!req.length) return true;
      var mine = charProfs();
      return req.every(function (name) { return mine.indexOf(name) !== -1; });
    }
    return all.indexOf(p.profFilter) !== -1 || (!req.length && !bonus.length && p.profFilter === "none");
  }
  function levelOk(spot, p) {
    if (!p.followLevel) return true;
    var L = charLevel();
    var slack = p.slack;
    return spot.levelMin <= L + slack && spot.levelMax >= L - slack;
  }

  function filtered() {
    var p = prefs();
    var farms = (window.GOLD_FARMS || []).slice();
    var out = farms.filter(function (spot) {
      if (p.favsOnly && !isFav(spot.id)) return false;
      if (!levelOk(spot, p)) return false;
      if (!factionOk(spot, p)) return false;
      if (!classOk(spot, p)) return false;
      if (!profOk(spot, p)) return false;
      if (p.typeFilter !== "all" && spot.type !== p.typeFilter) return false;
      return true;
    });
    out.sort(function (a, b) {
      var fa = isFav(a.id) ? 1 : 0, fb = isFav(b.id) ? 1 : 0;
      if (p.sort !== "name" && fb !== fa) return fb - fa;
      var cmp = 0;
      if (p.sort === "level") cmp = a.levelMin - b.levelMin || a.levelMax - b.levelMax || a.name.localeCompare(b.name);
      else if (p.sort === "sourced") cmp = sourcedSortKey(b) - sourcedSortKey(a) || a.levelMin - b.levelMin;
      else if (p.sort === "name") cmp = a.name.localeCompare(b.name);
      else cmp = liveSortKey(b) - liveSortKey(a) || sourcedSortKey(b) - sourcedSortKey(a) || a.levelMin - b.levelMin;
      return cmp;
    });
    return out;
  }

  function priceStamp() {
    var d = window.PRICE_DATA || {};
    if (!d.updated) return "US Normal Horde auction snapshot";
    return "US Normal Horde AH, " + d.updated.replace("T", " ").replace("Z", " UTC") +
      (d.source ? " (" + d.source.split(",")[0] + ")" : "");
  }

  function optionList(pairs, selected) {
    return pairs.map(function (pair) {
      var val = pair[0], label = pair[1];
      return '<option value="' + escapeHtml(val) + '"' + (String(selected) === String(val) ? " selected" : "") + ">" +
        escapeHtml(label) + "</option>";
    }).join("");
  }

  function ensureShell(root) {
    if (root.dataset.ready) return;
    var meta = window.GOLD_FARMS_META || {};
    root.innerHTML =
      '<p class="muted" id="goldFarmDisclaimer">' + escapeHtml(meta.disclaimer ||
        "Sourced figures are snapshots. Live values use this site's auction prices and only the drop rates a source listed.") +
      " " + escapeHtml(priceStamp()) + ".</p>" +
      '<div class="filter-bar gf-filters" id="goldFarmFilters"></div>' +
      '<p class="muted" id="goldFarmCount"></p>' +
      '<div class="card-grid" id="goldFarmList"></div>';
    root.dataset.ready = "1";
    bind(root);
  }

  function renderFilters() {
    var box = document.getElementById("goldFarmFilters");
    if (!box) return;
    var p = prefs();
    var L = charLevel();
    var classPairs = [["mine", "My class (" + (charClass() || "not set") + ")"], ["all", "All classes"]]
      .concat(CLASS_OPTS.map(function (c) { return [c, c]; }));
    var profPairs = [["all", "Any profession"], ["mine", "My professions"]]
      .concat(PROF_OPTS.map(function (n) { return [n, n]; }));
    var typePairs = [["all", "All types"]].concat(Object.keys(TYPE_LABEL).map(function (k) { return [k, TYPE_LABEL[k]]; }));
    var facPairs = [
      ["mine", "My faction (" + (charFaction() || "?") + ")"],
      ["all", "All factions"],
      ["horde", "Horde"],
      ["alliance", "Alliance"]
    ];
    var sortPairs = [
      ["live", "Live value"],
      ["sourced", "Sourced gold/hr"],
      ["level", "Level"],
      ["name", "Name"]
    ];
    box.innerHTML =
      '<label class="gf-check"><input type="checkbox" id="gfFollowLevel"' + (p.followLevel ? " checked" : "") +
        '> Around my level (Lv ' + L + ')</label>' +
      '<label class="field gf-inline">± <input type="number" id="gfSlack" min="0" max="20" step="1" value="' +
        p.slack + '"' + (p.followLevel ? "" : " disabled") + '> levels</label>' +
      '<label class="field gf-inline">Class <select id="gfClass">' + optionList(classPairs, p.classFilter) + "</select></label>" +
      '<label class="field gf-inline">Profession <select id="gfProf">' + optionList(profPairs, p.profFilter) + "</select></label>" +
      '<label class="field gf-inline">Type <select id="gfType">' + optionList(typePairs, p.typeFilter) + "</select></label>" +
      '<label class="field gf-inline">Faction <select id="gfFaction">' + optionList(facPairs, p.factionFilter) + "</select></label>" +
      '<label class="field gf-inline">Sort <select id="gfSort">' + optionList(sortPairs, p.sort) + "</select></label>" +
      '<label class="gf-check"><input type="checkbox" id="gfFavsOnly"' + (p.favsOnly ? " checked" : "") + "> Favorites only</label>";
  }

  function bind(root) {
    if (bound) return;
    bound = true;
    root.addEventListener("change", function (e) {
      var t = e.target;
      if (!t) return;
      var p = prefs();
      if (t.id === "gfFollowLevel") p.followLevel = !!t.checked;
      else if (t.id === "gfSlack") p.slack = Math.max(0, Math.min(20, parseInt(t.value, 10) || 0));
      else if (t.id === "gfClass") p.classFilter = t.value;
      else if (t.id === "gfProf") p.profFilter = t.value;
      else if (t.id === "gfType") p.typeFilter = t.value;
      else if (t.id === "gfFaction") p.factionFilter = t.value;
      else if (t.id === "gfSort") p.sort = t.value;
      else if (t.id === "gfFavsOnly") p.favsOnly = !!t.checked;
      else if (t.getAttribute("data-gf-fav")) {
        toggleFav(t.getAttribute("data-gf-fav"), t.checked);
        persist();
        renderList();
        return;
      } else {
        return;
      }
      persist();
      if (t.id === "gfFollowLevel" || t.id === "gfSlack") renderFilters();
      renderList();
    });
  }

  function toggleFav(id, on) {
    var st = state();
    if (!Array.isArray(st.goldFarmFavs)) st.goldFarmFavs = [];
    var i = st.goldFarmFavs.indexOf(id);
    if (on && i === -1) st.goldFarmFavs.push(id);
    if (!on && i !== -1) st.goldFarmFavs.splice(i, 1);
  }

  function lootHtml(spot, live) {
    var loot = spot.loot || [];
    if (!loot.length) return '<p class="muted">No priced loot list — see the source notes.</p>';
    var rows = loot.map(function (l) {
      var p = l.id ? priceOf(l.id) : null;
      var bits = [];
      if (l.chance != null) bits.push(Math.round(l.chance * 1000) / 10 + "%");
      if (l.qty && l.qty !== 1) bits.push("×" + l.qty);
      if (p) bits.push("AH " + formatGold(p.marketValue));
      else if (l.id) bits.push("no AH price in this snapshot");
      return "<li><span>" + escapeHtml(l.name) + "</span>" +
        (bits.length ? ' <span class="muted">(' + escapeHtml(bits.join(" · ")) + ")</span>" : "") + "</li>";
    });
    return "<ul class=\"gf-loot\">" + rows.join("") + "</ul>";
  }

  function valueBlock(spot, live) {
    var parts = [];
    if (live.perHour != null) {
      parts.push('<div class="gf-live"><span class="kicker">Live value</span><strong>' +
        formatGoldHtml(live.perHour) + "/hr</strong>" +
        '<div class="muted">Computed from this site\'s ' + escapeHtml(priceStamp()) +
        " × the listed drop rates, at the source\'s " + live.kph + " kills/hour assumption.</div></div>");
    } else if (live.perKill != null) {
      parts.push('<div class="gf-live"><span class="kicker">Live value</span><strong>' +
        formatGoldHtml(live.perKill) + "/kill</strong>" +
        '<div class="muted">Computed from this site\'s ' + escapeHtml(priceStamp()) +
        " × the listed drop rates. No kills/hour figure was published for this camp, so this is per kill, not per hour.</div></div>");
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
    if (s.goldPerHour != null) srcBits.push("about " + formatGold(s.goldPerHour) + "/hr");
    if (s.perKill != null) srcBits.push(formatGold(s.perKill) + "/kill");
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

  function cardHtml(spot) {
    var live = liveOf(spot);
    var tag = spot.tag === "forever"
      ? '<span class="badge gf-tag-forever">Forever-confirmed</span>'
      : '<span class="badge gf-tag-classic">Classic-era, likely applies</span>';
    var type = '<span class="badge">' + escapeHtml(TYPE_LABEL[spot.type] || spot.type) + "</span>";
    var fav = isFav(spot.id);
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
    return '<article class="card gf-card' + (fav ? " is-fav" : "") + '" data-farm="' + escapeHtml(spot.id) + '">' +
      '<div class="goal-head"><h4>' + escapeHtml(spot.name) + "</h4>" +
      '<label class="gf-star"><input type="checkbox" data-gf-fav="' + escapeHtml(spot.id) + '"' +
        (fav ? " checked" : "") + '> Favorite</label></div>' +
      '<div class="gf-tags">' + tag + type + "</div>" +
      '<div class="muted">' + escapeHtml(spot.zone) +
        (spot.loc ? " — " + escapeHtml(spot.loc) : "") + "</div>" +
      '<div class="gf-meta">Lv ' + spot.levelMin + "–" + spot.levelMax +
        (spot.mobLevel ? " · mobs " + escapeHtml(spot.mobLevel) : "") +
        " · " + escapeHtml(facLabel) +
        " · " + escapeHtml(classes) +
        " · " + escapeHtml(profLine) + "</div>" +
      (spot.factionNote ? '<div class="muted">' + escapeHtml(spot.factionNote) + "</div>" : "") +
      lootHtml(spot, live) +
      valueBlock(spot, live) +
      (spot.risk ? '<div class="gf-risk"><span class="kicker">Risk</span> ' + escapeHtml(spot.risk) + "</div>" : "") +
      (sources ? '<ul class="gf-sources">' + sources + "</ul>" : "") +
      "</article>";
  }

  function renderList() {
    var list = document.getElementById("goldFarmList");
    var count = document.getElementById("goldFarmCount");
    if (!list) return;
    var p = prefs();
    var rows = filtered();
    var total = (window.GOLD_FARMS || []).length;
    var L = charLevel();
    var windowTxt = p.followLevel
      ? ("level window " + Math.max(1, L - p.slack) + "–" + (L + p.slack) + " (character Lv " + L + ", ±" + p.slack + ")")
      : "all levels";
    if (count) {
      count.textContent = rows.length + " of " + total + " spots in the " + windowTxt +
        (p.favsOnly ? ", favorites only" : "") + ".";
    }
    if (!rows.length) {
      list.innerHTML = '<p class="muted">No spots match these filters. Widen the level window or clear a filter.</p>';
      return;
    }
    list.innerHTML = rows.map(cardHtml).join("");
  }

  function render(st, opts) {
    helpers = opts || {};
    if (st) helpers.state = st;
    var root = document.getElementById("goldFarms");
    if (!root) return;
    if (!Array.isArray(state().goldFarmFavs)) state().goldFarmFavs = [];
    prefs();
    ensureShell(root);
    renderFilters();
    renderList();
  }

  window.GoldFarms = {
    render: render,
    liveOf: liveOf,
    filtered: filtered
  };
})();
