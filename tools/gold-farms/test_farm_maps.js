const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = "/workspace/wow-forever-mobmaps";
const PORT = 8785;
const OUT = path.join(ROOT, "screenshots", "farm-maps");
const puppeteer = require("/tmp/pptr/node_modules/puppeteer-core");

function mime(f) {
  const ext = path.extname(f).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json",
    ".png": "image/png",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".md": "text/markdown; charset=utf-8",
  })[ext] || "application/octet-stream";
}
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const file = path.normalize(path.join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "content-type": mime(file) });
    res.end(data);
  });
});

function fail(msg, extra) {
  console.error("FAIL:", msg, extra || "");
  process.exitCode = 1;
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function goldState() {
  return {
    character: { name: "Test", race: "Undead", class: "Hunter", spec: "Beast Mastery", level: 40 },
    goals: {}, customGoals: [],
    goldLog: [],
    professions: [], crafting: [], journal: [], notes: [],
    equipment: {}, customItems: [],
    talents: { class: "Hunter", mode: "forever", activeSpec: "primary", foreverPrimary: { trees: {} }, foreverSecondary: { trees: {} }, classic: { trees: {} } },
    savedTalentBuilds: [],
    itemFilters: { class: null, slots: {}, hidePvp: false }
  };
}

function loadExpected() {
  const t = fs.readFileSync(path.join(ROOT, "data/gold-farm-spawns.js"), "utf8");
  const m = t.match(/window\.GOLD_FARM_SPAWNS = (\{.*\});\s*$/s);
  if (!m) throw new Error("could not parse gold-farm-spawns.js");
  return JSON.parse(m[1]);
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

(async () => {
  const expectedFile = loadExpected();
  const farmIds = Object.keys(expectedFile.farms);
  if (farmIds.length !== 20) fail("expected 20 farms in data file", farmIds.length);

  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--window-size=1400,1600"],
    defaultViewport: { width: 1400, height: 1600 },
  });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    if (/api\.github\.com|raw\.githubusercontent\.com|cloudsave/i.test(u)) return req.abort();
    req.continue();
  });
  page.on("pageerror", (e) => console.error("PAGEERROR", e.message));

  const base = `http://127.0.0.1:${PORT}/index.html`;
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate((s) => {
    localStorage.setItem("wowForever.tracker.v1", JSON.stringify(s));
    localStorage.setItem("wowForever.goldSubtab", "farms");
    document.documentElement.classList.add("no-toast");
  }, goldState());
  await page.goto(base + "#gold-farms", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.reload({ waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(() => { const t = document.getElementById("toast"); if (t) t.style.display = "none"; });
  await page.waitForFunction(() => window.GoldFarms && GoldFarms.openMap, { timeout: 15000 });
  await sleep(200);

  const results = [];
  fs.mkdirSync(OUT, { recursive: true });

  for (const farmId of farmIds) {
    const expFarm = expectedFile.farms[farmId];
    const expMobs = expFarm.mobs || [];
    const expTotal = expMobs.reduce((n, m) => n + ((m.points && m.points.length) || 0), 0);

    await page.evaluate(() => { if (window.ForeverApp) ForeverApp.closeModal(); });
    await sleep(50);
    await page.evaluate((id) => GoldFarms.openMap(id), farmId);
    await page.waitForSelector("#gfFarmMap", { timeout: 10000 });
    await page.waitForFunction(() => {
      const n = document.querySelectorAll(".gf-map-marker").length;
      const canvas = document.getElementById("gfFarmMapCanvas");
      const img = document.getElementById("gfFarmMapArt");
      const artDone = !img || img.complete;
      return artDone && (n > 0 || (canvas && canvas.getAttribute("data-gf-drawn") != null));
    }, { timeout: 15000 });
    await sleep(300);

    const info = await page.evaluate((farmId) => {
      function parseRgb(s) {
        if (!s) return null;
        s = s.trim().toLowerCase();
        if (s.startsWith("#")) {
          const h = s.slice(1);
          if (h.length === 3) return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)];
          if (h.length >= 6) return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
        }
        const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
      }
      const rec = window.GOLD_FARM_SPAWNS && GOLD_FARM_SPAWNS.farms[farmId];
      const markers = [...document.querySelectorAll(".gf-map-marker")];
      const legendBtns = [...document.querySelectorAll("#gfFarmMapLegend [data-mob-index]")];
      const legend = legendBtns.map((btn) => {
        const i = Number(btn.getAttribute("data-mob-index"));
        const swatch = btn.querySelector(".gf-map-swatch");
        const cs = swatch && getComputedStyle(swatch).backgroundColor;
        return {
          index: i,
          name: (btn.querySelector(".gf-map-leg-name") || {}).textContent,
          countText: (btn.querySelector(".gf-map-leg-count") || {}).textContent,
          swatch: parseRgb(cs),
        };
      });
      const byMob = {};
      markers.forEach((el) => {
        const id = el.getAttribute("data-mob-id");
        const color = el.getAttribute("data-color");
        if (!byMob[id]) byMob[id] = { drawn: 0, color, index: Number(el.getAttribute("data-mob-index")) };
        byMob[id].drawn++;
      });
      const draw = window.GoldFarms && GoldFarms.lastMapDraw && GoldFarms.lastMapDraw();
      const canvas = document.getElementById("gfFarmMapCanvas");
      // Sample canvas for leftover heat of each mob color (heat is blended; dots are SVG).
      // Also verify SVG markers are actually in the visible stage (non-zero positions).
      const placed = markers.filter((el) => {
        const cx = Number(el.getAttribute("cx")), cy = Number(el.getAttribute("cy"));
        return Number.isFinite(cx) && Number.isFinite(cy) && cx > 0 && cy > 0;
      }).length;
      return {
        title: document.getElementById("gfFarmMapTitle") && document.getElementById("gfFarmMapTitle").textContent,
        zone: document.querySelector(".gf-map-zone") && document.querySelector(".gf-map-zone").textContent,
        markerCount: markers.length,
        placed,
        attrDrawn: canvas && canvas.getAttribute("data-gf-drawn"),
        legendCount: legend.length,
        legend,
        byMob,
        draw,
        canvasWH: canvas && [canvas.width, canvas.height],
        svgCount: document.querySelectorAll("#gfFarmMapMarkers circle").length,
        artAttr: canvas && canvas.getAttribute("data-gf-art"),
        artHidden: (function () {
          const img = document.getElementById("gfFarmMapArt");
          return !img || img.hidden || img.getAttribute("data-failed") === "1";
        })(),
        artSrc: (function () {
          const img = document.getElementById("gfFarmMapArt");
          return img ? img.getAttribute("src") : null;
        })(),
        artNatural: (function () {
          const img = document.getElementById("gfFarmMapArt");
          return img ? [img.naturalWidth, img.naturalHeight] : null;
        })(),
        hasArtClass: !!(document.getElementById("gfFarmMapStage") && document.getElementById("gfFarmMapStage").classList.contains("has-art")),
      };
    }, farmId);

    const mobRows = expMobs.map((m, i) => {
      const drawn = (info.byMob[String(m.id)] && info.byMob[String(m.id)].drawn) || 0;
      const exp = (m.points && m.points.length) || 0;
      const markerColor = info.byMob[String(m.id)] && info.byMob[String(m.id)].color;
      const leg = info.legend[i];
      const colorOk = !!(markerColor && leg && leg.swatch && markerColor.toLowerCase() ===
        ("#" + leg.swatch.map((n) => n.toString(16).padStart(2, "0")).join("")).toLowerCase());
      return {
        name: m.name, id: m.id, expected: exp, rendered: drawn,
        color: markerColor || null, legendSwatch: leg && leg.swatch, colorMatch: exp ? colorOk : true,
        legendText: leg && leg.countText,
      };
    });

    const renderedTotal = info.markerCount;
    const row = {
      id: farmId,
      title: info.title,
      zone: info.zone || expFarm.zone,
      expected: expTotal,
      rendered: renderedTotal,
      placed: info.placed,
      legendEntries: info.legendCount,
      expectedMobs: expMobs.length,
      mobs: mobRows,
      art: info.artAttr === "1" && !info.artHidden && info.hasArtClass,
      artSrc: info.artSrc,
      artNatural: info.artNatural,
      ok: true,
      issues: [],
    };
    if (!row.art) { row.ok = false; row.issues.push("zone map image not shown"); }
    if (!info.artNatural || info.artNatural[0] !== 1002 || info.artNatural[1] !== 668) {
      row.ok = false; row.issues.push("unexpected art size " + JSON.stringify(info.artNatural));
    }
    if (!info.artSrc || !/data\/zone-maps\/.+\.webp/.test(info.artSrc)) {
      row.ok = false; row.issues.push("unexpected art src " + info.artSrc);
    }
    if (renderedTotal === 0) { row.ok = false; row.issues.push("rendered 0 markers"); }
    if (renderedTotal < expTotal) { row.ok = false; row.issues.push("rendered " + renderedTotal + " < expected " + expTotal); }
    if (info.legendCount !== expMobs.length) { row.ok = false; row.issues.push("legend " + info.legendCount + " != " + expMobs.length + " mobs"); }
    if (info.placed !== renderedTotal) { row.ok = false; row.issues.push("unplaced markers " + (renderedTotal - info.placed)); }
    mobRows.forEach((m) => {
      if (m.expected && m.rendered === 0) { row.ok = false; row.issues.push(m.name + " rendered 0"); }
      if (m.rendered < m.expected) { row.ok = false; row.issues.push(m.name + " " + m.rendered + " < " + m.expected); }
      if (m.expected && !m.colorMatch) { row.ok = false; row.issues.push(m.name + " legend color mismatch " + m.color + " vs " + JSON.stringify(m.legendSwatch)); }
      if (m.expected && m.legendText && !m.legendText.includes(String(m.expected))) {
        row.ok = false; row.issues.push(m.name + " legend count text '" + m.legendText + "'");
      }
    });
    // Markers for mobs other than the first
    const later = mobRows.filter((m, i) => i > 0 && m.expected > 0);
    if (later.length) {
      const laterDrawn = later.every((m) => m.rendered === m.expected);
      if (!laterDrawn) { row.ok = false; row.issues.push("not all later mobs fully rendered"); }
      row.laterMobsOk = laterDrawn;
    }

    const shotName = farmId + ".png";
    const el = await page.$("#modal") || await page.$("#gfFarmMap");
    if (el) await el.screenshot({ path: path.join(OUT, shotName) });
    else await page.screenshot({ path: path.join(OUT, shotName), fullPage: false });
    row.screenshot = path.join(OUT, shotName);
    results.push(row);
    console.log(
      (row.ok ? "OK " : "BAD") + " " + farmId +
      " expected=" + expTotal + " rendered=" + renderedTotal +
      " legend=" + info.legendCount + "/" + expMobs.length +
      (row.issues.length ? " :: " + row.issues.join("; ") : "")
    );
  }

  // Must include Thousand Needles, Dustwallow, and Hinterlands shots
  const must = ["thousand-needles-sparkleshell", "thousand-needles-vortex", "dustwallow-mudrock", "hinterlands-owlbeasts"];
  must.forEach((id) => {
    const r = results.find((x) => x.id === id);
    if (!r || !fs.existsSync(r.screenshot) || fs.statSync(r.screenshot).size < 1000) {
      fail("required screenshot missing", id);
    }
  });
  const dust = results.find((r) => r.id === "dustwallow-mudrock");
  if (!dust || dust.expected !== 329 || dust.mobs.length !== 5) {
    fail("dustwallow-mudrock should be 329 points / 5 mobs", dust);
  }

  const tablePath = path.join(OUT, "counts.json");
  fs.writeFileSync(tablePath, JSON.stringify(results, null, 2));
  console.log("wrote", tablePath);

  // Representative desktop shot of Thousand Needles (the map the user called out).
  await page.evaluate(() => { if (window.ForeverApp) ForeverApp.closeModal(); });
  await sleep(80);
  await page.evaluate(() => GoldFarms.openMap("thousand-needles-sparkleshell"));
  await page.waitForSelector("#gfFarmMapArt");
  await page.waitForFunction(() => {
    const img = document.getElementById("gfFarmMapArt");
    return img && img.complete && img.naturalWidth === 1002 && document.querySelectorAll(".gf-map-marker").length > 0;
  }, { timeout: 15000 });
  await sleep(300);
  const desktopShot = path.join(ROOT, "screenshots", "gold-farm-map-desktop.png");
  const modal = await page.$("#modal") || await page.$("#gfFarmMap");
  if (modal) await modal.screenshot({ path: desktopShot });
  else await page.screenshot({ path: desktopShot });
  console.log("wrote", desktopShot);

  // Phone viewport: Thousand Needles, plus Dustwallow.
  const phone = await browser.newPage();
  await phone.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.setRequestInterception(true);
  phone.on("request", (req) => {
    const u = req.url();
    if (/api\.github\.com|raw\.githubusercontent\.com|cloudsave/i.test(u)) return req.abort();
    req.continue();
  });
  await phone.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
  await phone.evaluate((s) => {
    localStorage.setItem("wowForever.tracker.v1", JSON.stringify(s));
    localStorage.setItem("wowForever.goldSubtab", "farms");
    document.documentElement.classList.add("no-toast");
  }, goldState());
  await phone.goto(base + "#gold-farms", { waitUntil: "domcontentloaded", timeout: 60000 });
  await phone.reload({ waitUntil: "networkidle0", timeout: 60000 });
  await phone.evaluate(() => { const t = document.getElementById("toast"); if (t) t.style.display = "none"; });
  await phone.waitForFunction(() => window.GoldFarms && GoldFarms.openMap, { timeout: 15000 });
  await phone.evaluate(() => GoldFarms.openMap("thousand-needles-sparkleshell"));
  await phone.waitForFunction(() => {
    const img = document.getElementById("gfFarmMapArt");
    const n = document.querySelectorAll(".gf-map-marker").length;
    return img && !img.hidden && img.complete && img.naturalWidth === 1002 && n > 0;
  }, { timeout: 15000 });
  await sleep(400);
  const phoneShot = path.join(ROOT, "screenshots", "gold-farm-map-mobile.png");
  const phoneFarm = path.join(OUT, "thousand-needles-phone.png");
  await phone.screenshot({ path: phoneShot, fullPage: false });
  const phoneModal = await phone.$("#modal") || await phone.$("#gfFarmMap");
  if (phoneModal) await phoneModal.screenshot({ path: phoneFarm });
  else await phone.screenshot({ path: phoneFarm });
  console.log("wrote", phoneShot, phoneFarm);

  await phone.evaluate(() => { if (window.ForeverApp) ForeverApp.closeModal(); });
  await sleep(80);
  await phone.evaluate(() => GoldFarms.openMap("dustwallow-mudrock"));
  await phone.waitForFunction(() => {
    const img = document.getElementById("gfFarmMapArt");
    const n = document.querySelectorAll(".gf-map-marker").length;
    return img && !img.hidden && img.complete && img.naturalWidth === 1002 && n > 0;
  }, { timeout: 15000 });
  await sleep(300);
  const dustPhone = path.join(OUT, "dustwallow-phone.png");
  const dustModal = await phone.$("#modal") || await phone.$("#gfFarmMap");
  if (dustModal) await dustModal.screenshot({ path: dustPhone });
  else await phone.screenshot({ path: dustPhone });
  console.log("wrote", dustPhone);
  await phone.close();

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    fail(failed.length + " farm map(s) failed", failed.map((f) => f.id + ": " + f.issues.join("; ")).join(" | "));
  }

  await browser.close();
  server.close();
  if (process.exitCode) {
    console.error("TESTS FAILED");
    process.exit(process.exitCode);
  }
  console.log("ALL 20 FARM MAPS PASSED");
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
