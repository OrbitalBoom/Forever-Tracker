/* Lazy-loaded Classic random-suffix helpers. Data: data/items/suffixes.js */
(function () {
  var VERSION = "20261125h";
  var loading = null;
  var ready = false;

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
  function cacheUrl(path) {
    return path + (path.indexOf("?") >= 0 ? "&" : "?") + "v=" + VERSION;
  }

  function ensure() {
    if (ready && window.ITEM_SUFFIXES) return Promise.resolve(window.ITEM_SUFFIXES);
    if (loading) return loading;
    loading = loadScript(cacheUrl("data/items/suffixes.js")).then(function () {
      ready = true;
      loading = null;
      return window.ITEM_SUFFIXES;
    }).catch(function (err) {
      loading = null;
      throw err;
    });
    return loading;
  }

  function data() { return window.ITEM_SUFFIXES || null; }
  function prop(id) {
    var d = data();
    if (!d || id == null) return null;
    return d.props[String(id)] || d.props[id] || null;
  }
  function groupOf(item) {
    if (!item) return null;
    var g = item.suffixGroup != null ? item.suffixGroup : (item.suffix && item.suffix.group);
    return g != null ? g : null;
  }
  function rolls(groupId) {
    var d = data();
    if (!d || groupId == null) return [];
    var raw = d.groups[String(groupId)] || d.groups[groupId] || [];
    return raw.map(function (row) {
      var id = row[0], chance = row[1];
      var p = prop(id) || { n: "suffix " + id, s: {}, src: "classic" };
      return { id: id, name: p.n, stats: p.s || {}, effects: p.e || [], chance: chance, src: p.src || "classic" };
    });
  }
  function suffixCount(item) { return rolls(groupOf(item)).length; }
  function suffixStats(id) { var p = prop(id); return (p && p.s) || {}; }
  function suffixEffects(id) { var p = prop(id); return (p && p.e) || []; }

  function mergeStats(base, extra) {
    var out = {}, k;
    base = base || {};
    extra = extra || {};
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k) && typeof base[k] === "number") out[k] = base[k];
    for (k in extra) if (Object.prototype.hasOwnProperty.call(extra, k) && typeof extra[k] === "number") out[k] = (out[k] || 0) + extra[k];
    return out;
  }

  function displayName(item, suffixId) {
    var name = (item && item.name) || "";
    var p = prop(suffixId == null && item ? item.suffixId : suffixId);
    if (!p || !p.n) return name;
    if (name && name.toLowerCase().indexOf(p.n.toLowerCase()) !== -1) return name;
    return name ? (name + " " + p.n) : p.n;
  }

  var STAT_SHORT = {
    str: "Str", agi: "Agi", sta: "Sta", int: "Int", spi: "Spi", ap: "AP", rap: "RAP",
    crit: "Crit%", hit: "Hit%", spellCrit: "Spell Crit%", spellHit: "Spell Hit%",
    sp: "Spell Dmg", healing: "Healing", mp5: "Mp5", hp5: "Hp5", defense: "Defense",
    dodge: "Dodge%", parry: "Parry%", blockChance: "Block%", blockValue: "Block value",
    block: "Block", spFire: "Fire dmg", spFrost: "Frost dmg", spShadow: "Shadow dmg",
    spNature: "Nature dmg", spArcane: "Arcane dmg", spHoly: "Holy dmg"
  };
  var STAT_ORDER = ["str","agi","sta","int","spi","ap","rap","crit","hit","spellCrit","spellHit","sp","healing","mp5","hp5","defense","dodge","parry","blockChance","blockValue","block","spFire","spFrost","spShadow","spNature","spArcane","spHoly"];

  function formatSuffix(p) {
    if (!p) return "";
    var parts = [];
    STAT_ORDER.forEach(function (k) {
      if (p.s && p.s[k]) parts.push("+" + p.s[k] + " " + (STAT_SHORT[k] || k));
    });
    (p.e || p.effects || []).forEach(function (e) { parts.push(e); });
    var body = parts.join(" ");
    return p.n + (body ? ": " + body : "");
  }
  function formatRoll(roll) { return formatSuffix({ n: roll.name, s: roll.stats, e: roll.effects }); }

  function bestFor(item, scoreFn) {
    var list = rolls(groupOf(item));
    if (!list.length) return null;
    var best = null, bestScore = -Infinity, i, sc;
    for (i = 0; i < list.length; i++) {
      sc = scoreFn(item, list[i]);
      if (sc > bestScore) { bestScore = sc; best = list[i]; }
    }
    return best ? { roll: best, score: bestScore } : null;
  }

  var SUFFIX_PHRASE = /\bof (?:the )?[a-z']+\b/gi;
  function suffixIdsMatching(query) {
    var d = data();
    if (!d || !query) return [];
    var q = query.toLowerCase();
    var phrases = q.match(SUFFIX_PHRASE) || (q.indexOf("of ") === 0 ? [q] : []);
    if (!phrases.length) return [];
    var ids = [], id, p, n, i;
    for (id in d.props) {
      if (!Object.prototype.hasOwnProperty.call(d.props, id)) continue;
      p = d.props[id];
      n = (p.n || "").toLowerCase();
      for (i = 0; i < phrases.length; i++) {
        if (n === phrases[i] || n.indexOf(phrases[i]) !== -1) { ids.push(Number(id) || id); break; }
      }
    }
    return ids;
  }
  function itemMatchesSearch(item, query) {
    query = (query || "").trim().toLowerCase();
    if (!query) return false;
    var name = (item && item.name) || "";
    var matchName = (typeof window.itemNameMatches === "function")
      ? function (n, q) { return window.itemNameMatches(n, q); }
      : function (n, q) { return String(n || "").toLowerCase().replace(/['’`]/g, "").indexOf(String(q || "").toLowerCase().replace(/['’`]/g, "")) !== -1; };
    var ids = suffixIdsMatching(query);
    if (ids.length) {
      var base = query.replace(SUFFIX_PHRASE, " ").replace(/\s+/g, " ").trim();
      if (base && !matchName(name, base)) return false;
      var have = {};
      rolls(groupOf(item)).forEach(function (r) { have[r.id] = true; have[String(r.id)] = true; });
      return ids.some(function (id) { return have[id] || have[String(id)]; });
    }
    if (matchName(name, query)) return true;
    if (item && item.suffixId) {
      if (matchName(displayName(item, item.suffixId), query)) return true;
    }
    return false;
  }

  window.ItemSuffixes = {
    version: VERSION,
    ensure: ensure,
    prop: prop,
    groupOf: groupOf,
    rolls: rolls,
    count: suffixCount,
    stats: suffixStats,
    effects: suffixEffects,
    mergeStats: mergeStats,
    displayName: displayName,
    formatSuffix: formatSuffix,
    formatRoll: formatRoll,
    bestFor: bestFor,
    suffixIdsMatching: suffixIdsMatching,
    itemMatchesSearch: itemMatchesSearch
  };
})();
