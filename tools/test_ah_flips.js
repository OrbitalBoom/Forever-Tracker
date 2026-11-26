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

  const intro = await page.evaluate(() => {
    const gold = document.getElementById("gold-sub-flips") || document.body;
    const text = gold.innerText || "";
    const how = document.getElementById("ahFlipsHowTo");
    const status = document.getElementById("ahFlipsStatus");
    const det = document.getElementById("ahfHowPrices");
    const sort = document.getElementById("ahfSort");
    const opts = sort ? Array.from(sort.options).map((o) => o.textContent.trim()) : [];
    const hideLabel = (document.querySelector("label[for='ahfHideThin'], #ahfHideThin") &&
      (document.getElementById("ahfHideThin").closest("label") || {}).textContent) || "";
    const soldTh = Array.from(document.querySelectorAll("#ahFlipsTable thead th")).map((th) => th.textContent.trim());
    return {
      text,
      howText: (how && how.innerText) || "",
      howClosedDetails: !!(det && !det.open),
      detailsText: (det && det.innerText) || "",
      status: (status && status.textContent) || "",
      hasOldLede: /Items listed under their usual price/.test(text),
      hasGoblin: /Forever Goblin/.test(text),
      hasMinSold: !!document.getElementById("ahfMinSold"),
      soldColumn: soldTh.some((h) => /sold\/day/i.test(h)),
      soldCells: !!document.querySelector('#ahFlipsTable td[data-label="Sold/day"]'),
      hideLabel: hideLabel.replace(/\s+/g, " ").trim(),
      sortOpts: opts,
    };
  });
  if (intro.hasOldLede || intro.hasGoblin) fail("old always-visible intro or Goblin sale-rate copy is still showing", intro);
  else if (!/Set a minimum profit/.test(intro.howText) || !/Click a row/.test(intro.howText) ||
           !/cheapest buyout/.test(intro.howText) || !/confidence badge/.test(intro.howText)) {
    fail("How to use should be a short 4-step list of what the page actually does", intro.howText);
  } else ok("How to use list is visible and accurate");
  if (!/official Blizzard API/.test(intro.status) || !/Prices updated/.test(intro.status)) {
    fail("status line should cite the official Blizzard API and an update time", intro.status);
  } else ok("status line: " + intro.status.trim());
  if (!intro.howClosedDetails) fail("How prices work should start closed", intro.detailsText);
  else ok("How prices work expander is closed by default");

  await page.evaluate(() => {
    const el = document.getElementById("gold-sub-flips") || document.getElementById("ahFlipsHowTo");
    if (el) el.scrollIntoView({ block: "start" });
  });
  await sleep(150);
  await page.screenshot({ path: path.join(OUT, "desktop-ah-intro-closed.png") });
  ok("screenshot desktop-ah-intro-closed.png");

  await page.click("#ahfHowPrices > summary");
  await sleep(200);
  const opened = await page.evaluate(() => {
    const det = document.getElementById("ahfHowPrices");
    const body = (det && det.innerText) || "";
    return { open: !!(det && det.open), body };
  });
  if (!opened.open) fail("clicking How prices work should open the expander", opened);
  else if (!/official Blizzard/.test(opened.body) || !/no sale rates/.test(opened.body) ||
           !/5% auction house cut/.test(opened.body) || !/never invented/.test(opened.body)) {
    fail("How prices work should describe the official feed, missing sale rates, the 5% cut, and never-invented values", opened.body);
  } else ok("How prices work expander has accurate methodology");
  await page.screenshot({ path: path.join(OUT, "desktop-ah-intro-open.png") });
  ok("screenshot desktop-ah-intro-open.png");
  await page.click("#ahfHowPrices > summary");
  await sleep(150);

  const hasSold = await page.evaluate(() => !!(window.AhFlips && AhFlips.feedHasSoldRates && AhFlips.feedHasSoldRates()));
  if (hasSold) {
    if (!intro.hasMinSold || !intro.soldColumn) fail("sale rates are in the feed, so Min sold/day and the Sold/day column should show", intro);
    else ok("sale-rate filter and column are visible because the feed has sold/day");
  } else {
    if (intro.hasMinSold || intro.soldColumn || intro.soldCells) fail("no sale rates in the feed, so Min sold/day and Sold/day should be hidden", intro);
    else ok("Min sold/day and Sold/day column hidden (feed has no sale rates)");
    if (/sold\/day/i.test(intro.hideLabel) || !/fewer than 3 listed/.test(intro.hideLabel)) {
      fail("thin-listings label should only mention fewer than 3 listed", intro.hideLabel);
    } else ok("thin-listings label is “" + intro.hideLabel + "”");
    if (intro.sortOpts.some((o) => /sold\/day/i.test(o))) fail("Profit × sold/day sort should be hidden when the feed has no sale rates", intro.sortOpts);
    else ok("sort options without sale rates: " + intro.sortOpts.join(", "));
  }

  // Sparklines, steadiness estimate, and header sorting
  const trend = await page.evaluate(() => {
    const sparks = document.querySelectorAll("#ahFlipsTable svg.ahf-spark");
    const empty = document.querySelectorAll("#ahFlipsTable .ahf-spark-empty");
    const first = sparks[0];
    const badges = Array.from(document.querySelectorAll("#ahFlipsTable [data-ahf-steady]"));
    const levels = { steady: 0, jumpy: 0, new: 0 };
    badges.forEach((b) => { const k = b.getAttribute("data-ahf-steady"); if (levels[k] != null) levels[k]++; });
    const all = (window.AhFlips && AhFlips.allRows && AhFlips.allRows()) || [];
    const allLevels = { steady: 0, jumpy: 0, new: 0 };
    all.forEach((r) => { const k = r.steadyLevel || (r.steady && r.steady.level); if (allLevels[k] != null) allLevels[k]++; });
    const visible = (window.AhFlips && AhFlips.rows && AhFlips.rows()) || [];
    const visLevels = { steady: 0, jumpy: 0, new: 0 };
    visible.forEach((r) => { const k = r.steadyLevel || (r.steady && r.steady.level); if (visLevels[k] != null) visLevels[k]++; });
    const chk = document.getElementById("ahfSteadier");
    const sampleTip = (badges[0] && (badges[0].getAttribute("data-ahf-tip") || badges[0].getAttribute("title"))) || "";
    const profitTh = document.querySelector('#ahFlipsTable thead [data-ahf-sort="profit"]');
    return {
      sparkN: sparks.length,
      emptyN: empty.length,
      hasLine: !!(first && first.querySelector("polyline.ahf-spark-line")),
      hasUsual: !!(first && first.querySelector("line.ahf-spark-usual")),
      hasNow: !!(first && first.querySelector("circle.ahf-spark-now")),
      badgeN: badges.length,
      levels,
      allN: all.length,
      allLevels,
      visN: visible.length,
      visLevels,
      steadierChecked: !!(chk && chk.checked),
      sampleTip,
      profitAria: profitTh && profitTh.closest("th") && profitTh.closest("th").getAttribute("aria-sort"),
      sortValue: (document.getElementById("ahfSort") || {}).value || "",
    };
  });
  if (!trend.sparkN || !trend.hasLine || !trend.hasUsual || !trend.hasNow) {
    fail("rows should render a 7-day sparkline with usual and current marks when history exists", trend);
  } else ok("sparklines drawn in " + trend.sparkN + " rows (usual + current marked; " + trend.emptyN + " not enough history)");
  if (!trend.badgeN || !(trend.visLevels.steady + trend.visLevels.jumpy + trend.visLevels.new)) {
    fail("steadiness badges should be present", trend);
  } else {
    ok("visible flips: Steady " + trend.visLevels.steady + ", Jumpy " + trend.visLevels.jumpy + ", New " + trend.visLevels.new +
      " (all flips: " + trend.allLevels.steady + "/" + trend.allLevels.jumpy + "/" + trend.allLevels.new + " of " + trend.allN + ")");
  }
  if (trend.steadierChecked) fail("Steadier flips only should be off by default");
  else ok("Steadier flips only is off by default");
  if (!/not a sale rate/i.test(trend.sampleTip) || !/estimate/i.test(trend.sampleTip) || !/snapshot/i.test(trend.sampleTip)) {
    fail("steadiness tooltip should say it is an estimate from snapshots, not a sale rate", trend.sampleTip);
  } else ok("steadiness tooltip describes the estimate");
  if (trend.sortValue !== "profit" || trend.profitAria !== "descending") {
    fail("default test sort should be Est. profit, highest first, with aria-sort", trend);
  } else ok("Est. profit header is the active descending sort");

  const beforeFilter = trend.visN;
  await page.click("#ahfSteadier");
  await sleep(400);
  const filtered = await page.evaluate(() => {
    const badges = Array.from(document.querySelectorAll("#ahFlipsTable [data-ahf-steady]"));
    const levels = Array.from(new Set(badges.map((b) => b.getAttribute("data-ahf-steady"))));
    const chk = document.getElementById("ahfSteadier");
    return { n: badges.length, levels, checked: !!(chk && chk.checked) };
  });
  if (!filtered.checked) fail("Steadier flips only should check on");
  else if (!filtered.n) fail("steadier filter hid every flip — thresholds may be too strict", filtered);
  else if (filtered.levels.some((l) => l !== "steady") || filtered.n > beforeFilter) {
    fail("steadier filter should leave only Steady rows and fewer or equal of them", { beforeFilter, filtered });
  } else ok("Steadier flips only leaves " + filtered.n + " Steady rows (was " + beforeFilter + ")");
  await page.click("#ahfSteadier");
  await sleep(400);

  await page.click('button[data-ahf-sort="name"]');
  await sleep(300);
  const az = await page.evaluate(() => {
    const names = Array.from(document.querySelectorAll("#ahFlipsTable tbody tr[data-item-id] .item-name")).map((el) => el.textContent.trim());
    const th = document.querySelector('#ahFlipsTable thead [data-ahf-sort="name"]');
    return {
      names,
      aria: th && th.closest("th") && th.closest("th").getAttribute("aria-sort"),
      sortValue: (document.getElementById("ahfSort") || {}).value || "",
    };
  });
  const azSorted = az.names.slice().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  if (az.sortValue !== "name" || az.aria !== "ascending" || JSON.stringify(az.names) !== JSON.stringify(azSorted)) {
    fail("first click on Item should sort A–Z and sync the Sort dropdown", { aria: az.aria, sortValue: az.sortValue, first: az.names[0], last: az.names[az.names.length - 1] });
  } else ok("Item header sorts A–Z and the Sort dropdown follows");

  await page.click('button[data-ahf-sort="name"]');
  await sleep(300);
  const za = await page.evaluate(() => {
    const names = Array.from(document.querySelectorAll("#ahFlipsTable tbody tr[data-item-id] .item-name")).map((el) => el.textContent.trim());
    const th = document.querySelector('#ahFlipsTable thead [data-ahf-sort="name"]');
    return { names, aria: th && th.closest("th") && th.closest("th").getAttribute("aria-sort") };
  });
  const zaSorted = azSorted.slice().reverse();
  if (za.aria !== "descending" || JSON.stringify(za.names) !== JSON.stringify(zaSorted)) {
    fail("second click on Item should reverse to Z–A", { aria: za.aria, first: za.names[0], last: za.names[za.names.length - 1] });
  } else ok("second click reverses Item sort to Z–A");

  await page.click('button[data-ahf-sort="discount"]');
  await sleep(300);
  const disc1 = await page.evaluate(() => {
    const vals = Array.from(document.querySelectorAll('#ahFlipsTable td[data-label="Discount"]')).map((el) => parseFloat(el.textContent));
    const th = document.querySelector('#ahFlipsTable thead [data-ahf-sort="discount"]');
    return { vals, aria: th && th.closest("th") && th.closest("th").getAttribute("aria-sort") };
  });
  const discHighToLow = disc1.vals.every((v, i, arr) => i === 0 || arr[i - 1] + 1e-9 >= v);
  if (disc1.aria !== "descending" || !discHighToLow) fail("first click on Discount should sort highest first", disc1);
  else ok("Discount header sorts highest first");
  await page.click('button[data-ahf-sort="discount"]');
  await sleep(300);
  const disc2 = await page.evaluate(() => {
    const vals = Array.from(document.querySelectorAll('#ahFlipsTable td[data-label="Discount"]')).map((el) => parseFloat(el.textContent));
    const th = document.querySelector('#ahFlipsTable thead [data-ahf-sort="discount"]');
    return { vals, aria: th && th.closest("th") && th.closest("th").getAttribute("aria-sort") };
  });
  const discLowToHigh = disc2.vals.every((v, i, arr) => i === 0 || arr[i - 1] - 1e-9 <= v);
  if (disc2.aria !== "ascending" || !discLowToHigh) fail("second click on Discount should reverse", disc2);
  else ok("second click reverses Discount sort");

  await page.focus('button[data-ahf-sort="listed"]');
  await page.keyboard.press("Enter");
  await sleep(300);
  const listedKb = await page.evaluate(() => {
    const vals = Array.from(document.querySelectorAll('#ahFlipsTable td[data-label="Listed"]')).map((el) => parseInt(el.textContent.replace(/,/g, ""), 10));
    const th = document.querySelector('#ahFlipsTable thead [data-ahf-sort="listed"]');
    return { vals, aria: th && th.closest("th") && th.closest("th").getAttribute("aria-sort") };
  });
  const listedDesc = listedKb.vals.every((v, i, arr) => i === 0 || arr[i - 1] >= v);
  if (listedKb.aria !== "descending" || !listedDesc) fail("Enter on Listed should sort highest first", listedKb);
  else ok("Listed header is keyboard-sortable (Enter)");

  await page.select("#ahfSort", "profit");
  await sleep(300);
  const restored = await page.evaluate(() => ({
    sort: (document.getElementById("ahfSort") || {}).value || "",
    aria: (document.querySelector('#ahFlipsTable thead [data-ahf-sort="profit"]') || {}).closest &&
      document.querySelector('#ahFlipsTable thead [data-ahf-sort="profit"]').closest("th").getAttribute("aria-sort"),
  }));
  if (restored.sort !== "profit" || restored.aria !== "descending") fail("Sort dropdown should restore Est. profit, highest first", restored);
  else ok("Sort dropdown restores Est. profit descending");

  await page.evaluate(() => {
    const el = document.getElementById("gold-sub-flips") || document.getElementById("ahFlips");
    if (el) el.scrollIntoView({ block: "start" });
  });
  await sleep(150);
  await page.screenshot({ path: path.join(OUT, "desktop-ah-trend-list.png") });
  ok("screenshot desktop-ah-trend-list.png");

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

  // Hover a Low confidence badge — custom tooltip describes the rating
  const lowHover = await page.evaluate(() => {
    const badge = document.querySelector("#ahFlipsTable .ahf-conf-low");
    if (!badge) return { missing: true };
    const r = badge.getBoundingClientRect();
    badge.scrollIntoView({ block: "center" });
    return {
      missing: false,
      label: (badge.getAttribute("aria-label") || ""),
      title: badge.getAttribute("title") || "",
      text: (window.AhFlips && AhFlips.confidenceTip("low")) || "",
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
    };
  });
  if (lowHover.missing) fail("no Low confidence badge in the table");
  else if (!/fewer than 3 are listed/.test(lowHover.text) || !/official Blizzard feed/.test(lowHover.text)) {
    fail("Low tooltip text does not match the confidence() checks", lowHover.text);
  } else ok("Low tooltip text matches the code");
  if (lowHover.missing) {
    /* skip hover if no badge */
  } else {
    const badgeHandle = await page.$("#ahFlipsTable .ahf-conf-low");
    const box = await badgeHandle.boundingBox();
    /* Approach from the right so the pointer does not cross the item name. */
    await page.mouse.move(Math.min(1270, (box.x + box.width + 40)), box.y + box.height / 2);
    await sleep(80);
    await badgeHandle.hover();
    await sleep(250);
    const tip = await page.evaluate(() => {
      const el = document.getElementById("ahfConfTip");
      return {
        open: !!(el && !el.hidden),
        text: (el && el.textContent || "").trim(),
        titleCleared: !!(document.querySelector("#ahFlipsTable .ahf-conf-low") &&
          document.querySelector("#ahFlipsTable .ahf-conf-low").getAttribute("title") === ""),
      };
    });
    if (!tip.open || tip.text.indexOf("fewer than 3 are listed") === -1) {
      fail("hovering a Low badge should show the confidence tooltip", tip);
    } else ok("hovering a Low badge shows the tooltip");
    await page.screenshot({ path: path.join(OUT, "desktop-confidence-low.png") });
    ok("screenshot desktop-confidence-low.png");
    await page.mouse.move(0, 0);
    await sleep(200);
  }

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
      hasTrend: !!document.querySelector("#ahfDetailTrend .ahf-spark, #ahfDetailTrend .ahf-spark-empty"),
      hasTrendLine: !!document.querySelector("#ahfDetailTrend polyline.ahf-spark-line"),
      hasSteady: !!document.querySelector("#ahfDetailBody [data-ahf-steady]"),
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
  if (!panel.hasTrend || !panel.hasSteady) fail("detail panel should include a 7-day sparkline and a steadiness estimate", panel);
  else ok("detail panel shows a larger 7-day sparkline and steadiness" + (panel.hasTrendLine ? " (with a price line)" : " (not enough history)"));
  const panelConf = await page.evaluate(() => {
    const badge = document.querySelector("#ahfDetail .ahf-conf, #ahfDetailBody .ahf-conf");
    const tips = window.AhFlips && {
      low: AhFlips.confidenceTip("low"),
      medium: AhFlips.confidenceTip("medium"),
      high: AhFlips.confidenceTip("high"),
    };
    return {
      present: !!badge,
      aria: badge && badge.getAttribute("aria-label") || "",
      title: badge && badge.getAttribute("title") || "",
      tips: tips,
    };
  });
  if (!panelConf.present || !panelConf.aria || !panelConf.title) fail("detail panel confidence badge needs title and aria-label", panelConf);
  else if (!panelConf.tips || !/3–4 listing/.test(panelConf.tips.medium) || !/at least 5 are listed/.test(panelConf.tips.high)) {
    fail("Medium/High tooltip text does not match the confidence() checks", panelConf.tips);
  } else ok("detail panel badge has accessible confidence text; Medium/High copy matches the code");
  if (clicked.name && panel.title.indexOf(clicked.name) === -1) fail("panel title should include the item name", { clicked, panel });
  else ok("panel title is " + panel.title);

  await page.evaluate(() => {
    const el = document.getElementById("ahfDetail");
    if (el) el.scrollIntoView({ block: "start" });
  });
  await page.screenshot({ path: path.join(OUT, "desktop-ah-detail.png") });
  ok("screenshot desktop-ah-detail.png");
  await page.screenshot({ path: path.join(OUT, "desktop-ah-trend-detail.png") });
  ok("screenshot desktop-ah-trend-detail.png");

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
  await mobile.screenshot({ path: path.join(OUT, "mobile-390-ah-trend-list.png") });
  ok("screenshot mobile-390-ah-trend-list.png");

  await mobile.evaluate(() => {
    const el = document.getElementById("gold-sub-flips") || document.getElementById("ahFlipsHowTo");
    if (el) el.scrollIntoView({ block: "start" });
  });
  await sleep(150);
  const mobIntro = await mobile.evaluate(() => {
    const how = document.getElementById("ahFlipsHowTo");
    const det = document.getElementById("ahfHowPrices");
    const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    return {
      how: (how && how.innerText) || "",
      closed: !!(det && !det.open),
      hasMinSold: !!document.getElementById("ahfMinSold"),
      soldCol: !!document.querySelector('#ahFlipsTable td[data-label="Sold/day"], #ahFlipsTable th'),
      soldHeader: Array.from(document.querySelectorAll("#ahFlipsTable thead th")).some((th) => /sold\/day/i.test(th.textContent)),
      sw,
      cw: document.documentElement.clientWidth,
    };
  });
  if (!/Set a minimum profit/.test(mobIntro.how) || !mobIntro.closed) fail("390 should show How to use with How prices work closed", mobIntro);
  else ok("390 How to use is visible, expander closed");
  await mobile.screenshot({ path: path.join(OUT, "mobile-390-ah-intro-closed.png") });
  ok("screenshot mobile-390-ah-intro-closed.png");
  await mobile.click("#ahfHowPrices > summary");
  await sleep(200);
  const mobOpen = await mobile.evaluate(() => {
    const det = document.getElementById("ahfHowPrices");
    const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    return { open: !!(det && det.open), body: (det && det.innerText) || "", sw, cw: document.documentElement.clientWidth };
  });
  if (!mobOpen.open || !/official Blizzard/.test(mobOpen.body) || !/no sale rates/.test(mobOpen.body)) {
    fail("390 How prices work should open with accurate methodology", mobOpen);
  } else ok("390 How prices work expander opens");
  if (mobOpen.sw > mobOpen.cw + 1) fail("horizontal overflow 390 ah flips expander open", mobOpen);
  else ok("no overflow 390 ah flips expander open (" + mobOpen.sw + " / " + mobOpen.cw + ")");
  await mobile.screenshot({ path: path.join(OUT, "mobile-390-ah-intro-open.png") });
  ok("screenshot mobile-390-ah-intro-open.png");
  await mobile.click("#ahfHowPrices > summary");
  await sleep(150);

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
  await mobile.screenshot({ path: path.join(OUT, "mobile-390-ah-trend-detail.png") });
  ok("screenshot mobile-390-ah-trend-detail.png");

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
