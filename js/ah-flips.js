/* AH flip finder for the Gold tab. Uses the existing US Normal Horde price
 * feed (schema 2) and, when present, the 7-day marketValue history. Never
 * invents prices or sale rates. Loaded with the page; history + vendor maps
 * are fetched only when the Gold tab is opened. */
(function () {
  "use strict";

  var AH_CUT = 0.05;
  var DEPOSIT_RATE = 0.05; /* Classic 12-hour auction deposit: 5% of vendor sell */
  var REPO_DEFAULT = { owner: "OrbitalBoom", repo: "Forever-Tracker" };
  var DEFAULTS = {
    minProfit: 10000,     /* 1g, copper */
    minSold: 1,
    maxBuy: 0,            /* 0 = no budget cap */
    category: "all",
    hideThin: true,
    sort: "score"         /* profit | discount | score (profit × sold/day) */
  };
  var THIN_QTY = 3;
  var loaded = false;
  var loading = null;
  var historyStatus = "none"; /* none | bundled | live */
  var lastRows = [];

  function $(s, root) { return (root || document).querySelector(s); }
  function $all(s, root) { return [].slice.call((root || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function repo() {
    var h = location.hostname || "";
    if (/\.github\.io$/i.test(h)) {
      var seg = location.pathname.split("/").filter(Boolean)[0];
      if (seg) return { owner: h.split(".")[0], repo: seg };
    }
    return REPO_DEFAULT;
  }
  function cacheVer() {
    var tag = document.querySelector('script[src*="js/ah-flips.js"], script[src*="js/app.js"]');
    var src = tag && (tag.getAttribute("src") || "");
    var m = src && src.match(/[?&]v=([^&]+)/);
    return m ? m[1] : "20261123c";
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(src); };
      s.onerror = function () { reject(new Error("failed " + src)); };
      document.head.appendChild(s);
    });
  }
  function fetchJson(url) {
    if (typeof fetch !== "function") return Promise.resolve(null);
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
  }

  function money(c) {
    if (c == null || isNaN(c)) return '<span class="muted">—</span>';
    var neg = c < 0; c = Math.round(Math.abs(c));
    var g = Math.floor(c / 10000), s = Math.floor((c % 10000) / 100), cc = c % 100;
    var out = [];
    if (g) out.push('<span class="money-g">' + g.toLocaleString() + "g</span>");
    if (g || s) out.push('<span class="money-s">' + s + "s</span>");
    out.push('<span class="money-c">' + cc + "c</span>");
    return (neg ? "−" : "") + out.join(" ");
  }
  function copperFromGoldInput(v) {
    var n = Number(v);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.round(n * 10000);
  }
  function goldInputValue(copper) {
    if (!copper) return "";
    return String(copper / 10000);
  }

  function median(values) {
    var xs = values.filter(function (v) { return v != null && v > 0; }).slice().sort(function (a, b) { return a - b; });
    if (!xs.length) return null;
    var mid = Math.floor(xs.length / 2);
    if (xs.length % 2) return xs[mid];
    return Math.round((xs[mid - 1] + xs[mid]) / 2);
  }

  function formatStampNY(iso) {
    if (!iso) return "unknown time";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short"
    });
    return fmt.format(d);
  }

  function prefs(state) {
    state = state || (window.ForeverApp && ForeverApp.getState && ForeverApp.getState()) || {};
    if (!state.goldFlips || typeof state.goldFlips !== "object") {
      state.goldFlips = {
        minProfit: DEFAULTS.minProfit,
        minSold: DEFAULTS.minSold,
        maxBuy: DEFAULTS.maxBuy,
        category: DEFAULTS.category,
        hideThin: DEFAULTS.hideThin,
        sort: DEFAULTS.sort
      };
    }
    var p = state.goldFlips;
    if (p.minProfit == null) p.minProfit = DEFAULTS.minProfit;
    if (p.minSold == null) p.minSold = DEFAULTS.minSold;
    if (p.maxBuy == null) p.maxBuy = DEFAULTS.maxBuy;
    if (!p.category) p.category = "all";
    if (p.hideThin == null) p.hideThin = true;
    if (!p.sort) p.sort = "score";
    return p;
  }

  function itemMeta(id) {
    var idx = window.ITEM_INDEX;
    if (idx && (!itemMeta._map || itemMeta._n !== idx.length)) {
      itemMeta._map = {};
      itemMeta._n = idx.length;
      idx.forEach(function (it) { itemMeta._map[String(it.id)] = it; });
    }
    return (itemMeta._map && itemMeta._map[String(id)]) || null;
  }
  function vendorOf(id) {
    var v = window.ITEM_VENDOR && (window.ITEM_VENDOR[id] || window.ITEM_VENDOR[String(id)]);
    if (!v) return { buy: 0, sell: 0 };
    if (Array.isArray(v)) return { buy: v[0] || 0, sell: v[1] || 0 };
    return { buy: v.buy || 0, sell: v.sell || 0 };
  }
  function priceOf(id) {
    if (window.priceEntry) return window.priceEntry(id);
    var d = window.PRICE_DATA;
    if (!d || !d.items) return null;
    var raw = d.items[id] || d.items[String(id)];
    if (!raw) return null;
    if (Array.isArray(raw)) {
      return { minBuyout: raw[0], marketValue: raw[1], quantity: raw[2], soldPerDay: raw.length > 3 ? raw[3] : null };
    }
    return raw;
  }
  function usualOf(id, fallback) {
    var h = window.PRICE_HISTORY;
    if (!h || !h.items) return { usual: fallback, samples: 0, source: "market" };
    var arr = h.items[id] || h.items[String(id)];
    if (!arr || !arr.length) return { usual: fallback, samples: 0, source: "market" };
    var med = median(arr);
    var n = arr.filter(function (v) { return v != null && v > 0; }).length;
    if (med == null) return { usual: fallback, samples: n, source: "market" };
    return { usual: med, samples: n, source: "median" };
  }

  function historyRange() {
    var h = window.PRICE_HISTORY;
    if (!h || !h.samples || !h.samples.length) return null;
    var first = h.samples[0].updated || h.samples[0];
    var last = h.samples[h.samples.length - 1].updated || h.samples[h.samples.length - 1];
    return { first: first, last: last, count: h.samples.length, windowDays: h.windowDays || 7 };
  }

  function confidence(row) {
    var marketDown = row.marketValue && row.usual && row.marketValue < row.usual * 0.8;
    var thin = row.quantity < THIN_QTY || (row.soldPerDay != null && row.soldPerDay < 1);
    var fewSamples = row.usualSource === "median" && row.usualSamples < 3;
    if (thin || marketDown || fewSamples) return "low";
    if (row.quantity >= 5 && (row.soldPerDay == null || row.soldPerDay >= 5) && !marketDown) return "high";
    return "medium";
  }

  function buildRows() {
    var data = window.PRICE_DATA;
    if (!data || !data.items) return [];
    if (window.normalizePriceData && !data._norm) window.normalizePriceData(data);
    var rows = [];
    var ids = Object.keys(data.items);
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var p = priceOf(id);
      if (!p || !p.minBuyout || !p.marketValue) continue;
      var vend = vendorOf(id);
      if (vend.buy > 0 && vend.buy <= p.minBuyout) continue; /* cheaper (or equal) at a vendor */
      var u = usualOf(id, p.marketValue);
      var usual = u.usual;
      if (!usual) continue;
      var vendorFlip = vend.sell > 0 && vend.sell > p.minBuyout;
      var deposit = 0;
      var profit;
      if (vendorFlip) {
        profit = vend.sell - p.minBuyout;
      } else {
        deposit = vend.sell > 0 ? Math.round(vend.sell * DEPOSIT_RATE) : 0;
        profit = usual * (1 - AH_CUT) - p.minBuyout - deposit;
      }
      if (profit <= 0) continue;
      var meta = itemMeta(id);
      var disc = usual > 0 ? (usual - p.minBuyout) / usual : 0;
      var row = {
        id: Number(id) || id,
        name: (meta && meta.n) || ("Item " + id),
        quality: (meta && meta.q) || "common",
        cat: (meta && meta.cat) || "other",
        icon: meta && meta.icon,
        minBuyout: p.minBuyout,
        marketValue: p.marketValue,
        usual: usual,
        usualSource: u.source,
        usualSamples: u.samples,
        discount: disc,
        profit: profit,
        deposit: deposit,
        quantity: p.quantity || 0,
        soldPerDay: p.soldPerDay != null ? p.soldPerDay : null,
        vendorFlip: vendorFlip,
        vendorSell: vend.sell || 0
      };
      row.confidence = confidence(row);
      row.score = row.profit * (row.soldPerDay != null ? row.soldPerDay : 0);
      rows.push(row);
    }
    return rows;
  }

  function applyFilters(rows, p) {
    return rows.filter(function (r) {
      if (p.minProfit && r.profit < p.minProfit) return false;
      if (p.minSold && r.soldPerDay != null && r.soldPerDay < p.minSold) return false;
      if (p.maxBuy && r.minBuyout > p.maxBuy) return false;
      if (p.category && p.category !== "all" && r.cat !== p.category) return false;
      if (p.hideThin) {
        if (r.quantity < THIN_QTY) return false;
        if (r.soldPerDay != null && r.soldPerDay < 1) return false;
      }
      return true;
    });
  }

  function sortRows(rows, sort) {
    var out = rows.slice();
    if (sort === "discount") out.sort(function (a, b) { return b.discount - a.discount || b.profit - a.profit; });
    else if (sort === "profit") out.sort(function (a, b) { return b.profit - a.profit; });
    else out.sort(function (a, b) { return b.score - a.score || b.profit - a.profit; });
    return out;
  }

  function itemLink(row) {
    return '<a class="item-name q-' + esc(row.quality) + '" href="#item-' + row.id + '" data-item-id="' + row.id + '">' +
      esc(row.name) + "</a>";
  }

  function usualBlurb() {
    var range = historyRange();
    var asOf = (window.PRICE_DATA && (window.PRICE_DATA.updated || window.PRICE_DATA.fetched)) || null;
    var bits = [];
    bits.push("Prices as of " + formatStampNY(asOf) + " (America/New_York), US Normal Horde auction house.");
    if (range && range.count >= 2) {
      bits.push("“Usual” is the median market value across " + range.count +
        " snapshots from " + formatStampNY(range.first) + " to " + formatStampNY(range.last) +
        " (a rolling " + range.windowDays + "-day window; older samples are dropped). " +
        "Market value is the average of the cheapest 15% of units listed.");
    } else {
      bits.push("No rolling history is available yet, so “usual” is the current market value " +
        "(the average of the cheapest 15% of units listed) — a snapshot spread, not a multi-day baseline.");
    }
    bits.push("Estimated AH flip profit is after the 5% auction house cut" +
      " and, when vendor sell is known, a Classic 12-hour deposit (5% of vendor sell). " +
      "Vendor flips use the vendor sell price and no auction cut. " +
      "Items a vendor sells for at or below the auction buyout are hidden. " +
      "Sale rates come from the Forever Goblin feed and are left blank when unknown — they are never invented.");
    return bits.join(" ");
  }

  function renderTable(state, hooks) {
    var root = $("#ahFlips");
    if (!root) return;
    var p = prefs(state);
    var all = buildRows();
    var rows = sortRows(applyFilters(all, p), p.sort);
    lastRows = rows;
    var cats = {};
    all.forEach(function (r) { cats[r.cat] = (cats[r.cat] || 0) + 1; });
    var catOpts = ["all"].concat(Object.keys(cats).sort());
    var range = historyRange();
    var asOf = window.PRICE_DATA && (window.PRICE_DATA.updated || window.PRICE_DATA.fetched);

    var html = "";
    html += '<p class="muted ahf-lede" id="ahFlipsBlurb">' + esc(usualBlurb()) + "</p>";
    html += '<div class="filter-bar ahf-filters">';
    html += '<label class="field">Min profit (g)<input type="number" id="ahfMinProfit" min="0" step="0.01" value="' +
      esc(goldInputValue(p.minProfit)) + '"></label>';
    html += '<label class="field">Min sold/day<input type="number" id="ahfMinSold" min="0" step="0.1" value="' +
      esc(p.minSold || "") + '"></label>';
    html += '<label class="field">Max buy (g)<input type="number" id="ahfMaxBuy" min="0" step="0.01" placeholder="no cap" value="' +
      esc(goldInputValue(p.maxBuy)) + '"></label>';
    html += '<label class="field">Category<select id="ahfCat">';
    catOpts.forEach(function (c) {
      var label = c === "all" ? "All categories" : c.charAt(0).toUpperCase() + c.slice(1);
      html += '<option value="' + esc(c) + '"' + (p.category === c ? " selected" : "") + ">" + esc(label) + "</option>";
    });
    html += "</select></label>";
    html += '<label class="field">Sort<select id="ahfSort">';
    [["score", "Profit × sold/day"], ["profit", "Profit per item"], ["discount", "Discount %"]].forEach(function (opt) {
      html += '<option value="' + opt[0] + '"' + (p.sort === opt[0] ? " selected" : "") + ">" + opt[1] + "</option>";
    });
    html += "</select></label>";
    html += '<label class="muted ahf-check"><input type="checkbox" id="ahfHideThin"' +
      (p.hideThin ? " checked" : "") + "> Hide thin listings (fewer than " + THIN_QTY +
      " listed, or under 1 sold/day)</label>";
    html += "</div>";
    html += '<p class="muted ahf-meta">Showing ' + rows.length + " of " + all.length +
      " flips" + (asOf ? " · as of " + esc(formatStampNY(asOf)) : "") +
      (range ? " · " + range.count + " history snapshots" : " · current snapshot only") + ".</p>";

    html += '<div class="table-wrap"><table class="data" id="ahFlipsTable">';
    html += "<thead><tr>" +
      "<th>Item</th><th>Cheapest buyout</th><th>Usual price</th><th>Discount</th>" +
      "<th>Est. profit</th><th>Listed</th><th>Sold/day</th><th>Confidence</th>" +
      "</tr></thead><tbody>";
    if (!rows.length) {
      html += '<tr><td colspan="8" class="muted">No flips match these filters. Lower the minimum profit or turn off the thin-listing hide if you want to see more — thin markets are easy to get stuck with.</td></tr>';
    } else {
      rows.forEach(function (r) {
        var notes = [];
        if (r.vendorFlip) notes.push('<span class="ahf-flag ahf-vendor">vendor flip</span>');
        if (r.usualSource === "median" && r.marketValue && r.usual && r.marketValue < r.usual * 0.8) {
          notes.push('<span class="ahf-flag">current market is below usual</span>');
        }
        var usualTip = r.usualSource === "median"
          ? "Median of " + r.usualSamples + " market-value snapshots"
          : "Current market value (no history for this item)";
        var profitTip = r.vendorFlip
          ? "Vendor sell minus cheapest buyout (no auction cut)"
          : "Usual × 95% − buyout" + (r.deposit ? " − 12-hour deposit " + (r.deposit / 10000).toFixed(2) + "g" : "");
        html += '<tr data-item-id="' + r.id + '">';
        html += "<td>" + itemLink(r) + (notes.length ? '<div class="ahf-notes">' + notes.join(" ") + "</div>" : "") + "</td>";
        html += "<td>" + money(r.minBuyout) + "</td>";
        html += '<td title="' + esc(usualTip) + '">' + money(r.usual) + "</td>";
        html += "<td>" + (r.discount * 100).toFixed(1) + "%</td>";
        html += '<td title="' + esc(profitTip) + '">' + money(r.profit) + "</td>";
        html += "<td>" + r.quantity.toLocaleString() + "</td>";
        html += "<td>" + (r.soldPerDay == null ? '<span class="muted">unknown</span>' : String(r.soldPerDay)) + "</td>";
        html += '<td><span class="ahf-conf ahf-conf-' + r.confidence + '">' + r.confidence + "</span></td>";
        html += "</tr>";
      });
    }
    html += "</tbody></table></div>";
    root.innerHTML = html;
    bindFilters(state, hooks);
  }

  function readFiltersInto(p) {
    var minP = $("#ahfMinProfit");
    var minS = $("#ahfMinSold");
    var maxB = $("#ahfMaxBuy");
    var cat = $("#ahfCat");
    var sort = $("#ahfSort");
    var hide = $("#ahfHideThin");
    if (minP) p.minProfit = copperFromGoldInput(minP.value);
    if (minS) p.minSold = minS.value === "" ? 0 : Number(minS.value) || 0;
    if (maxB) p.maxBuy = copperFromGoldInput(maxB.value);
    if (cat) p.category = cat.value || "all";
    if (sort) p.sort = sort.value || "score";
    if (hide) p.hideThin = !!hide.checked;
  }

  function bindFilters(state, hooks) {
    var p = prefs(state);
    var timer = null;
    function apply() {
      readFiltersInto(p);
      if (hooks && hooks.save) hooks.save();
      renderTable(state, hooks);
    }
    function delayed() {
      clearTimeout(timer);
      timer = setTimeout(apply, 250);
    }
    ["ahfMinProfit", "ahfMinSold", "ahfMaxBuy"].forEach(function (id) {
      var el = $("#" + id);
      if (el) el.addEventListener("input", delayed);
    });
    ["ahfCat", "ahfSort", "ahfHideThin"].forEach(function (id) {
      var el = $("#" + id);
      if (el) el.addEventListener("change", apply);
    });
  }

  function ensureExtras() {
    if (loaded) return Promise.resolve();
    if (loading) return loading;
    var ver = cacheVer();
    var jobs = [];
    if (!window.PRICE_HISTORY) {
      jobs.push(loadScript("data/price-history.js?v=" + encodeURIComponent(ver)).then(function () {
        if (window.PRICE_HISTORY) historyStatus = "bundled";
      }).catch(function () {}));
    } else {
      historyStatus = "bundled";
    }
    if (!window.ITEM_VENDOR) {
      jobs.push(loadScript("data/item-vendor.js?v=" + encodeURIComponent(ver)).catch(function () {}));
    }
    if (window.ItemDB && window.ItemDB.ensure) {
      jobs.push(window.ItemDB.ensure().catch(function () {}));
    } else {
      jobs.push(loadScript("data/items/index.js?v=" + encodeURIComponent(ver)).catch(function () {}));
    }
    /* Prefer a newer history file from the prices-data branch when we can reach it. */
    if (typeof fetch === "function" && location.protocol !== "file:") {
      var rp = repo();
      var bucket = Math.floor(Date.now() / 300000);
      var url = "https://raw.githubusercontent.com/" + rp.owner + "/" + rp.repo +
        "/prices-data/price-history.json?b=" + bucket;
      jobs.push(fetchJson(url).then(function (h) {
        if (!h || !h.samples || !h.items) return;
        var cur = window.PRICE_HISTORY;
        if (!cur || !cur.updated || new Date(h.updated) > new Date(cur.updated)) {
          window.PRICE_HISTORY = h;
          historyStatus = "live";
        }
      }).catch(function () {}));
    }
    loading = Promise.all(jobs).then(function () { loaded = true; loading = null; })
      .catch(function () { loading = null; loaded = true; });
    return loading;
  }

  function render(state, hooks) {
    var root = $("#ahFlips");
    if (!root) return;
    if (!window.PRICE_DATA) {
      root.innerHTML = '<p class="muted">Auction prices have not loaded yet.</p>';
      return;
    }
    ensureExtras().then(function () { renderTable(state, hooks || {}); });
    /* First paint from whatever is already in memory, then refresh when extras arrive. */
    if (window.ITEM_INDEX || window.ITEM_VENDOR || window.PRICE_HISTORY) {
      renderTable(state, hooks || {});
    } else {
      root.innerHTML = '<p class="muted">Loading flip data…</p>';
    }
  }

  document.addEventListener("forever-prices", function () {
    var tab = document.getElementById("tab-gold");
    if (tab && tab.classList.contains("active") && window.ForeverApp) {
      render(ForeverApp.getState(), { save: ForeverApp.save, formatGold: ForeverApp.formatGold });
    }
  });

  window.AhFlips = {
    render: render,
    rows: function () { return lastRows; },
    defaults: DEFAULTS
  };
})();
