const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = process.env.FOREVER_ROOT || "/workspace/wow-forever-petrank";
const PORT = Number(process.env.FOREVER_PORT) || 8800;
const OUT = path.join(ROOT, "screenshots", "pets-dash");
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

const HUNTER_STATE = {
  character: { name: "Tracker", race: "Orc", class: "Hunter", spec: "Beast Mastery", level: 29 },
  goals: {}, customGoals: [], goldLog: [], professions: [],
  crafting: [], journal: [], notes: [], equipment: {}, customItems: [],
  talents: { class: "Hunter", mode: "forever", activeSpec: "primary", foreverPrimary: { trees: {} }, foreverSecondary: { trees: {} }, classic: { trees: {} } },
  savedTalentBuilds: [],
  leveling: { schema: 1, follow: true, race: "Orc", source: "combined", variant: "speedrun", hideDone: false, minLevel: 1, maxLevel: 60, byChar: {}, migrated: true },
  profGuide: {}, goldFarmFavs: [], goldFarmPrefs: {},
  itemFilters: { class: null, slots: {}, hidePvp: false },
  hunterPet: { name: "", familyId: null, level: null },
  dashboard: { xpCurrent: null, sessions: [], activeSessionId: null }
};

async function overflow(page, label) {
  const r = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      sw: Math.max(doc.scrollWidth, body.scrollWidth),
      cw: doc.clientWidth,
    };
  });
  if (r.sw > r.cw + 1) fail("horizontal overflow " + label, r);
  else ok("no overflow " + label + " (" + r.sw + " / " + r.cw + ")");
}

async function shot(page, name) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, name);
  try {
    await page.screenshot({ path: file, fullPage: true });
  } catch (e) {
    await page.screenshot({ path: file, fullPage: false });
  }
  ok("screenshot " + file);
  return file;
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
    await page.setViewport({ width, height: width <= 400 ? 844 : 900, deviceScaleFactor: 1 });
    if (width <= 400) {
      await page.emulate({
        viewport: { width, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      });
    }
    await page.goto(base + (hash || "#dashboard"), { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluate((state, key) => {
      localStorage.setItem(key, JSON.stringify(state));
    }, HUNTER_STATE, "wowForever.tracker.v1");
    await page.reload({ waitUntil: "networkidle0", timeout: 60000 });
    if (hash) await page.goto(base + hash, { waitUntil: "networkidle0", timeout: 60000 });
    await sleep(400);
    return page;
  }

  // ----- Desktop dashboard -----
  let page = await open(1280, "#dashboard");
  let dash = await page.evaluate(() => {
    const root = document.getElementById("dashboardRoot");
    const tab = document.getElementById("tab-dashboard");
    const need = document.getElementById("dashXpNeed");
    const remain = document.getElementById("dashXpRemain");
    const xph = document.getElementById("dashXph");
    const eta = document.getElementById("dashEtaNext");
    const src = (document.getElementById("dashXpSource") || {}).textContent || "";
    const steps = document.querySelectorAll(".dash-step").length;
    const firstTab = document.querySelector(".tabs [data-tab]");
    return {
      hasRoot: !!(root && root.innerText.length > 40),
      active: tab && tab.classList.contains("active"),
      need: need && need.textContent,
      remain: remain && remain.textContent,
      xph: xph && xph.textContent,
      eta: eta && eta.textContent,
      src,
      steps,
      firstTab: firstTab && firstTab.getAttribute("data-tab"),
      hasPetTalentsFlag: window.PETS_DATA && window.PETS_DATA.meta && window.PETS_DATA.meta.hasPetTalents,
      xp29: window.PETS_DATA && window.PETS_DATA.xpByLevel && window.PETS_DATA.xpByLevel["29"],
    };
  });
  if (!dash.hasRoot || !dash.active) fail("dashboard did not populate", dash);
  else ok("dashboard populated");
  if (dash.firstTab !== "dashboard") fail("dashboard should be first nav tab", dash.firstTab);
  else ok("dashboard is first nav tab");
  if (String(dash.need).replace(/,/g, "") !== "44300") fail("XP to next should be Forever 44300 for level 29", dash.need);
  else ok("XP to next level is 44,300 (Forever LevelExperience)");
  if (dash.remain !== "—" || dash.xph !== "—" || dash.eta !== "—") fail("pre-entry figures must be em dashes", dash);
  else ok("remaining / XP/hour / ETA are em dashes before user data");
  if (!/Forever/.test(dash.src) || !/LevelExperience/.test(dash.src)) fail("XP source citation missing", dash.src);
  else ok("XP table cited as Forever LevelExperience");
  if (dash.steps < 3) fail("expected at least 3 open route steps", dash.steps);
  else ok(dash.steps + " open route steps shown");
  if (dash.hasPetTalentsFlag) fail("PETS_DATA.meta.hasPetTalents should be false");
  else ok("Forever has no pet talents (data flag)");
  await overflow(page, "desktop dashboard");
  await shot(page, "desktop-dashboard.png");

  // Enter XP, start session, add XP — ETAs should appear
  await page.evaluate(() => {
    const form = document.getElementById("dashXpForm");
    form.xp.value = "10000";
    form.xp.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await sleep(200);
  await page.click("#dashStartSession");
  await sleep(200);
  // Pretend the session started 10 minutes ago so the rate is defined
  await page.evaluate(() => {
    const s = ForeverApp.getState();
    const ses = s.dashboard.sessions.find((x) => x.id === s.dashboard.activeSessionId);
    ses.startedAt = Date.now() - 10 * 60 * 1000;
    ForeverApp.save();
    const form = document.getElementById("dashAddXpForm");
    form.xp.value = "2000";
    form.note.value = "Test pulls";
    form.querySelector("button[type=submit]").click();
  });
  await sleep(300);
  let afterXp = await page.evaluate(() => {
    return {
      remain: document.getElementById("dashXpRemain").textContent,
      xph: document.getElementById("dashXph").textContent,
      eta: document.getElementById("dashEtaNext").textContent,
      eta60: document.getElementById("dashEta60").textContent,
      sessionXp: document.getElementById("dashSessionXp").textContent,
      state: JSON.parse(JSON.stringify({
        hunterPet: ForeverApp.getState().hunterPet,
        dashboard: ForeverApp.getState().dashboard,
      })),
    };
  });
  if (afterXp.remain.replace(/,/g, "") !== "34300") fail("remaining XP should be 44300-10000=34300", afterXp.remain);
  else ok("remaining XP is 34,300 after entering 10,000");
  if (afterXp.xph === "—" || afterXp.eta === "—" || afterXp.eta60 === "—") fail("rate and ETAs should be filled after session XP", afterXp);
  else ok("XP/hour and ETAs computed from session (" + afterXp.xph + "/hr, next " + afterXp.eta + ")");
  if (!/2,000|2000/.test(afterXp.sessionXp)) fail("session XP not shown", afterXp.sessionXp);
  else ok("session XP shown");

  // Mark first route step done, confirm leveling progress updates
  let stepSync = await page.evaluate(() => {
    const btn = document.querySelector(".dash-step-done");
    const sid = btn && btn.getAttribute("data-sid");
    const before = sid ? !!ForeverApp.levelingProgress().done[sid] : null;
    if (btn) btn.click();
    const after = sid ? !!ForeverApp.levelingProgress().done[sid] : null;
    const still = Array.prototype.some.call(document.querySelectorAll(".dash-step-done"), (b) => b.getAttribute("data-sid") === sid);
    return { sid, before, after, stillFirst: still };
  });
  if (!stepSync.sid || stepSync.before || !stepSync.after) fail("mark done did not sync with Routes", stepSync);
  else ok("mark done synced with levelingProgress (" + stepSync.sid + ")");
  if (stepSync.stillFirst) fail("marked step should leave the next-steps list", stepSync);
  else ok("marked step left the dashboard list");

  // Cloud-save payload keys
  let keys = await page.evaluate(() => {
    const s = ForeverApp.getState();
    return {
      hasPet: !!(s.hunterPet),
      hasDash: !!(s.dashboard),
      xpCurrent: s.dashboard && s.dashboard.xpCurrent,
      sessions: s.dashboard && s.dashboard.sessions && s.dashboard.sessions.length,
      payload: JSON.parse(localStorage.getItem("wowForever.tracker.v1") || "{}"),
    };
  });
  if (!keys.hasPet || !keys.hasDash) fail("getState missing hunterPet/dashboard", keys);
  else ok("getState includes hunterPet and dashboard");
  if (keys.payload.hunterPet == null || keys.payload.dashboard == null) fail("localStorage payload missing new keys", Object.keys(keys.payload));
  else ok("localStorage payload includes hunterPet and dashboard");
  if (keys.payload.dashboard.xpCurrent !== 10000) fail("dashboard.xpCurrent not persisted in payload", keys.payload.dashboard);
  else ok("dashboard.xpCurrent=10000 in saved payload");

  // Reload persistence (dashboard)
  await page.reload({ waitUntil: "networkidle0", timeout: 60000 });
  await page.goto(base + "#dashboard", { waitUntil: "networkidle0", timeout: 60000 });
  await sleep(400);
  let reloaded = await page.evaluate(() => {
    const s = ForeverApp.getState();
    return {
      xp: s.dashboard && s.dashboard.xpCurrent,
      sessions: (s.dashboard && s.dashboard.sessions) || [],
      remain: (document.getElementById("dashXpRemain") || {}).textContent,
      xph: (document.getElementById("dashXph") || {}).textContent,
      formXp: (document.querySelector('#dashXpForm [name="xp"]') || {}).value,
    };
  });
  if (reloaded.xp !== 10000 || reloaded.formXp !== "10000") fail("dashboard XP did not persist across reload", reloaded);
  else ok("dashboard XP persisted across reload");
  if (!reloaded.sessions.length || reloaded.xph === "—") fail("session did not persist across reload", reloaded);
  else ok("session and XP/hour persisted across reload");
  await page.close();

  // ----- Desktop pets -----
  page = await open(1280, "#pets");
  let pets = await page.evaluate(() => {
    const root = document.getElementById("petsRoot");
    const note = (document.getElementById("petTalentsNote") || {}).innerText || "";
    const families = document.querySelectorAll("details.pet-family").length;
    const names = Array.prototype.map.call(document.querySelectorAll(".pet-family-name"), (n) => n.textContent);
    const wolf = Array.prototype.find.call(document.querySelectorAll("details.pet-family"), (d) => d.getAttribute("data-family-id") === "1");
    if (wolf) wolf.open = true;
    const diet = wolf ? (wolf.querySelector(".pet-family-diet") || {}).textContent : "";
    const special = wolf ? (wolf.querySelector(".pet-family-special") || {}).textContent : "";
    const rows = wolf ? wolf.querySelectorAll("tbody tr").length : 0;
    const tames = document.querySelectorAll("#petTameTable tbody tr").length;
    const loy = document.querySelectorAll("#petLoyalty tbody tr").length;
    const bite = document.querySelector('[data-pet-ability="17253"]');
    return {
      textLen: root ? root.innerText.length : 0,
      note,
      families,
      names,
      diet,
      special,
      rows,
      tames,
      loy,
      hasBite: !!bite,
      hasFox: names.indexOf("Fox") !== -1,
      hasCore: names.indexOf("Core Hound") !== -1,
      noTalents: /no pet talent/i.test(note) && /training points/i.test(note) && /loyalty/i.test(note),
    };
  });
  if (pets.families < 17) fail("expected classic + Forever families", pets);
  else ok(pets.families + " pet families populated");
  if (!pets.hasFox || !pets.hasCore) fail("Forever-only Fox/Core Hound missing", pets.names);
  else ok("Forever-only families Fox and Core Hound listed");
  if (!/Meat/.test(pets.diet)) fail("Wolf diet missing", pets.diet);
  else ok("Wolf diet: " + pets.diet);
  if (!/Furious Howl/.test(pets.special)) fail("Wolf special should be Furious Howl", pets.special);
  else ok("Wolf special is Furious Howl");
  if (pets.rows < 8) fail("Wolf ability ranks missing", pets.rows);
  else ok("Wolf ability ranks listed (" + pets.rows + " rows)");
  if (pets.tames < 10) fail("notable tame list too small", pets.tames);
  else ok("Where to tame has " + pets.tames + " sourced beasts");
  if (pets.loy < 6) fail("loyalty ranks missing", pets.loy);
  else ok("loyalty ranks 1–6 shown");
  if (!pets.noTalents) fail("page should say Forever has no pet talents and explain training points/loyalty", pets.note);
  else ok("no-pet-talents message present");

  // Tooltip (desktop hover/showTip)
  const tip = await page.evaluate(() => {
    const btn = document.querySelector('[data-pet-ability="17253"]');
    if (!btn || !window.ForeverPets) return { ok: false };
    const ab = ForeverPets.findAbility(17253);
    ForeverPets.showTip(btn, ab, false);
    const el = document.getElementById("petAbilityTip");
    return {
      ok: !!(el && !el.hidden),
      text: el ? el.innerText : "",
      name: ab && ab.name,
      rank: ab && ab.rank,
      level: ab && ab.level,
      tp: ab && ab.trainingPoints,
    };
  });
  if (!tip.ok || !/Bite/.test(tip.text) || !/Rank/.test(tip.text)) fail("pet ability tooltip failed", tip);
  else ok("pet ability tooltip shows Bite rank/level style");
  if (tip.level !== 1 || tip.tp !== 1) fail("Bite R1 should be level 1, 1 TP (client data)", tip);
  else ok("Bite R1 is level 1, 1 training point");
  await shot(page, "desktop-pets-tooltip.png");
  await page.evaluate(() => ForeverPets.hideTip(true));

  // Current pet save
  await page.evaluate(() => {
    const form = document.getElementById("petCurrentForm");
    form.name.value = "Ash";
    form.name.dispatchEvent(new Event("input", { bubbles: true }));
    form.family.value = "1";
    form.family.dispatchEvent(new Event("input", { bubbles: true }));
    form.level.value = "29";
    form.level.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await sleep(200);
  let petSave = await page.evaluate(() => {
    const s = ForeverApp.getState();
    const raw = JSON.parse(localStorage.getItem("wowForever.tracker.v1") || "{}");
    return { state: s.hunterPet, raw: raw.hunterPet };
  });
  if (!petSave.state || petSave.state.name !== "Ash" || petSave.state.familyId !== 1 || petSave.state.level !== 29) {
    fail("hunterPet not saved", petSave);
  } else ok("current pet saved to state (Ash, Wolf, 29)");
  if (!petSave.raw || petSave.raw.name !== "Ash") fail("hunterPet missing from storage payload", petSave.raw);
  else ok("cloud/local payload includes hunterPet");

  await overflow(page, "desktop pets");
  await shot(page, "desktop-pets.png");

  // Spawn map if a button exists
  const mapClicked = await page.evaluate(() => {
    const btn = document.querySelector("[data-pet-map]");
    if (!btn) return false;
    btn.scrollIntoView({ block: "center" });
    btn.click();
    return true;
  });
  await sleep(800);
  if (mapClicked) {
    const map = await page.evaluate(() => {
      const modal = document.getElementById("gfFarmMap");
      const canvas = document.getElementById("gfFarmMapCanvas");
      const title = (document.getElementById("gfFarmMapTitle") || {}).textContent;
      const note = ((document.querySelector("#gfFarmMap .gf-map-note") || {}).textContent || "");
      return { open: !!modal, hasCanvas: !!canvas, title, classic: /Classic data, may differ in Forever/.test(note) };
    });
    if (!map.open) fail("spawn map modal did not open", map);
    else ok("spawn map modal opened (" + map.title + ")");
    if (!map.classic) fail("map missing Classic disclaimer", map);
    else ok("map labeled Classic data, may differ in Forever");
    await shot(page, "desktop-pets-map.png");
    await page.evaluate(() => { if (window.ForeverApp) ForeverApp.closeModal(); });
  } else {
    fail("no spawn map button on notable tames");
  }
  await page.close();

  // Reload pet persistence on a fresh page
  page = await open(1280, "#pets");
  // open() writes HUNTER_STATE via evaluateOnNewDocument, which would wipe the previous save
  // if we use open(). Instead navigate without resetting storage? The previous page closed
  // but storage is per browser profile and evaluateOnNewDocument in open() resets it.
  // Re-do: set storage after landing, then reload once with the saved pet already applied below.
  await page.evaluate(() => {
    const s = ForeverApp.getState();
    s.hunterPet = { name: "Ash", familyId: 1, level: 29 };
    ForeverApp.save();
  });
  await page.reload({ waitUntil: "networkidle0", timeout: 60000 });
  await page.goto(base + "#pets", { waitUntil: "networkidle0", timeout: 60000 });
  await sleep(400);
  let petReload = await page.evaluate(() => {
    const form = document.getElementById("petCurrentForm");
    const s = ForeverApp.getState().hunterPet;
    return {
      name: form && form.name.value,
      family: form && form.family.value,
      level: form && form.level.value,
      state: s,
    };
  });
  if (petReload.name !== "Ash" || petReload.family !== "1" || petReload.level !== "29") {
    fail("current pet did not persist across reload", petReload);
  } else ok("current pet persisted across reload");
  await page.close();

  // ----- 390px pets + dashboard -----
  page = await open(390, "#pets");
  // restore pet so the form is interesting
  await page.evaluate(() => {
    const s = ForeverApp.getState();
    s.hunterPet = { name: "Ash", familyId: 1, level: 29 };
    ForeverApp.save();
    if (window.ForeverPets) ForeverPets.render();
  });
  await sleep(200);
  await overflow(page, "390 pets");
  // tap tooltip (pin / sheet)
  await page.evaluate(() => {
    const wolf = document.querySelector('details.pet-family[data-family-id="1"]');
    if (wolf) wolf.open = true;
  });
  await sleep(100);
  const mobileTip = await page.evaluate(() => {
    const btn = document.querySelector('[data-pet-ability="17253"]');
    if (!btn) return { ok: false, reason: "no bite btn" };
    btn.click();
    const el = document.getElementById("petAbilityTip");
    return {
      ok: !!(el && !el.hidden),
      sheet: el && el.classList.contains("is-touch-sheet"),
      pinned: el && el.classList.contains("is-pinned"),
      text: el ? el.innerText : "",
    };
  });
  if (!mobileTip.ok || !/Bite/.test(mobileTip.text)) fail("390px pet tooltip failed", mobileTip);
  else ok("390px pet tooltip works (sheet=" + mobileTip.sheet + ")");
  await shot(page, "mobile-390-pets.png");
  await page.evaluate(() => ForeverPets.hideTip(true));

  await page.evaluate(() => { if (window.ForeverApp) ForeverApp.showTab("dashboard"); });
  await sleep(300);
  const mobDash = await page.evaluate(() => {
    const tab = document.getElementById("tab-dashboard");
    return {
      active: tab && tab.classList.contains("active"),
      need: (document.getElementById("dashXpNeed") || {}).textContent,
      remain: (document.getElementById("dashXpRemain") || {}).textContent,
    };
  });
  if (!mobDash.active || String(mobDash.need).replace(/,/g, "") !== "44300") fail("390 dashboard failed", mobDash);
  else ok("390 dashboard populated (XP to next " + mobDash.need + ")");
  await overflow(page, "390 dashboard");
  await shot(page, "mobile-390-dashboard.png");
  await page.close();

  await browser.close();
  server.close();
  if (failed) {
    console.error("FAILED:", failed, "checks");
    process.exit(1);
  }
  console.log("ALL PETS/DASH TESTS PASSED");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
