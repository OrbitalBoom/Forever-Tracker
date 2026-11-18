/* Forever Tracker — optional cloud save to the save-data branch of the GitHub repo. */
(function () {
  "use strict";

  var OWNER = "OrbitalBoom";
  var REPO = "Forever-Tracker";
  var BRANCH = "save-data";
  var FILE_PATH = "save.json";
  var TOKEN_KEY = "wowForever.cloudSave.token";
  var DEBOUNCE_MS = 3000;
  var API = "https://api.github.com";
  var RAW = "https://raw.githubusercontent.com/" + OWNER + "/" + REPO + "/" + BRANCH + "/" + FILE_PATH;
  var TOKEN_RE = /token|secret|password|credential|github_pat|ghp_/i;

  var started = false;
  var timer = null;
  var dirty = false;
  var inFlight = false;
  var pending = false;
  var lastSha = null;
  var lastError = "";
  var status = "idle"; /* idle | saving | ok | error */
  var lastHttp = 0;

  function $(sel, root) { return (root || document).querySelector(sel); }

  function getToken() {
    try { return (localStorage.getItem(TOKEN_KEY) || "").trim(); } catch (e) { return ""; }
  }

  function setToken(value) {
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  function encodeBase64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function decodeBase64(b64) {
    var bin = atob(String(b64 || "").replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function formatTime(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    var opts = { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" };
    var now = new Date();
    var sameDay = d.toLocaleDateString("en-US", { timeZone: "America/New_York" }) ===
      now.toLocaleDateString("en-US", { timeZone: "America/New_York" });
    if (!sameDay) {
      opts.month = "short";
      opts.day = "numeric";
    }
    return d.toLocaleString("en-US", opts);
  }

  function shortErr(status, body) {
    if (!status) return "network";
    if (status === 401) return "bad token";
    if (status === 403) {
      try {
        var msg = (body && (body.message || body)) || "";
        if (/rate limit/i.test(String(msg))) return "rate limited";
      } catch (e) {}
      return "no permission";
    }
    if (status === 404) return "not found";
    if (status === 409) return "conflict";
    if (status === 422) return "could not save";
    return "HTTP " + status;
  }

  function setStatus(next, err) {
    status = next;
    if (err) lastError = err;
    else if (next !== "error") lastError = "";
    updatePill();
  }

  function updatePill() {
    var pill = $("#cloudSavePill");
    if (!pill) return;
    pill.classList.remove("is-ok", "is-saving", "is-error", "is-off");
    if (!getToken()) {
      pill.textContent = "Not connected";
      pill.classList.add("is-off");
      pill.title = "Click to connect cloud save";
      return;
    }
    if (status === "saving") {
      pill.textContent = "Saving…";
      pill.classList.add("is-saving");
      pill.title = "Saving your character to GitHub";
      return;
    }
    if (status === "error") {
      pill.textContent = "Error: " + (lastError || "could not save");
      pill.classList.add("is-error");
      pill.title = "Cloud save failed. Click for details.";
      return;
    }
    var when = (window.ForeverApp && window.ForeverApp.getState && window.ForeverApp.getState().savedAt) || null;
    if (when || status === "ok") {
      pill.textContent = "Saved to GitHub ✓ " + formatTime(when);
      pill.classList.add("is-ok");
      pill.title = "Saved to the save-data branch. Click to manage.";
      return;
    }
    pill.textContent = "Connected";
    pill.classList.add("is-ok");
    pill.title = "Cloud save is connected. Click to manage.";
  }

  function isSparse(s) {
    if (!s) return true;
    var c = s.character || {};
    if (c.name) return false;
    if ((s.goldLog || []).length) return false;
    if ((s.journal || []).length) return false;
    if ((s.notes || []).length) return false;
    if ((s.customGoals || []).length) return false;
    if ((s.professions || []).length) return false;
    if ((s.crafting || []).length) return false;
    if ((s.customItems || []).length) return false;
    if ((s.savedTalentBuilds || []).length) return false;
    if (s.goals && Object.keys(s.goals).length) return false;
    if (s.equipment && Object.keys(s.equipment).length) return false;
    var lv = s.leveling;
    if (lv && lv.progress && Object.keys(lv.progress).length) return false;
    var pg = s.profGuide;
    if (pg && ((pg.done && Object.keys(pg.done).length) || (pg.skill && Object.keys(pg.skill).length))) return false;
    return true;
  }

  function localTimestamp() {
    var s = window.ForeverApp && window.ForeverApp.getState ? window.ForeverApp.getState() : null;
    if (s && s.savedAt) {
      var t = Date.parse(s.savedAt);
      if (!isNaN(t)) return t;
    }
    if (isSparse(s)) return 0;
    return Date.now();
  }

  function remoteTimestamp(payload) {
    if (!payload || payload.missing) return 0;
    var raw = payload.savedAt || (payload.data && payload.data.savedAt);
    var t = Date.parse(raw || 0);
    return isNaN(t) ? 0 : t;
  }

  function collectExtra() {
    var extra = {};
    var storageKey = (window.ForeverApp && window.ForeverApp.STORAGE_KEY) || "wowForever.tracker.v1";
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (!k || k === storageKey || k === TOKEN_KEY) continue;
        if (TOKEN_RE.test(k)) continue;
        extra[k] = localStorage.getItem(k);
      }
    } catch (e) {}
    return extra;
  }

  function restoreExtra(extra) {
    if (!extra || typeof extra !== "object") return;
    var storageKey = (window.ForeverApp && window.ForeverApp.STORAGE_KEY) || "wowForever.tracker.v1";
    Object.keys(extra).forEach(function (k) {
      if (!k || k === storageKey || k === TOKEN_KEY || TOKEN_RE.test(k)) return;
      try { localStorage.setItem(k, extra[k]); } catch (e) {}
    });
  }

  function buildPayload() {
    var app = window.ForeverApp;
    var state = app && app.getState ? app.getState() : {};
    var data = {};
    Object.keys(state).forEach(function (k) {
      if (k === TOKEN_KEY || TOKEN_RE.test(k)) return;
      data[k] = state[k];
    });
    if (data && data.character) {
      /* never copy a token-shaped field if one is ever added later */
    }
    return {
      app: "Forever Tracker",
      version: 1,
      savedAt: state.savedAt || new Date().toISOString(),
      data: data,
      extra: collectExtra()
    };
  }

  function applyPayload(payload) {
    if (!payload || payload.missing) return;
    var data = payload.data || payload;
    if (window.ForeverApp && window.ForeverApp.applyLoadedState) {
      window.ForeverApp.applyLoadedState(data, payload.savedAt || data.savedAt);
    }
    restoreExtra(payload.extra);
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    var t = getToken();
    if (t) headers["Authorization"] = "Bearer " + t;
    if (opts.body) headers["Content-Type"] = "application/json";
    return fetch(API + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      keepalive: !!opts.keepalive
    });
  }

  function parseJsonSafe(r) {
    return r.text().then(function (text) {
      if (!text) return null;
      try { return JSON.parse(text); } catch (e) { return text; }
    });
  }

  function fetchRemoteApi() {
    var path = "/repos/" + OWNER + "/" + REPO + "/contents/" + FILE_PATH +
      "?ref=" + encodeURIComponent(BRANCH) + "&t=" + Date.now();
    return api(path).then(function (r) {
      lastHttp = r.status;
      if (r.status === 404) return { missing: true };
      return parseJsonSafe(r).then(function (j) {
        if (!r.ok) throw new Error(shortErr(r.status, j));
        if (j && j.sha) lastSha = j.sha;
        var raw = decodeBase64(j && j.content);
        return JSON.parse(raw);
      });
    });
  }

  function fetchRemoteRaw() {
    return fetch(RAW + "?t=" + Date.now(), { cache: "no-store" }).then(function (r) {
      lastHttp = r.status;
      if (r.status === 404) return { missing: true };
      if (!r.ok) throw new Error("network");
      return r.json();
    });
  }

  function ensureBranch() {
    return api("/repos/" + OWNER + "/" + REPO + "/git/ref/heads/" + BRANCH).then(function (r) {
      if (r.ok) return true;
      if (r.status !== 404) return parseJsonSafe(r).then(function (j) {
        throw new Error(shortErr(r.status, j));
      });
      return api("/repos/" + OWNER + "/" + REPO + "/git/ref/heads/main").then(function (m) {
        if (!m.ok) return parseJsonSafe(m).then(function (j) {
          throw new Error(shortErr(m.status, j));
        });
        return m.json().then(function (j) {
          var sha = j.object && j.object.sha;
          if (!sha) throw new Error("could not save");
          return api("/repos/" + OWNER + "/" + REPO + "/git/refs", {
            method: "POST",
            body: { ref: "refs/heads/" + BRANCH, sha: sha }
          }).then(function (c) {
            if (c.ok || c.status === 422) return true;
            return parseJsonSafe(c).then(function (body) {
              throw new Error(shortErr(c.status, body));
            });
          });
        });
      });
    });
  }

  function putSave(retry) {
    var payload = buildPayload();
    var body = {
      message: "Cloud save",
      content: encodeBase64(JSON.stringify(payload)),
      branch: BRANCH
    };
    if (lastSha) body.sha = lastSha;
    return api("/repos/" + OWNER + "/" + REPO + "/contents/" + FILE_PATH, {
      method: "PUT",
      body: body,
      keepalive: true
    }).then(function (r) {
      lastHttp = r.status;
      return parseJsonSafe(r).then(function (j) {
        if (r.ok) {
          if (j && j.content && j.content.sha) lastSha = j.content.sha;
          dirty = false;
          setStatus("ok");
          return true;
        }
        if (!retry && (r.status === 409 || r.status === 422)) {
          return fetchRemoteApi().catch(function () { return { missing: true }; }).then(function () {
            return putSave(true);
          });
        }
        throw new Error(shortErr(r.status, j));
      });
    });
  }

  function flush() {
    if (!getToken()) return Promise.resolve(false);
    if (inFlight) {
      pending = true;
      return inFlight;
    }
    setStatus("saving");
    inFlight = ensureBranch()
      .then(function () { return putSave(false); })
      .catch(function (e) {
        setStatus("error", (e && e.message) || "network");
        return false;
      })
      .then(function (ok) {
        inFlight = null;
        if (pending) {
          pending = false;
          return flush();
        }
        return !!ok;
      });
    return inFlight;
  }

  function flushNow() {
    if (!getToken()) return;
    if (!dirty && status !== "saving") return;
    if (timer) { clearTimeout(timer); timer = null; }
    flush();
  }

  function schedule() {
    if (!getToken()) {
      updatePill();
      return;
    }
    dirty = true;
    setStatus("saving");
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      flush();
    }, DEBOUNCE_MS);
  }

  function loadFromCloud() {
    var withToken = !!getToken();
    var req = withToken ? fetchRemoteApi() : fetchRemoteRaw();
    return req.then(function (payload) {
      if (!payload || payload.missing) {
        if (withToken && !isSparse(window.ForeverApp.getState())) schedule();
        else updatePill();
        return;
      }
      var rt = remoteTimestamp(payload);
      var lt = localTimestamp();
      if (rt > lt) {
        applyPayload(payload);
        if (withToken) setStatus("ok");
        else {
          updatePill();
          if (window.ForeverApp && window.ForeverApp.toast) {
            window.ForeverApp.toast("Restored your character from GitHub");
          }
        }
        return;
      }
      if (withToken && lt > rt) {
        schedule();
        return;
      }
      if (withToken) setStatus("ok");
      else updatePill();
    }).catch(function (e) {
      if (withToken) setStatus("error", (e && e.message) || "network");
      else updatePill();
    });
  }

  function modalHtml() {
    var connected = !!getToken();
    return (
      "<h3>Cloud save</h3>" +
      "<p>Your character is already saved in this browser automatically. Connect a GitHub token once, and Forever Tracker will also keep a copy in your repository so it comes back if this browser forgets it, or if you open the site on another computer.</p>" +
      (connected ? "<p class=\"muted\">A token is already saved in this browser. Paste a new one only if you want to replace it.</p>" : "") +
      "<form id=\"cloudSaveForm\" autocomplete=\"on\">" +
        "<label class=\"visually-hidden\">Username" +
          "<input type=\"text\" name=\"username\" value=\"Forever Tracker GitHub\" autocomplete=\"username\" tabindex=\"-1\">" +
        "</label>" +
        "<label class=\"field\">GitHub token" +
          "<input type=\"password\" id=\"cloudToken\" name=\"password\" autocomplete=\"current-password\" placeholder=\"github_pat_…\" spellcheck=\"false\">" +
        "</label>" +
        "<div class=\"row-actions\">" +
          "<button type=\"submit\" class=\"btn btn-primary\" id=\"cloudConnect\">Connect</button>" +
          "<button type=\"button\" class=\"btn\" id=\"cloudDisconnect\"" + (connected ? "" : " disabled") + ">Disconnect</button>" +
        "</div>" +
      "</form>" +
      "<h4>How to create a token</h4>" +
      "<ol class=\"cloud-steps\">" +
        "<li>Open <a href=\"https://github.com/settings/personal-access-tokens/new\" target=\"_blank\" rel=\"noopener\">GitHub’s fine-grained token page</a> (you need to be signed in).</li>" +
        "<li>Name it something like “Forever Tracker”, and set a long expiration.</li>" +
        "<li>Under <strong>Repository access</strong>, choose <strong>Only select repositories</strong> and pick <strong>Forever-Tracker</strong>.</li>" +
        "<li>Under <strong>Permissions</strong>, set <strong>Contents</strong> to <strong>Read and write</strong>. Leave everything else as it is.</li>" +
        "<li>Generate the token, copy it, paste it above, and click Connect.</li>" +
      "</ol>" +
      "<p class=\"muted\">The token stays in this browser only. It is never written into <code>save.json</code> or a backup file. The repository is public, so don’t put passwords or real-life personal information in your notes.</p>" +
      "<div class=\"cloud-backup\">" +
        "<h4>Backup file</h4>" +
        "<p class=\"muted\">Download or restore a JSON backup on this computer.</p>" +
        "<div class=\"row-actions\">" +
          "<button type=\"button\" class=\"btn\" id=\"btnExport\">Export JSON</button>" +
          "<button type=\"button\" class=\"btn\" id=\"btnImport\">Import JSON</button>" +
        "</div>" +
      "</div>" +
      "<div class=\"row-actions\" style=\"margin-top:16px\">" +
        "<button type=\"button\" class=\"btn\" data-close>Close</button>" +
      "</div>"
    );
  }

  function openCloudModal() {
    if (!window.ForeverApp || !window.ForeverApp.openModal) return;
    window.ForeverApp.openModal(modalHtml());
    var form = $("#cloudSaveForm");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        connect();
      });
    }
    var disc = $("#cloudDisconnect");
    if (disc) disc.addEventListener("click", disconnect);
    var exp = $("#btnExport");
    if (exp) exp.addEventListener("click", function () {
      if (window.ForeverApp && window.ForeverApp.exportData) window.ForeverApp.exportData();
    });
    var imp = $("#btnImport");
    if (imp) imp.addEventListener("click", function () {
      var f = $("#importFile");
      if (f) f.click();
    });
    var input = $("#cloudToken");
    if (input) setTimeout(function () { try { input.focus(); } catch (e) {} }, 0);
  }

  function connect() {
    var input = $("#cloudToken");
    var typed = (input && input.value || "").trim();
    var t = typed || getToken();
    if (!t) {
      if (window.ForeverApp && window.ForeverApp.toast) window.ForeverApp.toast("Paste a GitHub token first");
      return;
    }
    var previous = getToken();
    setToken(t);
    setStatus("saving");
    if (timer) { clearTimeout(timer); timer = null; }
    dirty = true;
    flush().then(function (ok) {
      if (ok) {
        if (input) input.value = "";
        if (window.ForeverApp && window.ForeverApp.toast) {
          window.ForeverApp.toast("Connected — your character will save to GitHub");
        }
        /* refresh the modal so Disconnect is enabled and the hint shows */
        if ($("#cloudSaveForm")) openCloudModal();
        return;
      }
      if (lastHttp === 401 || lastHttp === 403) {
        if (previous && previous !== t) setToken(previous);
        else setToken("");
        updatePill();
      }
    });
  }

  function disconnect() {
    setToken("");
    dirty = false;
    if (timer) { clearTimeout(timer); timer = null; }
    status = "idle";
    lastError = "";
    updatePill();
    if (window.ForeverApp && window.ForeverApp.toast) {
      window.ForeverApp.toast("Disconnected. This browser still has your character.");
    }
    if ($("#cloudSaveForm")) openCloudModal();
  }

  function bindPill() {
    var pill = $("#cloudSavePill");
    if (!pill || pill._bound) return;
    pill._bound = true;
    pill.addEventListener("click", openCloudModal);
  }

  function start() {
    if (started) return;
    started = true;
    bindPill();
    updatePill();
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") flushNow();
    });
    window.addEventListener("pagehide", flushNow);
    loadFromCloud();
  }

  window.CloudSave = {
    start: start,
    schedule: schedule,
    flush: flush,
    updatePill: updatePill,
    TOKEN_KEY: TOKEN_KEY
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
