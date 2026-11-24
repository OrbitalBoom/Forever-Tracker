const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = process.env.FOREVER_ROOT || "/workspace/wow-forever-petrank";
const PORT = Number(process.env.FOREVER_PORT) || 8806;
const OUT = path.join(ROOT, "screenshots", "petguide");
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
  dashboard: { xpCurrent: null, sessions: [], activeSessionId: null }
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
    await page.goto(base + (hash || "#pets"), { waitUntil: "networkidle0", timeout: 60000 });
    await page.evaluate((state, key) => {
      localStorage.setItem(key, JSON.stringify(state));
    }, STATE, "wowForever.tracker.v1");
    await page.reload({ waitUntil: "networkidle0", timeout: 60000 });
    await page.goto(base + (hash || "#pets"), { waitUntil: "networkidle0", timeout: 60000 });
    await sleep(400);
    return page;
  }

  const page = await open(1280, "#pets");

  const boot = await page.evaluate(() => {
    const guide = document.getElementById("petGuide");
    const fam = document.getElementById("pgFamilyTable");
    const rows = {};
    if (fam) {
      fam.querySelectorAll("tbody tr").forEach((tr) => {
        const name = tr.querySelector("td") && tr.querySelector("td").textContent.trim();
        rows[name] = {
          damage: tr.querySelector('[data-col="damage"]') && tr.querySelector('[data-col="damage"]').textContent.trim(),
          armor: tr.querySelector('[data-col="armor"]') && tr.querySelector('[data-col="armor"]').textContent.trim(),
          health: tr.querySelector('[data-col="health"]') && tr.querySelector('[data-col="health"]').textContent.trim(),
        };
      });
    }
    const happ = document.getElementById("pgHappBars");
    const happText = happ ? happ.textContent : "";
    const bite1 = document.querySelector('[data-bite-rank="1"]');
    const bite8 = document.querySelector('[data-bite-rank="8"]');
    const claw1 = document.querySelector('[data-claw-rank="1"]');
    const claw8 = document.querySelector('[data-claw-rank="8"]');
    const q = document.getElementById("pgQuestions");
    return {
      hasGuide: !!guide,
      version: (document.querySelector('script[src*="pet-guide.js"]') || {}).src || "",
      familyCount: Object.keys(rows).length,
      rows,
      happHas125: /125%/.test(happText) && /100%/.test(happText) && /75%/.test(happText),
      happCommunity: !!(guide && /Community tested/.test(guide.textContent)),
      bite1: bite1 && bite1.textContent.trim(),
      bite8: bite8 && bite8.textContent.trim(),
      claw1: claw1 && claw1.textContent.trim(),
      claw8: claw8 && claw8.textContent.trim(),
      hasTimeline: !!document.getElementById("pgSpeedTimeline"),
      hasTiers: !!document.getElementById("pgTierTable") && /Single-target personal DPS/.test(document.getElementById("pgTierTable").textContent),
      hasSetup: !!document.getElementById("pgSetup") && /The Rake/.test(document.getElementById("pgSetup").textContent) && /Greater Swoop/.test(document.getElementById("pgSetup").textContent) && /not in this site/.test(document.getElementById("pgSetup").textContent),
      staminaHealth: /Health increased by/.test((document.getElementById("pgTraining") || {}).textContent || ""),
      hasQuestions: !!(q && /Open questions/.test(q.querySelector("summary").textContent) && /Controlled tests/.test(q.textContent)),
      hasAutocast: !!document.getElementById("pgAutocast"),
      hasTiers: !!document.getElementById("pgTiers"),
      earnedFormulaPresent: /points a pet has earned/.test((document.getElementById("pgTraining") || {}).textContent || ""),
    };
  });

  if (!boot.hasGuide) fail("pet guide section missing", boot);
  else ok("pet guide section is on the Pets tab");
  if (!/pet-guide\.js\?v=20261125e/.test(boot.version)) fail("expected ?v=20261125e", boot.version);
  else ok("cache bust is 20261125e");
  if (boot.familyCount !== 19) fail("expected 19 families", boot.familyCount);
  else ok("19 families in the comparison table");

  const expect = {
    Cat: { damage: "+10%", armor: "0%", health: "−2%" },
    Turtle: { damage: "−10%", armor: "+13%", health: "0%" },
    Boar: { damage: "−10%", armor: "+9%", health: "+4%" },
    Bear: { damage: "−9%", armor: "+5%", health: "+8%" },
    Raptor: { damage: "+10%", armor: "+3%", health: "−5%" },
    Crab: { damage: "−5%", armor: "+13%", health: "−4%" },
    Scorpid: { damage: "−6%", armor: "+10%", health: "0%" },
    Crocolisk: { damage: "0%", armor: "+10%", health: "−5%" },
    Gorilla: { damage: "+2%", armor: "0%", health: "+4%" },
    "Core Hound": { damage: "+1%", armor: "0%", health: "+5%" },
    Fox: { damage: "0%", armor: "+5%", health: "0%" },
  };
  // minus sign may be hyphen or unicode minus
  function norm(s) { return String(s || "").replace(/−/g, "-").replace(/–/g, "-"); }
  Object.keys(expect).forEach((name) => {
    const got = boot.rows[name];
    if (!got) { fail("family missing from table: " + name); return; }
    const e = expect[name];
    if (norm(got.damage) !== norm(e.damage) || norm(got.armor) !== norm(e.armor) || norm(got.health) !== norm(e.health)) {
      fail("modifier mismatch for " + name, { expected: e, got });
    } else ok(name + " " + got.damage + " / " + got.armor + " / " + got.health);
  });

  if (!boot.happHas125) fail("happiness bars missing 125/100/75", boot);
  else ok("happiness bars show 125 / 100 / 75");
  if (!boot.happCommunity) fail("happiness should be badged community");
  else ok("community badge present in the guide");
  if (!/7\s*[–-]\s*9/.test(boot.bite1) || !/avg 8/.test(boot.bite1) || !/81\s*[–-]\s*99/.test(boot.bite8) || !/avg 90/.test(boot.bite8)) fail("Bite rank damage/ranges", { r1: boot.bite1, r8: boot.bite8 });
  else ok("Bite R1=7–9 (avg 8), R8=81–99 (avg 90)");
  if (!/4\s*[–-]\s*6/.test(boot.claw1) || !/avg 5/.test(boot.claw1) || !/43\s*[–-]\s*59/.test(boot.claw8) || !/avg 51/.test(boot.claw8)) fail("Claw rank damage/ranges", { r1: boot.claw1, r8: boot.claw8 });
  else ok("Claw R1=4–6 (avg 5), R8=43–59 (avg 51)");
  if (!boot.hasTimeline) fail("6-second timeline missing");
  else ok("6-second attack speed timeline is on the page");
  if (!boot.hasTiers) fail("three-column tier table missing", boot);
  else ok("section 10 tier table is on the page");
  if (!boot.hasSetup) fail("The Rake / Greater Swoop correction missing", boot);
  else ok("The Rake setup notes Greater Swoop is not in the tameable list");
  if (!boot.staminaHealth) fail("Great Stamina health correction missing");
  else ok("Great Stamina is described as health, not stamina points");
  if (!boot.hasQuestions) fail("open questions / checklist missing", boot);
  else ok("open questions and test checklist present");
  if (!boot.hasAutocast || !boot.hasTiers) fail("autocast or tiers missing", boot);
  else ok("autocast and tier recommendation sections present");
  if (!boot.earnedFormulaPresent) fail("training section should explain why earned TP is skipped");
  else ok("training planner explains earned-total is not in client data");

  const pure = await page.evaluate(() => {
    const bite = PetGuide.specialAttack({ ability: "Bite", rank: 5, focusCost: 35, regen: 5, cooldown: 0 });
    const claw = PetGuide.specialAttack({ ability: "Claw", rank: 1, focusCost: 25, regen: 5, cooldown: 0 });
    const spec = PetGuide.specialAttackSpec({ rank: 8, bestialDiscipline: 2, growl: false, happiness: 1.25, familyMult: 1.10, unleashedFury: 5, baseRegen: 10 });
    const fr = PetGuide.frenzyStats({ critPct: 20, swingSec: 2, rank: 5 });
    const frLow = PetGuide.frenzyStats({ critPct: 5, swingSec: 2, rank: 5 });
    const prob20 = PetGuide.frenzyProcChance(20, 5, 2.0);
    const probRake = PetGuide.frenzyProcChance(20, 5, 1.2);
    const allow = PetGuide.trainingAllowance(60, 6);
    const allow30 = PetGuide.trainingAllowance(30, 6);
    const train = PetGuide.trainingSum({
      level: 29,
      names: ["Great Stamina", "Natural Armor", "Bite"],
      familyId: 1,
      includeSpecial: true
    });
    const br1 = PetGuide.biteRange(1);
    const cr1 = PetGuide.clawRange(1);
    return { bite, claw, spec, fr, frLow, prob20, probRake, allow, allow30, train, br1, cr1 };
  });

  if (pure.bite.damage !== 44) fail("Bite R5 damage should be 44", pure.bite);
  else ok("calculator Bite R5 damage is 44");
  // uses/min = (5*60)/35 = 8.571...
  if (Math.abs(pure.bite.usesPerMin - (300 / 35)) > 1e-9) fail("Bite uses/min", pure.bite.usesPerMin);
  else ok("Bite uses/min is 300/35 with 5 focus/sec and cost 35");
  if (Math.abs(pure.bite.dps - (pure.bite.usesPerMin * 44) / 60) > 1e-9) fail("Bite dps", pure.bite);
  else ok("Bite theoretical DPS is uses/min × 44 / 60");
  if (pure.claw.damage !== 5) fail("Claw R1 damage", pure.claw);
  else ok("Claw R1 damage is 5");
  if (!pure.br1 || pure.br1[0] !== 7 || pure.br1[1] !== 9) fail("Bite R1 range", pure.br1);
  else ok("biteRange(1) is 7–9 from Forever Variance");
  if (!pure.cr1 || pure.cr1[0] !== 4 || pure.cr1[1] !== 6) fail("Claw R1 range", pure.cr1);
  else ok("clawRange(1) is 4–6 from Forever Variance");
  // M = 1.25*1.10*1.15 = 1.58125; Bite-only = 90*0.1*M = 14.23125; Claw-only = 12/25*51*M = 38.709; Combined = (9 + 8.5/25*51)*M = 41.650125
  if (pure.spec.B !== 90 || pure.spec.C !== 51) fail("spec averages", pure.spec);
  if (Math.abs(pure.spec.regen - 12) > 1e-9 || Math.abs(pure.spec.available - 12) > 1e-9) fail("spec regen/available", pure.spec);
  if (Math.abs(pure.spec.biteOnly - 14.23125) > 1e-6) fail("spec bite-only DPS", pure.spec);
  if (Math.abs(pure.spec.clawOnly - 38.709) > 1e-6 && Math.abs(pure.spec.clawOnly - (12/25*51*1.25*1.10*1.15)) > 1e-6) fail("spec claw-only DPS", pure.spec);
  if (Math.abs(pure.spec.combined - (9 + 8.5/25*51) * 1.25 * 1.10 * 1.15) > 1e-6) fail("spec combined DPS", pure.spec);
  else ok("section 3 special calculator: Bite-only / Claw-only / Combined at default inputs");
  if (Math.abs(pure.prob20 - (1 - Math.pow(0.8, 4))) > 1e-12) fail("Frenzy P at 2.0s", pure.prob20);
  else ok("Frenzy at-least-one chance at 20% crit, rank 5, 2.0s is 1-0.8^4");
  if (!(pure.probRake > pure.prob20)) fail("faster pet should have a higher 8s proc chance", { rake: pure.probRake, std: pure.prob20 });
  else ok("The Rake 1.2s has a higher 8s Frenzy proc chance than a 2.0s pet");
  if (pure.allow.total !== 300) fail("allowance 60 × 5 should be 300", pure.allow);
  else ok("training allowance 60 at Best Friend is 300 (guide formula)");
  if (pure.allow30.total !== 150) fail("allowance 30 × 5 should be 150", pure.allow30);
  else ok("training allowance 30 at Best Friend is 150");

  if (Math.abs(pure.fr.procPerSwing - 0.20) > 1e-12) fail("Frenzy R5 20% crit proc/swing should be 0.20", pure.fr);
  else ok("Frenzy proc per swing is 0.20 at 20% crit, rank 5");
  if (Math.abs(pure.fr.expectedSecondsToProc - 10) > 1e-9) fail("expected time to proc", pure.fr);
  else ok("expected time to a Frenzy proc is 10s at 2.0s swing, 20% crit, rank 5");
  if (pure.fr.uptime < 0.4 || pure.fr.uptime > 0.99) fail("uptime should be a realistic fraction at 20% crit, not saturated", pure.fr.uptime);
  else ok("Frenzy theoretical uptime is " + (pure.fr.uptime * 100).toFixed(1) + "% at 20% crit, 2.0s, rank 5");
  if (!(pure.fr.uptime > pure.frLow.uptime)) fail("higher crit should raise Frenzy uptime", { high: pure.fr.uptime, low: pure.frLow.uptime });
  else ok("higher crit raises theoretical Frenzy uptime");

  // Great Stamina R4 L24 = 25, Nat Armor R4 L24 = 15, Bite R4 L24 = 10, Wolf Howl R2 L24 = 15 → 65
  // At 29: Stamina R4 still (R5 is L30), Armor R4 (R5 L30), Bite R4 (R5 L32), Howl R2 (R3 L40)
  const expectTp = 25 + 15 + 10 + 15;
  if (pure.train.total !== expectTp) fail("training sum at 29 wolf stamina+armor+bite+howl", { expected: expectTp, got: pure.train });
  else ok("training planner sums to " + expectTp + " TP at pet 29 (Stamina R4 + Armor R4 + Bite R4 + Howl R2)");

  // Drive the form: set regen and confirm on-page output
  await page.evaluate(() => {
    document.getElementById("pgSpecialCalc").open = true;
    document.getElementById("pgFrenzyCalc").open = true;
    document.getElementById("pgTraining").open = true;
    document.getElementById("pgTimeline").open = true;
    document.getElementById("pgSetup").open = true;
    document.getElementById("pgTiers").open = true;
    document.getElementById("pgFamilies").open = true;
    document.getElementById("pgHappiness").open = true;
  });
  await sleep(200);
  const formOut = await page.evaluate(() => {
    const bite = document.getElementById("pgSpecialBite");
    const claw = document.getElementById("pgSpecialClaw");
    const comb = document.getElementById("pgSpecialCombined");
    const up = document.getElementById("pgFrenzyUptime");
    const tot = document.getElementById("pgTrainTotal");
    const allow = document.getElementById("pgAllowTotal");
    const rakeBar = document.querySelector('[data-frenzy-speed="1.2"]');
    return {
      bite: bite && bite.textContent,
      claw: claw && claw.textContent,
      combined: comb && comb.textContent,
      uptime: up && up.textContent,
      total: tot && tot.textContent,
      allow: allow && allow.textContent,
      rakeProb: rakeBar && rakeBar.textContent
    };
  });
  const expBite = 14.23125, expComb = (9 + 8.5/25*51) * 1.25 * 1.10 * 1.15;
  if (!formOut.bite || Math.abs(parseFloat(formOut.bite) - expBite) > 0.02) fail("on-page special Bite-only", formOut);
  else ok("on-page special calculator Bite-only is " + formOut.bite);
  if (!formOut.combined || Math.abs(parseFloat(formOut.combined) - expComb) > 0.02) fail("on-page special Combined", formOut);
  else ok("on-page special calculator Combined is " + formOut.combined);
  if (!formOut.uptime) fail("on-page Frenzy uptime missing", formOut);
  else ok("on-page Frenzy uptime is " + formOut.uptime);
  if (formOut.total !== String(expectTp)) fail("on-page training total", formOut);
  else ok("on-page training total is " + formOut.total);
  if (formOut.allow !== "150") fail("on-page allowance default 30/6 should be 150", formOut);
  else ok("on-page training allowance at default 30/6 is 150");
  if (!formOut.rakeProb) fail("Frenzy probability bar for The Rake missing", formOut);
  else ok("Frenzy probability bar for The Rake is " + formOut.rakeProb);

  await page.evaluate(() => {
    const el = document.getElementById("petGuide");
    if (el) el.scrollIntoView({ block: "start" });
  });
  await sleep(200);
  await page.screenshot({ path: path.join(OUT, "desktop-petguide.png") });
  ok("screenshot desktop-petguide.png");
  await overflow(page, "desktop pets + guide");
  await page.close();

  const mobile = await open(390, "#pets");
  await mobile.evaluate(() => {
    ["pgHappiness", "pgFamilies", "pgBiteClaw", "pgSpecialCalc", "pgFrenzyCalc", "pgTraining", "pgAutocast", "pgTiers", "pgQuestions"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.open = true;
    });
    ["pgTimeline", "pgSetup", "pgAllowForm"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.tagName === "DETAILS") el.open = true;
    });
    const el = document.getElementById("petGuide");
    if (el) el.scrollIntoView({ block: "start" });
  });
  await sleep(200);
  const mob = await mobile.evaluate(() => {
    return {
      hasGuide: !!document.getElementById("petGuide"),
      combined: (document.getElementById("pgSpecialCombined") || {}).textContent || null,
      uptime: (document.getElementById("pgFrenzyUptime") || {}).textContent || null,
      timeline: !!document.getElementById("pgSpeedTimeline"),
    };
  });
  if (!mob.hasGuide) fail("390 guide missing", mob);
  else ok("390 guide present");
  const expCombM = (9 + 8.5/25*51) * 1.25 * 1.10 * 1.15;
  if (!mob.combined || Math.abs(parseFloat(mob.combined) - expCombM) > 0.02) fail("390 special combined", mob);
  else ok("390 special calculator works (combined " + mob.combined + ")");
  if (!mob.uptime) fail("390 frenzy uptime missing", mob);
  else ok("390 frenzy calculator works (" + mob.uptime + ")");
  if (!mob.timeline) fail("390 timeline missing");
  else ok("390 timeline present");
  await overflow(mobile, "390 pets + guide");
  await mobile.screenshot({ path: path.join(OUT, "mobile-390-petguide.png") });
  ok("screenshot mobile-390-petguide.png");

  // second desktop shot of family table
  const page2 = await open(1280, "#pets");
  await page2.evaluate(() => {
    const d = document.getElementById("pgFamilies");
    if (d) { d.open = true; d.scrollIntoView({ block: "start" }); }
  });
  await sleep(200);
  await page2.screenshot({ path: path.join(OUT, "desktop-family-mods.png") });
  ok("screenshot desktop-family-mods.png");
  await page2.close();
  await mobile.close();

  await browser.close();
  server.close();
  if (failed) {
    console.error("FAILED:", failed, "checks");
    process.exit(1);
  }
  console.log("ALL PET GUIDE TESTS PASSED");
})().catch((e) => { console.error(e); process.exit(1); });
