/* Forever Tracker — runs from file:// with no build step. */
(function () {
  "use strict";

  var DATA = window.WOW_DATA;
  var ITEMS = window.WOW_ITEMS || [];
  var TALENT_META = window.WOW_TALENT_META || {};
  var STORAGE_KEY = "wowForever.tracker.v1";
  var LEVEL_WINDOW = 3;
  var AT_LEVEL_PAGE = 10;
  var SOON_LIMIT = 5;
  var selectedSlot = null;
  var slotShowAll = false;
  var DOLL_LEFT = ["head","neck","shoulder","back","chest","shirt","tabard","wrist"];
  var DOLL_RIGHT = ["hands","waist","legs","feet","finger1","finger2","trinket1","trinket2"];
  var DOLL_WEAPONS = ["mainhand","offhand","ranged"];
  var ICON_BASE = "https://render.worldofwarcraft.com/forever-us/icons/56/";

  var ARMOR = ["cloth", "leather", "mail", "plate"];
  var WEAPONS = ["sword","axe","mace","dagger","staff","polearm","fist","bow","gun","crossbow","wand","thrown","shield","held","idol","totem","libram"];
  var RELICS = ["idol","totem","libram"];

  var state = defaultState();
  var activeTab = "character";
  var goalFilter = "all";
  var talentFocusTree = 0;
  var talentViewLevel = null;
  var talentPreview = null;
  var buildOrderCache = {};


  function emptyTalentState(cls) {
    return {
      class: cls || "Warrior",
      mode: "forever",
      activeSpec: "primary",
      foreverPrimary: { trees: {} },
      foreverSecondary: { trees: {} },
      classic: { trees: {} }
    };
  }

  function normalizeTalents() {
    var t = state.talents;
    if (!t) { state.talents = emptyTalentState(ch().class); return; }
    // Migrate the original { class, trees } shape
    if (t.trees && !t.foreverPrimary) {
      state.talents = {
        class: t.class || ch().class,
        mode: t.mode || "forever",
        activeSpec: t.activeSpec || "primary",
        foreverPrimary: { trees: t.trees || {} },
        foreverSecondary: { trees: {} },
        classic: { trees: {} }
      };
      return;
    }
    if (!t.foreverPrimary) t.foreverPrimary = { trees: {} };
    if (!t.foreverPrimary.trees) t.foreverPrimary.trees = {};
    if (!t.foreverSecondary) t.foreverSecondary = { trees: {} };
    if (!t.foreverSecondary.trees) t.foreverSecondary.trees = {};
    if (!t.classic) t.classic = { trees: {} };
    if (!t.classic.trees) t.classic.trees = {};
    if (!t.mode) t.mode = "forever";
    if (!t.activeSpec) t.activeSpec = "primary";
  }

  function talentMode() {
    normalizeTalents();
    return state.talents.mode === "classic" ? "classic" : "forever";
  }

  function talentPack() {
    return talentMode() === "classic"
      ? (window.WOW_TALENTS_CLASSIC || [])
      : (window.WOW_TALENTS_FOREVER || window.WOW_TALENTS || []);
  }

  function talentBuilds() {
    return talentMode() === "classic"
      ? (window.WOW_TALENT_BUILDS_CLASSIC || [])
      : (window.WOW_TALENT_BUILDS_FOREVER || window.WOW_TALENT_BUILDS || []);
  }

  function talentStore() {
    normalizeTalents();
    if (talentMode() === "classic") return state.talents.classic;
    return state.talents.activeSpec === "secondary" ? state.talents.foreverSecondary : state.talents.foreverPrimary;
  }

  function dualSpecUnlocked() {
    return (ch().level || 1) >= 40 && talentMode() === "forever";
  }

  /* ---------- state ---------- */
  function defaultState() {
    return {
      character: { name: "", race: "Undead", class: "Warrior", spec: "Arms", level: 1 },
      goals: {},
      customGoals: [],
      goldLog: [],
      professions: [],
      crafting: [],
      journal: [],
      notes: [],
      equipment: {},
      customItems: [],
      talents: emptyTalentState("Warrior"),
      savedTalentBuilds: [],
      leveling: defaultLeveling(),
      profGuide: {},
      goldFarmFavs: [],
      goldFarmPrefs: {},
      itemFilters: { class: null, slots: {} }
    };
  }

  function uid(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      applyStateObject(parsed, { persist: false, render: false, keepTimestamp: true });
    } catch (e) {
      console.warn("Could not load saved data", e);
    }
  }

  function applyStateObject(parsed, opts) {
    opts = opts || {};
    var base = defaultState();
    Object.keys(base).forEach(function (k) {
      if (parsed[k] != null) base[k] = parsed[k];
    });
    if (!base.character) base.character = defaultState().character;
    if (parsed.savedAt) base.savedAt = parsed.savedAt;
    state = base;
    normalizeTalents();
    normalizeLeveling();
    if (opts.persist !== false) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        if (!opts.quiet) toast("Could not save to localStorage: " + (e.message || e));
      }
    }
    if (opts.render !== false) {
      renderTab(activeTab);
      if (window.ProfGuide) { try { window.ProfGuide.render(); } catch (e) { console.error(e); } }
    }
  }

  function applyLoadedState(data, savedAt) {
    var parsed = data || {};
    if (savedAt) parsed.savedAt = savedAt;
    applyStateObject(parsed, { persist: true, render: true, keepTimestamp: true, quiet: true });
  }

  function save() {
    try {
      state.savedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      if (window.CloudSave) window.CloudSave.schedule();
    } catch (e) {
      toast("Could not save to localStorage: " + (e.message || e));
    }
  }

  /* ---------- UI helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") n.className = attrs[k];
        else if (k === "html") n.innerHTML = attrs[k];
        else if (k === "text") n.textContent = attrs[k];
        else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
      });
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._id);
    toast._id = setTimeout(function () { t.hidden = true; }, 2800);
  }
  function openModal(html) {
    var back = $("#modalBack");
    $("#modal").innerHTML = html;
    back.hidden = false;
    var close = function (e) {
      if (e.target === back || (e.target && e.target.getAttribute && e.target.getAttribute("data-close") != null)) {
        closeModal();
      }
    };
    back.onclick = close;
  }
  function closeModal() {
    $("#modalBack").hidden = true;
    $("#modal").innerHTML = "";
  }

  function qualityClass(q) { return "q-" + (q || "common"); }

  /* ---------- gold ---------- */
  function toCopper(g, s, c) {
    return (Number(g) || 0) * 10000 + (Number(s) || 0) * 100 + (Number(c) || 0);
  }
  function fromCopper(total) {
    var sign = total < 0 ? -1 : 1;
    total = Math.abs(Math.round(total));
    var g = Math.floor(total / 10000);
    var s = Math.floor((total % 10000) / 100);
    var c = total % 100;
    return { g: g * sign, s: s, c: c, sign: sign };
  }
  function formatGold(copper) {
    var p = fromCopper(copper);
    var sign = p.g < 0 || (p.g === 0 && copper < 0) ? "-" : "";
    var g = Math.abs(p.g);
    return sign +
      '<span class="money-g">' + g + "g</span> " +
      '<span class="money-s">' + p.s + "s</span> " +
      '<span class="money-c">' + p.c + "c</span>";
  }
  function goldTotal() {
    return state.goldLog.reduce(function (sum, e) { return sum + (e.copper || 0); }, 0);
  }

  /* ---------- character helpers ---------- */
  function ch() { return state.character || defaultState().character; }
  function classColor(name) { return (DATA.classColors && DATA.classColors[name]) || "var(--gold)"; }

  function fillSelect(sel, values, current) {
    sel.innerHTML = "";
    values.forEach(function (v) {
      var name = typeof v === "string" ? v : v.name;
      var opt = el("option", { value: name, text: name });
      if (name === current) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  /* ---------- tabs ---------- */
  function resolveTab(name) {
    if (!name) return null;
    var aliases = { profession: "professions", prof: "professions", profs: "professions", farming: "gold", "gold-farms": "gold" };
    if (aliases[name]) name = aliases[name];
    var valid = ["character","goals","gold","professions","notes","items","talents","leveling"];
    return valid.indexOf(name) !== -1 ? name : null;
  }

  function showTab(name) {
    name = resolveTab(name) || name;
    activeTab = name;
    $all(".tabs [data-tab]").forEach(function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-tab") === name ? "true" : "false");
    });
    $all(".panel").forEach(function (p) {
      p.classList.toggle("active", p.id === "tab-" + name);
    });
    renderTab(name);
    try {
      if (!(name === "items" && /^#item-\d+/.test(location.hash || ""))) {
        history.replaceState(null, "", "#"+name);
      }
    } catch (e) {}
  }

  function renderTab(name) {
    renderChrome();
    if (name === "character") renderCharacter();
    else if (name === "goals") renderGoals();
    else if (name === "gold") renderGold();
    else if (name === "professions") renderProfessionsTab();
    else if (name === "notes") renderNotes();
    else if (name === "items") { if (window.ItemDB) window.ItemDB.onTab(); else renderItems(); }
    else if (name === "talents") renderTalents();
    else if (name === "leveling") renderLeveling();
  }

  function renderChrome() {
    var c = ch();
    var chip = $("#charChip");
    if (c.name) {
      chip.innerHTML = "<strong style=\"color:" + classColor(c.class) + "\">" + escapeHtml(c.name) +
        "</strong> · " + escapeHtml(c.race) + " " + escapeHtml(c.class) +
        " (" + escapeHtml(c.spec) + ") · " + c.level;
    } else {
      chip.textContent = "Set up your character";
    }
  }

  /* ---------- character tab ---------- */
  function renderCharacter() {
    var c = ch();
    var form = $("#characterForm");
    var active = document.activeElement;
    if (active !== form.name) form.name.value = c.name || "";
    fillSelect(form.race, DATA.races, c.race);
    fillSelect(form.class, DATA.classes, c.class);
    var specs = (DATA.specs[c.class] || []);
    if (specs.indexOf(c.spec) === -1) c.spec = specs[0] || "";
    fillSelect(form.spec, specs, c.spec);
    if (active !== form.level) form.level.value = c.level || 1;
    var races = DATA.classRaces[c.class] || [];
    var hint = $("#classHint");
    hint.textContent = c.class + " can be: " + races.join(", ") + ". Forever may add races — pick what you play.";
    if (c.race && c.race.indexOf("Skyborne") !== -1) {
      hint.textContent += " Skyborne class lists are not fully sourced, so every class stays selectable.";
    } else if (c.race && races.length && races.indexOf(c.race) === -1) {
      hint.textContent += " Note: " + c.race + " is not a vanilla option for " + c.class + ", but it's saved anyway.";
    }
  }

  function parseBoundedInt(raw, min, max, fallback) {
    var n = parseInt(raw, 10);
    if (raw === "" || raw === "-" || raw === "+" || isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function applyCharacterForm(opts) {
    opts = opts || {};
    var form = $("#characterForm");
    var prevClass = state.character.class;
    var level = state.character.level || 1;
    if (opts.clampLevel) {
      level = parseBoundedInt(form.level.value, 1, 60, 1);
    } else {
      var n = parseInt(form.level.value, 10);
      if (form.level.value !== "" && form.level.value !== "-" && form.level.value !== "+" && !isNaN(n) && n >= 1 && n <= 60) {
        level = n;
      }
    }
    var name = form.name.value;
    if (opts.trimName) name = name.trim();
    state.character = {
      name: name,
      race: form.race.value,
      class: form.class.value,
      spec: form.spec.value,
      level: level
    };
    if (state.character.class !== prevClass) {
      var specs = DATA.specs[state.character.class] || [];
      state.character.spec = specs[0] || "";
      if (state.talents && state.talents.class && state.talents.class !== state.character.class) {
        var mode = talentMode();
        var spec = (state.talents && state.talents.activeSpec) || "primary";
        state.talents = emptyTalentState(state.character.class);
        state.talents.mode = mode;
        state.talents.activeSpec = spec;
      } else if (state.talents) {
        state.talents.class = state.character.class;
      }
    }
    normalizeLeveling();
    if (state.leveling.follow) state.leveling.race = state.character.race || state.leveling.race;
    save();
    if (opts.render) renderCharacter();
    renderChrome();
  }

  /* Mid-typing: never clamp or rewrite the level field. */
  function onCharacterInput(e) {
    var isLevel = e.target && e.target.name === "level";
    if (isLevel) {
      applyCharacterForm({ clampLevel: false, render: false, trimName: false });
      return;
    }
    var isSelect = e.target && e.target.tagName === "SELECT";
    applyCharacterForm({ clampLevel: false, render: isSelect, trimName: false });
  }

  /* Commit: clamp level to 1–60 on change/blur/submit. */
  function onCharacterCommit() {
    applyCharacterForm({ clampLevel: true, render: true, trimName: true });
  }

  function onCharacterChange() { onCharacterCommit(); }

  /* ---------- goals ---------- */
  function allGoalDefs() {
    var list = [];
    DATA.dungeons.forEach(function (d) {
      list.push(Object.assign({ category: "dungeon" }, d));
    });
    DATA.raids.forEach(function (d) {
      list.push(Object.assign({ category: "raid" }, d));
    });
    DATA.mounts.forEach(function (d) {
      list.push(Object.assign({ category: "mount" }, d));
    });
    DATA.achievements.forEach(function (d) {
      list.push(Object.assign({ category: "achievement" }, d));
    });
    (state.customGoals || []).forEach(function (d) {
      list.push(Object.assign({ category: "custom" }, d));
    });
    return list;
  }

  function goalProgress(g) {
    var rec = state.goals[g.id] || {};
    var status = rec.status || "not-started";
    var progress = status === "done" ? 100 : (status === "in-progress" ? (rec.progress != null ? rec.progress : 40) : 0);
    return { status: status, progress: progress, notes: rec.notes || "" };
  }

  function renderGoals() {
    var q = ($("#goalSearch").value || "").toLowerCase();
    var defs = allGoalDefs().filter(function (g) {
      if (goalFilter !== "all" && g.category !== goalFilter) return false;
      if (q && (g.name + " " + (g.notes || "") + " " + (g.zone || "")).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var counts = { total: 0, done: 0, "in-progress": 0 };
    allGoalDefs().forEach(function (g) {
      counts.total++;
      var s = goalProgress(g).status;
      if (s === "done") counts.done++;
      if (s === "in-progress") counts["in-progress"]++;
    });
    $("#goalSummary").innerHTML =
      pill("Tracked", counts.total) + pill("In progress", counts["in-progress"]) + pill("Completed", counts.done);

    var groups = { dungeon: "Dungeons", raid: "Raids & world bosses", mount: "Mounts", achievement: "Milestones", custom: "Custom" };
    var html = "";
    Object.keys(groups).forEach(function (cat) {
      var items = defs.filter(function (g) { return g.category === cat; });
      if (!items.length) return;
      html += "<h3>" + groups[cat] + "</h3><div class=\"card-grid\">";
      items.forEach(function (g) { html += goalCard(g); });
      html += "</div>";
    });
    $("#goalLists").innerHTML = html || "<p class=\"muted\">No goals match that filter.</p>";
  }

  function pill(label, value) {
    return '<div class="stat-pill"><div class="kicker">' + label + '</div><div class="value">' + value + "</div></div>";
  }

  function goalCard(g) {
    var p = goalProgress(g);
    var meta = [];
    if (g.levelMin) meta.push("Level " + g.levelMin + (g.levelMax && g.levelMax !== g.levelMin ? "–" + g.levelMax : ""));
    if (g.players) meta.push(g.players + "-player");
    if (g.zone) meta.push(g.zone);
    if (g.faction && g.faction !== "both") meta.push(g.faction);
    if (g.phase) meta.push(g.phase);
    var lvl = ch().level || 1;
    var rec = "";
    if (g.levelMin) {
      if (lvl < g.levelMin - 2) rec = " <span class=\"muted\">(later)</span>";
      else if (lvl <= g.levelMax) rec = " <span class=\"badge at-level\">in range</span>";
    }
    return '<article class="card" data-goal="' + escapeHtml(g.id) + '">' +
      '<div class="goal-head"><h4>' + escapeHtml(g.name) + rec + "</h4>" +
      '<span class="status ' + p.status + '">' + p.status.replace("-", " ") + "</span></div>" +
      (meta.length ? '<div class="goal-meta">' + escapeHtml(meta.join(" · ")) + "</div>" : "") +
      (g.notes ? '<p class="muted" style="margin:0 0 8px">' + escapeHtml(g.notes) + "</p>" : "") +
      '<div class="progress ' + (p.status === "done" ? "done" : "") + '"><span style="width:' + p.progress + '%"></span></div>' +
      '<div class="row-actions">' +
      '<button type="button" class="btn btn-sm" data-goal-status="not-started">Not started</button>' +
      '<button type="button" class="btn btn-sm" data-goal-status="in-progress">In progress</button>' +
      '<button type="button" class="btn btn-sm" data-goal-status="done">Done</button>' +
      (g.category === "custom" ? '<button type="button" class="btn btn-sm btn-danger" data-goal-del="1">Delete</button>' : "") +
      "</div>" +
      '<label class="field" style="margin-top:8px">Notes<textarea data-goal-notes rows="2">' + escapeHtml(p.notes) + "</textarea></label>" +
      "</article>";
  }

  /* ---------- gold & professions ---------- */
  function renderGold() {
    var form = $("#goldForm");
    if (!form.date.value) form.date.value = todayISO();
    $("#goldSummary").innerHTML = pill("Running total", formatGold(goldTotal()));
    drawGoldChart();
    if (window.GoldFarms) {
      try { window.GoldFarms.render(state, { save: save, formatGold: formatGold, escapeHtml: escapeHtml }); }
      catch (e) { console.error(e); }
    }
    var rows = state.goldLog.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    var html = "<thead><tr><th>Date</th><th>Amount</th><th>Source</th><th></th></tr></thead><tbody>";
    if (!rows.length) html += "<tr><td colspan=\"4\" class=\"muted\">No entries yet.</td></tr>";
    rows.forEach(function (e) {
      html += "<tr><td>" + escapeHtml(e.date) + "</td><td>" + formatGold(e.copper) + "</td><td>" +
        escapeHtml(e.note || "") + "</td><td><button type=\"button\" class=\"btn btn-sm btn-danger\" data-del-gold=\"" +
        escapeHtml(e.id) + "\">Remove</button></td></tr>";
    });
    html += "</tbody>";
    $("#goldTable").innerHTML = html;
  }

  function renderProfessionsTab() {
    renderProfessions();
    renderCrafting();
    if (window.ProfGuide) {
      try { window.ProfGuide.syncAndRender({ scroll: true }); }
      catch (e) { try { window.ProfGuide.render(); } catch (e2) { console.error(e2); } }
    }
  }

  function drawGoldChart() {
    var canvas = $("#goldChart");
    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    var entries = state.goldLog.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    ctx.fillStyle = "#c4b48a";
    ctx.font = "12px sans-serif";
    if (entries.length < 1) {
      ctx.fillText("Add gold entries to see a running-total chart.", 16, h / 2);
      return;
    }
    var running = 0;
    var pts = entries.map(function (e) { running += e.copper; return running; });
    var min = Math.min(0, Math.min.apply(null, pts));
    var max = Math.max(0, Math.max.apply(null, pts));
    if (min === max) max = min + 10000;
    var pad = 28;
    ctx.strokeStyle = "#3a2c18";
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad, h - pad);
    ctx.lineTo(w - 8, h - pad);
    ctx.stroke();
    // zero line
    var z = h - pad - ((0 - min) / (max - min)) * (h - pad * 2);
    ctx.strokeStyle = "#4a3a22";
    ctx.beginPath(); ctx.moveTo(pad, z); ctx.lineTo(w - 8, z); ctx.stroke();
    ctx.strokeStyle = "#d4b44c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach(function (v, i) {
      var x = pad + (pts.length === 1 ? (w - pad - 8) / 2 : i * (w - pad - 16) / (pts.length - 1));
      var y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = "#d4b44c";
    pts.forEach(function (v, i) {
      var x = pad + (pts.length === 1 ? (w - pad - 8) / 2 : i * (w - pad - 16) / (pts.length - 1));
      var y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = "#8d7d5e";
    ctx.fillText(fromCopper(max).g + "g", 4, pad);
    ctx.fillText(fromCopper(min).g + "g", 4, h - 10);
  }

  function renderProfessions() {
    var box = $("#professions");
    if (!state.professions.length) {
      box.innerHTML = "<p class=\"muted\">No professions yet. Add one and the guide below will start at your skill. Classic caps at 300.</p>";
      return;
    }
    box.innerHTML = state.professions.map(function (p) {
      var pct = Math.max(0, Math.min(100, (p.skill || 0) / 300 * 100));
      return '<div class="card" data-prof="' + escapeHtml(p.id) + '"><div class="goal-head"><h4>' +
        escapeHtml(p.name) + "</h4><button type=\"button\" class=\"btn btn-sm btn-danger\" data-del-prof>Remove</button></div>" +
        '<label class="field">Skill <input type="number" min="0" max="300" value="' + (p.skill || 0) + '" data-prof-skill></label>' +
        '<div class="progress ' + (p.skill >= 300 ? "done" : "") + '"><span style="width:' + pct + '%"></span></div>' +
        '<div class="muted" style="margin-top:4px">' + (p.skill || 0) + " / 300</div></div>";
    }).join("");
  }

  function renderCrafting() {
    var box = $("#craftList");
    if (!state.crafting.length) {
      box.innerHTML = "<p class=\"muted\">No recipes on the list.</p>";
      return;
    }
    box.innerHTML = state.crafting.map(function (r) {
      var mats = (r.mats || []).map(function (m, i) {
        var need = Math.max(0, (m.qty || 0) - (m.have || 0));
        return '<div style="display:flex;gap:8px;align-items:center;margin:4px 0" data-mat="' + i + '">' +
          "<span style=\"flex:1\">" + escapeHtml(m.name) + " × " + m.qty + "</span>" +
          '<label class="muted">Have <input type="number" min="0" value="' + (m.have || 0) + '" data-mat-have style="width:70px"></label>' +
          "<span>Need <strong>" + need + "</strong></span></div>";
      }).join("");
      return '<div class="card" data-craft="' + escapeHtml(r.id) + '" style="margin-bottom:10px"><div class="goal-head"><h4>' +
        escapeHtml(r.recipe) + "</h4><button type=\"button\" class=\"btn btn-sm btn-danger\" data-del-craft>Remove</button></div>" +
        mats + "</div>";
    }).join("");
  }

  /* ---------- notes ---------- */
  function renderNotes() {
    var jf = $("#journalForm");
    if (!jf.date.value) jf.date.value = todayISO();
    var q = ($("#notesSearch").value || "").toLowerCase();
    var journals = state.journal.filter(function (e) {
      return !q || (e.title + " " + e.body + " " + e.date).toLowerCase().indexOf(q) !== -1;
    }).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var notes = state.notes.filter(function (e) {
      return !q || (e.title + " " + e.body).toLowerCase().indexOf(q) !== -1;
    }).slice().sort(function (a, b) { return (b.updated || "") > (a.updated || "") ? 1 : -1; });
    $("#journalList").innerHTML = journals.length ? journals.map(function (e) {
      return '<article class="entry" data-journal="' + escapeHtml(e.id) + '"><div class="when">' + escapeHtml(e.date) +
        '</div><h4>' + escapeHtml(e.title || "Untitled") + "</h4><p style=\"white-space:pre-wrap\">" +
        escapeHtml(e.body || "") + "</p>" +
        '<button type="button" class="btn btn-sm btn-danger" data-del-journal>Delete</button></article>';
    }).join("") : "<p class=\"muted\">No journal entries yet.</p>";
    $("#noteList").innerHTML = notes.length ? notes.map(function (e) {
      return '<article class="entry" data-note="' + escapeHtml(e.id) + '"><h4>' + escapeHtml(e.title || "Untitled") +
        "</h4><p style=\"white-space:pre-wrap\">" + escapeHtml(e.body || "") + "</p>" +
        '<button type="button" class="btn btn-sm btn-danger" data-del-note>Delete</button></article>';
    }).join("") : "<p class=\"muted\">No notes yet.</p>";
  }

  /* ---------- items / upgrades ---------- */
  function effectiveReq(item) {
    if (!item) return null;
    var raw = item.reqLevel;
    var req = (raw == null || raw === "") ? null : Number(raw);
    if (req != null && isNaN(req)) req = null;
    var ilvl = Number(item.itemLevel) || 0;
    var fromIlvl = ilvl > 5 ? Math.max(1, ilvl - 5) : null;
    // Missing or default-0 required level: infer conservatively from ilvl.
    // Never treat a high-ilvl piece as usable at level 1.
    if (req == null || req === 0) {
      if (fromIlvl) return fromIlvl;
      if (ilvl > 0 && ilvl <= 5) return 1;
      return null; // unknown — exclude from at-your-level lists
    }
    // Forever records sometimes store RequiredLevel 1 (or another low
    // placeholder) on high-ilvl gear. Use the ilvl-5 proxy when the gap is large.
    if (fromIlvl && fromIlvl - req >= 8) return fromIlvl;
    return req;
  }
  function reqUsable(item, cap) {
    var req = effectiveReq(item);
    if (req == null) return false;
    return req <= cap;
  }
  function itemIconHtml(item, size) {
    size = size || 36;
    if (item && item.icon) {
      return '<img class="slot-icon" src="' + ICON_BASE + item.icon + '.jpg" alt="" width="' + size + '" height="' + size + '" data-icon-img>';
    }
    return '<span class="slot-icon slot-icon-empty" aria-hidden="true"></span>';
  }
  function allItems() {
    var base = (window.ITEM_GEAR || ITEMS || []).filter(function (it) {
      return it && it.forever !== false;
    });
    return base.concat(state.customItems || []);
  }

  function slotMeta(id) {
    return DATA.slots.find(function (s) { return s.id === id; }) || { id: id, label: id, slot: id };
  }
  function slotBase(id) {
    var m = slotMeta(id);
    return m.slot || m.id;
  }

  function itemFitsSlot(item, slotId) {
    var base = slotBase(slotId);
    if (base === "ranged") {
      return item.slot === "ranged" || item.slot === "relic";
    }
    if (base === "mainhand") return item.slot === "mainhand" || item.slot === "onehand" || item.slot === "twohand";
    if (base === "offhand") return item.slot === "offhand" || item.slot === "onehand";
    return item.slot === base;
  }

  function profFor(cls) { return DATA.proficiencies[cls] || null; }

  function canUseTypeAtLevel(item, character, windowPts) {
    var p = profFor(character.class);
    if (!p) return true;
    var lvl = (character.level || 1) + (windowPts || 0);
    if (item.classes && item.classes.length && item.classes.indexOf(character.class) === -1) return false;
    if (ARMOR.indexOf(item.type) !== -1) {
      if (p.armor.indexOf(item.type) === -1) return false;
      if (item.type === "plate" && lvl < (p.plateAt || 40)) return false;
      if (item.type === "mail" && lvl < (p.mailAt || 1)) return false;
    }
    if (item.type === "shield") return !!p.shield;
    if (RELICS.indexOf(item.type) !== -1) return p.relic === item.type;
    if (item.type === "held") return true;
    if (WEAPONS.indexOf(item.type) !== -1) {
      if (p.weapons.indexOf(item.type) === -1 && item.type !== "held") return false;
      if (item.slot === "twohand") {
        if (!p.twoHand) return false;
        if (p.noTwoHandMace && item.type === "mace") return false;
        if (p.oneHandOnly && item.type !== "staff") return false;
      }
    }
    return true;
  }

  function preferredArmorTypes(character, windowPts) {
    var p = profFor(character.class);
    var lvl = (character.level || 1) + (windowPts || 0);
    if (!p) return ARMOR;
    if (p.armor.indexOf("plate") !== -1 && lvl >= (p.plateAt || 40)) return ["plate"];
    if (p.armor.indexOf("mail") !== -1 && lvl >= (p.mailAt || 1)) return ["mail"];
    if (p.armor.indexOf("leather") !== -1) return ["leather"];
    return ["cloth"];
  }

  function canEquipInSlot(item, character, slotId, windowPts) {
    if (!itemFitsSlot(item, slotId)) return false;
    if (!canUseTypeAtLevel(item, character, windowPts)) return false;
    var p = profFor(character.class);
    var base = slotBase(slotId);
    if (base === "offhand") {
      var isWeapon = WEAPONS.indexOf(item.type) !== -1 && item.type !== "shield" && item.type !== "held" && RELICS.indexOf(item.type) === -1;
      if (isWeapon && (!p || !p.dualWield)) return false;
    }
    if (base === "ranged" && item.slot === "relic") {
      return p && p.relic && item.type === p.relic;
    }
    if (base === "ranged" && item.slot === "ranged" && p && p.relic && !item.type) {
      /* ok */
    }
    return true;
  }

  function itemFiltersRoot() {
    if (!state.itemFilters || typeof state.itemFilters !== "object") state.itemFilters = { class: null, slots: {} };
    if (!state.itemFilters.slots || typeof state.itemFilters.slots !== "object") state.itemFilters.slots = {};
    return state.itemFilters;
  }
  function viewClass() {
    return itemFiltersRoot().class || ch().class || "Warrior";
  }
  function setViewClass(cls) {
    var root = itemFiltersRoot();
    root.class = cls;
    Object.keys(root.slots).forEach(function (id) {
      var f = root.slots[id];
      if (!f) return;
      f.type = "usable";
      f.hand = "all";
      if (f.build && window.ITEM_WEIGHTS && !ITEM_WEIGHTS.isRole(f.build) && !ITEM_WEIGHTS.canonSpec(cls, f.build)) {
        f.build = null;
      }
    });
    save();
  }
  function slotFilter(slotId) {
    var root = itemFiltersRoot();
    if (!root.slots[slotId]) root.slots[slotId] = { type: "usable", hand: "all", build: null, sort: "best", minQuality: "all" };
    var f = root.slots[slotId];
    if (!f.type) f.type = "usable";
    if (!f.hand) f.hand = "all";
    if (!f.sort) f.sort = "best";
    if (!f.minQuality) f.minQuality = "all";
    return f;
  }
  function viewChar() {
    var c = ch();
    return { name: c.name, race: c.race, class: viewClass(), spec: c.spec, level: c.level || 1 };
  }
  function selectedBuild(slotId) {
    var f = slotFilter(slotId);
    var cls = viewClass();
    var IW = window.ITEM_WEIGHTS;
    if (f.build && IW) {
      if (IW.isRole(f.build)) return f.build;
      var canon = IW.canonSpec(cls, f.build);
      if (canon) return canon;
    }
    if (IW && ch().class === cls) {
      var spec = IW.canonSpec(cls, ch().spec);
      if (spec) return spec;
    }
    return (IW && IW.specsOf(cls)[0]) || ch().spec || "";
  }
  function characterWeights() {
    var IW = window.ITEM_WEIGHTS;
    var c = ch();
    if (IW) return IW.weightsFor(c.class, IW.canonSpec(c.class, c.spec) || c.spec);
    return { ilvl: 1 };
  }
  function weightsFor(slotId) {
    var IW = window.ITEM_WEIGHTS;
    var id = slotId || selectedSlot;
    if (IW && id) return IW.weightsFor(viewClass(), selectedBuild(id));
    return characterWeights();
  }
  function hasStatData(item) {
    var s = (item && item.stats) || {};
    var k;
    for (k in s) {
      if (Object.prototype.hasOwnProperty.call(s, k) && typeof s[k] === "number" && s[k]) return true;
    }
    return !!(item && item.weapon && item.weapon.dps);
  }
  function itemScore(item, weights) {
    var w = weights || (selectedSlot ? weightsFor(selectedSlot) : characterWeights());
    var s = item.stats || {};
    var score = 0;
    Object.keys(s).forEach(function (k) {
      if (typeof s[k] === "number" && w[k]) score += s[k] * w[k];
    });
    if (item.weapon && item.weapon.dps && w.dps) score += item.weapon.dps * w.dps;
    if (hasStatData(item) && item.itemLevel && w.ilvl) score += item.itemLevel * w.ilvl;
    return score;
  }

  /* Classic quality ranks. Artifact / heirloom are included when the data has them,
     sitting above legendary and with rare, respectively; they are omitted from the
     Min rarity list when a slot has none. */
  var QUALITY_RANK = { poor: 1, common: 2, uncommon: 3, rare: 4, heirloom: 4, epic: 5, legendary: 6, artifact: 7 };
  var QUALITY_ORDER = ["poor", "common", "uncommon", "rare", "heirloom", "epic", "legendary", "artifact"];
  var QUALITY_LABELS = { poor: "Poor", common: "Common", uncommon: "Uncommon", rare: "Rare", heirloom: "Heirloom", epic: "Epic", legendary: "Legendary", artifact: "Artifact" };
  function qualityRank(q) {
    return QUALITY_RANK[String(q || "common").toLowerCase()] || 0;
  }
  function passesMinQuality(item, f) {
    var min = f && f.minQuality;
    if (!min || min === "all") return true;
    return qualityRank(item && item.quality) >= qualityRank(min);
  }
  function compareBySort(itemA, itemB, scoreA, scoreB, reqA, reqB, sort) {
    var nameCmp = (itemA.name || "").localeCompare(itemB.name || "");
    if (sort === "rarity") {
      var dq = qualityRank(itemB.quality) - qualityRank(itemA.quality);
      if (dq) return dq;
      var ds = (scoreB || 0) - (scoreA || 0);
      if (ds) return ds;
      var di = (itemB.itemLevel || 0) - (itemA.itemLevel || 0);
      return di || nameCmp;
    }
    if (sort === "ilvl") {
      var li = (itemB.itemLevel || 0) - (itemA.itemLevel || 0);
      if (li) return li;
      var rq = qualityRank(itemB.quality) - qualityRank(itemA.quality);
      return rq || nameCmp;
    }
    if (sort === "req") {
      var lr = (reqB || 0) - (reqA || 0);
      if (lr) return lr;
      var ii = (itemB.itemLevel || 0) - (itemA.itemLevel || 0);
      return ii || nameCmp;
    }
    var sc = (scoreB || 0) - (scoreA || 0);
    if (sc) return sc;
    return (itemB.itemLevel || 0) - (itemA.itemLevel || 0) || nameCmp;
  }

  var TYPE_CHIP_LABELS = {
    cloth: "Cloth", leather: "Leather", mail: "Mail", plate: "Plate",
    sword: "Swords", axe: "Axes", mace: "Maces", dagger: "Daggers",
    staff: "Staves", polearm: "Polearms", fist: "Fist",
    bow: "Bows", gun: "Guns", crossbow: "Crossbows", wand: "Wands", thrown: "Thrown",
    shield: "Shields", held: "Held", libram: "Librams", totem: "Totems", idol: "Idols"
  };
  var TYPE_CHIP_ORDER = {
    armor: ["cloth","leather","mail","plate"],
    weapon: ["sword","axe","mace","dagger","staff","polearm","fist","shield","held"],
    ranged: ["wand","bow","gun","crossbow","thrown","libram","totem","idol"]
  };
  function typeFamily(slotId) {
    var base = slotBase(slotId);
    if (base === "ranged") return "ranged";
    if (base === "mainhand" || base === "offhand") return "weapon";
    if (["head","shoulder","chest","wrist","hands","waist","legs","feet","back"].indexOf(base) !== -1) return "armor";
    return "other";
  }
  function itemHandChip(item) {
    if (!item) return null;
    if (item.slot === "twohand") return "2h";
    if (item.type === "staff" || item.type === "polearm") return "2h";
    if (item.type === "shield" || item.type === "held" || RELICS.indexOf(item.type) !== -1) return null;
    if (item.slot === "onehand" || item.slot === "mainhand" || item.slot === "offhand") return "1h";
    return null;
  }

  function formatStats(item) {
    var s = item.stats || {};
    var parts = [];
    var labels = { str: "Str", agi: "Agi", sta: "Sta", int: "Int", spi: "Spi", ap: "AP", rap: "RAP", fap: "Feral AP",
      crit: "Crit%", hit: "Hit%", spellCrit: "Spell Crit%", spellHit: "Spell Hit%", sp: "Spell Dmg", healing: "Healing",
      mp5: "Mp5", hp5: "Hp5", defense: "Defense", dodge: "Dodge%", parry: "Parry%", blockChance: "Block%",
      blockValue: "Block value", block: "Block", armor: "Armor", spFire: "Fire dmg", spFrost: "Frost dmg",
      spShadow: "Shadow dmg", spNature: "Nature dmg", spArcane: "Arcane dmg", spHoly: "Holy dmg", spellPen: "Spell Pen" };
    Object.keys(labels).forEach(function (k) {
      if (s[k]) parts.push("+" + s[k] + " " + labels[k]);
    });
    if (item.weapon) {
      parts.unshift((item.weapon.min || "?") + "–" + (item.weapon.max || "?") + "  (" + (item.weapon.dps || "?") + " dps, " + (item.weapon.speed || "?") + "s)");
    }
    (item.effects || []).forEach(function (e) { parts.push(e); });
    return parts.join(" · ");
  }

  function equippedTwoHand() {
    var mh = state.equipment.mainhand;
    return mh && mh.slot === "twohand";
  }

  function slotButtonHtml(slotId, selectedId) {
    var s = slotMeta(slotId);
    var it = state.equipment[slotId];
    var blocked = slotId === "offhand" && equippedTwoHand();
    var name = blocked ? "Occupied by two-hand" : (it ? it.name : "Empty");
    var q = it ? qualityClass(it.quality) : "";
    var cls = "slot-btn";
    if (!it && !blocked) cls += " empty";
    if (selectedId && slotId === selectedId) cls += " is-open";
    return '<button type="button" class="' + cls + '" data-equip-slot="' + s.id + '"' +
      (it && it.id != null ? ' data-item-id="' + escapeHtml(String(it.id)) + '"' : "") + ">" +
      itemIconHtml(blocked ? null : it) +
      '<span class="slot-text"><div class="slot-name">' + escapeHtml(s.label) + "</div>" +
      '<div class="item-name ' + q + '">' + escapeHtml(name) + "</div></span></button>";
  }

  function renderItems() {
    var doll = $("#paperDoll");
    if (!doll) return;
    var sel = selectedSlot;
    doll.innerHTML =
      '<div class="doll-col doll-left">' + DOLL_LEFT.map(function (id) { return slotButtonHtml(id, sel); }).join("") + "</div>" +
      '<div class="doll-center"><div class="doll-figure" aria-hidden="true"></div></div>' +
      '<div class="doll-col doll-right">' + DOLL_RIGHT.map(function (id) { return slotButtonHtml(id, sel); }).join("") + "</div>" +
      '<div class="doll-weapons">' + DOLL_WEAPONS.map(function (id) { return slotButtonHtml(id, sel); }).join("") + "</div>";
    if (sel) renderSlotPanel(sel);
    else {
      var panel = $("#slotPanel");
      if (panel) { panel.hidden = true; panel.innerHTML = ""; }
    }
  }

  var SKIP_UPGRADE_NAME = /gamemaster|\bqa\s*test\b|\[ph\]|\(test\)|<ph>|\btodo\b|^\d+\s+(epic|green)\b|test staff|^test\s/i;
  function isJunkUpgrade(item) {
    return !!(item && SKIP_UPGRADE_NAME.test(item.name || ""));
  }

  function otherUniqueEquipped(item, slotId) {
    if (!item || !item.unique) return false;
    return Object.keys(state.equipment).some(function (k) {
      if (k === slotId) return false;
      var e = state.equipment[k];
      return e && (e.id === item.id || e.name === item.name);
    });
  }

  function isThinUpgrade(item) {
    var s = item.stats || {};
    var meaningful = Object.keys(s).some(function (k) { return k !== "armor" || s[k] > 5; });
    if (meaningful || item.weapon || (item.effects && item.effects.length)) return false;
    return (item.itemLevel || 0) <= 5;
  }

  function slotCandidate(item, slotId) {
    if (isJunkUpgrade(item)) return false;
    if (otherUniqueEquipped(item, slotId)) return false;
    if (isThinUpgrade(item)) return false;
    if (!itemFitsSlot(item, slotId)) return false;
    var req = effectiveReq(item);
    if (req == null) return false;
    var lvl = ch().level || 1;
    if (req > lvl + LEVEL_WINDOW) return false;
    var current = state.equipment[slotId];
    if (current && current.id === item.id && !item.custom) return false;
    if (current && current.name === item.name && current.source === item.source) return false;
    return true;
  }

  function passesSlotTypeFilter(item, slotId, f, view, windowPts) {
    if (f.hand && f.hand !== "all") {
      var hand = itemHandChip(item);
      if (hand && hand !== f.hand) return false;
    }
    if (f.type === "all") return true;
    if (f.type === "usable") return canEquipInSlot(item, view, slotId, windowPts);
    return item.type === f.type;
  }

  function typeCountsFor(slotId) {
    var view = viewChar();
    var f = slotFilter(slotId);
    var counts = {}, hands = { "1h": 0, "2h": 0 }, qualities = {};
    allItems().forEach(function (item) {
      if (!slotCandidate(item, slotId)) return;
      var typ = item.type;
      if (typ) counts[typ] = (counts[typ] || 0) + 1;
      var hand = itemHandChip(item);
      if (hand) hands[hand] = (hands[hand] || 0) + 1;
      var req = effectiveReq(item);
      var atLevel = req <= (view.level || 1);
      var windowPts = atLevel ? 0 : LEVEL_WINDOW;
      if (passesSlotTypeFilter(item, slotId, f, view, windowPts)) {
        var q = String(item.quality || "common").toLowerCase();
        qualities[q] = (qualities[q] || 0) + 1;
      }
    });
    return { types: counts, hands: hands, qualities: qualities };
  }

  function upgradesFor(slotId) {
    var view = viewChar();
    var current = state.equipment[slotId];
    if (slotId === "offhand" && equippedTwoHand()) return { blocked: true, at: [], soon: [], unknownAt: [], unknownSoon: [] };
    var f = slotFilter(slotId);
    var sort = f.sort || "best";
    var weights = weightsFor(slotId);
    var curKnown = current && hasStatData(current);
    var curScore = curKnown ? itemScore(current, weights) : 0;
    var at = [], soon = [], unknownAt = [], unknownSoon = [];
    allItems().forEach(function (item) {
      if (!slotCandidate(item, slotId)) return;
      var req = effectiveReq(item);
      var atLevel = req <= (view.level || 1);
      var windowPts = atLevel ? 0 : LEVEL_WINDOW;
      if (!passesSlotTypeFilter(item, slotId, f, view, windowPts)) return;
      if (!passesMinQuality(item, f)) return;
      var known = hasStatData(item);
      var score = known ? itemScore(item, weights) : 0;
      var rec = { item: item, score: score, delta: score - curScore, atLevel: atLevel, req: req, unknown: !known };
      if (sort === "best") {
        if (!known) {
          if (atLevel) unknownAt.push(rec); else unknownSoon.push(rec);
          return;
        }
        if (curKnown && score <= curScore + 0.05) return;
        if (atLevel) at.push(rec); else soon.push(rec);
      } else {
        if (atLevel) at.push(rec); else soon.push(rec);
      }
    });
    function byChosen(a, b) {
      return compareBySort(a.item, b.item, a.score, b.score, a.req, b.req, sort);
    }
    function byIlvl(a, b) { return (b.item.itemLevel || 0) - (a.item.itemLevel || 0) || (a.item.name || "").localeCompare(b.item.name || ""); }
    at.sort(byChosen);
    soon.sort(byChosen);
    unknownAt.sort(byIlvl);
    unknownSoon.sort(byIlvl);
    var closest = current ? at.slice().sort(function (a, b) { return a.delta - b.delta; })[0] : null;
    return {
      blocked: false,
      at: at.slice(0, 40),
      soon: soon.slice(0, SOON_LIMIT),
      unknownAt: unknownAt.slice(0, 20),
      unknownSoon: unknownSoon.slice(0, 8),
      closest: closest,
      currentScore: curScore
    };
  }

  function upgradeAhHtml(it) {
    var p = window.priceEntry ? window.priceEntry(it.id) : null;
    if (!p) return "";
    var bits = "AH " + (function (c) {
      if (c == null || isNaN(c)) return "—";
      var n = Math.round(Math.abs(c)), g = Math.floor(n / 10000), s = Math.floor((n % 10000) / 100), cc = n % 100;
      if (g) return g + "g " + s + "s";
      if (s) return s + "s" + (cc ? " " + cc + "c" : "");
      return cc + "c";
    })(p.marketValue || p.minBuyout);
    if (p.minBuyout && p.marketValue && p.minBuyout !== p.marketValue) bits += " · min " + (function (c) {
      var n = Math.round(c), g = Math.floor(n / 10000), s = Math.floor((n % 10000) / 100), cc = n % 100;
      if (g) return g + "g " + s + "s";
      if (s) return s + "s" + (cc ? " " + cc + "c" : "");
      return cc + "c";
    })(p.minBuyout);
    return '<div class="item-ah"><span class="badge buy-ah">Buy on AH</span> ' + escapeHtml(bits) +
      (p.quantity != null ? " · " + Number(p.quantity).toLocaleString() + " listed" : "") + "</div>";
  }

  function upgradeReason(rec, slotId) {
    var it = rec.item;
    var parts = [];
    var stats = formatStats(it);
    if (stats) parts.push(stats);
    var cur = state.equipment[slotId];
    if (cur && cur.itemLevel && it.itemLevel && it.itemLevel !== cur.itemLevel) {
      var d = it.itemLevel - cur.itemLevel;
      parts.push((d > 0 ? "+" : "") + d + " ilvl");
    } else if (it.itemLevel && !stats) {
      parts.push("ilvl " + it.itemLevel);
    }
    return parts.join(" · ");
  }

  function goodForHtml(rec, slotId) {
    if (rec.unknown) {
      return '<span class="kind-tag gf-unknown-tag">Stats unknown</span>';
    }
    var IW = window.ITEM_WEIGHTS;
    if (!IW) return "";
    var build = selectedBuild(slotId);
    var bits = IW.contributing(weightsFor(slotId), rec.item);
    if (!bits.length) return "";
    var explain = "Counted for " + build + ": " + bits.map(function (b) {
      return b.label + " (×" + b.weight + ")";
    }).join(", ") + ". Rough relative priorities, not a sim.";
    return '<button type="button" class="kind-tag good-for-tag" data-good-for title="' + escapeHtml(explain) + '">Good for ' +
      escapeHtml(build) + "</button>" +
      '<p class="good-for-explain muted" hidden>' + escapeHtml(explain) + "</p>";
  }

  function upgradeCard(rec, slotId) {
    var it = rec.item;
    var reason = rec.unknown ? "" : upgradeReason(rec, slotId);
    var view = viewChar();
    var saved = ch();
    var canSave = canEquipInSlot(it, saved, slotId, 0);
    var canView = canEquipInSlot(it, view, slotId, rec.atLevel ? 0 : LEVEL_WINDOW);
    var note = "";
    if (!canView) note = '<div class="upgrade-row-note muted">Your selected class cannot use this.</div>';
    else if (view.class !== saved.class && !canSave) note = '<div class="upgrade-row-note muted">Your saved character cannot equip this.</div>';
    var actions = canSave
      ? '<button type="button" class="btn btn-primary btn-sm" data-equip-id="' + escapeHtml(String(it.id)) + '">Equip</button>'
      : '<span class="muted">Can\'t equip</span>';
    return '<div class="upgrade-row' + (rec.atLevel ? "" : " soon") + (rec.unknown ? " is-unknown" : "") + '" data-item-id="' + escapeHtml(String(it.id)) + '" data-compare-slot="' + escapeHtml(String(slotId)) + '">' +
      itemIconHtml(it) +
      '<div class="upgrade-row-main">' +
      '<a href="#item-' + it.id + '" data-item-id="' + escapeHtml(String(it.id)) + '" class="item-name ' + qualityClass(it.quality) + '">' + escapeHtml(it.name) + "</a> " +
      goodForHtml(rec, slotId) +
      '<div class="upgrade-row-meta">Req ' + rec.req +
      (it.type ? " · " + escapeHtml(it.type) : "") +
      (it.itemLevel ? " · ilvl " + it.itemLevel : "") + "</div>" +
      (reason ? '<div class="upgrade-row-reason">' + escapeHtml(reason) + "</div>" : "") +
      note +
      '<div class="upgrade-row-source">' + escapeHtml(it.source || "Unknown") +
      (it.custom ? " · custom" : "") + "</div>" +
      upgradeAhHtml(it) +
      "</div>" +
      '<div class="upgrade-row-actions">' + actions + "</div>" +
      "</div>";
  }

  function slotFilterBarHtml(slotId) {
    var f = slotFilter(slotId);
    var cls = viewClass();
    var build = selectedBuild(slotId);
    var counts = typeCountsFor(slotId);
    if (f.type !== "usable" && f.type !== "all" && !counts.types[f.type]) {
      f.type = "usable";
    }
    if (f.hand !== "all" && !counts.hands[f.hand]) f.hand = "all";
    var classes = (DATA.classes || []);
    var classOpts = classes.map(function (n) {
      return '<option value="' + escapeHtml(n) + '"' + (n === cls ? " selected" : "") + ">" + escapeHtml(n) + "</option>";
    }).join("");
    var IW = window.ITEM_WEIGHTS;
    var specs = IW ? IW.specsOf(cls) : [];
    var roles = IW ? IW.roleNames() : [];
    var buildOpts = '<optgroup label="' + escapeHtml(cls) + '">';
    specs.forEach(function (s) {
      buildOpts += '<option value="' + escapeHtml(s) + '"' + (s === build ? " selected" : "") + ">" + escapeHtml(s) + "</option>";
    });
    buildOpts += "</optgroup>";
    if (roles.length) {
      buildOpts += '<optgroup label="General roles">';
      roles.forEach(function (s) {
        buildOpts += '<option value="' + escapeHtml(s) + '"' + (s === build ? " selected" : "") + ">" + escapeHtml(s) + "</option>";
      });
      buildOpts += "</optgroup>";
    }
    var family = typeFamily(slotId);
    var order = TYPE_CHIP_ORDER[family] || Object.keys(counts.types);
    var chips = '<button type="button" class="slot-chip' + (f.type === "usable" ? " is-on" : "") + '" data-slot-type="usable">Usable</button>' +
      '<button type="button" class="slot-chip' + (f.type === "all" ? " is-on" : "") + '" data-slot-type="all">All</button>';
    order.forEach(function (typ) {
      var n = counts.types[typ] || 0;
      if (!n) return;
      var label = TYPE_CHIP_LABELS[typ] || typ;
      chips += '<button type="button" class="slot-chip' + (f.type === typ ? " is-on" : "") + '" data-slot-type="' + escapeHtml(typ) + '">' +
        escapeHtml(label) + "</button>";
    });
    var handChips = "";
    if ((counts.hands["1h"] || 0) && (counts.hands["2h"] || 0)) {
      handChips = '<div class="slot-chips" role="group" aria-label="One or two hand">' +
        '<button type="button" class="slot-chip' + (f.hand === "all" ? " is-on" : "") + '" data-slot-hand="all">1H &amp; 2H</button>' +
        '<button type="button" class="slot-chip' + (f.hand === "1h" ? " is-on" : "") + '" data-slot-hand="1h">1H</button>' +
        '<button type="button" class="slot-chip' + (f.hand === "2h" ? " is-on" : "") + '" data-slot-hand="2h">2H</button>' +
        "</div>";
    }
    if (f.minQuality !== "all" && !counts.qualities[f.minQuality]) f.minQuality = "all";
    var sort = f.sort || "best";
    var sortOpts = [
      ["best", "Best for spec"],
      ["rarity", "Rarity"],
      ["ilvl", "Item level"],
      ["req", "Required level"]
    ].map(function (pair) {
      return '<option value="' + pair[0] + '"' + (sort === pair[0] ? " selected" : "") + ">" + pair[1] + "</option>";
    }).join("");
    var minOpts = '<option value="all"' + (f.minQuality === "all" ? " selected" : "") + ">Any</option>";
    QUALITY_ORDER.forEach(function (q) {
      if (!counts.qualities[q]) return;
      minOpts += '<option value="' + q + '" class="q-' + q + '"' + (f.minQuality === q ? " selected" : "") + ">" +
        escapeHtml(QUALITY_LABELS[q] || q) + "</option>";
    });
    var browseNote = (cls !== ch().class)
      ? '<p class="muted slot-browse-note">Browsing as ' + escapeHtml(cls) + ". Your saved character is a " + escapeHtml(ch().class || "unknown") + ".</p>"
      : "";
    return '<div class="slot-filters">' +
      '<label class="field">Class<select id="slotFilterClass">' + classOpts + "</select></label>" +
      '<label class="field">Best for<select id="slotFilterBuild">' + buildOpts + "</select></label>" +
      '<label class="field">Sort by<select id="slotFilterSort">' + sortOpts + "</select></label>" +
      '<label class="field">Min rarity<select id="slotFilterMinQuality">' + minOpts + "</select></label>" +
      "</div>" +
      (family === "other" ? "" : '<div class="slot-chips" role="group" aria-label="Item type">' + chips + "</div>") +
      handChips +
      browseNote;
  }

  function openSlotPanel(slotId) {
    if (selectedSlot === slotId) {
      selectedSlot = null;
      slotShowAll = false;
      renderItems();
      return;
    }
    selectedSlot = slotId;
    slotShowAll = false;
    renderItems();
    var panel = $("#slotPanel");
    if (panel) panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function renderSlotPanel(slotId) {
    var panel = $("#slotPanel");
    if (!panel) return;
    var label = slotMeta(slotId).label;
    var cur = state.equipment[slotId];
    var u = upgradesFor(slotId);
    var html = '<div class="slot-panel-head"><h3>' + escapeHtml(label) + "</h3>" +
      '<button type="button" class="btn btn-sm" data-slot-close>Close</button></div>';
    html += '<p class="slot-panel-current muted">Currently: ' +
      (cur ? '<span class="' + qualityClass(cur.quality) + '">' + escapeHtml(cur.name) + "</span>" : "empty") +
      "</p>";
    html += slotFilterBarHtml(slotId);
    html += '<div class="slot-panel-tools">' +
      '<label class="field">Search this slot<input type="search" id="slotEquipSearch" placeholder="Type a name to equip…" autocomplete="off"></label>' +
      (cur ? '<button type="button" class="btn btn-sm" data-slot-clear>Clear slot</button>' : "") +
      "</div>" +
      '<div id="slotEquipResults" class="slot-equip-results"></div>';
    if (u.blocked) {
      html += "<p class=\"muted\">Your two-handed weapon occupies this slot. Unequip it from Main Hand first, or equip a one-handed weapon there.</p>";
    } else {
      var atList = slotShowAll ? u.at : u.at.slice(0, AT_LEVEL_PAGE);
      var unkAt = u.unknownAt || [];
      var sort = slotFilter(slotId).sort || "best";
      html += "<h4>" + (sort === "best" ? "Upgrades at your level" : "At your level") + "</h4>";
      if (!atList.length && !unkAt.length) {
        html += "<p class=\"muted\">No upgrades for this slot at your level with these filters. Try All, or search above to equip something you already have.</p>";
      } else {
        atList.forEach(function (r) { html += upgradeCard(r, slotId); });
        if (!slotShowAll && u.at.length > AT_LEVEL_PAGE) {
          html += '<p><button type="button" class="btn btn-sm" data-slot-more>Show more (' + (u.at.length - AT_LEVEL_PAGE) + ")</button></p>";
        }
        if (unkAt.length) {
          html += "<h4>Stats unknown</h4>";
          html += "<p class=\"muted\">These items have no stat data in our Forever item tables, so they are listed after scored upgrades.</p>";
          (slotShowAll ? unkAt : unkAt.slice(0, 6)).forEach(function (r) { html += upgradeCard(r, slotId); });
        }
      }
      if (u.soon.length) {
        html += "<h4>Coming soon</h4>";
        u.soon.forEach(function (r) { html += upgradeCard(r, slotId); });
      }
      if (u.unknownSoon && u.unknownSoon.length) {
        html += "<h4>Coming soon — stats unknown</h4>";
        u.unknownSoon.forEach(function (r) { html += upgradeCard(r, slotId); });
      }
    }
    panel.innerHTML = html;
    panel.hidden = false;
  }

  function renderSlotSearch() {
    var box = $("#slotEquipResults");
    var input = $("#slotEquipSearch");
    if (!box || !input || !selectedSlot) return;
    var q = (input.value || "").trim().toLowerCase();
    if (!q) { box.innerHTML = ""; return; }
    var c = ch();
    var cap = c.level || 1;
    var f = slotFilter(selectedSlot);
    var view = viewChar();
    var w = weightsFor(selectedSlot);
    var sort = f.sort || "best";
    var hits = allItems().filter(function (it) {
      if (isJunkUpgrade(it)) return false;
      if (!itemFitsSlot(it, selectedSlot)) return false;
      if (!canEquipInSlot(it, c, selectedSlot, 0)) return false;
      if (!reqUsable(it, cap)) return false;
      if (!passesSlotTypeFilter(it, selectedSlot, f, view, 0)) return false;
      if (!passesMinQuality(it, f)) return false;
      return it.name.toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) {
      return compareBySort(a, b, itemScore(a, w), itemScore(b, w), effectiveReq(a), effectiveReq(b), sort);
    }).slice(0, 20);
    box.innerHTML = hits.length ? hits.map(function (it) {
      var req = effectiveReq(it);
      return '<button type="button" class="slot-btn" data-equip-id="' + escapeHtml(String(it.id)) + '" data-item-id="' + escapeHtml(String(it.id)) + '" data-compare-slot="' + escapeHtml(String(selectedSlot)) + '">' +
        itemIconHtml(it) +
        '<span class="slot-text"><div class="item-name ' + qualityClass(it.quality) + '">' + escapeHtml(it.name) + "</div>" +
        '<div class="muted" style="font-size:11px">Req ' + (req != null ? req : "?") +
        (it.itemLevel ? " · ilvl " + it.itemLevel : "") +
        (it.source ? " · " + escapeHtml(it.source) : "") + "</div></span></button>";
    }).join("") : "<p class=\"muted\">No matching items you can use in this slot at your level.</p>";
  }

  function equipFromPanel(id) {
    if (!selectedSlot) return;
    var item = allItems().find(function (it) { return String(it.id) === String(id); });
    if (!item) return;
    if (!canEquipInSlot(item, ch(), selectedSlot, 0)) {
      toast("Your character cannot use that in this slot");
      return;
    }
    state.equipment[selectedSlot] = item;
    if (item.slot === "twohand") state.equipment.offhand = null;
    save();
    slotShowAll = false;
    renderItems();
    toast("Equipped " + item.name);
  }

  function clearSelectedSlot() {
    if (!selectedSlot) return;
    delete state.equipment[selectedSlot];
    save();
    slotShowAll = false;
    renderItems();
  }

  function openCustomItemForm() {
    var slotOpts = ["head","neck","shoulder","back","chest","wrist","hands","waist","legs","feet","finger","trinket","mainhand","offhand","onehand","twohand","ranged","relic"].map(function (s) {
      return "<option value=\"" + s + "\">" + s + "</option>";
    }).join("");
    var typeOpts = ["cloth","leather","mail","plate","misc","sword","axe","mace","dagger","staff","polearm","fist","bow","gun","crossbow","wand","thrown","shield","held","idol","totem","libram"].map(function (s) {
      return "<option value=\"" + s + "\">" + s + "</option>";
    }).join("");
    var qOpts = ["poor","common","uncommon","rare","epic","legendary"].map(function (s) {
      return "<option value=\"" + s + "\"" + (s === "rare" ? " selected" : "") + ">" + s + "</option>";
    }).join("");
    openModal(
      "<h3>Add a custom item</h3>" +
      "<p class=\"muted\">Use this for Forever-only gear or anything missing from the Classic Era starter database. It is saved in this browser and included in Export.</p>" +
      '<form id="customItemForm" class="form-grid">' +
      '<label class="field">Name<input name="name" required></label>' +
      '<label class="field">Slot<select name="slot">' + slotOpts + "</select></label>" +
      '<label class="field">Armor / weapon type<select name="type">' + typeOpts + "</select></label>" +
      '<label class="field">Quality<select name="quality">' + qOpts + "</select></label>" +
      '<label class="field">Required level<input type="number" name="reqLevel" min="0" max="60" value="60"></label>' +
      '<label class="field">Item level<input type="number" name="itemLevel" min="1" value="60"></label>' +
      '<label class="field">Source / how to get it<input name="source" placeholder="Boss, quest, crafted…"></label>' +
      '<label class="field">Class limit (blank = all)<input name="classes" placeholder="Warrior, Paladin"></label>' +
      '<label class="field">Stats (e.g. str 12, sta 10, crit 1, sp 22)<input name="stats" placeholder="str 12, ap 20, crit 1"></label>' +
      "</form>" +
      '<div class="row-actions"><button type="button" class="btn btn-primary" id="btnSaveCustom">Save to database</button>' +
      '<button type="button" class="btn" data-close>Cancel</button></div>'
    );
    $("#btnSaveCustom").addEventListener("click", function () {
      var f = $("#customItemForm");
      var name = f.name.value.trim();
      if (!name) { toast("Name is required"); return; }
      var stats = {};
      String(f.stats.value || "").split(",").forEach(function (part) {
        var m = part.trim().match(/^([a-zA-Z]+)\s+(-?\d+(?:\.\d+)?)$/);
        if (m) stats[m[1]] = Number(m[2]);
      });
      var classes = f.classes.value.trim() ? f.classes.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : null;
      var item = {
        id: uid("custom"),
        name: name,
        slot: f.slot.value,
        slotLabel: f.slot.value,
        type: f.type.value,
        quality: f.quality.value,
        reqLevel: parseInt(f.reqLevel.value, 10) || 0,
        itemLevel: parseInt(f.itemLevel.value, 10) || null,
        stats: stats,
        source: f.source.value.trim() || "Custom (Forever)",
        sourceType: "custom",
        custom: true
      };
      if (classes) item.classes = classes;
      state.customItems.push(item);
      save();
      closeModal();
      renderItems();
      toast("Added " + name + " to your database");
    });
  }

  /* ---------- talents ---------- */
  function talentClassData() {
    var pack = talentPack();
    var name = ch().class;
    return pack.find(function (c) { return c.name === name; }) || pack[0];
  }

  function charTalentLevel() {
    return Math.max(1, Math.min(60, ch().level || 1));
  }
  function pointsAtLevel(lvl) {
    return Math.max(0, Math.min(51, (lvl || 1) - 9));
  }
  function pointsAvailable() {
    return pointsAtLevel(charTalentLevel());
  }
  function myTalentBaseline() {
    return Math.max(10, Math.min(60, charTalentLevel()));
  }
  function viewTalentLevel() {
    if (!talentPreview) return charTalentLevel();
    if (talentViewLevel == null) return myTalentBaseline();
    return Math.max(10, Math.min(60, talentViewLevel));
  }
  function treeMap(treeName) {
    var store = talentStore();
    if (!store.trees) store.trees = {};
    if (!store.trees[treeName]) store.trees[treeName] = {};
    return store.trees[treeName];
  }
  function talentRank(treeName, id) {
    return (treeMap(treeName)[String(id)] || 0);
  }
  function treeSpent(treeName, trees) {
    var m = trees ? (trees[treeName] || {}) : treeMap(treeName);
    return Object.keys(m).reduce(function (s, k) { return s + (m[k] || 0); }, 0);
  }
  function totalSpent() {
    var data = talentClassData();
    if (!data) return 0;
    return data.trees.reduce(function (s, t) { return s + treeSpent(t.name); }, 0);
  }

  function canAddPoint(tree, talent, trees, avail) {
    var map = trees || null;
    var spentTotal;
    if (map) {
      spentTotal = 0;
      Object.keys(map).forEach(function (tn) {
        Object.keys(map[tn] || {}).forEach(function (k) { spentTotal += map[tn][k] || 0; });
      });
    } else {
      spentTotal = totalSpent();
    }
    var cap = avail != null ? avail : pointsAvailable();
    if (spentTotal >= cap) return false;
    var rank = map ? ((map[tree.name] && map[tree.name][String(talent.id)]) || 0) : talentRank(tree.name, talent.id);
    if (rank >= talent.maxRank) return false;
    var spent = map ? treeSpent(tree.name, map) : treeSpent(tree.name);
    if (spent < (talent.reqPoints || 0)) return false;
    if (talent.prereq) {
      var pr = map
        ? ((map[tree.name] && map[tree.name][String(talent.prereq.id)]) || 0)
        : talentRank(tree.name, talent.prereq.id);
      if (pr < talent.prereq.rank) return false;
    }
    return true;
  }

  function canRemovePoint(tree, talent) {
    var rank = talentRank(tree.name, talent.id);
    if (rank <= 0) return false;
    var next = JSON.parse(JSON.stringify(talentStore().trees));
    if (!next[tree.name]) next[tree.name] = {};
    next[tree.name][String(talent.id)] = rank - 1;
    if (next[tree.name][String(talent.id)] <= 0) delete next[tree.name][String(talent.id)];
    var spentAfter = Object.keys(next[tree.name] || {}).reduce(function (s, k) { return s + (next[tree.name][k] || 0); }, 0);
    for (var i = 0; i < tree.talents.length; i++) {
      var t = tree.talents[i];
      var r = (next[tree.name] && next[tree.name][String(t.id)]) || 0;
      if (r <= 0) continue;
      if (spentAfter < (t.reqPoints || 0)) return false;
      if (t.prereq) {
        var pr = (next[tree.name] && next[tree.name][String(t.prereq.id)]) || 0;
        if (pr < t.prereq.rank) return false;
      }
    }
    return true;
  }

  function addPoint(tree, talent) {
    if (!canAddPoint(tree, talent)) return;
    var m = treeMap(tree.name);
    m[String(talent.id)] = talentRank(tree.name, talent.id) + 1;
    state.talents.class = ch().class;
    save();
  }
  function removePoint(tree, talent) {
    if (!canRemovePoint(tree, talent)) return;
    var m = treeMap(tree.name);
    var r = talentRank(tree.name, talent.id) - 1;
    if (r <= 0) delete m[String(talent.id)];
    else m[String(talent.id)] = r;
    save();
  }

  function resetTree(treeName) {
    leaveBuildPreview();
    var store = talentStore();
    if (store.trees) delete store.trees[treeName];
    save();
  }
  function resetAllTalents() {
    leaveBuildPreview();
    talentStore().trees = {};
    state.talents.class = ch().class;
    save();
  }

  function plannedRankOf(src, id) {
    if (!src) return 0;
    if (src[String(id)] != null) return Number(src[String(id)]) || 0;
    if (src[id] != null) return Number(src[id]) || 0;
    return 0;
  }

  function findTalentInTree(tree, id) {
    return tree.talents.find(function (t) { return String(t.id) === String(id); });
  }

  function classDataFor(name) {
    var pack = talentPack();
    return pack.find(function (c) { return c.name === name; }) || pack[0];
  }

  function normalizeProvidedOrder(build, data) {
    var out = [];
    if (!build.order || !build.order.length) return out;
    var have = {};
    function pushStep(tree, talent) {
      if (!tree || !talent) return false;
      have[tree.name] = have[tree.name] || {};
      var from = have[tree.name][String(talent.id)] || 0;
      if (from >= talent.maxRank) return false;
      have[tree.name][String(talent.id)] = from + 1;
      out.push({
        tree: tree.name,
        treeIdx: data.trees.indexOf(tree),
        id: talent.id,
        name: talent.name,
        from: from,
        to: from + 1,
        maxRank: talent.maxRank,
        level: 9 + out.length + 1
      });
      return true;
    }
    build.order.forEach(function (step) {
      var treeName = null, id = null;
      if (step == null) return;
      if (typeof step === "number" || (typeof step === "string" && step.indexOf(":") === -1 && step.indexOf("/") === -1)) {
        id = step;
      } else if (typeof step === "string") {
        var parts = step.split(/[:/]/);
        if (parts.length >= 2) { treeName = parts[0]; id = parts[1]; }
        else id = step;
      } else if (Array.isArray(step)) {
        treeName = step[0]; id = step[1] != null ? step[1] : step[0];
      } else {
        treeName = step.tree || step.treeName || step.spec || null;
        id = step.id != null ? step.id : (step.talentId != null ? step.talentId : step.talent);
      }
      var tree = null, talent = null;
      if (treeName) tree = data.trees.find(function (t) { return t.name === treeName; });
      if (tree && id != null) talent = findTalentInTree(tree, id);
      if (!talent && id != null) {
        for (var i = 0; i < data.trees.length; i++) {
          var t = findTalentInTree(data.trees[i], id);
          if (t) { tree = data.trees[i]; talent = t; break; }
        }
      }
      pushStep(tree, talent);
    });
    return out;
  }

  function generateBuildOrder(build, data) {
    var planned = {};
    var totalWant = 0;
    data.trees.forEach(function (tree) {
      var src = (build.trees && build.trees[tree.name]) || {};
      planned[tree.name] = {};
      tree.talents.forEach(function (t) {
        var want = Math.min(plannedRankOf(src, t.id), t.maxRank);
        if (want) {
          planned[tree.name][String(t.id)] = want;
          totalWant += want;
        }
      });
    });
    var treeOrder = data.trees.slice().sort(function (a, b) {
      var pa = 0, pb = 0;
      Object.keys(planned[a.name] || {}).forEach(function (k) { pa += planned[a.name][k]; });
      Object.keys(planned[b.name] || {}).forEach(function (k) { pb += planned[b.name][k]; });
      return pb - pa;
    });
    var have = {};
    var spentInTree = {};
    var order = [];
    function rank(tn, id) { return (have[tn] && have[tn][String(id)]) || 0; }
    function canAdd(tree, talent) {
      var r = rank(tree.name, talent.id);
      var want = (planned[tree.name] && planned[tree.name][String(talent.id)]) || 0;
      if (r >= want || r >= talent.maxRank) return false;
      if ((spentInTree[tree.name] || 0) < (talent.reqPoints || 0)) return false;
      if (talent.prereq && rank(tree.name, talent.prereq.id) < talent.prereq.rank) return false;
      return true;
    }
    var guard = 0;
    while (order.length < totalWant && guard++ < 800) {
      var picked = null;
      for (var ti = 0; ti < treeOrder.length && !picked; ti++) {
        var tree = treeOrder[ti];
        var cands = tree.talents.filter(function (t) { return canAdd(tree, t); })
          .sort(function (a, b) { return a.row - b.row || a.col - b.col; });
        if (cands.length) picked = { tree: tree, talent: cands[0] };
      }
      if (!picked) break;
      have[picked.tree.name] = have[picked.tree.name] || {};
      var from = rank(picked.tree.name, picked.talent.id);
      have[picked.tree.name][String(picked.talent.id)] = from + 1;
      spentInTree[picked.tree.name] = (spentInTree[picked.tree.name] || 0) + 1;
      order.push({
        tree: picked.tree.name,
        treeIdx: data.trees.indexOf(picked.tree),
        id: picked.talent.id,
        name: picked.talent.name,
        from: from,
        to: from + 1,
        maxRank: picked.talent.maxRank,
        level: 9 + order.length + 1
      });
    }
    return order;
  }

  function getBuildOrder(build) {
    if (!build) return [];
    var data = classDataFor(build.class || ch().class);
    if (!data) return [];
    var key = (build.id || "anon") + ":" + talentMode() + ":" + (build.class || "") + ":" + JSON.stringify(build.trees || {}) + ":" + JSON.stringify(build.order || null);
    if (buildOrderCache[key]) return buildOrderCache[key];
    var order = [];
    if (build.order && build.order.length) {
      order = normalizeProvidedOrder(build, data);
      var generated = generateBuildOrder(build, data);
      if (order.length < generated.length) {
        /* Fill any legal remaining planned points the provided order skipped. */
        var seen = {};
        var filled = [];
        function consume(step) {
          var k = step.tree + "::" + step.id + "::" + step.to;
          if (seen[k]) return;
          seen[k] = true;
          filled.push(step);
        }
        order.forEach(consume);
        generated.forEach(function (step) {
          var k = step.tree + "::" + step.id + "::" + step.to;
          if (!seen[k]) {
            consume({
              tree: step.tree, treeIdx: step.treeIdx, id: step.id, name: step.name,
              from: step.from, to: step.to, maxRank: step.maxRank, level: 9 + filled.length + 1
            });
          }
        });
        /* re-number levels */
        filled.forEach(function (s, i) { s.level = 10 + i; });
        order = filled;
      } else {
        order.forEach(function (s, i) { s.level = 10 + i; });
      }
    } else {
      order = generateBuildOrder(build, data);
    }
    return (buildOrderCache[key] = order);
  }

  function treesFromOrder(order, n) {
    var trees = {};
    order.slice(0, Math.max(0, n)).forEach(function (step) {
      if (!trees[step.tree]) trees[step.tree] = {};
      trees[step.tree][String(step.id)] = (trees[step.tree][String(step.id)] || 0) + 1;
    });
    return trees;
  }

  function applyOrderToStore(order, n) {
    var store = talentStore();
    store.trees = treesFromOrder(order, n);
    state.talents.class = ch().class;
  }

  function findBuildById(id) {
    if (!id) return null;
    var pub = talentBuilds().find(function (b) { return b.id === id; });
    if (pub) return pub;
    return (state.savedTalentBuilds || []).find(function (b) { return b.id === id; }) || null;
  }

  function leaveBuildPreview(msg) {
    if (!talentPreview) return false;
    talentPreview = null;
    talentViewLevel = null;
    if (state.talents) state.talents.activeBuildId = null;
    if (msg) toast(msg);
    return true;
  }

  function activateBuildPreview(build) {
    if (!build) return;
    var order = getBuildOrder(build);
    talentPreview = { build: build, order: order };
    talentViewLevel = null;
    if (state.talents) state.talents.activeBuildId = build.id || null;
  }

  function restoreBuildPreview() {
    if (talentPreview) return talentPreview;
    var id = state.talents && state.talents.activeBuildId;
    if (!id) return null;
    var build = findBuildById(id);
    if (!build || (build.class && build.class !== ch().class)) return null;
    if (build.mode && build.mode !== talentMode()) return null;
    talentPreview = { build: build, order: getBuildOrder(build) };
    return talentPreview;
  }

  function setTalentViewLevel(lvl) {
    if (!talentPreview && !restoreBuildPreview()) return;
    if (lvl == null || lvl === "") talentViewLevel = null;
    else {
      var n = parseInt(lvl, 10);
      if (isNaN(n)) return;
      talentViewLevel = Math.max(10, Math.min(60, n));
    }
    renderTalents();
  }

  function applyBuild(build, opts) {
    opts = opts || {};
    if (build.class && build.class !== ch().class) {
      state.character.class = build.class;
      var specs = DATA.specs[build.class] || [];
      if (specs.indexOf(state.character.spec) === -1) state.character.spec = specs[0] || "";
    }
    if (build.mode) state.talents.mode = build.mode === "classic" ? "classic" : "forever";
    if (build.specSlot) state.talents.activeSpec = build.specSlot;
    state.talents.class = build.class || ch().class;
    activateBuildPreview(build);
    var order = talentPreview.order;
    applyOrderToStore(order, pointsAvailable());
    save();
  }

  function setTalentMode(mode) {
    normalizeTalents();
    var next = mode === "classic" ? "classic" : "forever";
    if (state.talents.mode !== next) leaveBuildPreview();
    state.talents.mode = next;
    if (state.talents.mode === "classic") state.talents.activeSpec = "primary";
    save();
    renderTalents();
  }

  function setActiveSpec(which) {
    normalizeTalents();
    if (which === "secondary" && !dualSpecUnlocked()) {
      toast("Dual Specialization unlocks at level 40.");
      return;
    }
    var next = which === "secondary" ? "secondary" : "primary";
    if (state.talents.activeSpec !== next) leaveBuildPreview();
    state.talents.activeSpec = next;
    save();
    renderTalents();
  }

  function talentStepAtLevel(order, lvl) {
    if (!order || !order.length) return null;
    var idx = (lvl || 0) - 10;
    if (idx < 0 || idx >= order.length) return null;
    return order[idx];
  }

  function rankLookup(trees, treeName, id) {
    return (trees[treeName] && trees[treeName][String(id)]) || 0;
  }

  function talentDescription(tree, talent, rank) {
    if (!talent || !talent.ranks || !talent.ranks.length) return "";
    var i = Math.max(0, Math.min(talent.ranks.length - 1, (rank || 1) - 1));
    return talent.ranks[i] || "";
  }

  function renderTalentPreviewDock(data, preview, viewLvl, charLvl, viewTrees) {
    var dock = $("#talentPreviewDock");
    if (!dock) return;
    if (!preview) { dock.hidden = true; dock.innerHTML = ""; return; }
    dock.hidden = false;
    var order = preview.order || [];
    var build = preview.build || {};
    var step = talentStepAtLevel(order, viewLvl);
    var endLvl = order.length ? 9 + order.length : 9;
    var delta = viewLvl - charLvl;
    var status;
    if (charLvl < 10 && viewLvl === 10) {
      status = "<strong>Viewing Lv 10</strong> <span class=\"tp-delta\">Your character is level " + charLvl + " — the first talent point is at 10.</span>";
    } else if (delta > 0) {
      status = "<strong>Viewing Lv " + viewLvl + "</strong> <span class=\"tp-delta is-ahead\">" +
        delta + " level" + (delta === 1 ? "" : "s") + " ahead of your Lv " + charLvl + "</span>";
    } else if (delta < 0) {
      status = "<strong>Viewing Lv " + viewLvl + "</strong> <span class=\"tp-delta is-behind\">" +
        Math.abs(delta) + " level" + (delta === -1 ? "" : "s") + " behind your Lv " + charLvl + "</span>";
    } else {
      status = "<strong>Viewing Lv " + viewLvl + "</strong> <span class=\"tp-delta\">This is your current level.</span>";
    }
    var backBtn = (talentViewLevel != null && viewLvl !== myTalentBaseline())
      ? '<button type="button" class="btn btn-sm btn-primary" data-talent-nav="mine">Back to Lv ' + myTalentBaseline() + "</button>"
      : "";

    var callout;
    if (viewLvl < 10) {
      callout = '<div class="tp-callout is-empty" id="talentCallout"><div class="tp-kicker">No talent point</div>' +
        "<p class=\"tp-headline\">Talents start at level 10.</p></div>";
    } else if (!step) {
      callout = '<div class="tp-callout is-empty" id="talentCallout"><div class="tp-kicker">Level ' + viewLvl + "</div>" +
        "<p class=\"tp-headline\">This build has no further points" +
        (endLvl >= 10 ? " after level " + endLvl : "") + ".</p></div>";
    } else {
      var treeObj = data.trees[step.treeIdx] || data.trees.find(function (t) { return t.name === step.tree; });
      var tal = treeObj ? findTalentInTree(treeObj, step.id) : null;
      var desc = talentDescription(treeObj, tal, step.to);
      callout = '<div class="tp-callout" id="talentCallout">' +
        '<div class="tp-kicker">Level ' + viewLvl + " · +1 point</div>" +
        '<p class="tp-headline"><strong>' + escapeHtml(step.name) + "</strong> (" +
        step.from + "/" + step.maxRank + " → " + step.to + "/" + step.maxRank + ") — " +
        '<span class="tp-tree">' + escapeHtml(step.tree) + "</span></p>" +
        (desc ? '<p class="tp-desc">' + escapeHtml(desc) + "</p>" : "") +
        "</div>";
    }

    var chips = "";
    for (var lv = viewLvl + 1; lv <= Math.min(60, viewLvl + 5); lv++) {
      var st = talentStepAtLevel(order, lv);
      if (st) {
        chips += '<button type="button" class="upcoming-chip" data-talent-nav="set" data-level="' + lv +
          '" title="Jump to level ' + lv + '">' +
          '<span class="uc-lv">Lv ' + lv + "</span>" +
          '<span class="uc-name">' + escapeHtml(st.name) + " " + st.to + "/" + st.maxRank + "</span></button>";
      } else {
        chips += '<button type="button" class="upcoming-chip is-empty" data-talent-nav="set" data-level="' + lv +
          '"><span class="uc-lv">Lv ' + lv + "</span><span class=\"uc-name\">No further points</span></button>";
      }
    }

    var mine = myTalentBaseline();
    var jumps = [
      { label: "My level (Lv " + mine + ")", nav: "mine", level: mine },
      { label: "+1", nav: "set", level: Math.min(60, mine + 1) },
      { label: "+2", nav: "set", level: Math.min(60, mine + 2) },
      { label: "+3", nav: "set", level: Math.min(60, mine + 3) },
      { label: "+5", nav: "set", level: Math.min(60, mine + 5) },
      { label: "Lv 60", nav: "set", level: 60 }
    ];
    var jumpHtml = jumps.map(function (j) {
      var active = (j.nav === "mine" ? (talentViewLevel == null || viewLvl === mine) : viewLvl === j.level);
      return '<button type="button" class="btn btn-sm' + (active ? " is-active btn-primary" : "") +
        '" data-talent-nav="' + j.nav + '"' +
        (j.nav === "set" ? ' data-level="' + j.level + '"' : "") + ">" + escapeHtml(j.label) + "</button>";
    }).join("");

    var showUpcoming = viewLvl > charLvl && charLvl >= 10;
    var legend = '<div class="tp-legend" id="talentLegend">' +
      '<span class="tl tl-cur"><i></i> Current</span>' +
      (showUpcoming ? '<span class="tl tl-up"><i></i> Upcoming (+N)</span>' : "") +
      (step ? '<span class="tl tl-new"><i></i> New at Lv ' + viewLvl + "</span>" : "") +
      "</div>";

    dock.innerHTML =
      '<div class="tp-top">' +
        '<div class="tp-status" id="talentViewStatus">' + status + backBtn + "</div>" +
        '<div class="tp-build-name">Previewing <strong>' + escapeHtml(build.name || "this build") + "</strong>" +
          (build.points ? " (" + escapeHtml(build.points) + ")" : "") +
          (order.length ? " · " + order.length + " points through Lv " + endLvl : "") +
        "</div>" +
      "</div>" +
      '<div class="tp-controls">' +
        '<button type="button" class="btn" data-talent-nav="step" data-delta="-1" ' +
          (viewLvl <= 10 ? "disabled " : "") + 'aria-label="Previous level">−1</button>' +
        '<label class="tp-slider-wrap">Level' +
          '<input id="talentLevelSlider" type="range" min="10" max="60" value="' + viewLvl + '" aria-label="Preview talent level">' +
          '<span class="tp-slider-val" id="talentSliderVal">' + viewLvl + "</span>" +
        "</label>" +
        '<button type="button" class="btn" data-talent-nav="step" data-delta="1" ' +
          (viewLvl >= 60 ? "disabled " : "") + 'aria-label="Next level">+1</button>' +
        '<div class="tp-jumps">' + jumpHtml + "</div>" +
      "</div>" +
      callout +
      '<div class="tp-upcoming-wrap"><div class="tp-upcoming-label">Next 5 levels — where the build goes next</div>' +
        '<div class="tp-upcoming" id="talentUpcoming">' + chips + "</div></div>" +
      legend;
  }

  function highlightInfo(order, viewLvl, charLvl) {
    var info = { newKey: null, newTreeIdx: -1, newName: "", upcoming: {} };
    var step = talentStepAtLevel(order, viewLvl);
    if (step) {
      info.newKey = step.tree + "::" + step.id;
      info.newTreeIdx = step.treeIdx;
      info.newName = step.name;
    }
    if (viewLvl > charLvl) {
      var fromIdx = Math.max(0, charLvl - 9);
      var toIdx = Math.max(0, viewLvl - 10);
      for (var i = fromIdx; i < toIdx; i++) {
        var s = order[i];
        if (!s) continue;
        var k = s.tree + "::" + s.id;
        if (k === info.newKey) continue;
        info.upcoming[k] = (info.upcoming[k] || 0) + 1;
      }
    }
    return info;
  }

  function renderTalents() {
    normalizeTalents();
    if (state.talents.class && state.talents.class !== ch().class) {
      var modeKeep = talentMode();
      var specKeep = state.talents.activeSpec || "primary";
      state.talents = emptyTalentState(ch().class);
      state.talents.mode = modeKeep;
      state.talents.activeSpec = specKeep;
      talentPreview = null;
      talentViewLevel = null;
    }
    var preview = restoreBuildPreview();
    var data = talentClassData();
    var charLvl = charTalentLevel();
    var viewLvl = preview ? viewTalentLevel() : charLvl;
    var order = preview ? preview.order : [];
    var viewTrees = preview ? treesFromOrder(order, pointsAtLevel(viewLvl)) : (talentStore().trees || {});
    var hl = preview ? highlightInfo(order, viewLvl, charLvl) : { newKey: null, newTreeIdx: -1, newName: "", upcoming: {} };
    var avail = preview ? pointsAtLevel(viewLvl) : pointsAvailable();
    var spent = 0;
    data.trees.forEach(function (t) { spent += treeSpent(t.name, viewTrees); });
    var counts = data.trees.map(function (t) { return treeSpent(t.name, viewTrees); });
    var mode = talentMode();
    var meta = TALENT_META || {};
    var unlocked = dualSpecUnlocked();
    var spec = state.talents.activeSpec || "primary";

    var modeBar = $("#talentModeBar");
    if (modeBar) {
      modeBar.innerHTML =
        '<div class="mode-toggle" role="group" aria-label="Talent data source">' +
        '<button type="button" class="btn btn-sm' + (mode === "forever" ? " btn-primary" : "") + '" data-talent-mode="forever">WoW: Forever</button>' +
        '<button type="button" class="btn btn-sm' + (mode === "classic" ? " btn-primary" : "") + '" data-talent-mode="classic">Classic Era (reference)</button>' +
        "</div>" +
        (mode === "forever" ? (
          '<div class="mode-toggle" role="group" aria-label="Dual specialization">' +
          '<button type="button" class="btn btn-sm' + (spec !== "secondary" ? " btn-primary" : "") + '" data-talent-spec="primary">Primary</button>' +
          '<button type="button" class="btn btn-sm' + (spec === "secondary" ? " btn-primary" : "") + '"' +
          (unlocked ? "" : " disabled") + ' data-talent-spec="secondary">Secondary' +
          (unlocked ? "" : " (lvl 40)") + "</button></div>"
        ) : "") +
        (meta.build ? '<span class="muted">Client ' + escapeHtml(meta.build) + " · " + (meta.talentCount || 467) + " talents</span>" : "");
    }

    var remaining = Math.max(0, avail - spent);
    if (preview) {
      $("#talentPoints").innerHTML = escapeHtml((preview.build && preview.build.name) || ch().class || "") +
        " · " + counts.join(" / ") +
        " · <strong>" + spent + "</strong> / " + order.length + " points at level " + viewLvl +
        (viewLvl !== charLvl ? " <span class=\"muted\">(character is " + charLvl + ")</span>" : "") +
        (mode === "forever" && unlocked ? " · " + (spec === "secondary" ? "Secondary" : "Primary") + " spec" : "");
    } else {
      $("#talentPoints").innerHTML = (ch().class || "") + " · " + counts.join(" / ") +
        " · <strong>" + remaining + "</strong> of " + avail + " remaining (level " + charLvl + ")" +
        (mode === "forever" && unlocked ? " · " + (spec === "secondary" ? "Secondary" : "Primary") + " spec" : "");
    }

    var srcNote = $("#buildSource");
    if (mode === "classic") {
      srcNote.innerHTML = "<strong>Classic Era trees are for reference only.</strong> WoW: Forever uses reworked talent trees. These older 1.12 builds are not valid in Forever.";
    } else {
      srcNote.innerHTML = escapeHtml(window.WOW_TALENT_BUILD_SOURCE || "") +
        (meta.credit ? " " + escapeHtml(meta.credit) : "");
    }

    renderTalentPreviewDock(data, preview, viewLvl, charLvl, viewTrees);

    $("#talentTrees").innerHTML = data.trees.map(function (tree, idx) {
      var cells = "";
      var treeIsNew = preview && hl.newTreeIdx === idx;
      for (var row = 1; row <= 7; row++) {
        for (var col = 1; col <= 4; col++) {
          var t = tree.talents.find(function (x) { return x.row === row && x.col === col; });
          if (!t) { cells += "<div></div>"; continue; }
          var rank = rankLookup(viewTrees, tree.name, t.id);
          var locked;
          if (preview) locked = rank === 0;
          else locked = rank === 0 && !canAddPoint(tree, t);
          var key = tree.name + "::" + t.id;
          var isNew = preview && hl.newKey === key;
          var upN = preview ? (hl.upcoming[key] || 0) : 0;
          var cls = "talent";
          if (rank > 0) cls += " has-points";
          if (rank >= t.maxRank) cls += " maxed";
          if (locked && !isNew && !upN) cls += " locked";
          if (isNew) cls += " is-new";
          else if (upN) cls += " is-upcoming";
          var desc = (t.ranks && t.ranks[Math.max(0, rank ? rank - 1 : 0)]) || "";
          var next = (t.ranks && t.ranks[rank]) ? "<br><em>Next: " + escapeHtml(t.ranks[rank]) + "</em>" : "";
          var req = t.prereq ? "<br>Requires " + t.prereq.rank + " in " + escapeHtml((tree.talents.find(function (x) { return x.id === t.prereq.id; }) || {}).name || "prereq") : "";
          var badge = "";
          if (isNew) badge = '<span class="t-badge t-badge-new">NEW</span>';
          else if (upN) badge = '<span class="t-badge t-badge-up">+' + upN + "</span>";
          cells += '<button type="button" class="' + cls + '" data-tree="' + idx + '" data-talent="' + t.id +
            '"' + (isNew ? ' data-hl="new"' : (upN ? ' data-hl="upcoming" data-up="' + upN + '"' : "")) +
            ' aria-label="' + escapeHtml(t.name) + '">' + badge +
            '<span class="t-name">' + escapeHtml(t.name) +
            '</span><span class="t-rank">' + rank + "/" + t.maxRank + "</span>" +
            '<div class="talent-tip"><strong>' + escapeHtml(t.name) + "</strong> · Rank " + rank + "/" + t.maxRank +
            (isNew ? " · New at Lv " + viewLvl : (upN ? " · +" + upN + " upcoming" : "")) +
            "<br>" + escapeHtml(desc) + next + req + "</div></button>";
        }
      }
      var tag = treeIsNew && hl.newName
        ? '<span class="tree-new-tag">New: ' + escapeHtml(hl.newName) + "</span>"
        : "";
      return '<div class="talent-tree' + (treeIsNew ? " has-new" : "") + '" data-tree-idx="' + idx + '"><h3>' + escapeHtml(tree.name) +
        " <span>" + treeSpent(tree.name, viewTrees) + "</span>" + tag +
        " <button type=\"button\" class=\"btn btn-sm\" data-reset-tree=\"" +
        escapeHtml(tree.name) + "\">Reset</button></h3><div class=\"talent-grid\">" + cells + "</div></div>";
    }).join("");

    var classBuilds = talentBuilds().filter(function (b) { return b.class === ch().class; });
    var listTitle = $("#buildListTitle");
    if (listTitle) listTitle.textContent = mode === "classic" ? "Classic Era reference builds" : "Published Forever builds";
    if (!classBuilds.length) {
      $("#buildList").innerHTML = mode === "classic"
        ? "<p class=\"muted\">No Classic Era reference builds loaded.</p>"
        : "<p class=\"muted\">No popular Forever builds published yet for this class.</p>";
    } else {
      var activeId = preview && preview.build && preview.build.id;
      $("#buildList").innerHTML = classBuilds.map(function (b) {
        var cite = b.sourceLabel || (mode === "classic" ? "Classic Era reference — not for Forever" : "");
        var via = b.via ? "<div class=\"muted\" style=\"font-size:11px;margin-top:4px\">" + escapeHtml(b.via) + "</div>" : "";
        var link = b.sourceUrl ? ' · <span class="muted">' + escapeHtml(b.sourceName || "source") + "</span>" : "";
        return '<button type="button" class="btn build-card' + (activeId && activeId === b.id ? " is-active" : "") +
          '" data-load-build="' + escapeHtml(b.id) + '">' +
          '<div class="role">' + escapeHtml(b.role || "") + " · " + escapeHtml(b.points) + "</div>" +
          "<strong>" + escapeHtml(b.name) + "</strong><p>" + escapeHtml(b.summary || "") + "</p>" +
          (cite ? '<div class="build-cite">' + escapeHtml(cite) + "</div>" : "") + via + "</button>";
      }).join("");
    }

    var sb = $("#savedBuilds");
    var cur = sb.value;
    var mineSaved = (state.savedTalentBuilds || []).filter(function (b) {
      return b.class === ch().class && (b.mode || "forever") === mode;
    });
    sb.innerHTML = '<option value="">Saved builds…</option>' + mineSaved.map(function (b) {
      var tag = b.specSlot === "secondary" ? " (2nd)" : "";
      return '<option value="' + escapeHtml(b.id) + '">' + escapeHtml(b.name) + tag + "</option>";
    }).join("");
    if (cur) sb.value = cur;
  }


  /* ---------- export / import ---------- */
  function exportData() {
    var payload = {
      app: "Forever Tracker",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: state
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    var name = (ch().name || "character").replace(/\s+/g, "_");
    a.href = URL.createObjectURL(blob);
    a.download = "forever-tracker-" + name + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    toast("Exported backup JSON");
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        var data = parsed.data || parsed;
        applyStateObject(data, { persist: false, render: true });
        save();
        toast("Imported backup");
      } catch (e) {
        toast("Import failed: " + (e.message || e));
      }
    };
    reader.readAsText(file);
  }

  /* ---------- events ---------- */
  /* ---------- leveling route (hand-picked RestedXP + OpenXP) ---------- */
  var LEVELING_SCHEMA = 2;
  var LEVELING_RACE_TOKEN = {
    "Undead": "Scourge",
    "Night Elf": "NightElf",
    "High Order Skyborne": "Skyborne",
    "Windshaper Skyborne": "Skyborne"
  };
  var LEVELING_IGNORE = {
    NONE:1, MALE:1, FEMALE:1, SOD:1, SOM:1, ERA:1, FOREVER:1, CLASSIC:1,
    TBC:1, WOTLK:1, CATA:1, DF:1, RETAIL:1, MOP:1, ENUS:1, ENG:1
  };

  function defaultLeveling() {
    return {
      schema: LEVELING_SCHEMA,
      follow: true,
      race: "Undead",
      source: "combined",
      variant: "speedrun",
      hideDone: false,
      minLevel: 1,
      maxLevel: 60,
      byChar: {},
      migrated: false
    };
  }

  function levelingPack() { return window.WOW_LEVELING || {}; }

  function normalizeLeveling() {
    if (!state.leveling) state.leveling = defaultLeveling();
    var L = state.leveling;
    if (L.schema !== LEVELING_SCHEMA) {
      L.byChar = {};
      L.schema = LEVELING_SCHEMA;
      L.migrated = true;
    }
    if (L.follow == null) L.follow = true;
    if (!L.race) L.race = (ch().race || "Undead");
    if (!L.source) L.source = (levelingPack().meta && levelingPack().meta.defaultSource) || "combined";
    if (!L.variant) L.variant = "speedrun";
    if (L.hideDone == null) L.hideDone = false;
    if (L.minLevel == null) L.minLevel = 1;
    if (L.maxLevel == null) L.maxLevel = 60;
    if (L.includeNewZones == null) L.includeNewZones = true;
    if (!L.byChar) L.byChar = {};
  }

  function levelingCharKey() {
    var c = ch();
    var L = state.leveling || {};
    var race = L.race || c.race || "Undead";
    var src = L.source || "combined";
    var vari = L.variant || "speedrun";
    return (c.name || "unnamed") + "|" + race + "|" + src + "|" + vari;
  }

  function levelingProgress() {
    normalizeLeveling();
    var key = levelingCharKey();
    if (!state.leveling.byChar[key]) state.leveling.byChar[key] = { done: {}, skipped: {}, notes: {} };
    return state.leveling.byChar[key];
  }

  function factionOfRace(race) {
    var pack = levelingPack();
    var r = (pack.races || DATA.races || []).find(function (x) { return x.name === race; });
    return (r && r.faction) || "Horde";
  }

  function levelingRaceToken(race) {
    return LEVELING_RACE_TOKEN[race] || race;
  }

  function levelingApplies(text, race, className, faction) {
    if (!text) return true;
    var raceTok = levelingRaceToken(race);
    function parse(inner) {
      inner = inner.replace(/(!?)\(\s*(.*?)\s*\)/g, function (_, op, m) {
        var ok = parse(m);
        return (ok !== (op === "!")) ? className : "NULL";
      });
      var alts = inner.split("/");
      for (var a = 0; a < alts.length; a++) {
        var v = true;
        var tokens = alts[a].match(/!?[\w\d]+/g) || [];
        for (var i = 0; i < tokens.length; i++) {
          var entry = tokens[i];
          var neg = false;
          if (entry.charAt(0) === "!") { entry = entry.slice(1); neg = true; }
          if (entry === "Undead") entry = "Scourge";
          var upper = entry.toUpperCase();
          if (upper === "DK") upper = "DEATHKNIGHT";
          var ident;
          if (LEVELING_IGNORE[upper]) ident = true;
          else ident = (upper === (className || "").toUpperCase() || entry === raceTok || entry === faction || upper === "FOREVER");
          v = neg ? !ident : ident;
          if (!v) break;
        }
        if (v) return true;
      }
      return false;
    }
    return parse(text);
  }

  function coordLabel(src) {
    var pack = levelingPack();
    var map = (pack.coordLabels) || {};
    if (src && map[src]) {
      var cls = (src === "missing" || src === "world-unconverted") ? "missing" : src;
      return { cls: cls, text: map[src] };
    }
    if (src === "forever") return { cls: "forever", text: "Forever-verified" };
    if (src === "classic") return { cls: "classic", text: "Classic coords" };
    if (src === "guide" || src === "guide-world") return { cls: "forever", text: map[src] || "From the guide" };
    return { cls: "missing", text: map.missing || "Coords missing" };
  }

  function pickLevelingRoute() {
    var pack = levelingPack();
    var L = state.leveling;
    var race = L.race;
    var cls = ch().class || "Warrior";
    var src = L.source || "combined";
    var vari = L.variant || "speedrun";
    if (vari === "mageaoe" && cls !== "Mage") vari = "speedrun";
    var routes = pack.routes || {};
    var keys = [
      src + "|" + vari + "|" + race + "|" + cls,
      src + "|" + vari + "|" + race
    ];
    for (var i = 0; i < keys.length; i++) {
      if (routes[keys[i]]) return routes[keys[i]];
    }
    return null;
  }

  function includeAddonChapters() {
    var L = state.leveling || {};
    return L.includeNewZones !== false && (L.source || "combined") === "combined";
  }

  function isAddonChapterKey(key, chp) {
    if (key && key.indexOf("addon||") === 0) return true;
    return !!(chp && chp.source === "addon");
  }

  function overlapChapterKeys(rec) {
    var names = {};
    ((rec && rec.addonSplices) || []).forEach(function (s) {
      (s.overlaps || []).forEach(function (n) { names[n] = true; });
    });
    var keys = [];
    ((rec && rec.chapters) || []).forEach(function (k) {
      if (k.indexOf("addon||") === 0) return;
      var name = k.indexOf("||") >= 0 ? k.split("||").slice(1).join("||") : k;
      if (names[name]) keys.push(k);
    });
    return keys;
  }

  function overlapStepIds(rec) {
    var pack = levelingPack();
    var chapters = pack.chapters || {};
    var ids = [];
    overlapChapterKeys(rec).forEach(function (k) {
      var chp = chapters[k];
      if (!chp) return;
      (chp.steps || []).forEach(function (row, i) {
        ids.push(row[11] || (k + ":" + i));
      });
    });
    return ids;
  }

  function overlapsAreSkipped(rec, prog) {
    var ids = overlapStepIds(rec);
    if (!ids.length || !prog) return false;
    for (var i = 0; i < ids.length; i++) {
      if (!prog.skipped[ids[i]]) return false;
    }
    return true;
  }

  function expandLevelingSteps() {
    var pack = levelingPack();
    var rec = pickLevelingRoute();
    if (!rec) return [];
    var chapters = pack.chapters || {};
    var names = pack.questNames || {};
    var race = state.leveling.race;
    var faction = factionOfRace(race);
    var cls = ch().class || "Warrior";
    var showAddon = includeAddonChapters();
    var out = [];
    var list = rec.chapters || [];
    for (var ci = 0; ci < list.length; ci++) {
      var key = list[ci];
      if (key.indexOf("__handoff__") === 0 || (rec.handoffAt != null && ci === rec.handoffAt && (ci === 0 || (list[ci - 1] || "").indexOf("__handoff__") === -1))) {
        if (rec.handoffAt != null && ci === rec.handoffAt && key.indexOf("__handoff__") !== 0) {
          out.push({
            index: out.length, k: "note", z: "OpenXP 21-60", lv: 21, title: "RestedXP free route ends — continuing with OpenXP",
            detail: "The public RestedXP Forever route stops around level 21 (Alliance) or 22 (Horde). The rest of this path is OpenXP's 21–60 community route, kept in the authors' order.",
            sid: "handoff:" + rec.race, tags: "handoff", race: race, chapter: "OpenXP 21-60"
          });
        }
        if (key.indexOf("__handoff__") === 0) continue;
      }
      var chp = chapters[key];
      if (!chp) continue;
      if (!showAddon && isAddonChapterKey(key, chp)) continue;
      var steps = chp.steps || [];
      for (var i = 0; i < steps.length; i++) {
        var row = steps[i];
        var when = row[9] || "";
        if (when && !levelingApplies(when, race, cls, faction)) continue;
        var kind = row[0], zone = row[1], lv = row[2], title = row[3], detail = row[4];
        var x = row[5], y = row[6], ss = row[7], q = row[8] || [], tags = row[10] || "", sid = row[11];
        if (title && title.indexOf("Do this until:") === 0 && x != null) {
          title = "Go to " + Number(x).toFixed(1) + ", " + Number(y).toFixed(1) + (zone ? " (" + zone + ")" : "");
        }
        var qn = [];
        for (var qi = 0; qi < q.length; qi++) {
          var nm = names[String(q[qi])];
          qn.push(nm ? (nm + " (" + q[qi] + ")") : ("Quest " + q[qi]));
        }
        if (qn.length && title && title.indexOf("Talk to") === 0) {
          detail = (qn.join("; ") + (detail ? ". " + detail : ""));
        }
        var bits = [];
        if (tags && tags.indexOf("optional") !== -1) bits.push("Optional.");
        if (tags && tags.indexOf("hardcore") !== -1) bits.push("Hardcore.");
        if (tags && tags.indexOf("softcore") !== -1) bits.push("Softcore.");
        if (tags && tags.indexOf("sticky") !== -1) bits.push("Keep doing this alongside later steps.");
        if (detail) bits.push(detail);
        if (x != null) bits.push("At " + Number(x).toFixed(1) + ", " + Number(y).toFixed(1) + (zone ? " in " + zone : "") + ".");
        out.push({
          index: out.length, k: kind, z: zone || chp.name, lv: lv || 1,
          title: title || kind, detail: bits.join(" "),
          sx: x, sy: y, ss: ss, q: q, qn: qn, tags: tags, sid: sid || (key + ":" + i),
          chapter: chp.name, race: race
        });
      }
    }
    return out;
  }

  function stepVisible(step, cls, prog, L) {
    var lv = step.lv || 1;
    if (lv < (L.minLevel || 1) || lv > (L.maxLevel || 60)) return false;
    if (L.hideDone && (prog.done[step.sid] || prog.skipped[step.sid])) return false;
    return true;
  }

  function renderLeveling() {
    normalizeLeveling();
    var root = $("#levelingRoot");
    if (!root) return;
    var pack = levelingPack();
    var L = state.leveling;
    if (L.follow) L.race = ch().race || L.race || "Undead";
    var race = L.race;
    var rec = pickLevelingRoute();
    var prog = levelingProgress();
    var cls = ch().class;
    var steps = expandLevelingSteps();
    var visible = steps.filter(function (s) { return stepVisible(s, cls, prog, L); });
    var allForCount = steps.filter(function (s) {
      var lv = s.lv || 1;
      return lv >= (L.minLevel || 1) && lv <= (L.maxLevel || 60);
    });
    var doneN = allForCount.filter(function (s) { return prog.done[s.sid] || prog.skipped[s.sid]; }).length;
    var pct = allForCount.length ? Math.round(doneN / allForCount.length * 100) : 0;
    var current = null;
    visible.forEach(function (s) {
      if (!current && !prog.done[s.sid] && !prog.skipped[s.sid]) current = s;
    });

    var raceOpts = (pack.races || DATA.races || []).map(function (r) {
      var name = r.name || r;
      var fac = r.faction || factionOfRace(name);
      return "<option value=\"" + escapeHtml(name) + "\"" + (name === race ? " selected" : "") + ">" + escapeHtml(name) + " (" + escapeHtml(fac) + ")</option>";
    }).join("");

    var srcOpts = (pack.sources || []).map(function (s) {
      return "<option value=\"" + s.id + "\"" + (s.id === L.source ? " selected" : "") + ">" + escapeHtml(s.label) + "</option>";
    }).join("");
    var varOpts = (pack.variants || []).filter(function (v) {
      return !v.class || v.class === cls;
    }).map(function (v) {
      return "<option value=\"" + v.id + "\"" + (v.id === L.variant ? " selected" : "") + ">" + escapeHtml(v.label) + "</option>";
    }).join("");

    var banner = "<div class=\"route-banner\">";
    banner += "<p><strong>Routes.</strong> " + escapeHtml((pack.meta && pack.meta.attribution) || "") + " Licensed under <strong>CC BY-NC-SA 4.0</strong> for personal non-commercial local use. Combined (the default) uses the current public RestedXP free Forever speedrun or dungeon guide through about level 21 (Alliance) or 22 (Horde), then hands off to OpenXP's 21–60 route, keeping each author's order. OpenXP's own 1–22 files are older copies of RestedXP (forked 2026-11-07); the combined path prefers the newer RestedXP early chapters.</p>";
    if ((L.source || "combined") === "combined") {
      banner += "<p><strong>New Forever zones.</strong> Combined also includes optional Forever Tracker add-on chapters (auto-optimized, not RestedXP/OpenXP) for Riverglades (35–45), Shen'dralas (38–45), and Mount Hyjal (55–60). They are built from already-fetched local quest data; nothing was invented. Use the <em>Include new zones</em> toggle (on by default). OpenXP chapters that share those level bands stay in the route — skip them with the overlapping-chapters button if you want to run only the new zones in that range.</p>";
    }
    if (L.migrated) banner += "<p class=\"less-tested\">Progress from the previous all-quests auto-route was reset because the steps changed. Checkboxes now follow these hand-picked guides.</p>";
    if (pack.meta && pack.meta.gaps && pack.meta.gaps.length) {
      banner += "<p class=\"muted\"><strong>Flagged gaps (routes were not reordered):</strong> " + escapeHtml(pack.meta.gaps.filter(function(g){return !/paid RestedXP|LevelForge/.test(g);}).join(" ")) + "</p>";
    }
    banner += "</div>";

    var curHtml = "";
    if (current) {
      curHtml = "<div class=\"card current-step\" id=\"levelingCurrent\"><div class=\"kicker\">Current step</div><h3>" +
        escapeHtml(current.title) + "</h3><p class=\"muted\">" + escapeHtml((current.z || current.chapter || "") + " · level " + (current.lv || "?")) +
        "</p><p>" + escapeHtml(current.detail || "") + "</p>" + stepTags(current) + "</div>";
    } else if (allForCount.length) {
      curHtml = "<div class=\"card current-step\"><div class=\"kicker\">Current step</div><h3>Route complete in this level range</h3><p class=\"muted\">Every visible step is done or skipped.</p></div>";
    } else if (!rec) {
      curHtml = "<div class=\"card current-step\"><div class=\"kicker\">Current step</div><h3>No route for this combination</h3><p class=\"muted\">Try Speedrun, or another race / source.</p></div>";
    }

    var toolbar = "<div class=\"route-toolbar\">" +
      "<label class=\"field\">Race / faction<select id=\"levelingRace\">" + raceOpts + "</select></label>" +
      "<label class=\"field check\"><input type=\"checkbox\" id=\"levelingFollow\"" + (L.follow ? " checked" : "") + "> Follow character race</label>" +
      "<label class=\"field\">Route source<select id=\"levelingSource\">" + srcOpts + "</select></label>" +
      "<label class=\"field\">Variant<select id=\"levelingVariant\">" + varOpts + "</select></label>" +
      "<label class=\"field\">From level<input type=\"number\" id=\"levelingMin\" min=\"1\" max=\"60\" value=\"" + (L.minLevel || 1) + "\"></label>" +
      "<label class=\"field\">To level<input type=\"number\" id=\"levelingMax\" min=\"1\" max=\"60\" value=\"" + (L.maxLevel || 60) + "\"></label>" +
      "<label class=\"field check\"><input type=\"checkbox\" id=\"levelingHideDone\"" + (L.hideDone ? " checked" : "") + "> Hide completed / skipped</label>" +
      ((L.source || "combined") === "combined" ? ("<label class=\"field check\"><input type=\"checkbox\" id=\"levelingIncludeNewZones\"" + (L.includeNewZones !== false ? " checked" : "") + "> Include new zones</label>") : "") +
      ((L.source || "combined") === "combined" && rec && (rec.addonSplices || []).length ? ("<button type=\"button\" class=\"btn\" id=\"levelingSkipOverlap\"" + (L.includeNewZones === false ? " disabled" : "") + ">" + (overlapsAreSkipped(rec, prog) ? "Unskip overlapping OpenXP chapters" : "Skip overlapping OpenXP chapters") + "</button>") : "") +
      "<button type=\"button\" class=\"btn\" id=\"levelingFromLevel\">From my level (" + (ch().level || 1) + ")</button>" +
      "</div>";

    var srcLabel = (pack.sources || []).reduce(function (a, s) { return s.id === (rec && rec.source || L.source) ? s.label : a; }, L.source || "");
    var stats = "<div class=\"stat-row\">" +
      "<div class=\"stat-pill\"><div class=\"kicker\">Progress</div><div class=\"value\">" + doneN + " / " + allForCount.length + " · " + pct + "%</div>" +
      "<div class=\"progress" + (pct === 100 ? " done" : "") + "\" style=\"margin-top:8px\"><span style=\"width:" + pct + "%\"></span></div></div>" +
      "<div class=\"stat-pill\"><div class=\"kicker\">Faction</div><div class=\"value\">" + escapeHtml(factionOfRace(race)) + "</div></div>" +
      "<div class=\"stat-pill\"><div class=\"kicker\">Source</div><div class=\"value\" style=\"font-size:16px\">" + escapeHtml(srcLabel || (rec && rec.source) || "") + "</div></div>" +
      "</div>";

    var zonesHtml = "";
    if (!rec) {
      zonesHtml = "<p class=\"muted\">No route is embedded for this race / source / variant.</p>";
    } else {
      var groups = [];
      var g = null;
      visible.forEach(function (s) {
        var zlabel = s.chapter || s.z;
        if (!g || g.zone !== zlabel) {
          g = { zone: zlabel, steps: [] };
          groups.push(g);
        }
        g.steps.push(s);
      });
      groups.forEach(function (group) {
        var zStepsAll = allForCount.filter(function (s) { return (s.chapter || s.z) === group.zone; });
        var zDone = zStepsAll.filter(function (s) { return prog.done[s.sid] || prog.skipped[s.sid]; }).length;
        var zpct = zStepsAll.length ? Math.round(zDone / zStepsAll.length * 100) : 0;
        var lvMin = Math.min.apply(null, group.steps.map(function (s) { return s.lv || 1; }));
        var lvMax = Math.max.apply(null, group.steps.map(function (s) { return s.lv || 1; }));
        var isAddon = /Forever Tracker add-on/.test(group.zone || "");
        zonesHtml += "<section class=\"zone-block" + (isAddon ? " addon-zone" : "") + "\" data-zone=\"" + escapeHtml(group.zone) + "\"" + (isAddon ? " data-addon=\"1\"" : "") + "><header><h3>" +
          escapeHtml(group.zone) + "</h3><div class=\"muted\">Levels " + lvMin + "–" + lvMax + " · " + zDone + "/" + zStepsAll.length +
          (isAddon ? " · Forever Tracker add-on (auto-optimized, not RestedXP/OpenXP)" : "") +
          "</div></header><div class=\"progress" + (zpct === 100 ? " done" : "") + "\" style=\"margin-bottom:10px\"><span style=\"width:" + zpct + "%\"></span></div>";
        group.steps.forEach(function (s) {
          zonesHtml += renderLevelingStep(s, prog, current);
        });
        zonesHtml += "</section>";
      });
      if (!groups.length) zonesHtml = "<p class=\"muted\">No steps in this level range (or all hidden).</p>";
    }

    if (L.variant === "dungeon" && pack.dungeonSide) {
      var side = pack.dungeonSide[factionOfRace(race)] || [];
      if (side.length) {
        zonesHtml += "<section class=\"zone-block\"><header><h3>OpenXP dungeon quest chapters</h3><div class=\"muted\">Standalone dungeon quest lists from OpenXP — not mixed into the leveling order.</div></header>";
        side.forEach(function (key) {
          var chp = (pack.chapters || {})[key];
          if (!chp) return;
          zonesHtml += "<p><strong>" + escapeHtml(chp.name) + "</strong> · " + chp.stepCount + " steps</p>";
        });
        zonesHtml += "</section>";
      }
    }

    root.innerHTML = banner + toolbar + stats + curHtml + zonesHtml;
  }

  function stepTags(step) {
    var html = "<div>";
    var kindLabel = step.k === "quest" ? "Accept · objectives · turn in" : (step.k || "step");
    html += "<span class=\"kind-tag\">" + escapeHtml(kindLabel) + "</span>";
    if (step.tags && step.tags.indexOf("addon") !== -1) html += "<span class=\"kind-tag addon-tag\">Add-on</span>";
    if (step.tags && step.tags.indexOf("unverified") !== -1) html += "<span class=\"src-tag missing\">Unverified</span>";
    if (step.sx != null) {
      var a = coordLabel(step.ss);
      html += "<span class=\"coord-tag\">" + Number(step.sx).toFixed(1) + ", " + Number(step.sy).toFixed(1) + "</span>";
      html += "<span class=\"src-tag " + a.cls + "\">" + escapeHtml(a.text) + "</span>";
    } else if (step.ss === "world-unconverted") {
      html += "<span class=\"src-tag missing\">World coords in the guide (not converted)</span>";
    }
    if (step.qn && step.qn.length) {
      html += "<span class=\"muted\">" + escapeHtml(step.qn.join(" · ")) + "</span>";
    }
    html += "</div>";
    return html;
  }

  function renderLevelingStep(step, prog, current) {
    var done = !!prog.done[step.sid];
    var skipped = !!prog.skipped[step.sid];
    var note = prog.notes[step.sid] || "";
    var cls = "route-step" + (done ? " done" : "") + (skipped ? " skipped" : "") + (current && current.sid === step.sid ? " is-current" : "");
    var html = "<article class=\"" + cls + "\" data-sid=\"" + escapeHtml(step.sid) + "\">";
    html += "<input type=\"checkbox\" class=\"step-done\" data-sid=\"" + escapeHtml(step.sid) + "\"" + (done ? " checked" : "") + " aria-label=\"Done: " + escapeHtml(step.title) + "\">";
    html += "<div class=\"step-main\"><h4>" + escapeHtml(step.title) + "</h4>";
    html += "<p class=\"muted\">" + escapeHtml((step.z || step.chapter || "") + (step.lv ? " · level " + step.lv : "") + (skipped ? " · skipped" : "")) + "</p>";
    html += "<p>" + escapeHtml(step.detail || "") + "</p>" + stepTags(step) + "</div>";
    html += "<div class=\"step-actions\"><button type=\"button\" class=\"btn step-skip\" data-sid=\"" + escapeHtml(step.sid) + "\">" +
      (skipped ? "Unskip" : "Skip") + "</button></div>";
    html += "<div class=\"step-notes\"><textarea class=\"step-note\" data-sid=\"" + escapeHtml(step.sid) + "\" placeholder=\"Notes for this step\">" + escapeHtml(note) + "</textarea></div>";
    html += "</article>";
    return html;
  }

  function bindLevelingOnce() {
    var root = $("#levelingRoot");
    if (!root || root.getAttribute("data-bound")) return;
    root.setAttribute("data-bound", "1");
    root.addEventListener("change", function (ev) {
      var t = ev.target;
      if (t.id === "levelingRace") {
        state.leveling.follow = false;
        state.leveling.race = t.value;
        save(); renderLeveling();
      } else if (t.id === "levelingSource") {
        state.leveling.source = t.value;
        save(); renderLeveling();
      } else if (t.id === "levelingVariant") {
        state.leveling.variant = t.value;
        save(); renderLeveling();
      } else if (t.id === "levelingFollow") {
        state.leveling.follow = t.checked;
        if (t.checked) state.leveling.race = ch().race || state.leveling.race;
        save(); renderLeveling();
      } else if (t.id === "levelingHideDone") {
        state.leveling.hideDone = t.checked;
        save(); renderLeveling();
      } else if (t.id === "levelingIncludeNewZones") {
        state.leveling.includeNewZones = t.checked;
        save(); renderLeveling();
      } else if (t.id === "levelingMin" || t.id === "levelingMax") {
        state.leveling.minLevel = Math.max(1, Math.min(60, parseInt($("#levelingMin").value, 10) || 1));
        state.leveling.maxLevel = Math.max(1, Math.min(60, parseInt($("#levelingMax").value, 10) || 60));
        if (state.leveling.minLevel > state.leveling.maxLevel) state.leveling.maxLevel = state.leveling.minLevel;
        save(); renderLeveling();
      } else if (t.classList.contains("step-done")) {
        var prog = levelingProgress();
        if (t.checked) prog.done[t.getAttribute("data-sid")] = true;
        else delete prog.done[t.getAttribute("data-sid")];
        save(); renderLeveling();
      } else if (t.classList.contains("step-note")) {
        var prog2 = levelingProgress();
        var sid = t.getAttribute("data-sid");
        if (t.value.trim()) prog2.notes[sid] = t.value;
        else delete prog2.notes[sid];
        save();
      }
    });
    root.addEventListener("click", function (ev) {
      var btn = ev.target.closest("button");
      if (!btn) return;
      if (btn.id === "levelingFromLevel") {
        state.leveling.minLevel = ch().level || 1;
        state.leveling.maxLevel = 60;
        save(); renderLeveling();
      } else if (btn.id === "levelingSkipOverlap") {
        var rec2 = pickLevelingRoute();
        var prog3 = levelingProgress();
        var ids = overlapStepIds(rec2);
        var allSkipped = overlapsAreSkipped(rec2, prog3);
        ids.forEach(function (sid) {
          if (allSkipped) delete prog3.skipped[sid];
          else prog3.skipped[sid] = true;
        });
        save(); renderLeveling();
      } else if (btn.classList.contains("step-skip")) {
        var prog = levelingProgress();
        var sid = btn.getAttribute("data-sid");
        if (prog.skipped[sid]) delete prog.skipped[sid];
        else prog.skipped[sid] = true;
        save(); renderLeveling();
      }
    });
  }


  function bind() {
    $all(".tabs [data-tab]").forEach(function (b) {
      b.addEventListener("click", function () { showTab(b.getAttribute("data-tab")); });
    });
    $("#characterForm").addEventListener("input", onCharacterInput);
    $("#characterForm").addEventListener("change", onCharacterCommit);
    var levelInput = $("#characterForm").elements.level;
    if (levelInput) levelInput.addEventListener("blur", onCharacterCommit);
    bindLevelingOnce();

    $("#goalSearch").addEventListener("input", renderGoals);
    document.addEventListener("click", function (e) {
      var f = e.target.closest && e.target.closest(".goal-filter");
      if (f) {
        goalFilter = f.getAttribute("data-filter");
        renderGoals();
        return;
      }
      var gs = e.target.getAttribute && e.target.getAttribute("data-goal-status");
      if (gs) {
        var card = e.target.closest("[data-goal]");
        var id = card.getAttribute("data-goal");
        if (!state.goals[id]) state.goals[id] = {};
        state.goals[id].status = gs;
        state.goals[id].progress = gs === "done" ? 100 : gs === "in-progress" ? 40 : 0;
        save(); renderGoals();
        return;
      }
      if (e.target.getAttribute && e.target.getAttribute("data-goal-del")) {
        var id2 = e.target.closest("[data-goal]").getAttribute("data-goal");
        state.customGoals = state.customGoals.filter(function (g) { return g.id !== id2; });
        delete state.goals[id2];
        save(); renderGoals();
        return;
      }
    });
    document.addEventListener("input", function (e) {
      if (e.target.getAttribute && e.target.getAttribute("data-goal-notes") != null) {
        var id = e.target.closest("[data-goal]").getAttribute("data-goal");
        if (!state.goals[id]) state.goals[id] = {};
        state.goals[id].notes = e.target.value;
        save();
      }
    });
    $("#btnAddGoal").addEventListener("click", function () {
      openModal("<h3>Add a custom goal</h3>" +
        '<label class="field">Name<input id="cgName"></label>' +
        '<label class="field">Notes<textarea id="cgNotes"></textarea></label>' +
        '<div class="row-actions"><button type="button" class="btn btn-primary" id="cgSave">Add</button>' +
        '<button type="button" class="btn" data-close>Cancel</button></div>');
      $("#cgSave").addEventListener("click", function () {
        var name = $("#cgName").value.trim();
        if (!name) return toast("Name required");
        state.customGoals.push({ id: uid("goal"), name: name, notes: $("#cgNotes").value.trim() });
        save(); closeModal(); renderGoals();
      });
    });

    $("#btnAddGold").addEventListener("click", function () {
      var f = $("#goldForm");
      var copper = toCopper(f.g.value, f.s.value, f.c.value);
      if (!copper) return toast("Enter an amount");
      if ($("#goldSpend").checked) copper = -copper;
      state.goldLog.push({ id: uid("gold"), date: f.date.value || todayISO(), copper: copper, note: f.note.value.trim() });
      f.g.value = 0; f.s.value = 0; f.c.value = 0; f.note.value = "";
      save(); renderGold();
    });
    document.addEventListener("click", function (e) {
      var id = e.target.getAttribute && e.target.getAttribute("data-del-gold");
      if (id) {
        state.goldLog = state.goldLog.filter(function (x) { return x.id !== id; });
        save(); renderGold();
      }
    });

    $("#btnAddProf").addEventListener("click", function () {
      var unused = DATA.professions.filter(function (n) {
        return !state.professions.some(function (p) { return p.name === n; });
      });
      if (!unused.length) return toast("All professions are already listed");
      openModal("<h3>Add profession</h3><label class=\"field\">Profession<select id=\"profName\">" +
        unused.map(function (n) { return "<option>" + n + "</option>"; }).join("") +
        "</select></label><label class=\"field\">Skill (0–300)<input type=\"number\" id=\"profSkill\" min=\"0\" max=\"300\" value=\"1\"></label>" +
        '<div class="row-actions"><button type="button" class="btn btn-primary" id="profSave">Add</button>' +
        '<button type="button" class="btn" data-close>Cancel</button></div>');
      $("#profSave").addEventListener("click", function () {
        var added = { id: uid("prof"), name: $("#profName").value, skill: Math.max(0, Math.min(300, parseInt($("#profSkill").value, 10) || 0)) };
        state.professions.push(added);
        save(); closeModal();
        if (window.ProfGuide && ProfGuide.onProfessionAdded) ProfGuide.onProfessionAdded(added.name);
        renderProfessionsTab();
      });
    });
    document.addEventListener("click", function (e) {
      if (e.target.getAttribute && e.target.getAttribute("data-del-prof") != null) {
        var id = e.target.closest("[data-prof]").getAttribute("data-prof");
        state.professions = state.professions.filter(function (p) { return p.id !== id; });
        save();
        if (window.ProfGuide && ProfGuide.onProfessionsChanged) ProfGuide.onProfessionsChanged();
        renderProfessionsTab();
      }
      if (e.target.getAttribute && e.target.getAttribute("data-del-craft") != null) {
        var idc = e.target.closest("[data-craft]").getAttribute("data-craft");
        state.crafting = state.crafting.filter(function (p) { return p.id !== idc; });
        save(); renderProfessionsTab();
      }
    });
    document.addEventListener("input", function (e) {
      if (e.target.getAttribute && e.target.getAttribute("data-prof-skill") != null) {
        var id = e.target.closest("[data-prof]").getAttribute("data-prof");
        var p = state.professions.find(function (x) { return x.id === id; });
        var n = parseInt(e.target.value, 10);
        if (p && e.target.value !== "" && !isNaN(n) && n >= 0 && n <= 300) { p.skill = n; save(); }
      }
      if (e.target.getAttribute && e.target.getAttribute("data-mat-have") != null) {
        var card = e.target.closest("[data-craft]");
        var rec = state.crafting.find(function (x) { return x.id === card.getAttribute("data-craft"); });
        var idx = parseInt(e.target.closest("[data-mat]").getAttribute("data-mat"), 10);
        var have = parseInt(e.target.value, 10);
        if (rec && rec.mats[idx] && e.target.value !== "" && !isNaN(have) && have >= 0) { rec.mats[idx].have = have; save(); }
      }
    });
    document.addEventListener("change", function (e) {
      if (e.target.getAttribute && e.target.getAttribute("data-prof-skill") != null) {
        var id = e.target.closest("[data-prof]").getAttribute("data-prof");
        var p = state.professions.find(function (x) { return x.id === id; });
        if (p) {
          p.skill = parseBoundedInt(e.target.value, 0, 300, 0);
          save();
          renderProfessions();
          if (window.ProfGuide) {
            try { window.ProfGuide.syncAndRender({ scroll: true }); }
            catch (err) { try { window.ProfGuide.render(); } catch (e2) { console.error(e2); } }
          }
          if (window.GoldFarms && $("#tab-gold") && $("#tab-gold").classList.contains("active")) {
            try { window.GoldFarms.render(state, { save: save, formatGold: formatGold, escapeHtml: escapeHtml }); } catch (err) { console.error(err); }
          }
        }
      }
      if (e.target.getAttribute && e.target.getAttribute("data-mat-have") != null) {
        var card = e.target.closest("[data-craft]");
        var rec = state.crafting.find(function (x) { return x.id === card.getAttribute("data-craft"); });
        var idx = parseInt(e.target.closest("[data-mat]").getAttribute("data-mat"), 10);
        if (rec && rec.mats[idx]) { rec.mats[idx].have = parseBoundedInt(e.target.value, 0, 999999, 0); save(); renderCrafting(); }
      }
    });
    $("#btnAddCraft").addEventListener("click", function () {
      var f = $("#craftForm");
      var recipe = f.recipe.value.trim();
      if (!recipe) return toast("Enter a recipe name");
      var mats = String(f.mats.value || "").split(",").map(function (part) {
        var m = part.trim().match(/^(.*?)(?:\s*x\s*|\s+)(\d+)$/i);
        if (m) return { name: m[1].trim(), qty: parseInt(m[2], 10), have: 0 };
        if (part.trim()) return { name: part.trim(), qty: 1, have: 0 };
        return null;
      }).filter(Boolean);
      state.crafting.push({ id: uid("craft"), recipe: recipe, mats: mats });
      f.recipe.value = ""; f.mats.value = "";
      save(); renderCrafting();
    });

    $("#btnAddJournal").addEventListener("click", function () {
      var f = $("#journalForm");
      if (!(f.title.value.trim() || f.body.value.trim())) return toast("Write a title or entry");
      state.journal.push({ id: uid("j"), date: f.date.value || todayISO(), title: f.title.value.trim(), body: f.body.value.trim() });
      f.title.value = ""; f.body.value = "";
      save(); renderNotes();
    });
    $("#btnAddNote").addEventListener("click", function () {
      var f = $("#noteForm");
      if (!(f.title.value.trim() || f.body.value.trim())) return toast("Write a title or note");
      state.notes.push({ id: uid("n"), title: f.title.value.trim(), body: f.body.value.trim(), updated: new Date().toISOString() });
      f.title.value = ""; f.body.value = "";
      save(); renderNotes();
    });
    $("#notesSearch").addEventListener("input", renderNotes);
    document.addEventListener("click", function (e) {
      if (e.target.getAttribute && e.target.getAttribute("data-del-journal") != null) {
        var id = e.target.closest("[data-journal]").getAttribute("data-journal");
        state.journal = state.journal.filter(function (x) { return x.id !== id; });
        save(); renderNotes();
      }
      if (e.target.getAttribute && e.target.getAttribute("data-del-note") != null) {
        var idn = e.target.closest("[data-note]").getAttribute("data-note");
        state.notes = state.notes.filter(function (x) { return x.id !== idn; });
        save(); renderNotes();
      }
    });

    $("#btnAddCustomItem").addEventListener("click", openCustomItemForm);
    $("#btnClearGear").addEventListener("click", function () {
      if (!confirm("Clear all equipped items?")) return;
      state.equipment = {};
      save(); renderItems();
    });
    document.addEventListener("error", function (e) {
      if (e.target && e.target.getAttribute && e.target.hasAttribute("data-icon-img")) {
        e.target.classList.add("is-missing");
        e.target.removeAttribute("src");
      }
    }, true);
    document.addEventListener("forever-prices", function () {
      if ($("#tab-items") && $("#tab-items").classList.contains("active")) renderItems();
    });
    document.addEventListener("input", function (e) {
      if (e.target && e.target.id === "slotEquipSearch") renderSlotSearch();
    });
    document.addEventListener("change", function (e) {
      var tEl = e.target;
      if (!tEl || !selectedSlot) return;
      if (tEl.id === "slotFilterClass") {
        setViewClass(tEl.value);
        slotShowAll = false;
        renderSlotPanel(selectedSlot);
        return;
      }
      if (tEl.id === "slotFilterBuild") {
        slotFilter(selectedSlot).build = tEl.value;
        save();
        slotShowAll = false;
        renderSlotPanel(selectedSlot);
        return;
      }
      if (tEl.id === "slotFilterSort") {
        slotFilter(selectedSlot).sort = tEl.value || "best";
        save();
        slotShowAll = false;
        renderSlotPanel(selectedSlot);
        return;
      }
      if (tEl.id === "slotFilterMinQuality") {
        slotFilter(selectedSlot).minQuality = tEl.value || "all";
        save();
        slotShowAll = false;
        renderSlotPanel(selectedSlot);
      }
    });
    document.addEventListener("click", function (e) {
      var tab = $("#tab-items");
      if (!tab || !tab.classList.contains("active")) return;
      var slot = e.target.closest && e.target.closest("[data-equip-slot]");
      if (slot && tab.contains(slot)) {
        openSlotPanel(slot.getAttribute("data-equip-slot"));
        return;
      }
      if (e.target.closest && e.target.closest("[data-slot-close]")) {
        selectedSlot = null;
        slotShowAll = false;
        renderItems();
        return;
      }
      if (e.target.closest && e.target.closest("[data-slot-clear]")) {
        clearSelectedSlot();
        return;
      }
      if (e.target.closest && e.target.closest("[data-slot-more]")) {
        slotShowAll = true;
        if (selectedSlot) renderSlotPanel(selectedSlot);
        return;
      }
      var typeChip = e.target.closest && e.target.closest("[data-slot-type]");
      if (typeChip && tab.contains(typeChip) && selectedSlot) {
        slotFilter(selectedSlot).type = typeChip.getAttribute("data-slot-type");
        slotShowAll = false;
        save();
        renderSlotPanel(selectedSlot);
        return;
      }
      var handChip = e.target.closest && e.target.closest("[data-slot-hand]");
      if (handChip && tab.contains(handChip) && selectedSlot) {
        slotFilter(selectedSlot).hand = handChip.getAttribute("data-slot-hand");
        slotShowAll = false;
        save();
        renderSlotPanel(selectedSlot);
        return;
      }
      var good = e.target.closest && e.target.closest("[data-good-for]");
      if (good && tab.contains(good)) {
        e.preventDefault();
        var expl = good.parentNode && good.parentNode.querySelector(".good-for-explain");
        if (expl) expl.hidden = !expl.hidden;
        return;
      }
      var eq = e.target.closest && e.target.closest("[data-equip-id]");
      if (eq && tab.contains(eq)) {
        e.preventDefault();
        equipFromPanel(eq.getAttribute("data-equip-id"));
      }
    });

    document.addEventListener("click", function (e) {
      var modeBtn = e.target.closest && e.target.closest("[data-talent-mode]");
      if (modeBtn) { setTalentMode(modeBtn.getAttribute("data-talent-mode")); return; }
      var specBtn = e.target.closest && e.target.closest("[data-talent-spec]");
      if (specBtn && !specBtn.disabled) { setActiveSpec(specBtn.getAttribute("data-talent-spec")); }
    });
    $("#btnTalentReset").addEventListener("click", function () { resetAllTalents(); renderTalents(); });
    $("#btnTalentResetTree").addEventListener("click", function () {
      var data = talentClassData();
      var t = data.trees[talentFocusTree];
      if (t) resetTree(t.name);
      renderTalents();
    });
    $("#btnTalentSave").addEventListener("click", function () {
      openModal("<h3>Save talent build</h3><label class=\"field\">Name<input id=\"tbName\" placeholder=\"My fury 17/34\"></label>" +
        '<div class="row-actions"><button type="button" class="btn btn-primary" id="tbSave">Save</button>' +
        '<button type="button" class="btn" data-close>Cancel</button></div>');
      $("#tbSave").addEventListener("click", function () {
        var name = $("#tbName").value.trim() || ("Build " + (state.savedTalentBuilds.length + 1));
        state.savedTalentBuilds.push({
          id: uid("tb"),
          name: name,
          class: ch().class,
          mode: talentMode(),
          specSlot: state.talents.activeSpec || "primary",
          trees: JSON.parse(JSON.stringify(talentStore().trees || {}))
        });
        save(); closeModal(); renderTalents(); toast("Saved " + name);
      });
    });
    $("#btnTalentLoad").addEventListener("click", function () {
      var id = $("#savedBuilds").value;
      var b = (state.savedTalentBuilds || []).find(function (x) { return x.id === id; });
      if (!b) return toast("Pick a saved build");
      applyBuild(b);
      renderChrome();
      renderTalents();
      toast("Loaded " + b.name);
    });
    $("#btnTalentDelete").addEventListener("click", function () {
      var id = $("#savedBuilds").value;
      if (!id) return;
      state.savedTalentBuilds = state.savedTalentBuilds.filter(function (x) { return x.id !== id; });
      save(); renderTalents();
    });
    document.addEventListener("click", function (e) {
      var nav = e.target.closest && e.target.closest("[data-talent-nav]");
      if (nav && $("#tab-talents").classList.contains("active")) {
        var kind = nav.getAttribute("data-talent-nav");
        if (kind === "step") {
          var d = parseInt(nav.getAttribute("data-delta"), 10) || 0;
          setTalentViewLevel(viewTalentLevel() + d);
        } else if (kind === "set") {
          setTalentViewLevel(nav.getAttribute("data-level"));
        } else if (kind === "mine") {
          setTalentViewLevel(null);
        }
        return;
      }
      var rt = e.target.getAttribute && e.target.getAttribute("data-reset-tree");
      if (rt) { resetTree(rt); renderTalents(); return; }
      var lb = e.target.closest && e.target.closest("[data-load-build]");
      if (lb) {
        var build = talentBuilds().find(function (x) { return x.id === lb.getAttribute("data-load-build"); });
        if (build) { applyBuild(build); renderChrome(); renderTalents(); toast("Loaded " + build.name); }
        return;
      }
      var cell = e.target.closest && e.target.closest(".talent[data-talent]");
      if (cell && $("#tab-talents").classList.contains("active") && e.button === 0) {
        var data = talentClassData();
        var tree = data.trees[parseInt(cell.getAttribute("data-tree"), 10)];
        talentFocusTree = parseInt(cell.getAttribute("data-tree"), 10);
        var tal = tree.talents.find(function (t) { return String(t.id) === cell.getAttribute("data-talent"); });
        if (tal) {
          if (talentPreview) {
            leaveBuildPreview("Left the build preview. You're editing your live talents at level " + charTalentLevel() + ".");
            renderTalents();
          }
          addPoint(tree, tal);
          renderTalents();
        }
      }
    });
    document.addEventListener("contextmenu", function (e) {
      var cell = e.target.closest && e.target.closest(".talent[data-talent]");
      if (cell && $("#tab-talents").classList.contains("active")) {
        e.preventDefault();
        var data = talentClassData();
        var tree = data.trees[parseInt(cell.getAttribute("data-tree"), 10)];
        talentFocusTree = parseInt(cell.getAttribute("data-tree"), 10);
        var tal = tree.talents.find(function (t) { return String(t.id) === cell.getAttribute("data-talent"); });
        if (tal) {
          if (talentPreview) {
            leaveBuildPreview("Left the build preview. You're editing your live talents at level " + charTalentLevel() + ".");
            renderTalents();
          }
          removePoint(tree, tal);
          renderTalents();
        }
      }
    });
    document.addEventListener("input", function (e) {
      if (e.target && e.target.id === "talentLevelSlider") {
        setTalentViewLevel(e.target.value);
      }
    });

    window.addEventListener("hashchange", function () {
      var hash = (location.hash || "").replace("#", "");
      if (/^item-\d+/.test(hash)) return;
      var name = resolveTab(hash);
      if (name && name !== activeTab) showTab(name);
    });

    var importFile = $("#importFile");
    if (importFile) {
      importFile.addEventListener("change", function () {
        if (this.files && this.files[0]) importData(this.files[0]);
        this.value = "";
      });
    }
  }

  /* ---------- init ---------- */
  function init() {
    load();
    bind();
    renderCharacter();
    var hash = (location.hash || "").replace("#", "");
    var q = "";
    try { q = new URLSearchParams(location.search).get("tab") || ""; } catch (e) {}
    var start = resolveTab(q) || resolveTab(hash);
    if (/^item-\d+/.test(hash)) start = "items";
    showTab(start || "character");
    if (/^item-\d+/.test(hash) && window.ItemDB) window.ItemDB.open(hash.replace("item-",""));
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
    } catch (e) {}
    if (window.CloudSave) window.CloudSave.start();
  }

  function isUpgradeItem(item) {
    var c = ch();
    if (!item || !c.class) return false;
    if (item.forever === false && !item.custom) return false;
    if (isJunkUpgrade(item)) return false;
    var need = effectiveReq(item);
    if (need == null || need > (c.level || 1)) return false;
    if (ARMOR.indexOf(item.type) !== -1 && preferredArmorTypes(c, 0).indexOf(item.type) === -1) return false;
    return DATA.slots.some(function (s) {
      if (!itemFitsSlot(item, s.id) || !canEquipInSlot(item, c, s.id, 0)) return false;
      if (s.id === "offhand" && equippedTwoHand()) return false;
      var current = state.equipment[s.id];
      if (current && current.id === item.id) return false;
      var w = characterWeights();
      var curScore = current ? itemScore(current, w) : 0;
      return itemScore(item, w) > curScore + 0.05;
    });
  }
  function equipItemInSlot(item, slotId) {
    var c = ch();
    var slots = DATA.slots.filter(function (s) {
      return itemFitsSlot(item, s.id) && canEquipInSlot(item, c, s.id, LEVEL_WINDOW);
    });
    if (slotId) slots = slots.filter(function (s) { return s.id === slotId; });
    if (!slots.length) { toast("Your character cannot use that in any slot yet"); return; }
    var slot = slots.filter(function (s) { return !state.equipment[s.id]; })[0] || slots[0];
    state.equipment[slot.id] = item;
    if (item.slot === "twohand") state.equipment.offhand = null;
    save();
    renderItems();
    toast("Equipped " + item.name + " in " + slot.label);
  }
  window.ForeverItems = {
    isUpgrade: isUpgradeItem,
    equipItem: equipItemInSlot,
    render: renderItems,
    qualityClass: qualityClass,
    formatStats: formatStats,
    effectiveReq: effectiveReq,
    upgradesFor: upgradesFor,
    canEquipInSlot: canEquipInSlot,
    itemFitsSlot: itemFitsSlot,
    itemScore: itemScore
  };
  window.ForeverApp = {
    STORAGE_KEY: STORAGE_KEY,
    getState: function () { return state; },
    setState: function (s) { state = s; save(); },
    save: save,
    load: load,
    applyLoadedState: applyLoadedState,
    exportData: exportData,
    importData: importData,
    openModal: openModal,
    closeModal: closeModal,
    toast: toast,
    renderTab: function () { renderTab(activeTab); },
    showTab: showTab,
    resolveTab: resolveTab,
    renderProfessions: renderProfessions,
    renderProfessionsTab: renderProfessionsTab,
    allItems: allItems,
    itemScore: itemScore,
    canEquipInSlot: canEquipInSlot,
    upgradesFor: upgradesFor,
    pointsAvailable: pointsAvailable,
    totalSpent: totalSpent,
    applyBuild: applyBuild,
    setTalentMode: setTalentMode,
    setActiveSpec: setActiveSpec,
    talentMode: talentMode,
    talentViewLevel: viewTalentLevel,
    setTalentViewLevel: setTalentViewLevel,
    charTalentLevel: charTalentLevel,
    getTalentPreview: function () { return talentPreview; },
    getBuildOrder: getBuildOrder,
    pointsAtLevel: pointsAtLevel,
    formatGold: formatGold,
    goldTotal: goldTotal,
    toCopper: toCopper,
    renderLeveling: renderLeveling,
    levelingProgress: levelingProgress,
    expandLevelingSteps: expandLevelingSteps,
    levelingCharKey: levelingCharKey,
    includeAddonChapters: includeAddonChapters,
    overlapChapterKeys: overlapChapterKeys,
    getState: function () { return state; },
    save: save
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // Floating talent tooltip: lives on <body> with fixed positioning so it is never
  // clipped by the scrollable tree container; flips below and clamps to the viewport.
  (function () {
    var tip = null;
    function ensure() {
      if (!tip) { tip = document.createElement("div"); tip.id = "talentTipFloat"; document.body.appendChild(tip); }
      return tip;
    }
    function hide() { if (tip) tip.style.display = "none"; }
    function show(cell) {
      var src = cell.querySelector(".talent-tip");
      if (!src) return hide();
      var el = ensure();
      el.innerHTML = src.innerHTML;
      el.style.display = "block";
      var r = cell.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight, m = 8;
      var vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
      var left = r.left + r.width / 2 - w / 2;
      left = Math.max(m, Math.min(left, vw - w - m));
      var top = r.top - h - m;
      if (top < m) top = r.bottom + m;
      if (top + h > vh - m) top = Math.max(m, vh - h - m);
      el.style.left = left + "px"; el.style.top = top + "px";
    }
    document.addEventListener("mouseover", function (e) {
      var cell = e.target.closest && e.target.closest(".talent[data-talent]");
      if (cell) show(cell); else hide();
    });
    document.addEventListener("focusin", function (e) {
      var cell = e.target.closest && e.target.closest(".talent[data-talent]");
      if (cell) show(cell);
    });
    document.addEventListener("focusout", hide);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    document.addEventListener("click", function (e) {
      var cell = e.target.closest && e.target.closest(".talent[data-talent]");
      if (cell) setTimeout(function () {
        var fresh = document.querySelector('.talent[data-tree="' + cell.dataset.tree + '"][data-talent="' + cell.dataset.talent + '"]');
        if (fresh) show(fresh); else hide();
      }, 0);
    });
    document.addEventListener("contextmenu", function (e) {
      var cell = e.target.closest && e.target.closest(".talent[data-talent]");
      if (cell) setTimeout(function () {
        var fresh = document.querySelector('.talent[data-tree="' + cell.dataset.tree + '"][data-talent="' + cell.dataset.talent + '"]');
        if (fresh) show(fresh); else hide();
      }, 0);
    });
  })();
})();
