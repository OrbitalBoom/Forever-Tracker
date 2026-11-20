/* Gold Farming section. Reads window.GOLD_FARMS and the same PRICE_DATA
 * feed as the Profession guide. Does not invent drop rates or gold/hour. */
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
  var bound = false;
  var helpers = {};
  var expandedId = null;
  var showAllRows = false;

  function escapeHtml(s) {
    if (helpers.escapeHtml) return helpers.escapeHtml(s);
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
      showAllGroups: false
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

  function headline(spot) {
    var live = liveOf(spot);
    var sourcedHr = sourcedHourly(spot);
    var sourced = spot.sourced || {};
    if (live.perHour != null) {
      return { copper: live.perHour, unit: "/hr", kind: "live", live: live };
    }
    if (sourcedHr != null) {
      return { copper: sourcedHr, unit: "/hr", kind: "sourced", live: live };
    }
    if (live.perKill != null) {
      return { copper: live.perKill, unit: "/kill", kind: "live", live: live };
    }
    if (sourced.perKill != null) {
      return { copper: sourced.perKill, unit: "/kill", kind: "sourced", live: live };
    }
    return { copper: null, unit: "", kind: "none", live: live };
  }

  function sortKey(spot) {
    var h = headline(spot);
    if (h.unit === "/hr" && h.copper != null) return h.copper;
    if (h.unit === "/kill" && h.copper != null) return h.copper / 1000;
    return -1;
  }

  function pillMatches(spot, typeFilter) {
    if (typeFilter === "all") return true;
    if (typeFilter === "mob") return spot.type === "mob" || spot.type === "cloth";
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
      if (!pillMatches(spot, p.typeFilter)) return false;
      if (!factionOk(spot, p)) return false;
      if (!classOk(spot, p)) return false;
      if (!opts.ignoreLevel && !levelFits(spot, L)) return false;
      return true;
    });
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
      '<div class="gf-pills" role="group" aria-label="Farm type">' + pills + "</div>";
  }

  function renderContext() {
    var el = document.getElementById("goldFarmContext");
    if (!el) return;
    var p = prefs();
    var fac = charFaction();
    var facLabel = fac ? fac.charAt(0).toUpperCase() + fac.slice(1) : "";
    var cls = charClass() || "your class";
    if (p.showAllGroups) {
      el.innerHTML = 'Showing every class and faction. <button type="button" class="gf-text-btn" id="gfToggleGroups">Use my class &amp; faction (' +
        escapeHtml(facLabel + " " + cls) + ")</button>";
    } else {
      el.innerHTML = "For " + escapeHtml(facLabel + " " + cls) +
        '. <button type="button" class="gf-text-btn" id="gfToggleGroups">Show all classes/factions</button>';
    }
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
      "<p>The big number on each row is a live gold/hour estimate when this site can price the listed drops and a source gave a kill rate; otherwise it is the source's own snapshot, marked the same way. " +
      escapeHtml(priceStamp()) + ". Nothing here is invented.</p>" +
      "<p>Bug exploits, duplication, and other play that breaks Blizzard's terms of use are not listed.</p>";
    el.open = open;
  }

  function bind(root) {
    if (bound) return;
    bound = true;
    root.addEventListener("click", function (e) {
      var t = e.target;
      if (!t) return;
      var step = t.closest && t.closest(".gf-step");
      if (step) {
        var cur = viewLevel();
        var next = step.id === "gfLvlDown" ? cur - 1 : cur + 1;
        setViewLevel(next, false);
        persist();
        showAllRows = false;
        refresh();
        return;
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
      if (e.target && e.target.id === "gfLevel") {
        setViewLevel(e.target.value, false);
        persist();
        showAllRows = false;
        refresh();
      }
    });
    root.addEventListener("keydown", function (e) {
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

  function lootHtml(spot) {
    var loot = spot.loot || [];
    if (!loot.length) return '<p class="muted">No priced loot list — see the source notes.</p>';
    var rows = loot.map(function (l) {
      var p = l.id ? priceOf(l.id) : null;
      var bits = [];
      if (l.chance != null) bits.push(Math.round(l.chance * 1000) / 10 + "%");
      if (l.qty && l.qty !== 1) bits.push("×" + l.qty);
      if (p) bits.push("AH " + goldText(p.marketValue));
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
      (spot.loc ? '<p>' + escapeHtml(spot.loc) + "</p>" : "") +
      '<p class="gf-meta">' + escapeHtml(facLabel) + " · " + escapeHtml(classes) +
        " · " + escapeHtml(profLine) +
        (spot.mobLevel ? " · mobs " + escapeHtml(spot.mobLevel) : "") + "</p>" +
      (spot.factionNote ? '<p class="muted">' + escapeHtml(spot.factionNote) + "</p>" : "") +
      lootHtml(spot) +
      valueBlock(spot, live) +
      (spot.risk ? '<div class="gf-risk"><span class="kicker">Risk</span> ' + escapeHtml(spot.risk) + "</div>" : "") +
      (sources ? '<ul class="gf-sources">' + sources + "</ul>" : "") +
      "</div>";
  }

  function needTag(spot) {
    var req = spot.professions || [];
    if (!req.length) return "";
    var label = req.length === 1 ? "Needs " + req[0] : "Needs " + req.slice(0, -1).join(", ") + " & " + req[req.length - 1];
    return '<span class="badge gf-need">' + escapeHtml(label) + "</span>";
  }

  function rowHtml(spot, rank, opts) {
    opts = opts || {};
    var h = headline(spot);
    var fav = isFav(spot.id);
    var open = expandedId === spot.id;
    var names = lootNames(spot);
    var lootLine = names.length ? names.slice(0, 3).join(", ") + (names.length > 3 ? "…" : "") : "See details for loot";
    var goldInner = h.copper != null
      ? ("<strong>" + goldShortHtml(h.copper) + "</strong><span class=\"gf-est\">est." + h.unit + "</span>")
      : '<strong class="gf-na">—</strong><span class="gf-est">no /hr yet</span>';
    var warn = isContested(spot)
      ? '<span class="gf-warn" title="Contested or PvP" aria-label="Contested or PvP">⚠</span>'
      : "";
    var extra = opts.dist
      ? '<div class="muted">Best around Lv ' + spot.levelMin + "–" + spot.levelMax + " (" + opts.dist + " level" + (opts.dist === 1 ? "" : "s") + " away)</div>"
      : "";
    return '<li class="gf-row' + (fav ? " is-fav" : "") + (open ? " is-open" : "") + '" data-farm="' + escapeHtml(spot.id) + '">' +
      '<div class="gf-row-main" data-gf-toggle="' + escapeHtml(spot.id) + '" role="button" tabindex="0" aria-expanded="' + (open ? "true" : "false") + '">' +
        '<span class="gf-rank">' + rank + "</span>" +
        '<div class="gf-row-body">' +
          '<div class="gf-row-title">' + escapeHtml(spot.name) + warn + needTag(spot) + "</div>" +
          '<div class="gf-row-sub">' + escapeHtml(spot.zone) + " · Lv " + spot.levelMin + "–" + spot.levelMax +
            " · " + escapeHtml(lootLine) + "</div>" +
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
          (p.typeFilter !== "all" ? " in " + escapeHtml(typeLabel) : "") + ".</p>";
        var nearFav = closest(TOP_N);
        if (nearFav.length) {
          html += '<p class="muted">Closest favorites or matches:</p><ol class="gf-list">';
          nearFav.forEach(function (x, i) { html += rowHtml(x.spot, i + 1, { dist: x.dist }); });
          html += "</ol>";
        }
      } else {
        html = '<p class="gf-empty">No farms sit right at level ' + L +
          (p.typeFilter !== "all" ? " for " + escapeHtml(typeLabel) : "") + ". Here are the closest ones.</p>";
        var near = closest(TOP_N);
        if (near.length) {
          html += '<ol class="gf-list">';
          near.forEach(function (x, i) { html += rowHtml(x.spot, i + 1, { dist: x.dist }); });
          html += "</ol>";
        } else {
          html += '<p class="muted">Nothing else matched these filters.</p>';
        }
      }
      box.innerHTML = html;
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
    box.innerHTML = html;
  }

  function refresh() {
    renderToolbar();
    renderContext();
    renderResults();
    renderAbout();
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
  }

  window.GoldFarms = {
    render: render,
    liveOf: liveOf,
    filtered: filtered,
    viewLevel: viewLevel,
    headline: headline
  };
})();
