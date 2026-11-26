/* Self-hosted Classic-style item tooltip. Does not load Wowhead power.js. */
(function () {
  var VERSION = "20261126e";
  var ICON = "https://render.worldofwarcraft.com/forever-us/icons/56/{icon}.jpg";
  var HOVER_DELAY = 80;
  var HOLD_MS = 420;
  var HIDE_DELAY = 40;
  var DWELL_MS = 1000;
  var LOCK_GRACE_MS = 250;

  var tip = null;
  var tipCompare = null;
  var showTimer = null;
  var hideTimer = null;
  var holdTimer = null;
  var reqGen = 0;
  var current = null; /* { id, slot, x, y } */
  var cache = {};
  var shiftHeld = false;
  var suppressClick = false;
  var pinned = false;
  var lockMode = null; /* null | "dwell" | "pin" */
  var dwellStartedAt = 0;
  var dwellRaf = null;
  var overAnchor = false;
  var overTip = false;
  var extrasLoading = null;
  var lastPointer = { x: 0, y: 0, type: "mouse" };

  var STAT_WHITE = {
    str: "Strength", agi: "Agility", sta: "Stamina", int: "Intellect", spi: "Spirit"
  };
  var STAT_RESIST = {
    fireRes: "Fire Resistance", frostRes: "Frost Resistance", natureRes: "Nature Resistance",
    shadowRes: "Shadow Resistance", arcaneRes: "Arcane Resistance", holyRes: "Holy Resistance"
  };
  var STAT_GREEN = {
    ap: "Attack Power", rap: "Ranged Attack Power", fap: "Feral Attack Power",
    crit: "Critical Strike", hit: "Hit", spellCrit: "Spell Critical Strike",
    spellHit: "Spell Hit", sp: "Spell Damage", healing: "Healing",
    mp5: "Mana per 5 sec.", hp5: "Health per 5 sec.", defense: "Defense",
    dodge: "Dodge", parry: "Parry", blockChance: "Block Chance",
    blockValue: "Block Value", block: "Block", spellPen: "Spell Penetration",
    spFire: "Fire Spell Damage", spFrost: "Frost Spell Damage",
    spShadow: "Shadow Spell Damage", spNature: "Nature Spell Damage",
    spArcane: "Arcane Spell Damage", spHoly: "Holy Spell Damage"
  };
  var TYPE_RIGHT = {
    cloth: "Cloth", leather: "Leather", mail: "Mail", plate: "Plate",
    sword: "Sword", axe: "Axe", mace: "Mace", dagger: "Dagger", staff: "Staff",
    polearm: "Polearm", fist: "Fist Weapon", bow: "Bow", gun: "Gun",
    crossbow: "Crossbow", wand: "Wand", thrown: "Thrown", shield: "Shield",
    idol: "Idol", totem: "Totem", libram: "Libram"
  };
  var CONSUMABLE_TYPE = {
    potion: "Potion", elixir: "Elixir", flask: "Flask", food: "Food",
    scroll: "Scroll", bandage: "Bandage", explosives: "Explosives"
  };
  var BIND_LINE = {
    bop: "Binds when picked up",
    boe: "Binds when equipped",
    bou: "Binds when used",
    quest: "Quest Item"
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function qClass(q) { return "q-" + (q || "common"); }
  function titleType(t) { return TYPE_RIGHT[t] || ""; }

  function coins(copper) {
    if (copper == null || isNaN(copper)) return "";
    var n = Math.round(Math.abs(copper));
    var g = Math.floor(n / 10000), s = Math.floor((n % 10000) / 100), c = n % 100;
    var out = [];
    if (g) out.push('<span class="tt-amt">' + g.toLocaleString() + '</span><span class="tt-coin gold" title="Gold"></span>');
    if (g || s) out.push('<span class="tt-amt">' + s + '</span><span class="tt-coin silver" title="Silver"></span>');
    if (!g || c) out.push('<span class="tt-amt">' + c + '</span><span class="tt-coin copper" title="Copper"></span>');
    return '<span class="tt-coins">' + (copper < 0 ? "−" : "") + out.join(" ") + "</span>";
  }

  function charLevel() {
    try {
      var s = window.ForeverApp && ForeverApp.getState && ForeverApp.getState();
      return (s && s.character && s.character.level) || 0;
    } catch (e) { return 0; }
  }
  function equippedIn(slotId) {
    if (!slotId) return null;
    try {
      var s = window.ForeverApp && ForeverApp.getState && ForeverApp.getState();
      return (s && s.equipment && s.equipment[slotId]) || null;
    } catch (e) { return null; }
  }
  function customOrEquipped(id) {
    try {
      var s = window.ForeverApp && ForeverApp.getState && ForeverApp.getState();
      if (!s) return null;
      var list = (s.customItems || []).concat(Object.keys(s.equipment || {}).map(function (k) { return s.equipment[k]; }));
      return list.filter(Boolean).find(function (it) { return String(it.id) === String(id); }) || null;
    } catch (e) { return null; }
  }
  function indexItem(id) {
    var idx = window.ITEM_INDEX;
    if (idx && idx.length) {
      for (var i = 0; i < idx.length; i++) {
        if (String(idx[i].id) === String(id)) {
          var it = idx[i];
          return {
            id: it.id, name: it.n, quality: it.q, cat: it.cat, icon: it.icon,
            itemLevel: it.il, reqLevel: it.rl, slot: it.slot, type: it.typ,
            forever: it.f === 1, nt: it.nt, _partial: true
          };
        }
      }
    }
    var gear = (window.ITEM_GEAR || []).concat([]);
    var g = gear.find(function (it) { return it && String(it.id) === String(id); });
    if (g) return g;
    return customOrEquipped(id);
  }

  function ensureDb() {
    if (window.ItemDB && ItemDB.ensure) return ItemDB.ensure();
    return Promise.resolve();
  }
  function detailOf(id) {
    var key = String(id);
    if (cache[key] && !cache[key]._partial) return Promise.resolve(cache[key]);
    return ensureDb().then(function () {
      if (window.ItemDB && ItemDB.detailOf) return ItemDB.detailOf(id);
      var g = (window.ITEM_GEAR || []).find(function (it) { return String(it.id) === String(id); });
      return g || customOrEquipped(id);
    }).then(function (d) {
      if (d) cache[String(d.id != null ? d.id : id)] = d;
      return d;
    });
  }

  function priceOf(id) {
    if (window.priceEntry) return window.priceEntry(id);
    var items = window.PRICE_DATA && window.PRICE_DATA.items;
    var p = items && (items[id] || items[String(id)]);
    if (p && Array.isArray(p)) p = { minBuyout: p[0], marketValue: p[1], quantity: p[2], soldPerDay: p.length > 3 ? p[3] : null };
    return p && (p.marketValue || p.minBuyout) ? p : null;
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
  function ensureExtras() {
    var jobs = [];
    if (!window.PRICE_HISTORY) {
      jobs.push(loadScript("data/price-history.js?v=" + encodeURIComponent(VERSION)).catch(function () { return null; }));
    }
    if (!window.ITEM_STACKS) {
      jobs.push(loadScript("data/item-stacks.js?v=" + encodeURIComponent(VERSION)).catch(function () { return null; }));
    }
    if (!jobs.length) return Promise.resolve();
    if (extrasLoading) return extrasLoading;
    extrasLoading = Promise.all(jobs).then(function () { extrasLoading = null; });
    return extrasLoading;
  }
  function stackOf(id) {
    var s = window.ITEM_STACKS;
    var n = s && (s[id] || s[String(id)]);
    return (n && n > 1) ? n : 0;
  }
  function formatTs(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" }) + " ET";
    } catch (e) { return iso; }
  }
  function priceUpdated() {
    var d = window.PRICE_DATA;
    return (d && (d.updated || d.fetched)) || "";
  }
  function historySeries(id) {
    var h = window.PRICE_HISTORY;
    if (!h || !h.items) return null;
    var arr = h.items[id] || h.items[String(id)];
    if (!arr || !arr.length) return null;
    var pts = [];
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] != null && arr[i] > 0) pts.push(arr[i]);
    }
    if (!pts.length) return null;
    var vals = pts.slice().sort(function (a, b) { return a - b; });
    var mid = vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2;
    return { first: pts[0], last: pts[pts.length - 1], median: mid, n: pts.length, days: h.windowDays || 7 };
  }
  function ahLines(item) {
    if (!item || item.id == null) return [];
    var lines = [];
    var p = priceOf(item.id);
    if (p && (p.minBuyout || p.marketValue)) {
      if (p.minBuyout) lines.push("AH min buyout: " + coins(p.minBuyout));
      if (p.marketValue) lines.push("AH usual (market): " + coins(p.marketValue));
      var vol = [];
      if (p.quantity != null) vol.push(Number(p.quantity).toLocaleString() + " listed");
      if (p.soldPerDay != null && p.soldPerDay !== "") {
        var spd = Number(p.soldPerDay);
        vol.push((Number.isInteger(spd) ? String(spd) : spd.toLocaleString(undefined, { maximumFractionDigits: 1 })) + " sold/day");
      }
      if (vol.length) lines.push(vol.join(" · "));
      var upd = formatTs(priceUpdated());
      if (upd) lines.push("Updated " + esc(upd));
      var stack = stackOf(item.id);
      if (stack) {
        var minS = p.minBuyout ? p.minBuyout * stack : null;
        var mktS = p.marketValue ? p.marketValue * stack : null;
        if (minS && mktS && minS !== mktS) {
          lines.push("Per stack of " + stack + " (min): " + coins(minS));
          lines.push("Per stack of " + stack + " (usual): " + coins(mktS));
        } else if (minS || mktS) {
          lines.push("Per stack of " + stack + ": " + coins(minS || mktS));
        }
      }
    } else {
      lines.push("No current AH listings");
    }
    var hist = historySeries(item.id);
    if (hist) {
      lines.push(hist.days + "-day usual (median of " + hist.n + "): " + coins(hist.median));
      if (hist.n >= 2 && hist.first) {
        var dlt = hist.last - hist.first;
        var pct = (dlt / hist.first) * 100;
        var dir = dlt > 0 ? "up" : dlt < 0 ? "down" : "unchanged";
        var cls = dlt > 0 ? " is-up" : dlt < 0 ? " is-down" : "";
        var pctTxt = Math.abs(pct) >= 0.5 ? (" " + dir + " " + Math.abs(pct).toFixed(0) + "%") : " unchanged";
        lines.push('<span class="item-tt-trend' + cls + '">' + hist.days + "-day trend: " +
          coins(hist.first) + " → " + coins(hist.last) + pctTxt + "</span>");
      }
    }
    return lines;
  }

  function itemScore(item) {
    if (window.ForeverItems && ForeverItems.itemScore) return ForeverItems.itemScore(item);
    return 0;
  }

  function compareLine(item, slotId) {
    var eq = equippedIn(slotId);
    if (!eq || !item || String(eq.id) === String(item.id)) return "";
    var a = itemScore(item), b = itemScore(eq);
    var d = a - b;
    if (Math.abs(d) < 0.05) return "";
    var sign = d > 0 ? "+" : "";
    var verb = d > 0 ? "Upgrade over " : "Below ";
    return verb + (eq.name || "equipped") + ": " + sign + d.toFixed(1);
  }

  function findCompareSlot(item, hinted) {
    if (hinted && equippedIn(hinted)) return hinted;
    if (!item || !window.ForeverItems || !window.DATA || !DATA.slots) return hinted || null;
    var api = window.ForeverItems;
    var slots = DATA.slots;
    var i;
    for (i = 0; i < slots.length; i++) {
      var s = slots[i];
      var eq = equippedIn(s.id);
      if (!eq) continue;
      if (api.itemFitsSlot && !api.itemFitsSlot(item, s.id)) continue;
      if (api.canEquipInSlot && !api.canEquipInSlot(item, (ForeverApp.getState() || {}).character || {}, s.id, 0)) continue;
      return s.id;
    }
    return hinted || null;
  }

  function renderBody(item, opts) {
    opts = opts || {};
    if (!item) return '<div class="item-tt-name q-common">Unknown item</div>';
    var lines = [];
    var quality = item.quality || "common";
    var suffixId = opts.suffixId != null && opts.suffixId !== "" ? opts.suffixId : item.suffixId;
    var suffix = (window.ItemSuffixes && suffixId != null && suffixId !== "") ? ItemSuffixes.prop(suffixId) : null;
    var shownName = (window.ItemSuffixes) ? ItemSuffixes.displayName(item, suffixId) : (item.name || "Item");
    lines.push('<div class="item-tt-name ' + qClass(quality) + '">' + esc(shownName || "Item") + "</div>");

    if (item._partial && !item._failed) {
      lines.push('<div class="item-tt-loading">Loading…</div>');
      return lines.join("");
    }
    if (item._failed && item._partial) {
      return lines.join("");
    }

    if (item.bind && BIND_LINE[item.bind]) {
      lines.push('<div class="item-tt-line">' + BIND_LINE[item.bind] + "</div>");
    } else if (item.cat === "quest") {
      lines.push('<div class="item-tt-line">Quest Item</div>');
    }
    if (item.unique) lines.push('<div class="item-tt-line">Unique</div>');

    if (item.cat === "reagent") {
      lines.push('<div class="item-tt-line tt-beige">Crafting Reagent</div>');
    } else if (item.cat === "consumable" && CONSUMABLE_TYPE[item.type]) {
      lines.push('<div class="item-tt-line tt-beige">' + CONSUMABLE_TYPE[item.type] + "</div>");
    }

    var slotL = item.slotLabel || "";
    var typR = item.cat === "gear" ? titleType(item.type) : "";
    if (slotL || typR) {
      lines.push('<div class="item-tt-row"><span>' + esc(slotL) + "</span><span>" + esc(typR) + "</span></div>");
    }

    var stats = item.stats || {};
    if (stats.armor) lines.push('<div class="item-tt-line">' + Number(stats.armor) + " Armor</div>");

    var w = item.weapon;
    if (w && (w.min != null || w.max != null)) {
      var school = w.school ? (" " + w.school) : "";
      var dmg = (w.min != null ? w.min : "?") + " - " + (w.max != null ? w.max : "?") + school + " Damage";
      var spd = w.speed != null ? Number(w.speed).toFixed(2) : "";
      lines.push('<div class="item-tt-row"><span>' + esc(dmg) + "</span><span>" + (spd ? "Speed " + spd : "") + "</span></div>");
      if (w.dps != null) {
        var dps = typeof w.dps === "number" ? w.dps.toFixed(2) : w.dps;
        lines.push('<div class="item-tt-line">(' + dps + " damage per second)</div>");
      }
    }

    Object.keys(STAT_WHITE).forEach(function (k) {
      if (stats[k]) lines.push('<div class="item-tt-stat">+' + stats[k] + " " + STAT_WHITE[k] + "</div>");
    });
    Object.keys(STAT_RESIST).forEach(function (k) {
      if (stats[k]) lines.push('<div class="item-tt-stat">+' + stats[k] + " " + STAT_RESIST[k] + "</div>");
    });
    if (suffix && suffix.s) {
      Object.keys(STAT_WHITE).forEach(function (k) {
        if (suffix.s[k]) lines.push('<div class="item-tt-effect">+' + suffix.s[k] + " " + STAT_WHITE[k] + "</div>");
      });
      Object.keys(STAT_RESIST).forEach(function (k) {
        if (suffix.s[k]) lines.push('<div class="item-tt-effect">+' + suffix.s[k] + " " + STAT_RESIST[k] + "</div>");
      });
    } else if (item.suffixGroup && window.ItemSuffixes) {
      var nOpt = ItemSuffixes.count(item);
      if (nOpt) lines.push('<div class="item-tt-line tt-beige">Random enchant: ' + nOpt + " options</div>");
    }

    if (item.durability || item.maxDurability) {
      var maxD = item.maxDurability || item.durability;
      var curD = item.durabilityCurrent != null ? item.durabilityCurrent : maxD;
      lines.push('<div class="item-tt-line">Durability ' + curD + " / " + maxD + "</div>");
    }

    if (item.classes && item.classes.length) {
      lines.push('<div class="item-tt-line">Classes: ' + esc(item.classes.join(", ")) + "</div>");
    }

    if (item.reqLevel) {
      var lvl = charLevel();
      var high = lvl && item.reqLevel > lvl;
      lines.push('<div class="item-tt-req' + (high ? " is-high" : "") + '">Requires Level ' + item.reqLevel + "</div>");
    }

    Object.keys(STAT_GREEN).forEach(function (k) {
      if (!stats[k]) return;
      lines.push('<div class="item-tt-effect">Equip: +' + stats[k] + " " + STAT_GREEN[k] + ".</div>");
    });
    (item.effects || []).forEach(function (e) {
      lines.push('<div class="item-tt-effect">' + esc(e) + "</div>");
    });
    if (suffix && suffix.s) {
      Object.keys(STAT_GREEN).forEach(function (k) {
        if (suffix.s[k]) lines.push('<div class="item-tt-effect">Equip: +' + suffix.s[k] + " " + STAT_GREEN[k] + ".</div>");
      });
    }
    if (suffix && suffix.e && suffix.e.length) {
      suffix.e.forEach(function (e) {
        lines.push('<div class="item-tt-effect">' + esc(e) + "</div>");
      });
    }

    if (item.setName) {
      lines.push('<div class="item-tt-set">' + esc(item.setName) + "</div>");
      (item.setBonuses || []).forEach(function (b) {
        lines.push('<div class="item-tt-set-bonus">' + esc(b) + "</div>");
      });
    }

    if (item.startQuest) {
      lines.push('<div class="item-tt-quest">This Item Begins a Quest</div>');
    }

    if (item.flavor) {
      lines.push('<div class="item-tt-flavor">"' + esc(item.flavor) + '"</div>');
    }

    if (item.sell) {
      lines.push('<div class="item-tt-sell">Sell Price: ' + coins(item.sell) + "</div>");
    }

    var extras = ahLines(item);
    if (!opts.asEquipped) {
      var slot = findCompareSlot(item, opts.slot);
      var cmp = compareLine(item, slot);
      if (cmp) extras.push(esc(cmp));
    } else {
      extras.push("Currently equipped");
    }
    if (item.pvp) {
      extras.push('<span class="item-tt-pvp">PvP — battleground, honor rank, or PvP vendor only</span>');
    }
    if (item.statSource === "wowhead-classic" || item.statSource === "classic-db") {
      extras.push('<span class="item-tt-classic-note">Stats: Classic 1.12 data</span>');
    } else if (item.statSource === "forever-client-derived") {
      extras.push('<span class="item-tt-classic-note">Stats calculated from Forever game data</span>');
    } else if (item.forever === false) {
      extras.push('<span class="item-tt-classic-note">Classic reference — not in the live Forever client</span>');
    }
    if (extras.length) {
      lines.push('<div class="item-tt-sep"></div><div class="item-tt-extra">' + extras.join("<br>") + "</div>");
    }
    if (opts.farmId && !opts.asEquipped && window.GoldFarms && GoldFarms.dropTipHtml) {
      var farmHtml = GoldFarms.dropTipHtml(opts.farmId, item.id);
      if (farmHtml) lines.push(farmHtml);
    }

    return lines.join("");
  }

  function renderTooltip(el, item, opts) {
    opts = opts || {};
    var icon = item && item.icon
      ? '<img class="item-tt-icon ' + qClass(item.quality) + '" src="' + ICON.replace("{icon}", String(item.icon)) + '" alt="" width="36" height="36" data-icon-img>'
      : '<span class="item-tt-icon item-tt-icon-empty"></span>';
    var close = '<button type="button" class="item-tt-close" aria-label="Close tooltip"' +
      (pinned ? "" : " hidden") + ">&times;</button>";
    var db = (item && item.id != null && !opts.asEquipped && !opts.embedded && !opts.hideDb)
      ? '<div class="item-tt-db-wrap"><a class="item-tt-db" href="#item-' + esc(String(item.id)) +
        '" data-item-db="' + esc(String(item.id)) + '">View in Items DB</a></div>'
      : "";
    var dwell = '<div class="item-tt-dwell" aria-hidden="true"><span class="item-tt-dwell-bar"></span></div>';
    var lockIcon = '<span class="item-tt-lock-icon"' + (pinned ? "" : " hidden") + ' aria-hidden="true">' +
      '<svg viewBox="0 0 12 12" width="12" height="12" focusable="false">' +
      '<path fill="currentColor" d="M8.1 1.15a2.35 2.35 0 0 1 .1 3.32L9.7 6 8.3 7.4 6.65 5.75a2.35 2.35 0 0 1-3.32-.1L1.9 4.2 3.1 3l1.45 1.45a.85.85 0 0 0 1.2 0L8.1 1.15zM5.15 6.35l.9.9-3.55 3.7-.9-.9 3.55-3.7z"/></svg></span>';
    if (opts.embedded) {
      el.classList.add("item-tt", "ahf-embedded-tt");
      el.innerHTML = '<div class="item-tt-inner">' + icon + '<div class="item-tt-body">' + renderBody(item, opts) + "</div></div>";
      return;
    }
    el.innerHTML = dwell + close + lockIcon + '<div class="item-tt-inner">' + icon + '<div class="item-tt-body">' + renderBody(item, opts) + db + "</div></div>";
    if (el === tip) syncLockChrome();
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function tipState() {
    if (!tip || tip.hidden) return "hidden";
    if (pinned && lockMode === "dwell") return "locked";
    if (pinned) return "pinned";
    if (dwellStartedAt) return "dwelling";
    return "hover";
  }

  function setDwellProgress(p) {
    if (!tip) return;
    var bar = tip.querySelector(".item-tt-dwell-bar");
    if (!bar) return;
    p = Math.max(0, Math.min(1, p || 0));
    if (reducedMotion()) {
      bar.style.transform = "none";
      bar.style.opacity = p > 0 ? "1" : "0";
    } else {
      bar.style.opacity = "1";
      bar.style.transform = "scaleX(" + p + ")";
    }
  }

  function syncLockChrome() {
    if (!tip) return;
    tip.classList.toggle("is-pinned", !!pinned);
    tip.classList.toggle("is-locked", !!pinned && lockMode === "dwell");
    tip.classList.toggle("is-dwelling", !pinned && !!dwellStartedAt);
    var btn = tip.querySelector(".item-tt-close");
    if (btn) btn.hidden = !pinned;
    var icon = tip.querySelector(".item-tt-lock-icon");
    if (icon) icon.hidden = !pinned;
    if (pinned) setDwellProgress(1);
    else if (dwellStartedAt) setDwellProgress((performance.now() - dwellStartedAt) / DWELL_MS);
    else setDwellProgress(0);
    tip.setAttribute("data-tt-state", tipState());
  }

  function cancelDwell() {
    if (dwellRaf) { cancelAnimationFrame(dwellRaf); dwellRaf = null; }
    dwellStartedAt = 0;
    if (tip) {
      tip.classList.remove("is-dwelling");
      setDwellProgress(0);
      tip.setAttribute("data-tt-state", tipState());
    }
  }

  function lockFromDwell() {
    if (!current || !tip || tip.hidden || pinned) return;
    lockMode = "dwell";
    setPinned(true);
  }

  function startDwell() {
    cancelDwell();
    if (pinned || !tip || tip.hidden) return;
    dwellStartedAt = performance.now();
    tip.classList.add("is-dwelling");
    tip.setAttribute("data-tt-state", "dwelling");
    setDwellProgress(0);
    function tick(now) {
      if (!dwellStartedAt || pinned) { dwellRaf = null; return; }
      var p = (now - dwellStartedAt) / DWELL_MS;
      setDwellProgress(p);
      if (p >= 1) {
        dwellRaf = null;
        lockFromDwell();
        return;
      }
      dwellRaf = requestAnimationFrame(tick);
    }
    dwellRaf = requestAnimationFrame(tick);
  }

  function clearHideTimer() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  }

  function sameHook(hook) {
    return current && hook &&
      String(current.id) === String(hook.id) &&
      current.slot === hook.slot &&
      String(current.suffixId || "") === String(hook.suffixId || "") &&
      String(current.farmId || "") === String(hook.farmId || "");
  }

  function ensureEls() {
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "item-tt";
      tip.id = "itemTooltip";
      tip.hidden = true;
      tip.setAttribute("role", "tooltip");
      document.body.appendChild(tip);
    }
    if (!tipCompare) {
      tipCompare = document.createElement("div");
      tipCompare.className = "item-tt item-tt-compare";
      tipCompare.id = "itemTooltipCompare";
      tipCompare.hidden = true;
      tipCompare.setAttribute("role", "tooltip");
      document.body.appendChild(tipCompare);
    }
  }

  function isTouchPointer() {
    if (lockMode === "dwell") return false;
    if (lastPointer && lastPointer.type === "touch") return true;
    var narrow = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
    var coarse = window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    return !!(narrow && coarse);
  }

  function applyTouchSheet() {
    if (!tip) return;
    tip.classList.add("is-touch-sheet");
    tip.style.left = "";
    tip.style.top = "";
    tip.style.right = "";
    tip.style.bottom = "";
    hideCompare();
  }

  function place(x, y) {
    if (!tip || tip.hidden) return;
    if (tip.classList.contains("is-touch-sheet")) return;
    var pad = 16;
    var vw = window.innerWidth, vh = window.innerHeight;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = x + pad, top = y + 18;
    if (left + w > vw - 8) left = x - w - pad;
    if (left < 8) left = 8;
    if (top + h > vh - 8) top = y - h - 12;
    if (top < 8) top = 8;
    tip.style.left = left + "px";
    tip.style.top = top + "px";

    if (!tipCompare || tipCompare.hidden) return;
    var cw = tipCompare.offsetWidth, ch = tipCompare.offsetHeight;
    var cx = left - cw - 8, cy = top;
    if (cx < 8) {
      cx = left + w + 8;
      if (cx + cw > vw - 8) cx = Math.max(8, vw - cw - 8);
    }
    if (cy + ch > vh - 8) cy = Math.max(8, vh - ch - 8);
    if (cy < 8) cy = 8;
    tipCompare.style.left = cx + "px";
    tipCompare.style.top = cy + "px";
  }

  function hideCompare() {
    if (tipCompare) { tipCompare.hidden = true; tipCompare.innerHTML = ""; }
  }

  function showCompareIfNeeded(item, slotHint, x, y) {
    if (!shiftHeld || !item || item._partial) { hideCompare(); return; }
    var slot = findCompareSlot(item, slotHint);
    var eq = equippedIn(slot);
    if (!eq || String(eq.id) === String(item.id)) { hideCompare(); return; }
    ensureEls();
    var seed = eq;
    renderTooltip(tipCompare, seed, { asEquipped: true, slot: slot });
    tipCompare.hidden = false;
    place(x, y);
    detailOf(eq.id).then(function (d) {
      if (!shiftHeld || !current || String(current.id) !== String(item.id)) return;
      renderTooltip(tipCompare, d || seed, { asEquipped: true, slot: slot });
      place(current.x, current.y);
    });
  }

  function hideNow() {
    reqGen++;
    current = null;
    pinned = false;
    lockMode = null;
    overAnchor = false;
    overTip = false;
    cancelDwell();
    if (showTimer) { clearTimeout(showTimer); showTimer = null; }
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (tip) {
      tip.hidden = true;
      tip.classList.remove("is-pinned", "is-locked", "is-dwelling", "is-touch-sheet");
      tip.style.left = "";
      tip.style.top = "";
      tip.style.right = "";
      tip.style.bottom = "";
      tip.setAttribute("data-tt-state", "hidden");
    }
    hideCompare();
  }

  function scheduleHide() {
    if (pinned) return;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hideNow, HIDE_DELAY);
  }

  function scheduleGraceHide() {
    if (lockMode !== "dwell") return;
    if (overAnchor || overTip) return;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      hideTimer = null;
      if (overAnchor || overTip) return;
      hideNow();
    }, LOCK_GRACE_MS);
  }

  function setPinned(on) {
    pinned = !!on;
    if (!pinned) {
      lockMode = null;
    } else if (!lockMode) {
      lockMode = "pin";
    }
    if (pinned) {
      cancelDwell();
      dwellStartedAt = 0;
      if (isTouchPointer()) applyTouchSheet();
    } else if (tip) {
      tip.classList.remove("is-touch-sheet");
    }
    syncLockChrome();
  }

  function tipOpts(slot, suffixId, farmId) {
    return { slot: slot, suffixId: suffixId, farmId: farmId || null };
  }
  function openTip(id, slot, x, y, suffixId, farmId, anchor) {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    ensureEls();
    var replacing = current && (
      String(current.id) !== String(id) ||
      current.slot !== slot ||
      String(current.suffixId || "") !== String(suffixId || "") ||
      String(current.farmId || "") !== String(farmId || "")
    );
    if (replacing && lockMode === "dwell") setPinned(false);
    var wasPinned = pinned;
    var freezePlace = wasPinned && tip && !tip.hidden && tip.style.left;
    var gen = ++reqGen;
    current = { id: id, slot: slot, x: x, y: y, suffixId: suffixId, farmId: farmId || null, anchor: anchor || null };
    overAnchor = !!anchor;
    var seed = indexItem(id) || { id: id, name: "Item " + id, quality: "common", _partial: true };
    cache[String(id)] = cache[String(id)] || seed;
    renderTooltip(tip, seed, tipOpts(slot, suffixId, farmId));
    tip.hidden = false;
    if (pinned && isTouchPointer()) applyTouchSheet();
    else if (!freezePlace) place(x, y);
    if (!(pinned && isTouchPointer())) showCompareIfNeeded(seed, slot, x, y);
    if (!wasPinned) startDwell();
    else syncLockChrome();
    function refreshPlace() {
      if (pinned || !current) return;
      place(current.x, current.y);
    }
    ensureExtras().then(function () {
      if (gen !== reqGen) return;
      var item = cache[String(id)] || seed;
      if (item && !item._partial) {
        renderTooltip(tip, item, tipOpts(slot, suffixId, farmId));
        refreshPlace();
      }
    });
    detailOf(id).then(function (d) {
      if (gen !== reqGen) return;
      var item = d || seed;
      if (!d) { seed._failed = true; item = seed; }
      renderTooltip(tip, item, tipOpts(slot, suffixId, farmId));
      refreshPlace();
      showCompareIfNeeded(item, slot, current ? current.x : x, current ? current.y : y);
    }).catch(function () {
      if (gen !== reqGen) return;
      seed._failed = true;
      renderTooltip(tip, seed, tipOpts(slot, suffixId, farmId));
    });
  }

  function hookFromEvent(e) {
    var el = e.target && e.target.closest && e.target.closest("[data-item-id], [data-open-item], [data-equip-slot]");
    if (!el || !document.body.contains(el)) return null;
    if (el.closest && el.closest(".item-tt")) return null;
    if (e.target && e.target.closest && e.target.closest("svg.ahf-spark, .ahf-spark-cell, #ahfDetailTrend, #ahfSparkTip")) return null;
    var id = el.getAttribute("data-item-id") || el.getAttribute("data-open-item");
    var slot = el.getAttribute("data-compare-slot") || el.getAttribute("data-equip-slot") || null;
    if (!id && el.hasAttribute("data-equip-slot")) {
      var eq = equippedIn(el.getAttribute("data-equip-slot"));
      if (!eq) return null;
      id = eq.id;
      slot = el.getAttribute("data-equip-slot");
    }
    if (!id) return null;
    var suffixId = el.getAttribute("data-suffix-id");
    var row = (el.classList && el.classList.contains("upgrade-row")) ? el : (el.closest && el.closest(".upgrade-row"));
    if (!suffixId && row) {
      var sel = row.querySelector(".suffix-select");
      var link = row.querySelector("a[data-suffix-id]");
      if (sel && sel.value) suffixId = sel.value;
      else if (link) suffixId = link.getAttribute("data-suffix-id");
    }
    if ((suffixId == null || suffixId === "") && el.hasAttribute("data-equip-slot")) {
      var worn = equippedIn(el.getAttribute("data-equip-slot"));
      if (worn && worn.suffixId != null) suffixId = worn.suffixId;
    }
    var farmId = el.getAttribute("data-farm-id") || null;
    return { el: el, id: id, slot: slot, suffixId: suffixId, farmId: farmId };
  }

  function stillInside(e, el) {
    var to = e.relatedTarget;
    try { return to && el.contains(to); } catch (err) { return false; }
  }

  function onPointerOver(e) {
    if (e.pointerType === "touch") return;
    lastPointer = { x: e.clientX, y: e.clientY, type: e.pointerType || "mouse" };
    if (tip && tip.contains(e.target)) {
      overTip = true;
      clearHideTimer();
      return;
    }
    var hook = hookFromEvent(e);
    if (!hook) {
      if (e.target && e.target.closest && e.target.closest("svg.ahf-spark, .ahf-spark-cell, #ahfDetailTrend, #ahfSparkTip")) {
        if (showTimer) { clearTimeout(showTimer); showTimer = null; }
        overAnchor = false;
        if (!pinned && current) scheduleHide();
      }
      return;
    }
    overAnchor = sameHook(hook) || !current;
    if (sameHook(hook)) {
      overAnchor = true;
      if (current) current.anchor = hook.el;
      clearHideTimer();
      return;
    }
    clearHideTimer();
    if (showTimer) clearTimeout(showTimer);
    showTimer = setTimeout(function () {
      showTimer = null;
      openTip(hook.id, hook.slot, lastPointer.x, lastPointer.y, hook.suffixId, hook.farmId, hook.el);
      overAnchor = true;
    }, HOVER_DELAY);
  }

  function onPointerOut(e) {
    if (e.pointerType === "touch") return;
    if (tip && (e.target === tip || tip.contains(e.target))) {
      if (stillInside(e, tip)) return;
      overTip = false;
      if (lockMode === "dwell") scheduleGraceHide();
      return;
    }
    var hook = hookFromEvent(e);
    if (!hook) {
      if (showTimer) { clearTimeout(showTimer); showTimer = null; }
      if (!pinned && current) scheduleHide();
      return;
    }
    if (stillInside(e, hook.el)) return;
    if (sameHook(hook) || (current && current.anchor === hook.el)) overAnchor = false;
    if (showTimer) { clearTimeout(showTimer); showTimer = null; }
    if (!pinned) {
      cancelDwell();
      if (current) scheduleHide();
    } else if (lockMode === "dwell") {
      scheduleGraceHide();
    }
  }

  function onPointerMove(e) {
    lastPointer = { x: e.clientX, y: e.clientY, type: e.pointerType || lastPointer.type };
    if (!current || !tip || tip.hidden) return;
    if (pinned) return;
    if (e.pointerType === "touch") return;
    current.x = e.clientX;
    current.y = e.clientY;
    place(e.clientX, e.clientY);
  }

  function onPointerDown(e) {
    lastPointer = { x: e.clientX, y: e.clientY, type: e.pointerType || "mouse" };
    if (e.pointerType !== "touch") return;
    var hook = hookFromEvent(e);
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (!hook) {
      if (pinned && tip && !tip.contains(e.target)) hideNow();
      return;
    }
    /* Pin-on-tap targets skip the long-press timer; click handler pins immediately. */
    if (hook.el && hook.el.closest && hook.el.closest("[data-item-pin]")) return;
    holdTimer = setTimeout(function () {
      holdTimer = null;
      suppressClick = true;
      setPinned(true);
      openTip(hook.id, hook.slot, e.clientX, e.clientY, hook.suffixId, hook.farmId, hook.el);
    }, HOLD_MS);
  }

  function onPointerUp() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  }

  function onClickCapture(e) {
    if (suppressClick) {
      e.preventDefault();
      e.stopPropagation();
      suppressClick = false;
      return;
    }
    var inTip = tip && tip.contains(e.target);
    if (inTip) {
      var closeBtn = e.target.closest && e.target.closest(".item-tt-close");
      if (closeBtn) {
        e.preventDefault();
        e.stopPropagation();
        hideNow();
        return;
      }
      var db = e.target.closest && e.target.closest("a[data-item-db]");
      if (db) {
        /* Let the Items DB link navigate; close the pinned tip. */
        hideNow();
        return;
      }
      return;
    }
    var pinEl = e.target.closest && e.target.closest("[data-item-pin]");
    var hook = hookFromEvent(e);
    if (pinEl && hook) {
      e.preventDefault();
      e.stopPropagation();
      setPinned(true);
      openTip(hook.id, hook.slot, e.clientX, e.clientY, hook.suffixId, hook.farmId, hook.el);
      return;
    }
    if (pinned) hideNow();
  }

  function onKey(e) {
    if (e.key === "Escape") { hideNow(); return; }
    if (e.key === "Shift") {
      shiftHeld = e.type === "keydown";
      if (current && !tip.hidden) {
        var item = cache[String(current.id)] || indexItem(current.id);
        if (shiftHeld) showCompareIfNeeded(item, current.slot, current.x, current.y);
        else hideCompare();
        place(current.x, current.y);
      }
    }
  }
  function onBlur() { shiftHeld = false; hideCompare(); }
  function onScroll() { if (current && !pinned) hideNow(); }

  function bind() {
    if (bind._done) return;
    bind._done = true;
    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerUp, true);
    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("keyup", onKey, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("scroll", onScroll, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();

  window.ItemTooltip = {
    version: VERSION,
    DWELL_MS: DWELL_MS,
    LOCK_GRACE_MS: LOCK_GRACE_MS,
    show: function (id, x, y, slot, suffixId, farmId) { openTip(id, slot, x || lastPointer.x, y || lastPointer.y, suffixId, farmId); },
    pin: function (id, x, y, slot, suffixId, farmId) {
      setPinned(true);
      openTip(id, slot, x || lastPointer.x, y || lastPointer.y, suffixId, farmId);
    },
    hide: hideNow,
    isPinned: function () { return !!pinned; },
    isLocked: function () { return !!pinned && lockMode === "dwell"; },
    detailOf: detailOf,
    renderTo: renderTooltip
  };
})();
