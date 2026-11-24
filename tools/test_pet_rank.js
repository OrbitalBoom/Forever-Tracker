const fs = require("fs");
const http = require("http");
const path = require("path");

const ROOT = process.env.FOREVER_ROOT || "/workspace/wow-forever-petrank";
const PORT = Number(process.env.FOREVER_PORT) || 8805;
const OUT = path.join(ROOT, "screenshots", "petrank");
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
  dashboard: { xpCurrent: null, sessions: [], activeSessionId: null }
};

const SPOTS = [
  { id: 30, name: "Forest Spider", ms: 2000, source: "CMaNGOS creature_template.MeleeBaseAttackTime" },
  { id: 118, name: "Prowler", ms: 1500, source: "CMaNGOS creature_template.MeleeBaseAttackTime" },
  { id: 682, name: "Stranglethorn Tiger", ms: 1300, source: "CMaNGOS creature_template.MeleeBaseAttackTime" },
];

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
    const table = document.getElementById("petRankTable");
    const level = document.getElementById("petRankLevel");
    const count = (document.getElementById("petRankCount") || {}).textContent || "";
    const formula = document.getElementById("petRankFormula");
    const note = document.getElementById("petRankForeverNote");
    const ft = (formula && formula.textContent) || "";
    const nt = (note && note.textContent) || "";
    const rows = table ? table.querySelectorAll("tbody tr").length : 0;
    return {
      hasTable: !!table,
      level: level && level.value,
      count,
      hasFormula: !!(formula && /Family body/.test(ft) && /Attack speed/.test(ft)),
      formulaClaimsCmangosAsForever: /Average white DPS from that formula does not change with speed/.test(ft) || /adds \(swings per minute/.test(ft),
      formulaMentionsFasterAttack: /Faster Attack I/.test(ft),
      formulaMentionsFrenzy: /Frenzy/.test(ft) && /Go for the Throat/.test(ft) && /not in Forever/.test(ft),
      formulaNotOfficialDps: /has not published/.test(ft),
      hasForeverNote: !!(note && /innate Attack Speed passives/.test(nt) && /Faster Attack I/.test(nt)),
      rows,
      tameable: (window.PETS_DATA && PETS_DATA.tameable && PETS_DATA.tameable.length) || 0,
      hasMods: !!(window.PETS_DATA && PETS_DATA.familyModifiers && PETS_DATA.familyModifiers["2"]),
    };
  });
  if (!boot.hasTable || boot.rows < 20) fail("ranking table did not populate", boot);
  else ok("ranking table populated (" + boot.rows + " rows at default level)");
  if (boot.level !== "29") fail("level filter should default to character level 29", boot.level);
  else ok("level filter defaults to 29");
  if (boot.tameable < 500) fail("expected full tameable list, not just notables", boot.tameable);
  else ok("tameable list has " + boot.tameable + " sourced creatures");
  if (!boot.hasFormula) fail("scoring formula missing");
  else ok("scoring formula is on the page");
  if (boot.formulaClaimsCmangosAsForever) fail("formula still presents the CMaNGOS white-DPS rule as the page claim", boot);
  else ok("formula no longer claims CMaNGOS white-DPS independence as a Forever rule");
  if (!boot.formulaMentionsFasterAttack || !boot.formulaMentionsFrenzy || !boot.formulaNotOfficialDps) fail("formula missing Forever speed / Frenzy / unofficial-DPS wording", boot);
  else ok("formula cites Faster Attack, Frenzy, and official silence on white DPS");
  if (!boot.hasForeverNote) fail("Forever attack-speed callout missing", boot);
  else ok("Forever attack-speed callout is on the page");
  if (!boot.hasMods) fail("familyModifiers missing");
  else ok("family modifiers present");

  // Spot-check attack speeds against CMaNGOS values
  const spots = await page.evaluate((ids) => {
    const list = (PETS_DATA.tameable || []);
    return ids.map((s) => {
      const rec = list.find((b) => b.id === s.id);
      return rec ? { id: rec.id, name: rec.name, ms: rec.attackTimeMs } : { id: s.id, missing: true };
    });
  }, SPOTS);
  SPOTS.forEach((s, i) => {
    const got = spots[i];
    if (!got || got.missing) fail("spot-check beast missing: " + s.name);
    else if (got.ms !== s.ms) fail("attack time mismatch for " + s.name, { expected: s.ms, got: got.ms, source: s.source });
    else ok("spot-check " + s.name + " (id " + s.id + ") attack " + got.ms + " ms — " + s.source);
  });

  // Level filter excludes higher-level beasts (Stranglethorn Tiger 32-33, Snapjaw 30-31)
  const at29 = await page.evaluate(() => {
    const names = Array.prototype.map.call(document.querySelectorAll("#petRankTable tbody tr td:nth-child(2)"), (td) => td.textContent.trim());
    const tiger = (PETS_DATA.tameable || []).find((b) => b.id === 682);
    const snap = (PETS_DATA.tameable || []).find((b) => b.id === 2408);
    const prowler = (PETS_DATA.tameable || []).find((b) => b.id === 118);
    return {
      names: names.slice(0, 5),
      allNames: names,
      hasTiger: names.some((n) => /Stranglethorn Tiger/.test(n)),
      hasSnapjaw: names.some((n) => n === "Snapjaw" || /^Snapjaw\b/.test(n)),
      hasProwler: names.some((n) => n.indexOf("Prowler") !== -1),
      tigerMin: tiger && tiger.minLevel,
      snapMin: snap && snap.minLevel,
      prowlerMin: prowler && prowler.minLevel,
    };
  });
  if (at29.tigerMin !== 32) fail("expected Stranglethorn Tiger minLevel 32", at29);
  if (at29.hasTiger) fail("level 29 filter should exclude Stranglethorn Tiger (32-33)", at29);
  else ok("level 29 filter excludes Stranglethorn Tiger (min 32)");
  if (at29.hasSnapjaw) fail("level 29 filter should exclude Snapjaw (min 30)", at29);
  else ok("level 29 filter excludes Snapjaw (min 30)");
  if (!at29.hasProwler) fail("Prowler (9-10) should be listed at level 29", at29);
  else ok("Prowler is listed at level 29");

  // Raise filter to 40 and confirm the tiger appears
  await page.evaluate(() => {
    const input = document.getElementById("petRankLevel");
    input.value = 40;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await sleep(300);
  const at40 = await page.evaluate(() => {
    const names = Array.prototype.map.call(document.querySelectorAll("#petRankTable tbody tr td:nth-child(2)"), (td) => td.textContent);
    return { hasTiger: names.some((n) => /Stranglethorn Tiger/.test(n)), rows: names.length };
  });
  if (!at40.hasTiger) fail("at hunter 40, Stranglethorn Tiger should appear", at40);
  else ok("at hunter 40, Stranglethorn Tiger is included");

  // Reset to 29 and check role sort (Tank tab)
  await page.evaluate(() => {
    const input = document.getElementById("petRankLevel");
    input.value = 29;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await sleep(300);
  await page.click('[data-rank-role="tank"]');
  await sleep(300);
  const tankSort = await page.evaluate(() => {
    const rows = Array.prototype.slice.call(document.querySelectorAll("#petRankTable tbody tr")).slice(0, 8).map((tr) => {
      const tds = tr.querySelectorAll("td");
      return {
        rank: tds[0] && tds[0].textContent.trim(),
        name: tds[1] && tds[1].textContent.trim(),
        family: tds[2] && tds[2].textContent.trim(),
        roles: tds[7] && tds[7].textContent,
        why: tds[8] && tds[8].textContent,
      };
    });
    const firstScores = (window.PetRank.filtered() || []).slice(0, 5).map((r) => ({
      name: r.beast.name, family: r.beast.familyId, tank: r.score.tank, dps: r.score.dps, support: r.score.support, tags: r.score.tags
    }));
    const sorted = (window.PetRank.filtered() || []);
    let orderOk = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].score.tank > sorted[i - 1].score.tank) orderOk = false;
    }
    return { rows, firstScores, orderOk, n: sorted.length, role: window.PetRank.ui.role };
  });
  if (tankSort.role !== "tank") fail("tank tab did not activate", tankSort.role);
  else ok("Tank role tab active, " + tankSort.n + " tagged beasts");
  if (!tankSort.orderOk) fail("Tank tab is not sorted by tank score descending", tankSort.firstScores);
  else ok("Tank tab sorted by tank score");
  const tankFamOk = tankSort.firstScores.every((s) => s.tags.indexOf("Tank") !== -1);
  if (!tankFamOk) fail("Tank tab included a beast without the Tank tag", tankSort.firstScores);
  else ok("Tank tab only includes Tank-tagged beasts");

  await page.click('[data-rank-role="dps"]');
  await sleep(300);
  const dpsSort = await page.evaluate(() => {
    const sorted = window.PetRank.filtered() || [];
    let orderOk = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].score.dps > sorted[i - 1].score.dps) orderOk = false;
    }
    return {
      orderOk,
      n: sorted.length,
      first: sorted.slice(0, 5).map((r) => ({ name: r.beast.name, family: r.beast.familyId, dps: r.score.dps, ms: r.beast.attackTimeMs, tags: r.score.tags })),
    };
  });
  if (!dpsSort.orderOk) fail("DPS tab not sorted by DPS score", dpsSort.first);
  else ok("DPS tab sorted by DPS score");

  const sameFamilyDps = await page.evaluate(() => {
    PetRank.ui.role = "dps";
    PetRank.ui.sort = "dps";
    const cats = (PetRank.filtered() || []).filter((r) => r.beast.familyId === 2);
    const scores = Array.from(new Set(cats.map((r) => r.score.dps)));
    const times = Array.from(new Set(cats.map((r) => r.beast.attackTimeMs))).sort((a, b) => a - b);
    return {
      n: cats.length,
      scores,
      times,
      sample: cats.slice(0, 3).map((r) => ({ name: r.beast.name, ms: r.beast.attackTimeMs, dps: r.score.dps })),
    };
  });
  if (sameFamilyDps.n < 2) fail("expected several cats at level 29", sameFamilyDps);
  else if (sameFamilyDps.scores.length !== 1) fail("cats of the same family should share one DPS score (speed is not counted as damage)", sameFamilyDps);
  else if (sameFamilyDps.times.length < 2) fail("expected cats with more than one Classic swing time so the equal-score check is meaningful", sameFamilyDps);
  else ok("same-family cats share one DPS score (" + sameFamilyDps.scores[0] + ") across swing times " + sameFamilyDps.times.join(", ") + " ms");

  await page.click('[data-rank-role="support"]');
  await sleep(300);
  const supSort = await page.evaluate(() => {
    const sorted = window.PetRank.filtered() || [];
    let orderOk = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].score.support > sorted[i - 1].score.support) orderOk = false;
    }
    return {
      orderOk,
      n: sorted.length,
      first: sorted.slice(0, 5).map((r) => ({ name: r.beast.name, family: r.beast.familyId, support: r.score.support, tags: r.score.tags })),
    };
  });
  if (!supSort.orderOk || !supSort.n) fail("Support sort failed", supSort);
  else ok("Support tab sorted by support score (" + supSort.n + ")");

  // Top 5 per role at 29 for the report
  await page.click('[data-rank-role="all"]');
  await sleep(200);
  const tops = await page.evaluate(() => {
    function top(role) {
      PetRank.ui.role = role;
      PetRank.ui.sort = "auto";
      return PetRank.filtered().slice(0, 5).map((r, i) => ({
        rank: i + 1,
        name: r.beast.name,
        familyId: r.beast.familyId,
        minLevel: r.beast.minLevel,
        maxLevel: r.beast.maxLevel,
        zone: r.beast.zone,
        attackTimeMs: r.beast.attackTimeMs,
        teaches: (r.beast.teaches || []).map((t) => t.name + (t.rank != null ? " R" + t.rank : "")),
        tags: r.score.tags,
        tank: r.score.tank,
        dps: r.score.dps,
        support: r.score.support,
        why: r.score.reasons
      }));
    }
    const fams = {};
    (PETS_DATA.families || []).forEach((f) => { fams[f.id] = f.name; });
    return { tank: top("tank"), dps: top("dps"), support: top("support"), fams, cat: PETS_DATA.familyModifiers["2"], turtle: PETS_DATA.familyModifiers["21"], boar: PETS_DATA.familyModifiers["5"] };
  });
  fs.writeFileSync(path.join(OUT, "top5-level29.json"), JSON.stringify(tops, null, 2));
  console.log("TOP5_JSON written");
  ["tank", "dps", "support"].forEach((role) => {
    console.log("TOP 5 " + role.toUpperCase() + " at 29:");
    tops[role].forEach((r) => {
      console.log("  " + r.rank + ". " + r.name + " (" + (tops.fams[r.familyId] || r.familyId) + ") L" + r.minLevel + "-" + r.maxLevel +
        " " + (r.zone || "—") + " " + r.attackTimeMs + "ms  tank=" + r.tank + " dps=" + r.dps + " support=" + r.support);
    });
  });

  await page.evaluate(() => { PetRank.ui.role = "all"; PetRank.ui.sort = "auto"; });
  await page.evaluate(() => { if (window.ForeverPets) ForeverPets.render(); });
  await sleep(300);
  await page.evaluate(() => {
    const el = document.getElementById("petRank");
    if (el) el.scrollIntoView({ block: "start" });
  });
  await sleep(200);
  await page.screenshot({ path: path.join(OUT, "desktop-ranking.png") });
  ok("screenshot desktop-ranking.png");
  await overflow(page, "desktop pets ranking");
  await page.close();

  // 390px
  const mobile = await open(390, "#pets");
  await mobile.evaluate(() => {
    const el = document.getElementById("petRank");
    if (el) el.scrollIntoView({ block: "start" });
  });
  await sleep(200);
  const mob = await mobile.evaluate(() => {
    const table = document.getElementById("petRankTable");
    const rows = table ? table.querySelectorAll("tbody tr").length : 0;
    const cs = table && table.querySelector("tbody tr");
    const display = cs ? getComputedStyle(cs).display : "";
    return { rows, display, hasRank: !!document.getElementById("petRank") };
  });
  if (!mob.hasRank || mob.rows < 10) fail("390 ranking missing", mob);
  else ok("390 ranking populated (" + mob.rows + " rows, tr display=" + mob.display + ")");
  await overflow(mobile, "390 pets ranking");
  await mobile.screenshot({ path: path.join(OUT, "mobile-390-ranking.png") });
  ok("screenshot mobile-390-ranking.png");
  await mobile.close();

  await browser.close();
  server.close();
  if (failed) {
    console.error("FAILED:", failed, "checks");
    process.exit(1);
  }
  console.log("ALL PET RANK TESTS PASSED");
})().catch((e) => { console.error(e); process.exit(1); });
