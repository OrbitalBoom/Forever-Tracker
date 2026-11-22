/* Item search, detail cards, and lazy loading for data/items/*.js */
(function () {
  var VERSION = "20261122b";
  var ICON = "https://render.worldofwarcraft.com/forever-us/icons/56/{icon}.jpg";
  var loaded = false;
  var loading = null;
  var chunks = {};
  var index = [];
  var byId = {};
  var filter = "all";
  var selected = null;
  var searchTimer = null;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Failed to load " + src)); };
      document.head.appendChild(s);
    });
  }
  function cacheUrl(path) { return path + (path.indexOf("?") >= 0 ? "&" : "?") + "v=" + VERSION; }

  function ensure() {
    if (loaded) return Promise.resolve();
    if (loading) return loading;
    loading = Promise.all([
      loadScript(cacheUrl("data/items/meta.js")),
      loadScript(cacheUrl("data/items/index.js")),
      loadScript(cacheUrl("data/items/gear.js"))
    ]).then(function () {
      index = window.ITEM_INDEX || [];
      byId = {};
      index.forEach(function (it) { byId[it.id] = it; });
      window.WOW_ITEMS = window.ITEM_GEAR || [];
      loaded = true;
      loading = null;
    }).catch(function (err) {
      loading = null;
      throw err;
    });
    return loading;
  }

  function loadChunk(k) {
    if (window.ITEM_DETAIL_CHUNK && window.ITEM_DETAIL_CHUNK[k]) {
      return Promise.resolve(window.ITEM_DETAIL_CHUNK[k]);
    }
    if (chunks[k]) return chunks[k];
    chunks[k] = loadScript(cacheUrl("data/items/d" + k + ".js")).then(function () {
      return (window.ITEM_DETAIL_CHUNK || {})[k] || {};
    });
    return chunks[k];
  }

  function detailOf(id) {
    var idx = byId[id];
    if (!idx) {
      // custom items or gear-only
      var gear = (window.ITEM_GEAR || []).concat(((window.ForeverApp && ForeverApp.getState) ? (ForeverApp.getState().customItems || []) : []));
      var g = gear.find(function (it) { return String(it.id) === String(id); });
      return Promise.resolve(g || null);
    }
    return loadChunk(idx.k).then(function (ch) { return (ch && ch[id]) || (ch && ch[String(id)]) || null; });
  }

  function qClass(q) { return "q-" + (q || "common"); }

  function iconHtml(icon, quality, name) {
    var cls = "idb-icon " + qClass(quality);
    if (icon) {
      var url = ICON.replace("{icon}", String(icon));
      return '<img class="' + cls + '" src="' + esc(url) + '" alt="" width="36" height="36">';
    }
    var letter = (name || "?").charAt(0).toUpperCase();
    return '<span class="' + cls + ' idb-icon-fallback">' + esc(letter) + "</span>";
  }

  function money(c) {
    if (c == null || isNaN(c)) return '<span class="muted">—</span>';
    var n = Math.round(Math.abs(c)), neg = c < 0;
    var g = Math.floor(n / 10000), s = Math.floor((n % 10000) / 100), cc = n % 100;
    var out = [];
    if (g) out.push('<span class="money-g">' + g.toLocaleString() + "g</span>");
    if (g || s) out.push('<span class="money-s">' + s + "s</span>");
    if (!g) out.push('<span class="money-c">' + cc + "c</span>");
    return (neg ? "−" : "") + out.join(" ");
  }

  function formatTs(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " America/New_York";
    } catch (e) { return iso; }
  }

  function priceOf(id) {
    if (window.priceEntry) return window.priceEntry(id);
    var items = window.PRICE_DATA && window.PRICE_DATA.items;
    var p = items && (items[id] || items[String(id)]);
    if (p && Array.isArray(p)) p = { minBuyout: p[0], marketValue: p[1], quantity: p[2], soldPerDay: p.length > 3 ? p[3] : null };
    return p && (p.marketValue || p.minBuyout) ? p : null;
  }
  function isNotTradeable(it) {
    if (!it) return false;
    if (it.nt === 1 || it.cat === "quest") return true;
    if (it.bind === "bop" || it.bind === "quest") return true;
    return false;
  }
  function priceCell(id, itemHint) {
    var p = priceOf(id);
    if (p) {
      var bits = '<strong>' + money(p.marketValue || p.minBuyout) + "</strong>";
      if (p.minBuyout && p.marketValue && p.minBuyout !== p.marketValue) {
        bits += '<span class="idb-price-min">min ' + money(p.minBuyout) + "</span>";
      }
      if (p.quantity != null) bits += '<span class="idb-price-qty">' + Number(p.quantity).toLocaleString() + " listed</span>";
      return '<span class="idb-price">' + bits + "</span>";
    }
    if (isNotTradeable(itemHint)) return '<span class="idb-price is-na">Not tradeable</span>';
    return '<span class="idb-price is-na">No current listings</span>';
  }

  function search(q, cat, limit) {
    q = (q || "").trim().toLowerCase();
    limit = limit || 30;
    var out = [];
    for (var i = 0; i < index.length; i++) {
      var it = index[i];
      if (cat && cat !== "all" && it.cat !== cat) continue;
      if (q && it.n.toLowerCase().indexOf(q) === -1 && String(it.id) !== q) continue;
      out.push(it);
      if (out.length >= limit) break;
    }
    // If the query is a prefix, already in order of id; prefer starts-with
    if (q) {
      out.sort(function (a, b) {
        var as = a.n.toLowerCase().indexOf(q) === 0 ? 0 : 1;
        var bs = b.n.toLowerCase().indexOf(q) === 0 ? 0 : 1;
        if (as !== bs) return as - bs;
        return a.n.localeCompare(b.n);
      });
    }
    return out;
  }

  function helper() { return window.ForeverItems || null; }

  function isUpgrade(item) {
    var api = helper();
    if (!api || !api.isUpgrade) return false;
    return api.isUpgrade(item);
  }

  function renderResults() {
    var q = ($("#itemSearch") || {}).value || "";
    var box = $("#itemResults");
    if (!box) return;
    if (!q.trim()) {
      var n = index.length;
      var meta = window.ITEM_DB_META || {};
      var c = (meta.counts && meta.counts.byCategory) || {};
      box.innerHTML = '<p class="muted">Type a name to search ' + n.toLocaleString() + " items" +
        (c.gear ? " (" + c.gear.toLocaleString() + " gear, " + (c.reagent || 0).toLocaleString() + " reagents, " +
          (c.consumable || 0).toLocaleString() + " consumables, " + (c.quest || 0).toLocaleString() + " quest)" : "") +
        ".</p>";
      return;
    }
    var hits = search(q, filter, 40);
    if (!hits.length) {
      box.innerHTML = '<p class="muted">No items match “' + esc(q) + '”.</p>';
      return;
    }
    box.innerHTML = '<ul class="idb-list">' + hits.map(function (it) {
      var badge = "";
      if (it.f !== 1) badge = '<span class="idb-badge classic">Classic reference</span>';
      var gearItem = (window.ITEM_GEAR || []).find(function (g) { return g.id === it.id; });
      if (gearItem && isUpgrade(gearItem)) badge += '<span class="idb-badge upgrade">Upgrade</span>';
      var sub = [];
      if (it.il) sub.push("ilvl " + it.il);
      if (it.rl) sub.push("req " + it.rl);
      if (it.slot) sub.push(it.slot);
      if (it.typ) sub.push(it.typ);
      sub.push(it.cat);
      return '<li><button type="button" class="idb-row" data-open-item="' + it.id + '" data-item-id="' + it.id + '">' +
        iconHtml(it.icon, it.q, it.n) +
        '<span class="idb-row-body"><span class="item-name ' + qClass(it.q) + '">' + esc(it.n) + "</span>" +
        badge + '<span class="idb-row-sub">' + esc(sub.join(" · ")) + "</span></span>" +
        priceCell(it.id, it) + "</button></li>";
    }).join("") + "</ul>";
  }

  function listBlock(title, rows) {
    if (!rows || !rows.length) return "";
    return "<h4>" + esc(title) + "</h4><ul class=\"idb-facts\">" + rows.join("") + "</ul>";
  }

  function itemAnchor(id, name, quality) {
    if (!id) return esc(name || "");
    return '<a href="#item-' + id + '" data-item-id="' + id + '" class="item-name ' + qClass(quality || "common") + '">' + esc(name || ("Item " + id)) + "</a>";
  }

  function renderDetail(item) {
    var box = $("#itemDetail");
    if (!box) return;
    if (!item) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    selected = item.id;
    var quality = item.quality || "common";
    var srcNote = item.forever
      ? '<span class="idb-badge forever">Forever-confirmed</span>'
      : '<span class="idb-badge classic">Classic reference — not in the live Forever client</span>';
    var upgrade = isUpgrade(item) ? '<span class="idb-badge upgrade">Upgrade</span>' : "";
    var metaBits = [];
    if (item.itemLevel) metaBits.push("ilvl " + item.itemLevel);
    if (item.reqLevel) metaBits.push("requires level " + item.reqLevel);
    if (item.slotLabel || item.slot) metaBits.push(item.slotLabel || item.slot);
    if (item.cat && item.cat !== "gear") metaBits.push(item.cat);
    else if (item.type) metaBits.push(item.type);
    if (item.bind) metaBits.push(item.bind === "bop" ? "Binds when picked up" : item.bind === "boe" ? "Binds when equipped" : item.bind);
    if (item.classes && item.classes.length) metaBits.push("Classes: " + item.classes.join(", "));

    var stats = [];
    if (item.weapon) {
      stats.push((item.weapon.min || "?") + "–" + (item.weapon.max || "?") + "  (" +
        (item.weapon.dps || "?") + " dps, " + (item.weapon.speed || "?") + "s)");
    }
    var labels = { str: "Strength", agi: "Agility", sta: "Stamina", int: "Intellect", spi: "Spirit",
      ap: "Attack Power", rap: "Ranged AP", fap: "Feral AP", crit: "Crit chance", hit: "Hit chance",
      spellCrit: "Spell crit", spellHit: "Spell hit", sp: "Spell damage", healing: "Healing",
      mp5: "Mana per 5", hp5: "Health per 5", defense: "Defense", dodge: "Dodge", parry: "Parry",
      blockChance: "Block chance", blockValue: "Block value", armor: "Armor",
      fireRes: "Fire resist", frostRes: "Frost resist", shadowRes: "Shadow resist",
      natureRes: "Nature resist", arcaneRes: "Arcane resist", holyRes: "Holy resist" };
    Object.keys(labels).forEach(function (k) {
      if (item.stats && item.stats[k]) stats.push("+" + item.stats[k] + " " + labels[k]);
    });
    (item.effects || []).forEach(function (e) { stats.push(e); });
    var statNote = "";
    if (item.statSource === "wowhead-classic" || item.statSource === "classic-db") {
      statNote = '<p class="muted idb-stat-note">Stats are from Classic sources' +
        (item.statSource === "classic-db" ? " (CMaNGOS item_template)" : " (Wowhead Classic tooltips)") +
        " and may differ if Forever changed the item.</p>";
    } else if (item.slot && !(item.stats && Object.keys(item.stats).length) && !item.weapon) {
      statNote = '<p class="muted idb-stat-note">Numeric stats for this piece are not in the Classic sources we have; the Forever client only stores allocation weights.</p>';
    }

    var p = priceOf(item.id);
    var prices = window.PRICE_DATA || {};
    var ahHtml = "<h4>Auction House</h4>";
    if (p) {
      ahHtml += '<p class="idb-ah"><strong class="idb-ah-main">' + money(p.marketValue || p.minBuyout) + "</strong>" +
        ' <span class="muted">market</span>';
      if (p.minBuyout != null) {
        ahHtml += ' · min buyout ' + money(p.minBuyout);
      }
      if (p.quantity != null) ahHtml += ' · ' + Number(p.quantity).toLocaleString() + " listed";
      ahHtml += '<br><span class="muted">US Normal Horde, copper per item';
      if (item.cat === "reagent" || item.cat === "consumable") ahHtml += " (value per unit)";
      ahHtml += ". ";
      var ts = prices.updated || prices.fetched;
      if (ts) ahHtml += "Snapshot " + formatTs(ts) + ".";
      ahHtml += "</span></p>";
    } else if (isNotTradeable(item)) {
      ahHtml += '<p class="idb-ah is-na">Not tradeable</p>';
    } else {
      ahHtml += '<p class="idb-ah is-na">No current listings</p>';
      var ts = prices.updated || prices.fetched;
      if (ts) ahHtml += '<p class="muted">US Normal Horde snapshot ' + formatTs(ts) + ".</p>";
    }
    if (item.sell) ahHtml += "<p>Vendor sell: " + money(item.sell) + "</p>";

    var useRows = [];
    (item.recipes || []).forEach(function (r) {
      useRows.push("<li>" + esc(r.prof || "Profession") + (r.skill ? " " + r.skill : "") +
        " — " + esc(r.name) + (r.qty && r.qty !== 1 ? " ×" + r.qty : "") +
        (r.product ? " → " + itemAnchor(r.productId, r.product) : "") + "</li>");
    });
    (function () {
      var grouped = {};
      (item.questUses || []).forEach(function (q) {
        var key = (q.kind || "required") + "\0" + (q.name || "");
        grouped[key] = (grouped[key] || 0) + 1;
      });
      Object.keys(grouped).forEach(function (key) {
        var parts = key.split("\0");
        var n = grouped[key];
        useRows.push("<li>Quest (" + esc(parts[0]) + "): " + esc(parts[1]) + (n > 1 ? " (" + n + " versions)" : "") + "</li>");
      });
    })();
    if (item.attune) useRows.push("<li>" + esc(item.attune) + "</li>");
    if (item.startQuest) useRows.push("<li>Starts a quest (id " + item.startQuest + ")</li>");

    var srcRows = [];
    (item.drops || []).forEach(function (d) {
      var ch = d.chance ? d.chance + "%" : "chance unknown";
      srcRows.push("<li>" + esc(d.name || "Unknown") +
        (d.zone ? " — " + esc(d.zone) : "") +
        " · " + ch +
        (d.kind === "object" ? " (node/object)" : "") + "</li>");
    });
    (item.vendors || []).forEach(function (v) {
      srcRows.push("<li>Vendor: " + esc(v.name || "Vendor") +
        (v.zone ? " — " + esc(v.zone) : "") +
        (v.price ? " · " + money(v.price) : "") + "</li>");
    });
    (item.crafted || []).forEach(function (c) {
      srcRows.push("<li>Crafted: " + esc(c.prof || "") + (c.skill ? " " + c.skill : "") +
        " — " + esc(c.name) + (c.qty && c.qty !== 1 ? " (×" + c.qty + ")" : "") + "</li>");
    });
    (item.questRewards || []).forEach(function (q) {
      srcRows.push("<li>Quest reward" + (q.choice ? " (choice)" : "") + ": " + esc(q.name) + "</li>");
    });
    if (!srcRows.length && item.source) {
      srcRows.push("<li>" + esc(item.source) + (item.sourceType ? " (" + esc(item.sourceType) + ")" : "") + "</li>");
    }

    var links = [];
    if (item.forever || (item.id && item.id < 100000)) {
      links.push('<a href="https://www.wowhead.com/classic/item=' + item.id + '" target="_blank" rel="noopener">Wowhead Classic</a>');
    }
    links.push('<span class="muted">Item id ' + item.id + "</span>");

    var equipBtn = "";
    var api = helper();
    if (api && item.slot && item.slot !== "shirt" && (item.forever !== false || item.custom)) {
      equipBtn = '<button type="button" class="btn btn-primary btn-sm" id="btnEquipItem">Equip in slot</button>';
    }

    box.innerHTML =
      '<div class="idb-card-head" data-item-id="' + item.id + '">' + iconHtml(item.icon, quality, item.name) +
      '<div><h3 class="item-name ' + qClass(quality) + '">' + esc(item.name) + "</h3>" +
      "<div>" + srcNote + upgrade + "</div>" +
      '<div class="muted">' + esc(metaBits.join(" · ")) + "</div></div></div>" +
      (stats.length ? '<p class="idb-stats">' + esc(stats.join(" · ")) + "</p>" : "") +
      statNote +
      ahHtml +
      listBlock("Uses", useRows) +
      listBlock("Sources", srcRows) +
      '<p class="idb-links">' + links.join(" · ") + "</p>" +
      '<div class="row-actions">' + equipBtn +
      '<button type="button" class="btn btn-sm" id="btnCloseItem">Close</button></div>';

    var close = $("#btnCloseItem");
    if (close) close.addEventListener("click", function () {
      selected = null;
      renderDetail(null);
      if (location.hash.indexOf("item-") === 1) history.replaceState(null, "", location.pathname + location.search);
    });
    var eq = $("#btnEquipItem");
    if (eq && api) eq.addEventListener("click", function () { api.equipItem(item); });
    box.scrollIntoView({ block: "nearest" });
  }

  function open(id) {
    var fold = document.getElementById("itemDatabase");
    if (fold && fold.tagName === "DETAILS") fold.open = true;
    id = parseInt(id, 10) || id;
    return ensure().then(function () {
      showTab();
      return detailOf(id).then(function (item) {
        if (!item) {
          var box = $("#itemDetail");
          if (box) {
            box.hidden = false;
            box.innerHTML = '<p class="muted">Item ' + esc(id) + " is not in the database.</p>";
          }
          return;
        }
        var idx = byId[item.id];
        var qel = $("#itemSearch");
        if (qel && !qel.value) qel.value = item.name;
        renderResults();
        renderDetail(item);
        try { history.replaceState(null, "", "#item-" + item.id); } catch (e) {}
      });
    });
  }

  function showTab() {
    var btn = document.querySelector('.tabs [data-tab="items"]');
    if (btn && btn.getAttribute("aria-selected") !== "true") btn.click();
  }

  function bindUi() {
    var input = $("#itemSearch");
    if (input && !input._idbBound) {
      input._idbBound = true;
      input.addEventListener("input", function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(renderResults, 40);
      });
    }
    document.querySelectorAll("#itemFilters [data-item-filter]").forEach(function (btn) {
      if (btn._idbBound) return;
      btn._idbBound = true;
      btn.addEventListener("click", function () {
        filter = btn.getAttribute("data-item-filter") || "all";
        document.querySelectorAll("#itemFilters [data-item-filter]").forEach(function (b) {
          b.classList.toggle("is-on", b === btn);
        });
        renderResults();
      });
    });
    var results = $("#itemResults");
    if (results && !results._idbBound) {
      results._idbBound = true;
      results.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-open-item]");
        if (!btn) return;
        open(btn.getAttribute("data-open-item"));
      });
    }
  }

  function bindGlobalLinks() {
    document.addEventListener("click", function (e) {
      /* Only item name links — not paper-doll slots, Equip buttons, or search rows. */
      var a = e.target.closest && e.target.closest("a[data-item-id]");
      if (!a) return;
      if (e.target.closest && e.target.closest("[data-equip-id], [data-equip-slot]")) return;
      var id = a.getAttribute("data-item-id");
      if (!id) return;
      e.preventDefault();
      open(id);
    });
    window.addEventListener("hashchange", function () {
      var m = /^#item-(\d+)/.exec(location.hash || "");
      if (m) open(m[1]);
    });
  }

  function onTab() {
    bindUi();
    ensure().then(function () {
      bindUi();
      renderResults();
      var api = helper();
      if (api && api.render) api.render();
      var m = /^#item-(\d+)/.exec(location.hash || "");
      if (m) open(m[1]);
    }).catch(function (err) {
      var box = $("#itemResults");
      if (box) box.innerHTML = '<p class="muted">Could not load the item database.</p>';
      console.error(err);
    });
  }

  bindGlobalLinks();
  document.addEventListener("forever-prices", function () {
    if (document.getElementById("tab-items") && document.getElementById("tab-items").classList.contains("active")) {
      renderResults();
      if (selected != null) open(selected);
    }
  });

  window.ItemDB = {
    ensure: ensure,
    open: open,
    search: search,
    onTab: onTab,
    detailOf: detailOf,
    version: VERSION
  };
})();
