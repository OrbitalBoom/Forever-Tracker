/* Forever Tracker: profession leveling guide (1-300) and crafting ROI table.
 * Data: js/professions-data.js (recipes) + data/prices.js / prices.json (AH prices).
 * Runs from file:// too; prices fall back to the bundled snapshot. */
(function () {
  "use strict";

  var D = window.PROF_DATA;
  var APP = function () { return window.ForeverApp; };
  if (!D) return;

  var ORDER = [171, 164, 333, 202, 165, 197, 185, 129, 186];
  var QUALITY = ["poor", "common", "uncommon", "rare", "epic", "legendary", "legendary", "legendary"];
  var AH_CUT = 0.05;
  var REPO_DEFAULT = { owner: "OrbitalBoom", repo: "Forever-Tracker" };

  var prices = window.PRICE_DATA || null;
  var priceStatus = prices ? "bundled" : "none";
  var recipeById = {};
  var producers = {};          // profId -> itemId -> [recipes]
  var unavailable = {};        // spellId -> true when a reagent is missing from the client
  var rendered = false;
  var lastPlan = null;

  ORDER.forEach(function (pid) {
    var p = D.professions[pid];
    if (!p) return;
    producers[pid] = {};
    p.recipes.forEach(function (r) {
      r.pid = pid;
      recipeById[r.id] = r;
      // Skill needed to learn. When the data has no required skill and the colour
      // tiers are not anchored (orange shows as 1), assume it is learned at the
      // yellow threshold, so the planner never counts on an orange range it can't verify.
      r.learnAt = r.r ? Math.max(r.r, r.d[0] || 1) : (r.f & 64) ? r.d[1] : Math.max(1, r.d[0] || 1);
      if (r.g.some(function (g) { var it = D.items[g[0]]; return !it || /^Item \d+$/.test(it[0]); })) unavailable[r.id] = true;
      if (r.i) (producers[pid][r.i] = producers[pid][r.i] || []).push(r);
    });
  });

  /* ---------- helpers ---------- */
  function $(s, root) { return (root || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function item(id) { return D.items[id] || ["Item " + id, 1, 0, 0, 0, 1]; }
  function itemName(id) { return item(id)[0]; }
  function qClass(id) { return "q-" + (QUALITY[item(id)[1]] || "common"); }
  function wowhead(id) { return "https://www.wowhead.com/classic/item=" + id; }
  function itemLink(id) {
    return '<a class="' + qClass(id) + '" href="#item-' + id + '" data-item-id="' + id + '">' + esc(itemName(id)) + "</a>";
  }
  function money(c) {
    if (c == null || isNaN(c)) return '<span class="muted">—</span>';
    var neg = c < 0; c = Math.round(Math.abs(c));
    var g = Math.floor(c / 10000), s = Math.floor((c % 10000) / 100), cc = c % 100;
    var out = [];
    if (g) out.push('<span class="money-g">' + g.toLocaleString() + "g</span>");
    if (g || s) out.push('<span class="money-s">' + s + "s</span>");
    out.push('<span class="money-c">' + cc + "c</span>");
    return (neg ? "-" : "") + out.join(" ");
  }
  function ago(iso) {
    if (!iso) return "unknown";
    var ms = Date.now() - new Date(iso).getTime();
    if (isNaN(ms)) return "unknown";
    var m = Math.round(ms / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + " min ago";
    var h = Math.round(m / 60);
    if (h < 48) return h + " h ago";
    return Math.round(h / 24) + " days ago";
  }

  /* ---------- state ---------- */
  function st() {
    var s = APP().getState();
    if (!s.profGuide || typeof s.profGuide !== "object") s.profGuide = {};
    var g = s.profGuide;
    g.skill = g.skill || {};
    g.done = g.done || {};
    g.locked = g.locked || {};
    g.opts = g.opts || {};
    var o = g.opts;
    if (o.trainer == null) o.trainer = true;
    if (o.vendor == null) o.vendor = true;
    if (o.drop == null) o.drop = false;
    if (o.unknownItem == null) o.unknownItem = false;
    if (o.unknownTrainer == null) o.unknownTrainer = true;
    if (o.spec == null) o.spec = false;
    if (o.resale == null) o.resale = false;
    if (!o.mode) o.mode = "gold";
    if (o.useIntermediates == null) o.useIntermediates = true;
    g.roi = g.roi || { sort: "profit", dir: -1, minQty: 0, onlyProfit: false, level: null };
    if (!g.prof) {
      var mine = (s.professions || []).map(function (p) { return profIdByName(p.name); }).filter(Boolean);
      g.prof = mine[0] || 171;
    }
    return g;
  }
  function save() { APP().save(); }
  function profIdByName(name) {
    if (!name) return null;
    var n = String(name).toLowerCase().replace(/[^a-z]/g, "");
    for (var i = 0; i < ORDER.length; i++) {
      var p = D.professions[ORDER[i]];
      if (p && p.name.toLowerCase().replace(/[^a-z]/g, "") === n) return ORDER[i];
    }
    return null;
  }
  function charProf(pid) {
    var s = APP().getState();
    var name = D.professions[pid].name;
    return (s.professions || []).find(function (p) { return profIdByName(p.name) === pid; }) || null;
  }
  function currentSkill(pid) {
    var cp = charProf(pid);
    if (cp) return Math.max(1, Math.min(300, cp.skill || 1));
    var g = st();
    return Math.max(1, Math.min(300, g.skill[pid] || 1));
  }
  function setSkill(pid, v) {
    v = Math.max(1, Math.min(300, parseInt(v, 10) || 1));
    var cp = charProf(pid);
    if (cp) cp.skill = v; else st().skill[pid] = v;
    save();
  }

  /* ---------- recipe source ---------- */
  function sourceInfo(r) {
    var s = r.s || "";
    var cat, label;
    if (s.indexOf("a") !== -1) { cat = "trainer"; label = "Learned with the profession"; }
    else if (s.indexOf("t") !== -1) { cat = "trainer"; label = "Trainer"; }
    else if (s.indexOf("v") !== -1) { cat = "vendor"; label = "Recipe from a vendor"; }
    else if (/[dqc]/.test(s)) { cat = "drop"; label = s.indexOf("q") !== -1 ? "Quest reward" : s.indexOf("c") !== -1 ? "Found in a container" : "World drop / mob drop"; }
    else if (r.ti) { cat = "unknownItem"; label = "Recipe item, source not yet known"; }
    else { cat = "unknownTrainer"; label = "No source data yet (often a trainer)"; }
    var unconfirmed = !!(r.f & 4) || (!s && !r.ti);
    if (r.f & 8) { label = "Forever vendor"; unconfirmed = false; }
    var cost = null;
    if (typeof r.vc === "number") cost = r.vc;
    return { cat: cat, label: label, unconfirmed: unconfirmed, cost: cost, npcs: r.sn || [], item: r.ti || 0, currency: typeof r.vc === "string" ? r.vc : null };
  }
  function allowed(r, o, forProfit) {
    if (unavailable[r.id]) return false;
    if ((r.f & 128) && !forProfit) return false; // cooldown recipes can't be spammed for skill-ups
    if ((r.f & 2) && !o.spec) return false;
    var c = sourceInfo(r).cat;
    return !!o[c];
  }
  function sourceTag(r) {
    var si = sourceInfo(r);
    var cls = si.cat === "trainer" || si.cat === "unknownTrainer" ? "classic" : si.cat === "vendor" ? "forever" : "missing";
    var txt = si.cat === "trainer" || si.cat === "unknownTrainer" ? "Trainer" : si.cat === "vendor" ? "Vendor recipe" : si.cat === "drop" ? "Drop/quest" : "Recipe item";
    var title = si.label + (si.npcs.length ? ": " + si.npcs.join(", ") : "") + (si.unconfirmed ? " (Classic source, not yet confirmed in Forever)" : "");
    return '<span class="src-tag ' + cls + '" title="' + esc(title) + '">' + txt + (si.unconfirmed ? "?" : "") + "</span>";
  }

  /* ---------- prices ---------- */
  function priceOf(id) {
    var p = prices && prices.items && prices.items[id];
    return p && p.marketValue ? p : null;
  }
  function vendorUnit(id) {
    var it = item(id);
    return it[4] && it[2] > 0 ? it[2] / (it[5] || 1) : null;
  }
  var costMemo = {};
  function unitCost(id, pid, o, depth) {
    var key = pid + ":" + id + ":" + o.mode + ":" + (o.useIntermediates ? 1 : 0) + ":" + depth;
    if (costMemo[key]) return costMemo[key];
    var res;
    if (o.mode === "count") {
      res = vendorUnit(id) != null ? { c: 0.05, how: "vendor" } : { c: 1, how: "count" };
      return (costMemo[key] = res);
    }
    var best = null;
    var v = vendorUnit(id);
    if (v != null) best = { c: v, how: "vendor" };
    var p = priceOf(id);
    if (p && (!best || p.marketValue < best.c)) best = { c: p.marketValue, how: "ah" };
    if (o.useIntermediates && depth < 3 && producers[pid] && producers[pid][id]) {
      producers[pid][id].forEach(function (r) {
        if (unavailable[r.id] || (r.f & 128) || (r.f & 2)) return;
        var c = recipeCost(r, o, depth + 1);
        if (c.c == null) return;
        var per = c.c / ((r.y[0] + r.y[1]) / 2 || 1);
        if (!best || per < best.c) best = { c: per, how: "craft", recipe: r };
      });
    }
    if (!best) {
      var it = item(id);
      if (it[2] > 0) best = { c: it[2], how: "est" };
      else if (it[3] > 0) best = { c: it[3] * 4, how: "est" };
      else best = { c: null, how: "none" };
    }
    return (costMemo[key] = best);
  }
  function recipeCost(r, o, depth) {
    var total = 0, est = false, missing = false;
    for (var i = 0; i < r.g.length; i++) {
      var u = unitCost(r.g[i][0], r.pid, o, depth || 0);
      if (u.c == null) { missing = true; continue; }
      if (u.how === "est") est = true;
      total += u.c * r.g[i][1];
    }
    return { c: missing && total === 0 ? null : total, est: est, missing: missing };
  }
  function sellValue(r) {
    if (!r.i) return null;
    var y = (r.y[0] + r.y[1]) / 2;
    var p = priceOf(r.i);
    var vend = item(r.i)[3] || 0;
    var ah = p ? p.marketValue * (1 - AH_CUT) : 0;
    return Math.max(ah, vend) * y;
  }

  /* ---------- skill-up model ---------- */
  function chance(r, s) {
    var d = r.d;
    if (s < r.learnAt) return 0;
    if (s < d[1]) return 1;                 // orange
    if (s >= d[3]) return 0;                // grey
    return Math.max(0, Math.min(1, (d[3] - s) / (d[3] - d[1]))); // yellow/green formula
  }
  function color(r, s) {
    var d = r.d;
    if (s < d[1]) return "orange";
    if (s < d[2]) return "yellow";
    if (s < d[3]) return "green";
    return "grey";
  }

  /* ---------- optimizer ---------- */
  function plan(pid, start, o) {
    costMemo = {};
    var recs = D.professions[pid].recipes.filter(function (r) { return allowed(r, o); });
    var costs = {};
    recs.forEach(function (r) {
      var c = recipeCost(r, o, 0);
      var net = c.c;
      if (net != null && o.resale && o.mode === "gold") { var sv = sellValue(r); if (sv) net -= sv; }
      costs[r.id] = { c: c.c, net: net, est: c.est };
    });
    var best = new Array(302), choice = new Array(302);
    best[300] = 0; best[301] = 0;
    for (var s = 299; s >= start; s--) {
      var bv = Infinity, br = null;
      for (var i = 0; i < recs.length; i++) {
        var r = recs[i], cc = costs[r.id];
        if (cc.net == null) continue;
        var p = chance(r, s);
        if (p <= 0) continue;
        var val = cc.net / p + best[Math.min(300, s + (r.u || 1))];
        if (val < bv) { bv = val; br = r; }
      }
      if (br) { best[s] = bv; choice[s] = br; }
      else { best[s] = best[s + 1]; choice[s] = null; }
    }
    var steps = [], cur = null;
    for (s = start; s < 300; ) {
      var r2 = choice[s];
      var adv = r2 ? (r2.u || 1) : 1;
      var p2 = r2 ? chance(r2, s) : 0;
      if (!cur || (cur.r || null) !== (r2 || null)) {
        cur = { r: r2, from: s, to: s, crafts: 0, cost: 0 };
        steps.push(cur);
      }
      if (r2) { cur.crafts += 1 / p2; cur.cost += (costs[r2.id].c || 0) / p2; }
      s += adv; cur.to = Math.min(300, s);
    }
    steps.forEach(function (x) {
      x.id = "pg:" + pid + ":" + (x.r ? x.r.id : "gap") + ":" + x.from;
      x.n = Math.ceil(x.crafts - 1e-9);
      x.est = x.r ? costs[x.r.id].est : false;
    });
    return { pid: pid, start: start, steps: steps, opts: JSON.parse(JSON.stringify(o)) };
  }

  function shopping(steps, pid, o) {
    var list = {}, crafted = {}, recipesNeeded = {};
    function add(id, qty, depth) {
      var u = unitCost(id, pid, o, depth);
      if (u.how === "craft" && u.recipe && depth < 3) {
        var y = (u.recipe.y[0] + u.recipe.y[1]) / 2 || 1;
        var n = qty / y;
        crafted[u.recipe.id] = (crafted[u.recipe.id] || 0) + n;
        u.recipe.g.forEach(function (g) { add(g[0], g[1] * n, depth + 1); });
        if (!/trainer/i.test(sourceInfo(u.recipe).cat)) recipesNeeded[u.recipe.id] = true;
        return;
      }
      if (!list[id]) list[id] = { qty: 0, u: u };
      list[id].qty += qty;
    }
    steps.forEach(function (x) {
      if (!x.r) return;
      if (!/trainer/i.test(sourceInfo(x.r).cat)) recipesNeeded[x.r.id] = true;
      x.r.g.forEach(function (g) { add(g[0], g[1] * x.n, 0); });
    });
    return { list: list, crafted: crafted, recipesNeeded: recipesNeeded };
  }

  /* ---------- rendering ---------- */
  function profOptions(sel) {
    return ORDER.filter(function (pid) { return D.professions[pid]; }).map(function (pid) {
      var n = D.professions[pid].name + (pid === 186 ? " (smelting)" : "");
      return '<option value="' + pid + '"' + (pid === sel ? " selected" : "") + ">" + esc(n) + "</option>";
    }).join("");
  }

  function priceLine() {
    if (!prices) return '<span class="muted">No auction prices loaded. Costs use vendor prices and estimates.</span>';
    var n = Object.keys(prices.items || {}).length;
    return "Prices updated <strong>" + esc(ago(prices.updated)) + "</strong> · " + esc(prices.region || "US") + " " +
      esc(prices.ruleset || "Normal") + " " + esc(prices.faction || "Horde") + " AH · " + n.toLocaleString() + " items · source: " +
      '<a href="' + esc(prices.sourceUrl || "#") + '" target="_blank" rel="noopener">' + esc(prices.source || "unknown") + "</a>" +
      (priceStatus === "bundled" ? ' <span class="muted">(bundled snapshot)</span>' : "");
  }

  function render() {
    var root = $("#profGuide");
    if (!root || !APP()) return;
    var g = st(), o = g.opts, pid = g.prof;
    var skill = currentSkill(pid);
    var html = "";
    html += '<div class="route-toolbar pg-toolbar">' +
      '<label class="field">Profession<select id="pgProf">' + profOptions(pid) + "</select></label>" +
      '<label class="field">Current skill<input type="number" id="pgSkill" min="1" max="300" value="' + skill + '"></label>' +
      '<label class="field">Optimize for<select id="pgMode"><option value="gold"' + (o.mode === "gold" ? " selected" : "") + '>Lowest gold cost (AH prices)</option><option value="count"' + (o.mode === "count" ? " selected" : "") + ">Fewest raw materials</option></select></label>" +
      '<button type="button" class="btn btn-sm" id="pgRefresh">Refresh prices</button>' +
      "</div>";
    html += '<div class="pg-opts">' +
      chk("trainer", "Trainer recipes", o.trainer) + chk("vendor", "Vendor-bought recipes", o.vendor) +
      chk("drop", "Drop / quest recipes", o.drop) + chk("unknownItem", "Recipe items with unknown source", o.unknownItem) +
      chk("unknownTrainer", "Recipes with no source data (often trainer)", o.unknownTrainer) +
      chk("spec", "Specialization recipes", o.spec) + chk("useIntermediates", "Craft my own bars/bolts/parts when cheaper", o.useIntermediates) +
      chk("resale", "Subtract what the crafted items sell for", o.resale) + "</div>";
    html += '<p class="muted pg-price">' + priceLine() + "</p>";
    html += '<div class="mode-toggle pg-sub"><button type="button" class="btn btn-sm' + (g.view !== "roi" ? " btn-primary" : "") + '" data-pgview="level">Leveling guide 1–300</button>' +
      '<button type="button" class="btn btn-sm' + (g.view === "roi" ? " btn-primary" : "") + '" data-pgview="roi">Best profit by skill</button></div>';
    html += '<div id="pgBody"></div>';
    root.innerHTML = html;
    if (g.view === "roi") renderRoi(); else renderLevel();
    rendered = true;
  }
  function chk(k, label, v) {
    return '<label class="check"><input type="checkbox" data-pgopt="' + k + '"' + (v ? " checked" : "") + "> " + esc(label) + "</label>";
  }

  function colorChip(r, s) {
    var c = color(r, s);
    return '<span class="sk sk-' + c + '" title="' + c + " at " + s + " (" + r.d.join(" / ") + ')">' + c + "</span>";
  }

  function renderLevel() {
    var g = st(), o = g.opts, pid = g.prof, body = $("#pgBody");
    var start = currentSkill(pid);
    var locked = g.locked[pid];
    var p;
    if (locked) {
      costMemo = {};
      p = { pid: pid, start: locked.start, steps: locked.steps.map(function (x) {
        var r = recipeById[x.sp] || null;
        var cost = r ? (recipeCost(r, o, 0).c || 0) * x.crafts : 0;
        return { id: x.id, r: r, from: x.from, to: x.to, crafts: x.crafts, n: Math.ceil(x.crafts - 1e-9), cost: cost, est: r ? recipeCost(r, o, 0).est : false };
      }) };
    } else {
      p = plan(pid, Math.min(start, 299), o);
    }
    lastPlan = p;
    if (start >= 300 && !locked) { body.innerHTML = '<p class="muted">Already at 300. Switch to "Best profit by skill" to see what to craft.</p>'; return; }
    var shop = shopping(p.steps, pid, o);
    var totalCost = 0, totalCrafts = 0;
    p.steps.forEach(function (x) { totalCost += x.cost; totalCrafts += x.n; });
    var countMode = o.mode === "count";
    var h = '<div class="stat-row">' +
      pill("Plan", (locked ? "Locked " + esc(locked.at) : "Live") + " · " + p.start + " → 300") +
      pill("Crafts (expected)", totalCrafts.toLocaleString()) +
      pill(countMode ? "Raw materials" : "Estimated cost", countMode ? Math.round(totalCost).toLocaleString() + " units" : money(totalCost)) +
      "</div>";
    h += '<div class="row-actions">' + (locked
      ? '<button type="button" class="btn btn-sm" id="pgUnlock">Unlock plan (re-optimize with today\'s prices)</button>'
      : '<button type="button" class="btn btn-sm" id="pgLock">Lock this plan</button> <span class="muted">Locking keeps the steps (and your checkmarks) fixed when prices change.</span>') + "</div>";
    h += '<p class="muted">Expected crafts use the skill-up chance: orange 100%, then (grey − skill) / (grey − yellow) through yellow and green, 0 at grey. Real results vary a little. Colours and costs come from Forever client data (build ' + esc(D.meta.clientBuild) + "); costs from " + (prices ? "the AH snapshot above, or the vendor price when cheaper" : "vendor prices and estimates") + ".</p>";
    h += '<div class="pg-steps">';
    var gates = [{ at: 50, t: "Journeyman (needs skill 50, level 10) to go past 75" }, { at: 125, t: "Expert (needs skill 125, level 20) to go past 150" }, { at: 200, t: "Artisan (needs skill 200, level 35) to go past 225" }];
    p.steps.forEach(function (x) {
      gates.forEach(function (gt) {
        if (!gt.shown && x.to > gt.at + 25 && p.start < gt.at + 25 && x.from <= gt.at + 25) {
          gt.shown = true;
          h += '<div class="pg-gate">Train ' + esc(gt.t) + " (Classic rule).</div>";
        }
      });
      var done = !!g.done[x.id];
      if (!x.r) {
        h += '<div class="route-step pg-step"><div class="step-main"><h4>' + x.from + "–" + x.to + ": no recipe available with the current filters</h4><p>Turn on more recipe sources above.</p></div></div>";
        return;
      }
      var r = x.r, si = sourceInfo(r);
      var reag = r.g.map(function (gg) {
        var u = unitCost(gg[0], pid, o, 0);
        var how = u.how === "vendor" ? "vendor" : u.how === "ah" ? "AH" : u.how === "craft" ? "craft" : u.how === "est" ? "est." : "";
        return gg[1] + "× " + itemLink(gg[0]) + (how ? ' <span class="muted">(' + how + ")</span>" : "");
      }).join(", ");
      var learn = /trainer/i.test(si.cat) ? "" : '<div class="muted">Learn: ' + esc(si.label) + (si.item ? " · " + itemLink(si.item) : "") +
        (si.cost != null ? " · " + money(si.cost) : "") + (si.npcs.length ? " · " + esc(si.npcs.join(", ")) : "") + "</div>";
      h += '<div class="route-step pg-step' + (done ? " done" : "") + '"><input type="checkbox" data-pgstep="' + esc(x.id) + '"' + (done ? " checked" : "") + ' aria-label="Done">' +
        '<div class="step-main"><h4><span class="pg-range">' + x.from + "–" + x.to + "</span> Craft " + x.n + "× " +
        (r.i ? itemLink(r.i) : esc(r.n)) + (r.i && itemName(r.i) !== r.n ? ' <span class="muted">(' + esc(r.n) + ")</span>" : "") +
        " " + colorChip(r, x.from) + " " + sourceTag(r) + "</h4>" +
        "<p>" + reag + " · per craft " + (countMode ? "" : money(x.cost / Math.max(1e-9, x.crafts))) + " · step " + (countMode ? Math.round(x.cost) + " units" : money(x.cost)) + (x.est ? ' <span class="muted">(includes estimates)</span>' : "") + "</p>" + learn + "</div></div>";
    });
    h += "</div>";
    // shopping list
    var ids = Object.keys(shop.list).sort(function (a, b) { return itemName(a) < itemName(b) ? -1 : 1; });
    var shopTotal = 0;
    h += "<h3>Shopping list</h3><div class=\"table-wrap\"><table class=\"data\"><thead><tr><th>Material</th><th>Qty</th><th>Buy from</th><th>Unit</th><th>Total</th></tr></thead><tbody>";
    ids.forEach(function (id) {
      var e = shop.list[id], q = Math.ceil(e.qty - 1e-9), u = e.u;
      var unit = o.mode === "count" ? unitCost(id, pid, { mode: "gold", useIntermediates: false }, 0) : u;
      var tot = unit.c != null ? unit.c * q : null;
      if (tot) shopTotal += tot;
      var from = unit.how === "vendor" ? "Vendor" : unit.how === "ah" ? "Auction house" : unit.how === "est" ? "Not on AH now (est.)" : "Unknown";
      h += "<tr><td>" + itemLink(id) + "</td><td>" + q.toLocaleString() + "</td><td>" + from + "</td><td>" + money(unit.c) + "</td><td>" + money(tot) + "</td></tr>";
    });
    h += '</tbody><tfoot><tr><th colspan="4">Total</th><th>' + money(shopTotal) + "</th></tr></tfoot></table></div>";
    var crafted = Object.keys(shop.crafted);
    if (crafted.length) {
      h += '<p class="muted">Craft these yourself along the way (cheaper than buying; they may give extra skill-ups): ' + crafted.map(function (id) {
        var r = recipeById[id]; return Math.ceil(shop.crafted[id] - 1e-9) + "× " + (r.i ? itemLink(r.i) : esc(r.n));
      }).join(", ") + ".</p>";
    }
    var need = Object.keys(shop.recipesNeeded);
    if (need.length) {
      h += "<h3>Recipes to buy or find</h3><ul class=\"pg-need\">" + need.map(function (id) {
        var r = recipeById[id], si = sourceInfo(r);
        return "<li>" + (si.item ? itemLink(si.item) : esc(r.n)) + " · " + esc(si.label) + (si.cost != null ? " · " + money(si.cost) : "") +
          (si.currency ? " · Merchant's Favor" : "") + (si.npcs.length ? " · " + esc(si.npcs.join(", ")) : "") +
          (priceOf(si.item) ? " · AH " + money(priceOf(si.item).marketValue) : "") + (si.unconfirmed ? ' <span class="muted">(Classic source, unconfirmed in Forever)</span>' : "") + "</li>";
      }).join("") + "</ul>";
    }
    body.innerHTML = h;
  }

  function pill(label, value) {
    return '<div class="stat-pill"><div class="kicker">' + label + '</div><div class="value">' + value + "</div></div>";
  }

  function roiRows(pid, level, o) {
    costMemo = {};
    var go = { mode: "gold", useIntermediates: o.useIntermediates };
    return D.professions[pid].recipes.filter(function (r) {
      return r.i && !unavailable[r.id] && r.learnAt <= level && allowed(r, o, true);
    }).map(function (r) {
      var c = recipeCost(r, go, 0);
      var y = (r.y[0] + r.y[1]) / 2;
      var p = priceOf(r.i);
      var vend = item(r.i)[3] || 0;
      var revenue = p ? p.marketValue * (1 - AH_CUT) * y : null;
      var basis = revenue != null ? revenue : vend * y;
      var profit = c.c != null ? basis - c.c : null;
      return {
        r: r, cost: c.c, est: c.est, y: y, ah: p ? p.marketValue : null, min: p ? p.minBuyout : null, vend: vend,
        profit: profit, roi: profit != null && c.c > 0 ? profit / c.c : null, qty: p ? p.quantity : 0,
        sold: p ? p.soldPerDay : null, onlyVendor: revenue == null, color: color(r, level)
      };
    });
  }

  var ROI_COLS = [
    ["name", "Recipe"], ["color", "Colour"], ["cost", "Materials"], ["ah", "AH price (each)"], ["vend", "Vendor sells"],
    ["profit", "Profit / craft"], ["roi", "ROI"], ["qty", "Listed"], ["sold", "Sold / day"]
  ];
  var COLOR_RANK = { orange: 0, yellow: 1, green: 2, grey: 3 };

  function renderRoi() {
    var g = st(), o = g.opts, pid = g.prof, body = $("#pgBody"), ro = g.roi;
    var level = ro.level || currentSkill(pid);
    var rows = roiRows(pid, level, o);
    if (ro.onlyProfit) rows = rows.filter(function (x) { return x.profit != null && x.profit > 0; });
    if (ro.minQty) rows = rows.filter(function (x) { return (x.qty || 0) >= ro.minQty; });
    var k = ro.sort, dir = ro.dir || -1;
    rows.sort(function (a, b) {
      var va, vb;
      if (k === "name") { va = itemName(a.r.i); vb = itemName(b.r.i); return va < vb ? -dir : va > vb ? dir : 0; }
      if (k === "color") { va = COLOR_RANK[a.color]; vb = COLOR_RANK[b.color]; }
      else { va = a[k]; vb = b[k]; }
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (va - vb) * dir;
    });
    var h = '<div class="route-toolbar">' +
      '<label class="field">Skill level<input type="number" id="pgRoiLevel" min="1" max="300" value="' + level + '"></label>' +
      '<label class="field">Min. listed on AH<input type="number" id="pgRoiQty" min="0" value="' + (ro.minQty || 0) + '"></label>' +
      '<label class="check"><input type="checkbox" id="pgRoiProfit"' + (ro.onlyProfit ? " checked" : "") + "> Only profitable</label>" +
      '<button type="button" class="btn btn-sm" id="pgRoiMine">Use my skill (' + currentSkill(pid) + ")</button></div>";
    h += '<p class="muted">Every recipe you can know at skill ' + level + " with the recipe filters above. Profit = AH price × yield × 0.95 (the AH keeps 5%) − materials, where each material counts at its cheapest of AH price, vendor price, or crafting it yourself. With no AH price, the vendor sell price is used (marked “vendor”). The deposit is not included. Check “Listed” and “Sold / day” before crafting a stack: a price nobody pays is not profit.</p>";
    h += '<div class="table-wrap"><table class="data pg-roi" id="pgRoiTable"><thead><tr>' + ROI_COLS.map(function (c) {
      var arrow = c[0] === k ? (dir > 0 ? " ▲" : " ▼") : "";
      return '<th data-pgsort="' + c[0] + '" class="sortable">' + esc(c[1]) + arrow + "</th>";
    }).join("") + "</tr></thead><tbody>";
    rows.forEach(function (x) {
      var r = x.r;
      h += "<tr><td>" + itemLink(r.i) + (x.y !== 1 ? ' <span class="muted">×' + x.y + "</span>" : "") + " " + sourceTag(r) +
        (r.cd ? ' <span class="kind-tag" title="Has a cooldown">' + (r.cd >= 24 ? Math.round(r.cd / 24) + "d" : r.cd + "h") + " cd</span>" : "") +
        ((r.f & 64) ? ' <span class="muted" title="Learn skill not in the data; assumed at the yellow threshold">*</span>' : "") + "</td>" +
        "<td>" + colorChip(r, level) + "</td>" +
        "<td>" + money(x.cost) + (x.est ? ' <span class="muted">est.</span>' : "") + "</td>" +
        "<td>" + (x.ah != null ? money(x.ah) + (x.min != null && x.min < x.ah ? '<div class="muted">min ' + money(x.min) + "</div>" : "") : '<span class="muted">not listed</span>') + "</td>" +
        "<td>" + money(x.vend) + "</td>" +
        '<td class="' + (x.profit > 0 ? "pg-pos" : x.profit < 0 ? "pg-neg" : "") + '">' + money(x.profit) + (x.onlyVendor && x.profit != null ? ' <span class="muted">vendor</span>' : "") + "</td>" +
        "<td>" + (x.roi != null ? Math.round(x.roi * 100) + "%" : '<span class="muted">—</span>') + "</td>" +
        "<td>" + (x.qty ? x.qty.toLocaleString() : "0") + "</td>" +
        "<td>" + (x.sold != null ? Number(x.sold).toLocaleString() : '<span class="muted">—</span>') + "</td></tr>";
    });
    if (!rows.length) h += '<tr><td colspan="9" class="muted">No recipes match. Lower the filters or raise the skill level.</td></tr>';
    h += "</tbody></table></div>";
    h += '<p class="muted">* Skill to learn is not in the Forever data yet; assumed at the yellow threshold. Recipes with a cooldown are listed here but never used in the leveling guide.</p>';
    if (pid === 333) h += '<p class="muted">Enchants applied to gear make no item, so they are not listed here; wands, rods and oils are.</p>';
    body.innerHTML = h;
  }

  /* ---------- events ---------- */
  function bind() {
    document.addEventListener("change", function (e) {
      var t = e.target;
      if (!t.closest || !t.closest("#profGuide")) return;
      var g = st();
      if (t.id === "pgProf") { g.prof = parseInt(t.value, 10); g.roi.level = null; save(); render(); }
      else if (t.id === "pgSkill") { setSkill(g.prof, t.value); render(); }
      else if (t.id === "pgMode") { g.opts.mode = t.value; save(); render(); }
      else if (t.getAttribute("data-pgopt")) { g.opts[t.getAttribute("data-pgopt")] = t.checked; save(); render(); }
      else if (t.getAttribute("data-pgstep")) {
        var id = t.getAttribute("data-pgstep");
        if (t.checked) g.done[id] = true; else delete g.done[id];
        save();
        var row = t.closest(".pg-step"); if (row) row.classList.toggle("done", t.checked);
      }
      else if (t.id === "pgRoiLevel") { g.roi.level = Math.max(1, Math.min(300, parseInt(t.value, 10) || 1)); save(); renderRoi(); }
      else if (t.id === "pgRoiQty") { g.roi.minQty = Math.max(0, parseInt(t.value, 10) || 0); save(); renderRoi(); }
      else if (t.id === "pgRoiProfit") { g.roi.onlyProfit = t.checked; save(); renderRoi(); }
    });
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t.closest || !t.closest("#profGuide")) return;
      var g = st();
      var v = t.closest("[data-pgview]");
      if (v) { g.view = v.getAttribute("data-pgview"); save(); render(); return; }
      var th = t.closest("[data-pgsort]");
      if (th) {
        var k = th.getAttribute("data-pgsort");
        if (g.roi.sort === k) g.roi.dir = -(g.roi.dir || -1); else { g.roi.sort = k; g.roi.dir = k === "name" || k === "color" ? 1 : -1; }
        save(); renderRoi(); return;
      }
      if (t.id === "pgRefresh") { loadRemotePrices(true); return; }
      if (t.id === "pgRoiMine") { g.roi.level = null; save(); renderRoi(); return; }
      if (t.id === "pgLock" && lastPlan) {
        g.locked[g.prof] = {
          at: new Date().toISOString().slice(0, 10), start: lastPlan.start,
          steps: lastPlan.steps.filter(function (x) { return x.r; }).map(function (x) {
            return { id: x.id, sp: x.r.id, from: x.from, to: x.to, crafts: Math.round(x.crafts * 100) / 100 };
          })
        };
        save(); render(); return;
      }
      if (t.id === "pgUnlock") { delete g.locked[g.prof]; save(); render(); return; }
    });
  }

  /* ---------- remote prices ---------- */
  function repo() {
    var h = location.hostname || "";
    if (/\.github\.io$/i.test(h)) {
      var seg = location.pathname.split("/").filter(Boolean)[0];
      if (seg) return { owner: h.split(".")[0], repo: seg };
    }
    return REPO_DEFAULT;
  }
  function newer(a, b) {
    if (!a) return b; if (!b) return a;
    return new Date(b.updated) > new Date(a.updated) ? b : a;
  }
  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function loadRemotePrices(manual) {
    if (typeof fetch !== "function") return;
    var rp = repo();
    var bucket = Math.floor(Date.now() / 300000);
    var urls = ["https://raw.githubusercontent.com/" + rp.owner + "/" + rp.repo + "/prices-data/prices.json?b=" + bucket];
    if (location.protocol !== "file:") urls.push("data/prices.json?b=" + bucket);
    Promise.all(urls.map(function (u) { return fetchJson(u).catch(function () { return null; }); })).then(function (res) {
      var best = prices, changed = false;
      res.forEach(function (p) {
        if (p && p.items && p.updated) {
          var nb = newer(best, p);
          if (nb !== best) { best = nb; changed = true; }
        }
      });
      if (changed) { prices = best; priceStatus = "live"; }
      else if (prices && priceStatus === "bundled" && res.some(Boolean)) priceStatus = "live";
      if (rendered) render();
      if (manual && APP()) {
        var tEl = document.getElementById("toast");
        if (tEl) { tEl.textContent = changed ? "Loaded newer prices" : "Prices are already the newest available"; tEl.hidden = false; setTimeout(function () { tEl.hidden = true; }, 2500); }
      }
    });
  }

  window.ProfGuide = {
    render: render,
    plan: function (pid, start, opts) { st(); return plan(pid, start, Object.assign({}, st().opts, opts || {})); },
    roiRows: function (pid, level) { return roiRows(pid, level, st().opts); },
    prices: function () { return prices; },
    chance: chance
  };

  function boot() { bind(); loadRemotePrices(false); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
