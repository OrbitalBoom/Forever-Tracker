const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = process.env.FOREVER_ROOT || "/workspace/wow-forever-petrank";
const PORT = Number(process.env.FOREVER_PORT) || 8798;
const OUT = path.join(ROOT, "screenshots", "tip-lock");
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
    goldLog: [],
    professions: [], crafting: [], journal: [], notes: [],
    equipment: {}, customItems: [],
    talents: { class: "Hunter", mode: "forever", activeSpec: "primary", foreverPrimary: { trees: {} }, foreverSecondary: { trees: {} }, classic: { trees: {} } },
    savedTalentBuilds: [],
    itemFilters: { class: null, slots: {}, hidePvp: false }
  };
}

async function tipInfo(page) {
  return page.evaluate(() => {
    const tip = document.getElementById("itemTooltip");
    if (!tip || tip.hidden) return { visible: false, state: "hidden" };
    const cs = getComputedStyle(tip);
    const bar = tip.querySelector(".item-tt-dwell-bar");
    const link = tip.querySelector("a.item-tt-db");
    const close = tip.querySelector(".item-tt-close");
    const lockIcon = tip.querySelector(".item-tt-lock-icon");
    let barScale = null;
    if (bar) {
      const t = getComputedStyle(bar).transform;
      if (t && t !== "none") {
        const m = t.match(/matrix\(([^)]+)\)/);
        if (m) barScale = parseFloat(m[1].split(",")[0]);
      }
    }
    return {
      visible: true,
      state: tip.getAttribute("data-tt-state") || "",
      pinnedClass: tip.classList.contains("is-pinned"),
      lockedClass: tip.classList.contains("is-locked"),
      dwellingClass: tip.classList.contains("is-dwelling"),
      pointerEvents: cs.pointerEvents,
      hasDwell: !!tip.querySelector(".item-tt-dwell"),
      hasBar: !!bar,
      barScale,
      hasLink: !!link,
      linkHref: link ? link.getAttribute("href") : null,
      closeHidden: close ? !!close.hidden : true,
      lockHidden: lockIcon ? !!lockIcon.hidden : true,
      isPinned: !!(window.ItemTooltip && ItemTooltip.isPinned && ItemTooltip.isPinned()),
      isLocked: !!(window.ItemTooltip && ItemTooltip.isLocked && ItemTooltip.isLocked()),
      dwellMs: window.ItemTooltip && ItemTooltip.DWELL_MS,
      graceMs: window.ItemTooltip && ItemTooltip.LOCK_GRACE_MS,
      version: window.ItemTooltip && ItemTooltip.version,
      rect: { x: tip.getBoundingClientRect().x, y: tip.getBoundingClientRect().y, w: tip.getBoundingClientRect().width, h: tip.getBoundingClientRect().height },
    };
  });
}

async function openFarms(page, base) {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate((s) => {
    localStorage.setItem("wowForever.tracker.v1", JSON.stringify(s));
    localStorage.setItem("wowForever.goldSubtab", "farms");
    document.documentElement.classList.add("no-toast");
  }, goldState());
  await page.goto(base + "#gold-farms", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.reload({ waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(() => { const t = document.getElementById("toast"); if (t) t.style.display = "none"; });
  await page.waitForFunction(() => window.GoldFarms && window.ItemTooltip, { timeout: 15000 });
  await page.waitForSelector("#goldFarms", { timeout: 10000 });
  const more = await page.$("#gfShowMore");
  if (more) await more.click();
  await sleep(100);
  await page.waitForFunction(() => {
    return document.querySelector('a.gf-item-link[data-item-id="7069"][data-farm-id="arathi-thundering-exiles"]');
  }, { timeout: 20000 });
}

async function hoverAir(page) {
  const air = await page.$('a.gf-item-link[data-item-id="7069"][data-farm-id="arathi-thundering-exiles"]');
  if (!air) throw new Error("no Elemental Air handle");
  await air.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));
  await sleep(150);
  const box = await air.boundingBox();
  if (!box) throw new Error("no bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  return box;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--window-size=1400,1100"],
    defaultViewport: { width: 1400, height: 1100 },
  });
  const base = `http://127.0.0.1:${PORT}/index.html`;
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    if (/api\.github\.com|raw\.githubusercontent\.com|cloudsave/i.test(u)) return req.abort();
    req.continue();
  });
  page.on("pageerror", (e) => console.error("PAGEERROR", e.message));

  await openFarms(page, base);
  const ver = await page.evaluate(() => window.ItemTooltip && ItemTooltip.version);
  console.log("ItemTooltip.version", ver);
  if (ver !== "20261124g") fail("expected version 20261124g", ver);
  else ok("version " + ver);

  // --- 1. Hover shows tooltip ---
  await hoverAir(page);
  await page.waitForFunction(() => {
    const tip = document.getElementById("itemTooltip");
    return tip && !tip.hidden;
  }, { timeout: 5000 });
  let info = await tipInfo(page);
  console.log("after hover", { visible: info.visible, state: info.state, hasDwell: info.hasDwell, dwellMs: info.dwellMs });
  if (!info.visible) fail("tooltip did not show on hover");
  else ok("tooltip shows on hover");

  // --- 2. Timer animation element appears ---
  if (!info.hasDwell || !info.hasBar) fail("dwell timer element missing", info);
  else ok("timer animation element appears");
  if (info.state !== "dwelling" && !info.dwellingClass) {
    // may already be locked if something was slow; only fail if locked instantly
    if (info.state === "locked") fail("tooltip locked immediately, no dwell window", info);
    else fail("expected dwelling state after hover", info);
  } else ok("tooltip is dwelling (timer running)");
  if (info.dwellMs !== 1000) fail("DWELL_MS should be 1000", info.dwellMs);
  if (info.graceMs !== 250) fail("LOCK_GRACE_MS should be 250", info.graceMs);

  // Mid-timer: wait until bar is partially filled, then screenshot
  const midDeadline = Date.now() + 900;
  let mid = null;
  while (Date.now() < midDeadline) {
    mid = await tipInfo(page);
    if (mid.state === "locked") break;
    if (mid.visible && mid.barScale != null && mid.barScale > 0.55 && mid.barScale < 0.85) break;
    await sleep(40);
  }
  mid = mid || await tipInfo(page);
  console.log("mid-timer", { state: mid.state, barScale: mid.barScale, dwelling: mid.dwellingClass });
  await page.screenshot({ path: path.join(OUT, "mid-timer.png"), fullPage: false });
  ok("wrote mid-timer.png");
  if (mid.state === "locked") fail("mid-timer screenshot was already locked (timer too fast)");
  else if (!(mid.visible && mid.hasBar)) fail("mid-timer tooltip missing bar", mid);
  else ok("mid-timer captured while unlocked");

  // --- 3. Early leave cancels ---
  // Move away now, before lock, from this same hover if still dwelling; otherwise start a fresh one.
  if (mid.state === "locked") {
    await page.mouse.move(20, 20);
    await sleep(400);
    await page.evaluate(() => ItemTooltip.hide && ItemTooltip.hide());
    await hoverAir(page);
    await page.waitForFunction(() => {
      const tip = document.getElementById("itemTooltip");
      return tip && !tip.hidden && tip.getAttribute("data-tt-state") === "dwelling";
    }, { timeout: 5000 });
    await sleep(350);
  }
  // move far from item and tooltip
  await page.mouse.move(20, 20);
  await sleep(200);
  const cancelled = await tipInfo(page);
  console.log("early leave", cancelled);
  if (cancelled.visible) fail("early leave did not hide tooltip", cancelled);
  else ok("early leave cancels and hides tooltip");
  if (cancelled.isLocked || cancelled.lockedClass) fail("early leave left tooltip locked", cancelled);

  // --- 4. Lock happens after dwell ---
  await hoverAir(page);
  await page.waitForFunction(() => {
    const tip = document.getElementById("itemTooltip");
    return tip && !tip.hidden && tip.getAttribute("data-tt-state") === "locked";
  }, { timeout: 5000 });
  const locked = await tipInfo(page);
  console.log("locked", {
    state: locked.state, pointerEvents: locked.pointerEvents,
    pinnedClass: locked.pinnedClass, lockedClass: locked.lockedClass,
    closeHidden: locked.closeHidden, lockHidden: locked.lockHidden,
    isLocked: locked.isLocked, isPinned: locked.isPinned
  });
  if (!(locked.visible && locked.state === "locked" && locked.isLocked && locked.lockedClass && locked.pinnedClass)) {
    fail("tooltip did not lock after dwell", locked);
  } else ok("lock happens after dwell");
  if (locked.pointerEvents !== "auto") fail("locked tooltip should have pointer-events: auto", locked.pointerEvents);
  else ok("locked tooltip is interactive");
  if (locked.closeHidden) fail("close button should be visible when locked");
  else ok("close button visible");
  if (locked.lockHidden) fail("lock/pin icon should be visible when locked");
  else ok("lock icon visible");
  if (!locked.hasLink) fail("View in Items DB link missing");
  await page.screenshot({ path: path.join(OUT, "locked.png"), fullPage: false });
  ok("wrote locked.png");

  // --- 5. Mouse can move onto tooltip without it closing ---
  const tipBox = locked.rect;
  const ontoX = tipBox.x + Math.min(40, tipBox.w / 2);
  const ontoY = tipBox.y + Math.min(24, tipBox.h / 2);
  await page.mouse.move(ontoX, ontoY, { steps: 8 });
  await sleep(400); // longer than grace
  const onTip = await tipInfo(page);
  console.log("on tooltip", { visible: onTip.visible, state: onTip.state, isLocked: onTip.isLocked });
  if (!(onTip.visible && onTip.state === "locked")) fail("tooltip closed when moving onto it", onTip);
  else ok("mouse can move onto tooltip without it closing");

  // --- 6. Link inside is clickable ---
  const clickResult = await page.evaluate(() => {
    const tip = document.getElementById("itemTooltip");
    const link = tip && tip.querySelector("a.item-tt-db");
    if (!link) return { ok: false, reason: "no link" };
    const r = link.getBoundingClientRect();
    const x = r.x + r.width / 2;
    const y = r.y + r.height / 2;
    const top = document.elementFromPoint(x, y);
    const hit = !!(top && (top === link || link.contains(top) || top.closest && top.closest("a.item-tt-db")));
    link.click();
    return {
      ok: true,
      hit,
      x, y,
      hash: location.hash,
      topTag: top && top.tagName,
      topClass: top && top.className,
    };
  });
  console.log("link click", clickResult);
  if (!clickResult.ok) fail("could not click View in Items DB", clickResult);
  else if (!clickResult.hit) fail("elementFromPoint did not hit the DB link (not clickable)", clickResult);
  else ok("link inside is clickable (elementFromPoint hit)");
  await sleep(100);
  const afterClick = await page.evaluate(() => ({ hash: location.hash, tipHidden: !document.getElementById("itemTooltip") || document.getElementById("itemTooltip").hidden }));
  if (!/#item-7069/.test(afterClick.hash)) fail("clicking DB link did not navigate to #item-7069", afterClick);
  else ok("DB link navigation works (" + afterClick.hash + ")");

  // --- 7. Leaving a locked tooltip closes it ---
  // Reopen farms if the SPA moved us to the item page; the farms list may still be in DOM
  // but to be safe, go back to farms and hover again.
  await page.goto(base + "#gold-farms", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.evaluate(() => { const t = document.getElementById("toast"); if (t) t.style.display = "none"; });
  const more2 = await page.$("#gfShowMore");
  if (more2) await more2.click();
  await page.waitForFunction(() => {
    return document.querySelector('a.gf-item-link[data-item-id="7069"][data-farm-id="arathi-thundering-exiles"]');
  }, { timeout: 20000 });
  await hoverAir(page);
  await page.waitForFunction(() => {
    const tip = document.getElementById("itemTooltip");
    return tip && !tip.hidden && tip.getAttribute("data-tt-state") === "locked";
  }, { timeout: 5000 });
  await page.mouse.move(20, 20);
  await sleep(400);
  const left = await tipInfo(page);
  console.log("leave locked", left);
  if (left.visible) fail("leaving item and locked tooltip did not close it", left);
  else ok("leaving closes locked tooltip");

  await browser.close();
  server.close();
  if (failed) {
    console.error("\nRESULT: " + failed + " failure(s)");
    process.exit(1);
  }
  console.log("\nRESULT: all tip-lock tests passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
