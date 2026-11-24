const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = "/workspace/wow-forever-mobile";
const PORT = 8795;
const PHASE = process.env.MOBILE_PHASE || "after";
const OUT = path.join(ROOT, "screenshots", "mobile", PHASE === "desktop" ? "desktop" : PHASE);
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
    ".svg": "image/svg+xml",
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

let failed = 0;
const overflowFindings = [];
function fail(msg, extra) {
  failed++;
  console.error("FAIL:", msg, extra || "");
}
function ok(msg) { console.log("OK:", msg); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function goldState() {
  return {
    character: { name: "Test", race: "Undead", class: "Hunter", spec: "Beast Mastery", level: 40 },
    goals: {}, customGoals: [],
    goldLog: [
      { date: "2026-11-20", copper: 125000, note: "Farm" },
      { date: "2026-11-21", copper: 84000, note: "AH" },
    ],
    professions: [{ name: "Skinning", skill: 200 }, { name: "Leatherworking", skill: 180 }],
    crafting: [], journal: [], notes: [],
    equipment: {}, customItems: [],
    talents: { class: "Hunter", mode: "forever", activeSpec: "primary", foreverPrimary: { trees: {} }, foreverSecondary: { trees: {} }, classic: { trees: {} } },
    savedTalentBuilds: [],
    itemFilters: { class: null, slots: {}, hidePvp: false }
  };
}

const VIEWS = [
  { name: "360", width: 360, height: 740, mobile: true },
  { name: "iphone", width: 390, height: 844, mobile: true },
  { name: "tablet", width: 768, height: 1024, mobile: true },
];

const TABS = [
  { id: "character", label: "character" },
  { id: "goals", label: "goals" },
  { id: "gold", label: "gold-log", gold: "log" },
  { id: "gold", label: "gold-farms", gold: "farms" },
  { id: "gold", label: "gold-flips", gold: "flips" },
  { id: "professions", label: "professions" },
  { id: "notes", label: "notes" },
  { id: "items", label: "items-doll" },
  { id: "items", label: "items", itemsDb: true },
  { id: "leveling", label: "leveling" },
  { id: "talents", label: "talents" },
];

async function overflowInfo(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const vw = window.innerWidth;
    const sw = Math.max(doc.scrollWidth, body.scrollWidth);
    const offenders = [];
    const nodes = document.querySelectorAll("body *");
    for (const el of nodes) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.hidden || el.closest("[hidden]")) continue;
      const st = getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      // Allow elements inside a dedicated horizontal scroller
      const scroller = el.closest(".table-wrap, .tabs, .talent-trees, .idb-filters, .gf-pills");
      const right = r.left + r.width;
      if (right > vw + 1.5 && !scroller) {
        offenders.push({
          tag: el.tagName,
          id: el.id || "",
          cls: (el.className && String(el.className).slice(0, 80)) || "",
          right: Math.round(right),
          vw,
          w: Math.round(r.width),
        });
        if (offenders.length >= 8) break;
      }
    }
    return { vw, sw, overflow: sw > vw + 1, offenders };
  });
}

async function setupPage(page, base) {
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    if (/api\.github\.com|raw\.githubusercontent\.com|cloudsave/i.test(u)) return req.abort();
    req.continue();
  });
  page.on("pageerror", (e) => console.error("PAGEERROR", e.message));
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate((s) => {
    localStorage.setItem("wowForever.tracker.v1", JSON.stringify(s));
    localStorage.setItem("wowForever.goldSubtab", "log");
    document.documentElement.classList.add("no-toast");
  }, goldState());
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.reload({ waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(() => { const t = document.getElementById("toast"); if (t) t.style.display = "none"; });
  await page.waitForFunction(() => window.GoldFarms || document.querySelector(".tabs"), { timeout: 20000 });
}

async function showTab(page, tab) {
  await page.evaluate((t) => {
    const btn = document.querySelector('.tabs [data-tab="' + t.id + '"]');
    if (btn) btn.click();
    if (t.gold) {
      const g = document.querySelector('[data-gold-sub="' + t.gold + '"]');
      if (g) g.click();
    }
  }, tab);
  await page.evaluate(() => { if (window.ItemTooltip) ItemTooltip.hide(); });
  await sleep(200);
  if (tab.gold === "farms") {
    await page.waitForFunction(() => window.GoldFarms, { timeout: 15000 }).catch(() => {});
    const more = await page.$("#gfShowMore");
    if (more) { await more.click(); await sleep(80); }
  }
  if (tab.gold === "flips") {
    await page.waitForSelector("#ahFlipsTable, .ahf-filters", { timeout: 10000 }).catch(() => {});
    await page.evaluate(() => {
      const el = document.getElementById("ahFlipsTable") || document.querySelector(".ahf-meta");
      if (el) el.scrollIntoView({ block: "start" });
    });
    await sleep(150);
  }
  if (tab.id === "items") {
    await page.evaluate((openDb) => {
      const fold = document.getElementById("itemDatabase");
      if (fold) fold.open = !!openDb;
      window.scrollTo(0, 0);
    }, !!tab.itemsDb);
    if (tab.itemsDb) {
      const search = await page.$("#itemSearch");
      if (search) {
        await search.click({ clickCount: 3 });
        await page.keyboard.type("Elemental Air", { delay: 10 });
        await sleep(400);
      }
    }
  }
  if (tab.id === "talents") {
    await page.waitForSelector("#talentTrees .talent-tree, #talentTrees .talent", { timeout: 15000 }).catch(() => {});
    await sleep(200);
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
  const base = `http://127.0.0.1:${PORT}/index.html`;

  if (PHASE === "desktop") {
    const browser = await puppeteer.launch({
      executablePath: "/usr/bin/google-chrome",
      headless: "new",
      args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,900"],
      defaultViewport: { width: 1280, height: 900 },
    });
    const page = await browser.newPage();
    await setupPage(page, base);
    const shots = ["character", "goals", "gold", "items", "talents"];
    for (const id of shots) {
      await page.evaluate((id) => {
        const btn = document.querySelector('.tabs [data-tab="' + id + '"]');
        if (btn) btn.click();
      }, id);
      await sleep(250);
      if (id === "gold") {
        const farms = await page.$('[data-gold-sub="farms"]');
        if (farms) { await farms.click(); await sleep(300); }
        const more = await page.$("#gfShowMore");
        if (more) { await more.click(); await sleep(80); }
      }
      const file = path.join(OUT, "1280-" + id + ".png");
      await page.screenshot({ path: file, fullPage: false });
      console.log("desktop shot", file);
    }
    const ov = await overflowInfo(page);
    console.log("desktop overflow", ov.overflow, ov.sw, ov.vw);
    if (ov.overflow) fail("desktop unexpected overflow", ov);
    else ok("desktop 1280 no page overflow");
    await browser.close();
    server.close();
    if (failed) process.exit(1);
    console.log("RESULT: desktop screenshots ok");
    return;
  }

  const results = { phase: PHASE, views: {} };
  for (const view of VIEWS) {
    const browser = await puppeteer.launch({
      executablePath: "/usr/bin/google-chrome",
      headless: "new",
      args: ["--no-sandbox", "--disable-gpu", `--window-size=${view.width},${view.height}`],
    });
    const page = await browser.newPage();
    await page.emulate({
      viewport: { width: view.width, height: view.height, isMobile: true, hasTouch: true, deviceScaleFactor: 2, isLandscape: false },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    await setupPage(page, base);
    const viewRes = [];
    for (const tab of TABS) {
      await showTab(page, tab);
      const ov = await overflowInfo(page);
      const shot = path.join(OUT, view.name + "-" + tab.label + ".png");
      await page.screenshot({ path: shot, fullPage: false });
      const rec = { tab: tab.label, overflow: ov.overflow, sw: ov.sw, vw: ov.vw, offenders: ov.offenders, shot };
      viewRes.push(rec);
      const label = view.name + "/" + tab.label;
      if (ov.overflow) {
        overflowFindings.push(rec);
        if (PHASE === "after") fail("horizontal overflow " + label, { sw: ov.sw, vw: ov.vw, offenders: ov.offenders });
        else console.log("BEFORE overflow", label, ov.sw, ">", ov.vw, ov.offenders.slice(0, 3));
      } else {
        ok("no overflow " + label);
      }
    }

    // Cloud save modal
    await page.evaluate(() => {
      const pill = document.getElementById("cloudSavePill");
      if (pill) pill.click();
    });
    await sleep(250);
    const cloudShot = path.join(OUT, view.name + "-cloud.png");
    await page.screenshot({ path: cloudShot, fullPage: false });
    const cloudFit = await page.evaluate(() => {
      const m = document.querySelector("#modalBack .modal, #modal");
      const back = document.getElementById("modalBack");
      if (!m || (back && back.hidden)) return { open: false };
      const r = m.getBoundingClientRect();
      return {
        open: true,
        inView: r.left >= -1 && r.right <= window.innerWidth + 1 && r.top >= -1 && r.bottom <= window.innerHeight + 1,
        r: { x: r.x, y: r.y, w: r.width, h: r.height },
        vw: window.innerWidth,
        vh: window.innerHeight,
      };
    });
    console.log("cloud modal", view.name, cloudFit);
    if (PHASE === "after") {
      if (!cloudFit.open) fail("cloud modal did not open " + view.name);
      else if (!cloudFit.inView) fail("cloud modal does not fit viewport " + view.name, cloudFit);
      else ok("cloud modal fits " + view.name);
    }
    await page.evaluate(() => {
      const back = document.getElementById("modalBack");
      if (back) back.hidden = true;
    });

    // Spawn map modal (farms)
    await showTab(page, { id: "gold", label: "gold-farms", gold: "farms" });
    await sleep(200);
    const mapBtn = await page.$(".gf-map-btn, .gf-map-btn-wide");
    if (mapBtn) {
      await mapBtn.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await sleep(80);
      await mapBtn.click();
      await sleep(400);
      const mapShot = path.join(OUT, view.name + "-spawn-map.png");
      await page.screenshot({ path: mapShot, fullPage: false });
      const mapFit = await page.evaluate(() => {
        const m = document.querySelector("#modalBack .modal, #modal");
        const stage = document.getElementById("gfFarmMapStage");
        if (!m) return { open: false };
        const r = m.getBoundingClientRect();
        const s = stage ? stage.getBoundingClientRect() : null;
        return {
          open: true,
          inView: r.left >= -1 && r.right <= window.innerWidth + 1 && r.top >= -1 && r.bottom <= window.innerHeight + 2,
          r: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          stage: s ? { w: Math.round(s.width), h: Math.round(s.height), bottom: Math.round(s.bottom) } : null,
          vw: window.innerWidth,
          vh: window.innerHeight,
        };
      });
      console.log("spawn map", view.name, mapFit);
      if (PHASE === "after") {
        if (!mapFit.open) fail("spawn map modal did not open " + view.name);
        else if (!mapFit.inView) fail("spawn map modal does not fit viewport " + view.name, mapFit);
        else ok("spawn map fits " + view.name);
      }
      await page.evaluate(() => {
        const back = document.getElementById("modalBack");
        if (back) back.hidden = true;
      });
    } else if (PHASE === "after") {
      fail("no spawn map button " + view.name);
    }

    // Tooltip tap-pin (phone/tablet, after phase or always for shots)
    await showTab(page, { id: "gold", label: "gold-farms", gold: "farms" });
    await page.waitForFunction(() => {
      return document.querySelector('a.gf-item-link[data-item-id="7069"]');
    }, { timeout: 20000 }).catch(() => {});
    const air = await page.$('a.gf-item-link[data-item-id="7069"]');
    if (air) {
      await air.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await sleep(120);
      const box = await air.boundingBox();
      if (box) {
        // Touch tap
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await sleep(300);
        const tipShot = path.join(OUT, view.name + "-tooltip.png");
        await page.screenshot({ path: tipShot, fullPage: false });
        const tipFit = await page.evaluate(() => {
          const tip = document.getElementById("itemTooltip");
          if (!tip || tip.hidden) return { visible: false };
          const r = tip.getBoundingClientRect();
          const cs = getComputedStyle(tip);
          const close = tip.querySelector(".item-tt-close");
          const link = tip.querySelector("a.item-tt-db");
          return {
            visible: true,
            state: tip.getAttribute("data-tt-state") || "",
            pinned: tip.classList.contains("is-pinned"),
            sheet: tip.classList.contains("is-touch-sheet"),
            pointerEvents: cs.pointerEvents,
            inView: r.left >= -1 && r.right <= window.innerWidth + 1 && r.top >= -1 && r.bottom <= window.innerHeight + 1,
            r: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
            vw: window.innerWidth,
            vh: window.innerHeight,
            closeHidden: close ? !!close.hidden : true,
            hasLink: !!link,
            closeH: close ? close.getBoundingClientRect().height : 0,
          };
        });
        console.log("tooltip tap", view.name, tipFit);
        if (PHASE === "after") {
          if (!tipFit.visible || !tipFit.pinned) fail("tap did not pin tooltip " + view.name, tipFit);
          else if (!tipFit.inView) fail("pinned tooltip not within viewport " + view.name, tipFit);
          else ok("tooltip tap-pin stays in viewport " + view.name);
          if (tipFit.closeHidden) fail("close button not visible on pinned tooltip " + view.name);
          if (tipFit.pointerEvents !== "auto") fail("pinned tooltip not interactive " + view.name, tipFit.pointerEvents);
        }
        await page.evaluate(() => { if (window.ItemTooltip) ItemTooltip.hide(); });
      }
    } else if (PHASE === "after") {
      fail("no farm item link for tooltip " + view.name);
    }

    // Talent tree usable
    await showTab(page, { id: "talents", label: "talents" });
    const talentInfo = await page.evaluate(() => {
      const trees = document.getElementById("talentTrees");
      const tree = document.querySelector("#talentTrees .talent-tree");
      if (!trees || !tree) return { ok: false };
      const r = trees.getBoundingClientRect();
      const tr = tree.getBoundingClientRect();
      const talents = tree.querySelectorAll(".talent");
      const first = talents[0] && talents[0].getBoundingClientRect();
      return {
        ok: true,
        treeCount: document.querySelectorAll("#talentTrees .talent-tree").length,
        talentCount: talents.length,
        treesW: Math.round(r.width),
        treeW: Math.round(tr.width),
        vw: window.innerWidth,
        canScroll: trees.scrollWidth > trees.clientWidth + 1,
        firstTalent: first ? { w: Math.round(first.width), h: Math.round(first.height) } : null,
        fitsOrScrolls: tr.width <= window.innerWidth + 1 || trees.scrollWidth > trees.clientWidth,
      };
    });
    console.log("talents", view.name, talentInfo);
    await page.evaluate(() => {
      const el = document.getElementById("talentTrees");
      if (el) el.scrollIntoView({ block: "start" });
    });
    await sleep(150);
    const talentShot = path.join(OUT, view.name + "-talents-tree.png");
    await page.screenshot({ path: talentShot, fullPage: false });
    if (PHASE === "after") {
      if (!talentInfo.ok) fail("talent tree missing " + view.name);
      else if (!talentInfo.fitsOrScrolls) fail("talent tree neither fits nor scrolls " + view.name, talentInfo);
      else ok("talent tree usable " + view.name);
    }

    results.views[view.name] = viewRes;
    await browser.close();
  }

  const report = path.join(ROOT, "screenshots", "mobile", PHASE + "-report.json");
  fs.writeFileSync(report, JSON.stringify({ results, overflowFindings, failed }, null, 2));
  console.log("wrote", report, "overflows", overflowFindings.length);
  server.close();
  if (PHASE === "after" && failed) {
    console.error("RESULT: " + failed + " failure(s)");
    process.exit(1);
  }
  console.log("RESULT:", PHASE, "complete, failures=", failed);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
