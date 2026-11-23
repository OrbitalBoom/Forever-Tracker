/* Self-hosted Classic-style item tooltip. Does not load Wowhead power.js. */
(function () {
  var VERSION = "20261122l";
  var ICON = "https://render.worldofwarcraft.com/forever-us/icons/56/{icon}.jpg";
  var HOVER_DELAY = 80;
  var HOLD_MS = 420;
  var HIDE_DELAY = 40;

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

    var extras = [];
    var p = priceOf(item.id);
    if (p) {
      extras.push("AH " + coins(p.marketValue || p.minBuyout) +
        (p.quantity != null ? " · " + Number(p.quantity).toLocaleString() + " listed" : ""));
    }
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
    } else if (item.forever === false) {
      extras.push('<span class="item-tt-classic-note">Classic reference — not in the live Forever client</span>');
    }
    if (extras.length) {
      lines.push('<div class="item-tt-sep"></div><div class="item-tt-extra">' + extras.join("<br>") + "</div>");
    }

    return lines.join("");
  }

  function renderTooltip(el, item, opts) {
    var icon = item && item.icon
      ? '<img class="item-tt-icon ' + qClass(item.quality) + '" src="' + ICON.replace("{icon}", String(item.icon)) + '" alt="" width="36" height="36" data-icon-img>'
      : '<span class="item-tt-icon item-tt-icon-empty"></span>';
    el.innerHTML = '<div class="item-tt-inner">' + icon + '<div class="item-tt-body">' + renderBody(item, opts) + "</div></div>";
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

  function place(x, y) {
    if (!tip || tip.hidden) return;
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
    if (showTimer) { clearTimeout(showTimer); showTimer = null; }
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (tip) tip.hidden = true;
    hideCompare();
  }

  function scheduleHide() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hideNow, HIDE_DELAY);
  }

  function openTip(id, slot, x, y, suffixId) {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    ensureEls();
    var gen = ++reqGen;
    current = { id: id, slot: slot, x: x, y: y, suffixId: suffixId };
    var seed = indexItem(id) || { id: id, name: "Item " + id, quality: "common", _partial: true };
    cache[String(id)] = cache[String(id)] || seed;
    renderTooltip(tip, seed, { slot: slot, suffixId: suffixId });
    tip.hidden = false;
    place(x, y);
    showCompareIfNeeded(seed, slot, x, y);
    detailOf(id).then(function (d) {
      if (gen !== reqGen) return;
      var item = d || seed;
      if (!d) { seed._failed = true; item = seed; }
      renderTooltip(tip, item, { slot: slot, suffixId: suffixId });
      place(current ? current.x : x, current ? current.y : y);
      showCompareIfNeeded(item, slot, current ? current.x : x, current ? current.y : y);
    }).catch(function () {
      if (gen !== reqGen) return;
      seed._failed = true;
      renderTooltip(tip, seed, { slot: slot, suffixId: suffixId });
    });
  }

  function hookFromEvent(e) {
    var el = e.target && e.target.closest && e.target.closest("[data-item-id], [data-open-item], [data-equip-slot]");
    if (!el || !document.body.contains(el)) return null;
    if (el.closest && el.closest(".item-tt")) return null;
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
    return { el: el, id: id, slot: slot, suffixId: suffixId };
  }

  function stillInside(e, el) {
    var to = e.relatedTarget;
    try { return to && el.contains(to); } catch (err) { return false; }
  }

  function onPointerOver(e) {
    if (e.pointerType === "touch") return;
    var hook = hookFromEvent(e);
    if (!hook) return;
    lastPointer = { x: e.clientX, y: e.clientY, type: e.pointerType || "mouse" };
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (current && String(current.id) === String(hook.id) && current.slot === hook.slot && String(current.suffixId || "") === String(hook.suffixId || "")) return;
    if (showTimer) clearTimeout(showTimer);
    showTimer = setTimeout(function () {
      showTimer = null;
      openTip(hook.id, hook.slot, lastPointer.x, lastPointer.y, hook.suffixId);
    }, HOVER_DELAY);
  }

  function onPointerOut(e) {
    if (e.pointerType === "touch") return;
    var hook = hookFromEvent(e);
    if (!hook) {
      if (showTimer) { clearTimeout(showTimer); showTimer = null; }
      if (current) scheduleHide();
      return;
    }
    if (stillInside(e, hook.el)) return;
    if (showTimer) { clearTimeout(showTimer); showTimer = null; }
    if (current) scheduleHide();
  }

  function onPointerMove(e) {
    lastPointer = { x: e.clientX, y: e.clientY, type: e.pointerType || lastPointer.type };
    if (!current || !tip || tip.hidden) return;
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
    if (!hook) { hideNow(); return; }
    holdTimer = setTimeout(function () {
      holdTimer = null;
      suppressClick = true;
      openTip(hook.id, hook.slot, e.clientX, e.clientY, hook.suffixId);
    }, HOLD_MS);
  }

  function onPointerUp() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  }

  function onClickCapture(e) {
    if (!suppressClick) return;
    e.preventDefault();
    e.stopPropagation();
    suppressClick = false;
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
  function onScroll() { if (current) hideNow(); }

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
    show: function (id, x, y, slot, suffixId) { openTip(id, slot, x || lastPointer.x, y || lastPointer.y, suffixId); },
    hide: hideNow,
    detailOf: detailOf
  };
})();
