const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = process.env.FOREVER_ROOT || "/workspace/wow-forever-ahinline";
const PORT = Number(process.env.FOREVER_PORT) || 8820;
const OUT = path.join(ROOT, "screenshots", "ahflips");
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
function fail(msg, extra) { failed++; console.error("FAIL:", msg, extra || ""); }
function ok(msg) { console.log("OK:", msg); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

const STATE = {
  character: { name: "Tracker", race: "Orc", class: "Hunter", spec: "Beast Mastery", level: 29 },
  goals: {}, customGoals: [], goldLog: [], professions: [], crafting: [], journal: [], notes: [],
  equipment: {}, customItems: [],
  talents: { class: "Hunter", mode: "forever", activeSpec: "primary", foreverPrimary: { trees: {} }, foreverSecondary: { trees: {} }, classic: { trees: {} } },
  savedTalentBuilds: [],
  hunterPet: { name: "Ash", familyId: 1, level: 29 },
  dashboard: { xpCurrent: null, sessions: [], activeSessionId: null },
  goldFlips: { minProfit: 0, minSold: 0, maxBuy: 0, category: "all", hideThin: false, showUnnamed: false, sort: "profit" }
};

async function overflow(page, label) {
  const r = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return { sw: Math.max(doc.scrollWidth, body.scrollWidth), cw: doc.clientWidth };
  });
  if (r.sw > r.cw + 1) fail("horizontal overflow " + label, r);
  else ok("no overflow " + label + " (" + r.sw + " / " + r.cw + ")");
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
  const base = `http://127.0.0.1:${PORT}/index.html`;
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,900"],
  });

  async function open(width, hash) {
    const page = await browser.newPage();
    if (width <= 400) {
      await page.emulate({
        viewport: { width, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      });
    } else {
      await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    }
    await page.goto(base + (hash || "#gold-flips"), { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluate((state) => {
      localStorage.setItem("wowForever.tracker.v1", JSON.stringify(state));
    }, STATE);
    await page.reload({ waitUntil: "networkidle0", timeout: 60000 });
    await page.goto(base + (hash || "#gold-flips"), { waitUntil: "networkidle0", timeout: 60000 });
    await sleep(500);
    return page;
  }

  const page = await open(1280, "#gold-flips");

  const boot = await page.evaluate(() => {
    const names = Array.from(document.querySelectorAll("#ahFlipsTable tbody tr td:first-child .item-name, #ahFlipsTable tbody tr td:first-child a"))
      .map((el) => el.textContent.trim());
    const placeholder = names.filter((n) => /^Item \d+$/.test(n));
    const info = window.AH_ITEM_META_INFO || {};
    const rows = (window.AhFlips && AhFlips.rows()) || [];
    const unnamedInRows = rows.filter((r) => AhFlips.isUnnamed(r));
    const tabItems = document.getElementById("tab-items");
    const tabGold = document.getElementById("tab-gold");
    return {
      table: !!document.getElementById("ahFlipsTable"),
      nNames: names.length,
      placeholderInView: placeholder.length,
      placeholderSample: placeholder.slice(0, 5),
      firstName: names[0] || "",
      namedOverlay: info.named,
      unnamedIds: (info.unnamed || []).length,
      missingFromIndex: info.missingFromIndex,
      priced: info.priced,
      flipRows: rows.length,
      unnamedFlipRows: unnamedInRows.length,
      goldActive: !!(tabGold && tabGold.classList.contains("active")),
      itemsActive: !!(tabItems && tabItems.classList.contains("active")),
      hasToggle: !!document.getElementById("ahfShowUnnamed"),
      meta: (document.getElementById("ahFlipsMeta") || {}).textContent || "",
      hasNamesFile: !!window.AH_ITEM_META,
    };
  });
  if (!boot.table || boot.nNames < 5) fail("AH flips table did not populate", boot);
  else ok("AH flips table populated (" + boot.nNames + " visible rows, " + boot.flipRows + " flip rows)");
  if (!boot.hasNamesFile || boot.namedOverlay !== 704 || boot.unnamedIds !== 208) {
    fail("expected 704 sourced names and 208 still-unnamed IDs", boot);
  } else ok("ItemSparse overlay named 704 of 912 missing IDs; 208 remain unnamed");
  if (boot.placeholderInView !== 0) fail("default list still shows Item NNNNNN placeholders", boot);
  else ok("default flip list has no “Item NNNNNN” placeholders");
  if (!boot.goldActive || boot.itemsActive) fail("should be on the Gold / flips tab", boot);
  else ok("Gold flips tab is active");
  if (!/hiding \d+ with no sourced name/.test(boot.meta)) fail("meta should mention hidden unnamed items", boot.meta);
  else ok("meta notes hidden unnamed items: " + boot.meta.trim());

  // Toggle shows unnamed IDs
  await page.click("#ahfShowUnnamed");
  await sleep(300);
  const shown = await page.evaluate(() => {
    const names = Array.from(document.querySelectorAll("#ahFlipsTable .item-name")).map((el) => el.textContent.trim());
    const placeholder = names.filter((n) => /^Item \d+$/.test(n));
    return { n: names.length, placeholder: placeholder.length, sample: placeholder.slice(0, 5) };
  });
  if (!shown.placeholder) fail("toggling Show unnamed should reveal Item ID rows", shown);
  else ok("Show unnamed reveals " + shown.placeholder + " Item ID rows (e.g. " + shown.sample.join(", ") + ")");

  // Turn it back off so the panel test uses a named item
  await page.click("#ahfShowUnnamed");
  await sleep(300);

  // Click first row — panel on this page, not Items tab
  const clicked = await page.evaluate(() => {
    const tr = document.querySelector("#ahFlipsTable tbody tr[data-item-id]");
    const name = tr && tr.querySelector(".item-name") && tr.querySelector(".item-name").textContent.trim();
    const id = tr && tr.getAttribute("data-item-id");
    if (tr) tr.click();
    return { name, id };
  });
  await sleep(400);
  const panel = await page.evaluate(() => {
    const back = document.getElementById("ahfDetailBack");
    const title = (document.getElementById("ahfDetailTitle") || {}).textContent || "";
    const body = (document.getElementById("ahfDetailBody") || {}).textContent || "";
    const tip = document.getElementById("ahfDetailTip");
    const gold = document.getElementById("tab-gold");
    const items = document.getElementById("tab-items");
    const open = document.querySelector("[data-ahf-open-items]");
    return {
      open: !!(back && !back.hidden),
      title: title.trim(),
      hasBuyout: /Cheapest buyout/.test(body),
      hasUsual: /Usual/.test(body),
      hasListed: /Listed/.test(body),
      hasTooltip: !!(tip && tip.querySelector(".item-tt-body, .item-tt-inner")),
      hasOpenInItems: !!(open && /Open in Items/.test(open.textContent)),
      goldActive: !!(gold && gold.classList.contains("active")),
      itemsActive: !!(items && items.classList.contains("active")),
      hash: location.hash,
    };
  });
  if (!panel.open) fail("clicking a row should open the inline detail panel", panel);
  else ok("inline detail panel opened for " + clicked.name);
  if (!panel.goldActive || panel.itemsActive || /^#item-/.test(panel.hash)) {
    fail("click should stay on AH Flips, not navigate to Items", panel);
  } else ok("click stayed on the Gold / flips page (" + panel.hash + ")");
  if (!panel.hasBuyout || !panel.hasUsual || !panel.hasListed || !panel.hasTooltip || !panel.hasOpenInItems) {
    fail("panel is missing expected sections", panel);
  } else ok("panel shows tooltip, prices, listed quantity, and Open in Items");
  if (clicked.name && panel.title.indexOf(clicked.name) === -1) fail("panel title should include the item name", { clicked, panel });
  else ok("panel title is " + panel.title);

  await page.evaluate(() => {
    const el = document.getElementById("ahfDetail");
    if (el) el.scrollIntoView({ block: "start" });
  });
  await page.screenshot({ path: path.join(OUT, "desktop-ah-detail.png") });
  ok("screenshot desktop-ah-detail.png");

  // Escape closes
  await page.keyboard.press("Escape");
  await sleep(200);
  const escClosed = await page.evaluate(() => {
    const back = document.getElementById("ahfDetailBack");
    return !back || back.hidden;
  });
  if (!escClosed) fail("Escape should close the panel");
  else ok("Escape closes the panel");

  // Re-open and click outside
  await page.click("#ahFlipsTable tbody tr[data-item-id]");
  await sleep(200);
  await page.evaluate(() => {
    const back = document.getElementById("ahfDetailBack");
    if (back) back.click();
  });
  await sleep(200);
  const outClosed = await page.evaluate(() => {
    const back = document.getElementById("ahfDetailBack");
    return !back || back.hidden;
  });
  if (!outClosed) fail("clicking the backdrop should close the panel");
  else ok("clicking outside closes the panel");

  await overflow(page, "desktop ah flips");
  await page.close();

  // Mobile 390
  const mobile = await open(390, "#gold-flips");
  const mob = await mobile.evaluate(() => {
    const names = Array.from(document.querySelectorAll("#ahFlipsTable .item-name")).map((el) => el.textContent.trim());
    const placeholder = names.filter((n) => /^Item \d+$/.test(n));
    const tr = document.querySelector("#ahFlipsTable tbody tr[data-item-id]");
    const display = tr ? getComputedStyle(tr).display : "";
    return { n: names.length, placeholder: placeholder.length, display, first: names[0] || "" };
  });
  if (!mob.n || mob.placeholder) fail("390 flips should be packed and named", mob);
  else ok("390 flips populated with named rows (" + mob.n + ", first=" + mob.first + ")");

  await mobile.evaluate(() => {
    const lead = document.getElementById("ahFlips") || document.getElementById("ahFlipsTable");
    if (lead) lead.scrollIntoView({ block: "start" });
  });
  await sleep(200);
  await overflow(mobile, "390 ah flips closed");
  await mobile.screenshot({ path: path.join(OUT, "mobile-390-ah-list.png") });
  ok("screenshot mobile-390-ah-list.png");

  await mobile.click("#ahFlipsTable tbody tr[data-item-id]");
  await sleep(400);
  const mobPanel = await mobile.evaluate(() => {
    const back = document.getElementById("ahfDetailBack");
    const dialog = document.getElementById("ahfDetail");
    const r = dialog && dialog.getBoundingClientRect();
    const close = dialog && dialog.querySelector(".ahf-detail-close");
    const ch = close && close.getBoundingClientRect().height;
    return {
      open: !!(back && !back.hidden),
      title: ((document.getElementById("ahfDetailTitle") || {}).textContent || "").trim(),
      itemsActive: !!(document.getElementById("tab-items") && document.getElementById("tab-items").classList.contains("active")),
      bottomSheet: !!(dialog && r && r.bottom > (window.innerHeight - 24)),
      closeH: ch || 0,
      vw: window.innerWidth,
    };
  });
  if (!mobPanel.open || mobPanel.itemsActive) fail("390 click should open a sheet on this page", mobPanel);
  else ok("390 bottom-sheet panel opened: " + mobPanel.title);
  if (mobPanel.closeH < 44) fail("390 close button should be at least 44px", mobPanel);
  else ok("390 close button is " + mobPanel.closeH + "px");
  await overflow(mobile, "390 ah flips with panel open");
  await mobile.screenshot({ path: path.join(OUT, "mobile-390-ah-detail.png") });
  ok("screenshot mobile-390-ah-detail.png");

  await mobile.keyboard.press("Escape");
  await sleep(200);

  await browser.close();
  server.close();
  if (failed) {
    console.error("FAILED:", failed, "checks");
    process.exit(1);
  }
  console.log("ALL AH FLIPS INLINE TESTS PASSED");
})().catch((e) => { console.error(e); process.exit(1); });
