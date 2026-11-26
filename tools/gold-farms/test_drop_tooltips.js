const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = process.env.FOREVER_ROOT || "/workspace/wow-forever-droptips";
const PORT = 8788;
const OUT = path.join(ROOT, "screenshots", "drop-tips");
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
  await page.waitForFunction(() => window.GoldFarms, { timeout: 15000 });
  // Only the top 5 farms are shown until "Show more" is clicked.
  await page.waitForSelector("#goldFarms", { timeout: 10000 });
  const more = await page.$("#gfShowMore");
  if (more) await more.click();
  await sleep(100);
  // Wait for ItemDB index so drop names become links.
  await page.waitForFunction(() => {
    return document.querySelector('a.gf-item-link[data-item-id="7069"][data-farm-id="arathi-thundering-exiles"]');
  }, { timeout: 20000 });
}

async function tipInfo(page) {
  return page.evaluate(() => {
    const tip = document.getElementById("itemTooltip");
    if (!tip || tip.hidden) return { visible: false };
    const text = tip.innerText || "";
    return {
      visible: true,
      pinned: tip.classList.contains("is-pinned"),
      hiddenClose: !!(tip.querySelector(".item-tt-close") && tip.querySelector(".item-tt-close").hidden),
      hasClose: !!tip.querySelector(".item-tt-close"),
      name: (tip.querySelector(".item-tt-name") || {}).textContent || "",
      text,
      hasMin: /min buyout/i.test(text),
      hasUsual: /usual \(market\)/i.test(text),
      hasListed: /listed/i.test(text),
      hasSold: /sold\/day/i.test(text),
      hasUpdated: /Updated /i.test(text),
      hasVendor: /Sell Price/i.test(text),
      hasStack: /Per stack of /i.test(text),
      hasTrend: /7-day/i.test(text),
      hasDbLink: !!tip.querySelector("a.item-tt-db"),
      hasFarm: !!tip.querySelector(".item-tt-farm"),
      farmText: (tip.querySelector(".item-tt-farm") && tip.querySelector(".item-tt-farm").innerText) || "",
    };
  });
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

  // ----- Desktop hover -----
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    if (/api\.github\.com|raw\.githubusercontent\.com|cloudsave/i.test(u)) return req.abort();
    req.continue();
  });
  page.on("pageerror", (e) => console.error("PAGEERROR", e.message));
  await openFarms(page, base);

  // Coverage check: every gf-item-link has a data-item-id; unmatched stay plain.
  const coverage = await page.evaluate(() => {
    const links = [...document.querySelectorAll("#goldFarms a.gf-item-link")];
    const air = links.filter((a) => a.getAttribute("data-item-id") === "7069");
    const unmatchedPlain = [...document.querySelectorAll("#goldFarms .gf-row-sub, #goldFarms .gf-loot, #goldFarms .gf-break")]
      .map((el) => el.textContent)
      .join(" | ");
    return {
      linkCount: links.length,
      airLinks: air.length,
      airText: air.map((a) => a.textContent),
      // sample of unmatched vendor-trash should not be links
      burningPitchIsLink: !!document.querySelector('#goldFarms a.gf-item-link[data-item-id="4787"]'),
    };
  });
  console.log("coverage", coverage);
  if (!coverage.airLinks) fail("Elemental Air link not found on desktop farms list", coverage);
  if (coverage.burningPitchIsLink) fail("Burning Pitch (not in item DB) should stay plain text");

  const air = await page.$('a.gf-item-link[data-item-id="7069"][data-farm-id="arathi-thundering-exiles"]');
  if (!air) { fail("no Elemental Air handle"); }
  await air.scrollIntoViewIfNeeded();
  await sleep(200);
  const box = await air.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => {
    const tip = document.getElementById("itemTooltip");
    return tip && !tip.hidden && /Elemental Air/i.test(tip.innerText || "");
  }, { timeout: 10000 });
  // history / stacks may arrive a beat later
  await page.waitForFunction(() => {
    const tip = document.getElementById("itemTooltip");
    const t = (tip && tip.innerText) || "";
    return /min buyout/i.test(t) && /usual \(market\)/i.test(t);
  }, { timeout: 8000 });
  await sleep(400);
  const hoverInfo = await tipInfo(page);
  console.log("hover", hoverInfo);
  if (!hoverInfo.visible) fail("tooltip not visible on hover");
  if (!/Elemental Air/i.test(hoverInfo.name)) fail("tooltip name", hoverInfo.name);
  const hasSoldInFeed = await page.evaluate(() => {
    const items = (window.PRICE_DATA && window.PRICE_DATA.items) || {};
    return Object.keys(items).some((k) => {
      const raw = items[k];
      return raw && raw.length > 3 && raw[3] != null && raw[3] !== "";
    });
  });
  const hoverKeys = ["hasMin","hasUsual","hasListed","hasUpdated","hasVendor","hasStack","hasTrend","hasDbLink"];
  if (hasSoldInFeed) hoverKeys.push("hasSold");
  hoverKeys.forEach((k) => {
    if (!hoverInfo[k]) fail("hover tooltip missing " + k, hoverInfo);
  });
  if (!hasSoldInFeed) console.log("OK: sold/day not required; official feed has no sale rates");
  if (!hoverInfo.hasFarm) fail("farm section missing on farm-context hover", hoverInfo);
  const farm = hoverInfo.farmText;
  if (!/Thundering Exiles/i.test(farm)) fail("farm title missing", farm);
  if (!/13%/.test(farm)) fail("expected 13% drop rate", farm);
  if (!/Thundering Exile/.test(farm)) fail("expected per-mob Thundering Exile", farm);
  if (!/~1 in 8 kills/i.test(farm)) fail("expected ~1 in 8 kills", farm);
  if (!/100 kills\/hour/i.test(farm) || !/~13 per hour/i.test(farm)) fail("expected 100 kph / ~13 per hour", farm);
  if (!/Classic drop data, may differ in Forever/i.test(farm)) fail("classic disclaimer missing", farm);
  if (!/guide source/i.test(farm) && !/ZugZugDB/i.test(farm)) fail("source missing", farm);
  await page.screenshot({ path: path.join(OUT, "elemental-air-thundering-desktop-hover.png"), fullPage: false });
  const tipHandle = await page.$("#itemTooltip");
  if (tipHandle) await tipHandle.screenshot({ path: path.join(OUT, "elemental-air-thundering-desktop-tooltip.png") });
  console.log("wrote desktop hover screenshots");

  // Click should pin
  await air.click();
  await sleep(200);
  const pinned = await tipInfo(page);
  console.log("pinned after click", { pinned: pinned.pinned, hiddenClose: pinned.hiddenClose });
  if (!pinned.pinned) fail("click did not pin tooltip");
  if (pinned.hiddenClose) fail("pinned tooltip should show close button");

  // Same item outside a farm context must not show the farm section.
  await page.evaluate(() => {
    if (window.ItemTooltip) {
      ItemTooltip.hide();
      ItemTooltip.show(7069, 420, 240);
    }
  });
  await page.waitForFunction(() => {
    const tip = document.getElementById("itemTooltip");
    return tip && !tip.hidden && /Elemental Air/i.test(tip.innerText || "");
  }, { timeout: 10000 });
  await sleep(300);
  const dbInfo = await tipInfo(page);
  console.log("non-farm tooltip farm?", dbInfo.hasFarm, dbInfo.farmText);
  if (dbInfo.hasFarm) fail("tooltip opened without a farm id must not include the farm drop section", dbInfo.farmText);

  await page.close();

  // ----- Phone tap -----
  const phone = await browser.newPage();
  await phone.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.setRequestInterception(true);
  phone.on("request", (req) => {
    const u = req.url();
    if (/api\.github\.com|raw\.githubusercontent\.com|cloudsave/i.test(u)) return req.abort();
    req.continue();
  });
  phone.on("pageerror", (e) => console.error("PHONE PAGEERROR", e.message));
  await openFarms(phone, base);
  const phoneAir = await phone.$('a.gf-item-link[data-item-id="7069"][data-farm-id="arathi-thundering-exiles"]');
  if (!phoneAir) fail("no Elemental Air link on phone");
  await phoneAir.scrollIntoViewIfNeeded();
  await sleep(250);
  const pbox = await phoneAir.boundingBox();
  await phone.touchscreen.tap(pbox.x + pbox.width / 2, pbox.y + pbox.height / 2);
  await phone.waitForFunction(() => {
    const tip = document.getElementById("itemTooltip");
    return tip && !tip.hidden && tip.classList.contains("is-pinned") && /Elemental Air/i.test(tip.innerText || "");
  }, { timeout: 10000 });
  await phone.waitForFunction(() => {
    const tip = document.getElementById("itemTooltip");
    const t = (tip && tip.innerText) || "";
    return /min buyout/i.test(t) && /Sell Price/i.test(t);
  }, { timeout: 8000 });
  await sleep(400);
  const tapInfo = await tipInfo(phone);
  console.log("tap", tapInfo);
  if (!tapInfo.visible || !tapInfo.pinned) fail("phone tap did not pin tooltip", tapInfo);
  if (tapInfo.hiddenClose) fail("phone pinned tooltip missing close button");
  ["hasMin","hasUsual","hasVendor","hasDbLink"].forEach((k) => {
    if (!tapInfo[k]) fail("phone tooltip missing " + k, tapInfo);
  });
  if (!tapInfo.hasFarm) fail("phone farm section missing", tapInfo);
  if (!/13%/.test(tapInfo.farmText) || !/~1 in 8 kills/i.test(tapInfo.farmText)) {
    fail("phone farm rate/kills missing", tapInfo.farmText);
  }
  if (!/Classic drop data, may differ in Forever/i.test(tapInfo.farmText)) fail("phone classic disclaimer missing");
  await phone.screenshot({ path: path.join(OUT, "elemental-air-thundering-phone-tap.png"), fullPage: false });
  const phoneTip = await phone.$("#itemTooltip");
  if (phoneTip) await phoneTip.screenshot({ path: path.join(OUT, "elemental-air-thundering-phone-tooltip.png") });
  console.log("wrote phone tap screenshots");

  await browser.close();
  server.close();
  if (process.exitCode) {
    console.error("TESTS FAILED");
    process.exit(process.exitCode);
  }
  console.log("DROP TOOLTIP TESTS PASSED");
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
