/* Forever Tracker — Leveling dashboard (WW-16). */
(function () {
  "use strict";

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

  function dash() {
    var s = state();
    if (!s) return { xpCurrent: null, sessions: [], activeSessionId: null };
    if (!s.dashboard) s.dashboard = { xpCurrent: null, sessions: [], activeSessionId: null };
    if (!Array.isArray(s.dashboard.sessions)) s.dashboard.sessions = [];
    return s.dashboard;
  }

  function save() {
    if (app() && app().save) app().save();
  }

  function xpTable() {
    var d = window.PETS_DATA;
    return (d && d.xpByLevel) || {};
  }

  function xpSource() {
    var d = window.PETS_DATA;
    return (d && d.xpSource) || { label: "XP table unavailable" };
  }

  function char() {
    var s = state();
    return (s && s.character) || { name: "", level: 1, class: "", race: "", spec: "" };
  }

  function charLevel() {
    var n = parseInt(char().level, 10);
    return isNaN(n) ? 1 : Math.max(1, Math.min(60, n));
  }

  function setCharLevel(n) {
    var s = state();
    if (!s || !s.character) return;
    n = parseInt(n, 10);
    if (isNaN(n) || n < 1 || n > 60) return;
    s.character.level = n;
    save();
    if (app() && app().renderTab) app().renderTab();
  }

  function setXpCurrent(v) {
    var d = dash();
    if (v === "" || v == null) d.xpCurrent = null;
    else {
      var n = parseInt(v, 10);
      if (isNaN(n) || n < 0) return;
      d.xpCurrent = n;
    }
    save();
  }

  function xpToNext(level) {
    var t = xpTable();
    if (level >= 60) return null;
    var v = t[String(level)];
    return v == null ? null : v;
  }

  function remainingThisLevel() {
    var need = xpToNext(charLevel());
    var cur = dash().xpCurrent;
    if (need == null || cur == null) return null;
    return Math.max(0, need - cur);
  }

  function remainingToSixty() {
    var level = charLevel();
    var curRem = remainingThisLevel();
    if (level >= 60) return 0;
    if (curRem == null) return null;
    var t = xpTable();
    var sum = curRem;
    for (var lv = level + 1; lv <= 59; lv++) {
      var n = t[String(lv)];
      if (n == null) return null;
      sum += n;
    }
    return sum;
  }

  function fmtNum(n) {
    if (n == null || isNaN(n)) return "—";
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function fmtDuration(hours) {
    if (hours == null || !isFinite(hours) || hours < 0) return "—";
    var mins = Math.round(hours * 60);
    if (mins < 1) return "< 1 min";
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    if (h === 0) return m + " min";
    if (m === 0) return h + "h";
    return h + "h " + m + "m";
  }

  function sessionById(id) {
    var sessions = dash().sessions || [];
    for (var i = 0; i < sessions.length; i++) if (sessions[i].id === id) return sessions[i];
    return null;
  }

  function activeSession() {
    var d = dash();
    if (!d.activeSessionId) return null;
    return sessionById(d.activeSessionId);
  }

  function uid() {
    return "xps_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
  }

  function startSession() {
    var d = dash();
    if (d.activeSessionId && sessionById(d.activeSessionId) && !sessionById(d.activeSessionId).endedAt) return;
    var ses = { id: uid(), startedAt: Date.now(), endedAt: null, entries: [] };
    d.sessions.push(ses);
    d.activeSessionId = ses.id;
    save();
    render();
  }

  function stopSession() {
    var ses = activeSession();
    if (!ses || ses.endedAt) return;
    ses.endedAt = Date.now();
    save();
    render();
  }

  function addXpEntry(amount, note) {
    var n = parseInt(amount, 10);
    if (isNaN(n) || n === 0) return;
    var d = dash();
    var ses = activeSession();
    if (!ses || ses.endedAt) {
      ses = { id: uid(), startedAt: Date.now(), endedAt: null, entries: [] };
      d.sessions.push(ses);
      d.activeSessionId = ses.id;
    }
    ses.entries.push({ t: Date.now(), xp: n, note: (note || "").slice(0, 80) });
    save();
    render();
  }

  function sessionXp(ses) {
    if (!ses || !ses.entries) return 0;
    var s = 0;
    for (var i = 0; i < ses.entries.length; i++) s += ses.entries[i].xp || 0;
    return s;
  }

  function sessionHours(ses, now) {
    if (!ses || !ses.startedAt) return null;
    var end = ses.endedAt || now || Date.now();
    var ms = end - ses.startedAt;
    if (ms <= 0) return null;
    return ms / 3600000;
  }

  /* XP/hour only from a real session with at least one entry and elapsed time. */
  function sessionRate(ses, now) {
    if (!ses) return null;
    var hours = sessionHours(ses, now);
    var xp = sessionXp(ses);
    if (hours == null || hours <= 0 || !xp) return null;
    return xp / hours;
  }

  function displaySession() {
    var d = dash();
    var ses = activeSession();
    if (ses) return ses;
    if (d.sessions && d.sessions.length) return d.sessions[d.sessions.length - 1];
    return null;
  }

  function nextSteps(n) {
    if (app() && app().nextOpenLevelingSteps) return app().nextOpenLevelingSteps(n || 5) || [];
    return [];
  }

  function topFarm() {
    if (!window.GoldFarms || !GoldFarms.filtered) return null;
    var list;
    try { list = GoldFarms.filtered(); } catch (e) { return null; }
    return (list && list[0]) || null;
  }

  function farmHeadline(spot) {
    if (!spot || !window.GoldFarms || !GoldFarms.headline) return null;
    try { return GoldFarms.headline(spot); } catch (e) { return null; }
  }

  function cheapUpgrades() {
    var a = app();
    if (!a || !a.upgradesFor || !a.getState) return { kind: "link" };
    var eq = (a.getState().equipment) || {};
    var slots = (window.DATA && DATA.slots) || [];
    var filled = 0, empty = 0;
    var usable = [];
    slots.forEach(function (s) {
      if (s.id === "shirt" || s.id === "tabard") return;
      usable.push(s);
      if (eq[s.id]) filled++;
      else empty++;
    });
    if (!filled) return { kind: "empty", empty: empty };
    var picks = [];
    try {
      usable.forEach(function (s) {
        var u = a.upgradesFor(s.id);
        var list = (u && u.at) || [];
        var rec = list[0];
        if (rec && rec.item && rec.delta > 0 && !rec.unknown) {
          picks.push({ slot: s.label, name: rec.item.name, id: rec.item.id, delta: rec.delta });
        }
      });
    } catch (e) {
      return { kind: "link", empty: empty };
    }
    picks.sort(function (x, y) { return y.delta - x.delta; });
    return { kind: picks.length ? "list" : "none", items: picks.slice(0, 3), empty: empty };
  }

  function fmtGoldCopper(c) {
    if (c == null || isNaN(c)) return "—";
    c = Math.round(Number(c));
    if (!isFinite(c)) return "—";
    var g = Math.floor(c / 10000);
    var s = Math.floor((c % 10000) / 100);
    var co = c % 100;
    var parts = [];
    if (g) parts.push(g + "g");
    if (s || g) parts.push(s + "s");
    parts.push(co + "c");
    return parts.join(" ");
  }

  function renderXpCard() {
    var level = charLevel();
    var c = char();
    var need = xpToNext(level);
    var cur = dash().xpCurrent;
    var rem = remainingThisLevel();
    var src = xpSource();
    var html = '<section class="card dash-xp" id="dashXpCard">';
    html += "<h3>Level and experience</h3>";
    if (c.name) html += '<p class="dash-who"><strong>' + escapeHtml(c.name) + "</strong> · " + escapeHtml(c.race || "") + " " + escapeHtml(c.class || "") + (c.spec ? " (" + escapeHtml(c.spec) + ")" : "") + "</p>";
    html += '<form id="dashXpForm" class="form-grid" autocomplete="off">';
    html += '<label class="field">Level<input type="number" name="level" min="1" max="60" value="' + escapeHtml(level) + '"></label>';
    html += '<label class="field">XP into this level<input type="number" name="xp" min="0" placeholder="—" value="' + (cur == null ? "" : escapeHtml(cur)) + '"></label>';
    html += "</form>";
    html += '<div class="stat-row dash-xp-stats">';
    html += '<div class="stat"><span class="stat-label">XP to next level</span><span class="stat-value" id="dashXpNeed">' + (level >= 60 ? "Cap (60)" : fmtNum(need)) + "</span></div>";
    html += '<div class="stat"><span class="stat-label">XP remaining</span><span class="stat-value" id="dashXpRemain">' + fmtNum(rem) + "</span></div>";
    html += "</div>";
    html += '<p class="muted" id="dashXpSource">' + escapeHtml(src.label || "XP table") +
      ". Values are the Experience field for this level in the Forever client LevelExperience table. They match Classic 1.12, but are cited from the Forever client.</p>";
    if (cur == null && level < 60) {
      html += '<p class="muted">XP remaining and time estimates stay as — until you enter XP into this level.</p>';
    }
    html += "</section>";
    return html;
  }

  function renderSessionCard() {
    var now = Date.now();
    var ses = displaySession();
    var active = !!(ses && !ses.endedAt && dash().activeSessionId === ses.id);
    var rate = sessionRate(ses, now);
    var rem = remainingThisLevel();
    var to60 = remainingToSixty();
    var html = '<section class="card dash-session" id="dashSessionCard">';
    html += "<h3>XP session</h3>";
    html += '<p class="muted">Start a session, then add the XP you actually gained. XP/hour and time estimates use only those entries and the clock — nothing is filled in for you.</p>';
    html += '<div class="dash-session-actions">';
    if (active) html += '<button type="button" class="btn btn-primary" id="dashStopSession">Stop session</button>';
    else html += '<button type="button" class="btn btn-primary" id="dashStartSession">Start session</button>';
    html += "</div>";
    html += '<form id="dashAddXpForm" class="form-grid" autocomplete="off">';
    html += '<label class="field">XP gained<input type="number" name="xp" step="1" placeholder="e.g. 3500" required></label>';
    html += '<label class="field">Note (optional)<input type="text" name="note" maxlength="80" placeholder="Quest turn-ins"></label>';
    html += '<div class="field"><button type="submit" class="btn">Add XP</button></div>';
    html += "</form>";
    html += '<div class="stat-row">';
    html += '<div class="stat"><span class="stat-label">This session</span><span class="stat-value" id="dashSessionXp">' + (ses ? fmtNum(sessionXp(ses)) + " XP" : "—") + "</span></div>";
    html += '<div class="stat"><span class="stat-label">Time</span><span class="stat-value" id="dashSessionTime">' + (ses && sessionHours(ses, now) != null ? fmtDuration(sessionHours(ses, now)) : "—") + "</span></div>";
    html += '<div class="stat"><span class="stat-label">XP / hour</span><span class="stat-value" id="dashXph">' + (rate != null ? fmtNum(rate) : "—") + "</span></div>";
    html += "</div>";
    html += '<div class="stat-row">';
    html += '<div class="stat"><span class="stat-label">Est. time to next level</span><span class="stat-value" id="dashEtaNext">' +
      (rate != null && rem != null && rem > 0 ? fmtDuration(rem / rate) : (charLevel() >= 60 ? "At cap" : "—")) + "</span></div>";
    html += '<div class="stat"><span class="stat-label">Est. time to 60</span><span class="stat-value" id="dashEta60">' +
      (rate != null && to60 != null && to60 > 0 ? fmtDuration(to60 / rate) : (charLevel() >= 60 ? "At cap" : "—")) + "</span></div>";
    html += "</div>";
    if (ses && ses.entries && ses.entries.length) {
      html += '<div class="table-wrap"><table class="dash-xp-log"><thead><tr><th>When</th><th>XP</th><th>Note</th></tr></thead><tbody>';
      ses.entries.slice().reverse().forEach(function (e) {
        var when = new Date(e.t);
        var label = isNaN(when.getTime()) ? "—" : when.toLocaleTimeString();
        html += "<tr><td>" + escapeHtml(label) + "</td><td>" + fmtNum(e.xp) + "</td><td>" + escapeHtml(e.note || "") + "</td></tr>";
      });
      html += "</tbody></table></div>";
    }
    html += "</section>";
    return html;
  }

  function renderRouteCard() {
    var steps = nextSteps(5);
    var html = '<section class="card dash-route" id="dashRouteCard">';
    html += "<h3>Next steps on your route</h3>";
    html += '<p class="muted">From the Leveling Route tab, in the same order, skipping steps you already marked done. Marking one done here updates that tab too.</p>';
    if (!steps.length) {
      html += '<p>No open steps in the current route. <button type="button" class="btn btn-sm" data-dash-tab="leveling">Open Leveling Route</button></p>';
    } else {
      html += '<ol class="dash-steps">';
      steps.forEach(function (s) {
        html += '<li class="dash-step">';
        html += '<div class="dash-step-main">';
        html += "<strong>" + escapeHtml(s.title || "") + "</strong>";
        html += '<span class="muted"> · ' + escapeHtml((s.z || "") + (s.lv ? " · lv " + s.lv : "")) + "</span>";
        if (s.detail) html += '<div class="dash-step-detail muted">' + escapeHtml(s.detail) + "</div>";
        html += "</div>";
        html += '<button type="button" class="btn btn-sm dash-step-done" data-sid="' + escapeHtml(s.sid) + '">Mark done</button>';
        html += "</li>";
      });
      html += "</ol>";
    }
    html += "</section>";
    return html;
  }

  function renderLinks() {
    var html = '<section class="card dash-links" id="dashLinksCard">';
    html += "<h3>Quick links</h3>";
    html += '<ul class="dash-link-list">';
    html += '<li><button type="button" class="btn" data-dash-tab="goals">Goals</button> <span class="muted">Dungeons, raids, mounts, and your custom list.</span></li>';

    var farm = topFarm();
    html += "<li>";
    if (farm) {
      var h = farmHeadline(farm);
      var extra = "";
      if (h && h.copper != null) {
        extra = " · " + fmtGoldCopper(h.copper) + (h.unit || "") + (h.kind ? " (" + h.kind + ")" : "");
      }
      html += '<button type="button" class="btn" id="dashOpenFarm" data-farm-id="' + escapeHtml(farm.id) + '">Top gold farm</button> ';
      html += "<strong>" + escapeHtml(farm.name) + "</strong>";
      if (farm.zone) html += '<span class="muted"> · ' + escapeHtml(farm.zone) + escapeHtml(extra) + "</span>";
    } else {
      html += '<button type="button" class="btn" data-dash-tab="gold">Gold farms</button> <span class="muted">No sourced farm ranked for this level yet.</span>';
    }
    html += "</li>";

    var up = cheapUpgrades();
    html += "<li>";
    html += '<button type="button" class="btn" data-dash-tab="items">Gear upgrades</button> ';
    if (up.kind === "empty") {
      html += '<span class="muted">No gear set on the paper doll yet — open Items &amp; Upgrades to add pieces. Scores are not guessed.</span>';
    } else if (up.kind === "list") {
      html += "<ul class=\"dash-upgrades\">";
      up.items.forEach(function (it) {
        html += "<li>" + escapeHtml(it.slot) + ": " + escapeHtml(it.name) + "</li>";
      });
      html += "</ul>";
    } else {
      html += '<span class="muted">Open the paper doll to compare scored upgrades. Nothing is listed here unless a score can be computed.</span>';
    }
    html += "</li></ul>";
    html += "</section>";
    return html;
  }

  function render() {
    var root = document.getElementById("dashboardRoot");
    if (!root) return;
    var html = "";
    html += renderXpCard();
    html += renderSessionCard();
    html += renderRouteCard();
    html += renderLinks();
    root.innerHTML = html;
    bind(root);
  }

  function bind(root) {
    var form = document.getElementById("dashXpForm");
    if (form) {
      form.addEventListener("change", function (e) {
        var t = e.target;
        if (t.name === "level") {
          setCharLevel(t.value);
          render();
        }
        if (t.name === "xp") {
          setXpCurrent(t.value);
          render();
          var again = document.querySelector('#dashXpForm [name="xp"]');
          if (again) again.focus();
        }
      });
    }
    var start = document.getElementById("dashStartSession");
    if (start) start.addEventListener("click", startSession);
    var stop = document.getElementById("dashStopSession");
    if (stop) stop.addEventListener("click", stopSession);
    var add = document.getElementById("dashAddXpForm");
    if (add) {
      add.addEventListener("submit", function (e) {
        e.preventDefault();
        addXpEntry(add.xp.value, add.note.value);
      });
    }
    root.addEventListener("click", function (e) {
      var tabBtn = e.target.closest("[data-dash-tab]");
      if (tabBtn && app() && app().showTab) {
        var tab = tabBtn.getAttribute("data-dash-tab");
        if (tab === "gold" && app().showTab) {
          app().showTab("gold");
          try { location.hash = "#gold-farms"; } catch (err) {}
        } else {
          app().showTab(tab);
        }
        return;
      }
      var done = e.target.closest(".dash-step-done");
      if (done && app() && app().markLevelingStep) {
        app().markLevelingStep(done.getAttribute("data-sid"), true);
        render();
        return;
      }
      var farmBtn = e.target.closest("#dashOpenFarm");
      if (farmBtn && app() && app().showTab) {
        app().showTab("gold");
        try { location.hash = "#gold-farms"; } catch (err) {}
      }
    });
  }

  window.ForeverDash = {
    render: render,
    sessionRate: sessionRate,
    remainingThisLevel: remainingThisLevel,
    remainingToSixty: remainingToSixty,
    xpToNext: xpToNext
  };
})();
