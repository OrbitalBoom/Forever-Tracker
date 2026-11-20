/* WoW: Forever gold-farming spots.
 *
 * Sources are listed on each spot and summarized below. Do not invent camps,
 * drop rates, or gold-per-hour figures. Sourced numbers are stored with their
 * date, realm, and a short note. The UI also computes a "live value" from
 * this site's US Normal Horde auction snapshot (data/prices.js / the
 * prices-data branch — the same feed the Profession guide uses).
 *
 * Weekly refresh: when re-checking farms, update sourced prices/dates, add
 * or retire spots that the community has confirmed or abandoned, and keep
 * the exclusion list at the bottom current. Prefer recent Forever posts
 * over Classic-era guides. Tag each spot "forever" (priced or described
 * for live Forever) or "classic" (Classic Era / beta, likely still applies,
 * labeled as such in the UI).
 *
 * Principal sources (checked 20 Nov 2026):
 * - Conquest Capped, "Best Spots for Levels 30-45", updated 16 Nov 2026,
 *   EU AH prices of 15 Nov 2026.
 *   https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming/
 * - Conquest Capped, "Gold Farming at Level 60", updated 16 Nov 2026,
 *   PvP-realm AH prices of 15 Nov 2026.
 *   https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming-60/
 * - forevergold.dad, "Best gold farm at level 50", US Normal AH,
 *   20 Nov 2026, 07:22 UTC.
 *   https://forevergold.dad/farm/level-50
 * - FrostyBoost, "10 Spots Priced on Nov 13", EU prices 13 Nov 2026.
 *   https://frostyboost.com/blog/guides/wow-forever-gold-farming-guide
 * - boosting.pro, "Best Gold Farms by Level", updated 1 Nov 2026
 *   (checked 30 Oct 2026, includes beta Scarce-material farms).
 *   https://boosting.pro/wow-forever-gold-guide/
 * - Wowhead Forever Herbalism / Mining / Fishing / Alchemy overviews.
 * - ByteTavern Linen Cloth farm guide (~16 Nov 2026); uses Classic spawn
 *   and drop data because Forever's loot tables are not public.
 * - theforeverguides.com "Gold Farming by Level" (beta / Classic-based).
 * - botwowforever Hinterlands gathering route.
 * - warcraftmaps.com Mage Maraudon farm (1.60.1, Classic spawn data).
 * - Warcraft Tavern Forever Mage AoE guide (notes AoE nerfs).
 * - Reddit r/wowforever: gathering professions (14 Oct 2026), 100g-by-40
 *   and fishing (29-30 Oct 2026).
 * - Wowhead Forever profession-pairing guide (gathering at launch).
 *
 * Left out of the list:
 * - The Blackmaw Hold devotee farm, which a mid-November hotfix stripped
 *   of loot. It is not a legitimate live spot.
 * - Item duplication, collision/geometry glitches, and other play that
 *   breaks Blizzard's terms of use.
 * - "Pay me gold to stop ganking" and similar ideas from forum threads.
 * - Paid gold-buying offers that some guide pages also advertise.
 */
window.GOLD_FARMS_META = {
  built: "2026-11-20",
  priceHouse: "US Normal Horde (house 114), same feed as the Profession guide",
  disclaimer: "Gold per hour moves with the Auction House and with how fast you can pull. Sourced figures are snapshots, not promises. Live values are computed from current AH prices and the drop rates a source listed."
};
window.GOLD_FARMS = [

  {
    id: "barrens-pristine-leather",
    name: "Barrens beasts — Pristine Leather",
    zone: "The Barrens",
    loc: "Plainstriders, zhevras and kodos around the Crossroads and Lushwater Oasis.",
    levelMin: 10, levelMax: 26, mobLevel: "12–20",
    faction: "both",
    factionNote: "Horde-native questing ground; Alliance can reach it but will be contested.",
    classes: ["any"],
    professions: ["Skinning"],
    bonusProfs: [],
    type: "gathering",
    loot: [{ id: 249427, name: "Pristine Leather" }, { id: 2318, name: "Light Leather" }, { id: 2319, name: "Medium Leather" }],
    sourced: {
      note: "Forever Scarce material. Boosting.pro (1 Nov 2026, beta prices): Pristine Leather sold for 69 silver to 1.8 gold; the Barrens gave 38% of recorded drops, then Wailing Caverns 11%. r/wowforever (14 Oct 2026) also reports early Skinning/Herb or Mining as the mount-gold path.",
      date: "2026-11-01"
    },
    risk: "Scarce-material prices fall as more players skin the same low-level beasts. One skin per corpse in Forever.",
    tag: "forever",
    sources: [
      { title: "WoW Forever Gold Guide: Best Gold Farms by Level", url: "https://boosting.pro/wow-forever-gold-guide/", date: "2026-11-01", site: "boosting.pro" },
      { title: "Best gathering professions for cash?", url: "https://www.reddit.com/r/wowforever/comments/1x64igj/best_gathering_professions_for_cash/", date: "2026-10-14", site: "r/wowforever" }
    ]
  },
  {
    id: "low-herbs-frilled-lichen",
    name: "Starting-zone herbs — Frilled Lichen",
    zone: "Starting zones (Durotar, Mulgore, Tirisfal; Elwynn, Dun Morogh, Teldrassil, Darkshore, Silverpine)",
    loc: "Peacebloom, Silverleaf and Earthroot while you quest. Wowhead: any starting zone at skill 1–70, then Darkshore / Loch Modan / Silverpine at 70–115.",
    levelMin: 1, levelMax: 25, mobLevel: "",
    faction: "both",
    classes: ["any"],
    professions: ["Herbalism"],
    bonusProfs: [],
    type: "gathering",
    loot: [{ id: 2447, name: "Peacebloom" }, { id: 765, name: "Silverleaf" }, { id: 2449, name: "Earthroot" }, { id: 785, name: "Mageroyal" }, { id: 2450, name: "Briarthorn" }, { id: 249399, name: "Frilled Lichen" }],
    sourced: {
      note: "Forever Scarce material Frilled Lichen can drop from low-level herbs. Boosting.pro (1 Nov 2026, beta): 80 silver to 2.1 gold each. A r/wowforever comment (14 Oct 2026) said Frilled Lichen made a good chunk of gold. Wowhead's Forever Herbalism guide recommends starting zones, then Darkshore, Loch Modan and Silverpine Forest.",
      date: "2026-11-01"
    },
    risk: "Herb prices swing hard once more gatherers reach the zone. Do not vendor Scarce materials.",
    tag: "forever",
    sources: [
      { title: "Herbalism Profession Overview in Forever", url: "https://www.wowhead.com/forever/guide/professions/herbalism/overview-leveling", date: "2026-11-20", site: "Wowhead" },
      { title: "WoW Forever Gold Guide: Best Gold Farms by Level", url: "https://boosting.pro/wow-forever-gold-guide/", date: "2026-11-01", site: "boosting.pro" },
      { title: "Best gathering professions for cash?", url: "https://www.reddit.com/r/wowforever/comments/1x64igj/best_gathering_professions_for_cash/", date: "2026-10-14", site: "r/wowforever" }
    ]
  },
  {
    id: "low-mining-pyrite",
    name: "Copper and Tin veins — Pyrite",
    zone: "Starting zones, then the Barrens, Silverpine, Westfall, Loch Modan, Ashenvale, Redridge, Thousand Needles",
    loc: "Wowhead Forever Mining: Copper in any starter zone (skill 1–65); Copper / Tin / Silver in Ashenvale, Redridge, the Barrens and Thousand Needles (65–125).",
    levelMin: 1, levelMax: 30, mobLevel: "",
    faction: "both",
    classes: ["any"],
    professions: ["Mining"],
    bonusProfs: ["Herbalism"],
    type: "gathering",
    loot: [{ id: 2770, name: "Copper Ore" }, { id: 2771, name: "Tin Ore" }, { id: 2775, name: "Silver Ore" }, { id: 249391, name: "Pyrite" }],
    sourced: {
      note: "Forever Scarce material Pyrite can drop from Copper, Tin, Silver and Iron (Mining 1–125). Boosting.pro (1 Nov 2026, beta): 2 to 8 silver each. r/wowforever (29–30 Oct) repeatedly recommends Mining plus Herbalism or Skinning for mount gold.",
      date: "2026-11-01"
    },
    risk: "Ore nodes are contested on busy launch realms. Pairing with Herbalism is the usual Wowhead advice.",
    tag: "forever",
    sources: [
      { title: "Mining Profession Overview in Forever", url: "https://www.wowhead.com/forever/guide/professions/mining/overview-leveling", date: "2026-11-20", site: "Wowhead" },
      { title: "WoW Forever Gold Guide: Best Gold Farms by Level", url: "https://boosting.pro/wow-forever-gold-guide/", date: "2026-11-01", site: "boosting.pro" },
      { title: "Quick Guide to having 100g by level 40", url: "https://www.reddit.com/r/wowforever/comments/1xipxlp/quick_guide_to_having_100g_by_level_40/", date: "2026-10-30", site: "r/wowforever" }
    ]
  },
  {
    id: "barrens-linen-quilboar",
    name: "Razormane and Kolkar — Linen Cloth",
    zone: "The Barrens",
    loc: "Razormane at Thorn Hill and Kolkar camps at the three oases around the Crossroads. Southsea pirates south of Ratchet are a similar alternative.",
    levelMin: 10, levelMax: 20, mobLevel: "10–16",
    faction: "horde",
    factionNote: "Horde-native. Alliance can reach the camps but the Crossroads is hostile.",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Tailoring", "First Aid"],
    type: "cloth",
    loot: [{ id: 2589, name: "Linen Cloth", chance: 0.77, qty: 1, chanceNote: "about 0.77 Linen per kill in Classic data for level 10–15 humanoids" }],
    sourced: {
      note: "ByteTavern's Forever Linen guide: Horde's best camps are Thorn Hill and the Kolkar oases, 0.77 Linen/kill in Classic data (Forever loot tables are not public). At two kills a minute they estimate about 90 Linen an hour. They also warn that vendor Linen is only about 20 silver an hour at a level-60 clear rate, so this is mainly for First Aid, bags and crates, unless your AH pays more.",
      killsPerHour: 120,
      killsPerHourNote: "ByteTavern's two kills a minute estimate (about 90 Linen/hour at 0.77/kill).",
      date: "2026-11-16"
    },
    risk: "Drop rates are from Classic data, not a published Forever table. Fine while you quest; thin as a dedicated gold farm if Linen is cheap.",
    tag: "classic",
    sources: [
      { title: "WoW Forever Linen Cloth Farm: Best Spots, Alliance and Horde", url: "https://bytetavern.com/wow-forever-linen-cloth-farming/", date: "2026-11-16", site: "ByteTavern" }
    ]
  },
  {
    id: "westfall-linen-jangolode",
    name: "Jangolode Mine — Linen Cloth",
    zone: "Westfall",
    loc: "Riverpaw gnolls, Defias and kobolds around Jangolode Mine in northern Westfall, about 850 yards north of the Sentinel Hill flight path.",
    levelMin: 10, levelMax: 20, mobLevel: "11–13",
    faction: "alliance",
    factionNote: "Alliance-native. Horde can get there but will be deep in Alliance territory.",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Tailoring", "First Aid"],
    type: "cloth",
    loot: [{ id: 2589, name: "Linen Cloth", chance: 0.87, qty: 1, chanceNote: "ByteTavern: 0.87 Linen per kill at this camp in Classic data" }],
    sourced: {
      note: "ByteTavern's Forever Linen guide calls this the best Alliance camp (0.87 Linen/kill in Classic data). Dwarves and gnomes can use Stonesplinter Valley in Loch Modan instead (0.77).",
      killsPerHour: 120,
      killsPerHourNote: "Same two-kills-a-minute estimate as the rest of that guide.",
      date: "2026-11-16"
    },
    risk: "Classic drop data, not a published Forever table. Alliance zone.",
    tag: "classic",
    sources: [
      { title: "WoW Forever Linen Cloth Farm: Best Spots, Alliance and Horde", url: "https://bytetavern.com/wow-forever-linen-cloth-farming/", date: "2026-11-16", site: "ByteTavern" }
    ]
  },
  {
    id: "bael-modan-wool",
    name: "Bael Modan dwarves — Wool Cloth",
    zone: "The Barrens",
    loc: "Bael'dun dwarves at Bael Modan in the southern Barrens. Several mob types in one camp.",
    levelMin: 20, levelMax: 30, mobLevel: "24–27",
    faction: "horde",
    factionNote: "Southern Barrens, convenient for Horde. Alliance can reach it from Theramore or Thousand Needles.",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Tailoring", "First Aid"],
    type: "cloth",
    loot: [{ id: 2592, name: "Wool Cloth" }],
    sourced: {
      note: "theforeverguides (beta logs): Bael'dun Officers dropped Wool on 49% of 35 logged kills and Bael'dun Excavators on 47% of 59. Small beta samples. They recommend Wool and Medium Leather as the level-20 farm.",
      date: "2026-11-04"
    },
    risk: "Beta sample sizes are small. Tag is Classic-era / beta, likely applies.",
    tag: "classic",
    sources: [
      { title: "WoW Forever Gold Farming by Level: 1–60 Brackets", url: "https://theforeverguides.com/gold-making/gold-by-level/", date: "2026-11-04", site: "theforeverguides" }
    ]
  },
  {
    id: "wetlands-raptors-leather",
    name: "Wetlands raptors — Medium Leather",
    zone: "Wetlands",
    loc: "Mottled raptors, including Mottled Razormaw, in the 22–28 range.",
    levelMin: 22, levelMax: 32, mobLevel: "22–28",
    faction: "both",
    factionNote: "Alliance-sided zone; Horde can farm it but will cross patrols.",
    classes: ["any"],
    professions: ["Skinning"],
    bonusProfs: [],
    type: "gathering",
    loot: [{ id: 2319, name: "Medium Leather" }, { id: 4234, name: "Heavy Leather" }],
    sourced: {
      note: "theforeverguides: Mottled Razormaw was the most-logged Medium Leather beast in beta (94 logs), with several raptor types from 22 to 28 in the same area.",
      date: "2026-11-04"
    },
    risk: "Alliance territory. Beta logs, not a live gold/hour figure.",
    tag: "classic",
    sources: [
      { title: "WoW Forever Gold Farming by Level: 1–60 Brackets", url: "https://theforeverguides.com/gold-making/gold-by-level/", date: "2026-11-04", site: "theforeverguides" }
    ]
  },
  {
    id: "fishing-cooking",
    name: "Fishing (and Cooking the catch)",
    zone: "Any safe water — cities and nearby coasts work",
    loc: "A r/wowforever 100g-by-40 guide (30 Oct 2026) recommends fishing on a bank alt in Orgrimmar at the start or end of a session. Wowhead's Forever Fishing overview says fishing has essentially no costs, so the catch is profit, especially with Cooking.",
    levelMin: 1, levelMax: 60, mobLevel: "",
    faction: "both",
    classes: ["any"],
    professions: ["Fishing"],
    bonusProfs: ["Cooking"],
    type: "gathering",
    loot: [],
    sourced: {
      note: "No gold/hour is published in these sources. r/wowforever (30 Oct 2026) calls fishing very profitable because fish power-level Cooking and list well. Wowhead Forever: low attention, consistent gold if you catch the right fish.",
      date: "2026-10-30"
    },
    risk: "Pace is slow. Demand is real, but so is competition on popular city docks.",
    tag: "forever",
    sources: [
      { title: "Fishing Profession Overview in Forever", url: "https://www.wowhead.com/forever/guide/professions/fishing/overview-leveling", date: "2026-11-20", site: "Wowhead" },
      { title: "Quick Guide to having 100g by level 40", url: "https://www.reddit.com/r/wowforever/comments/1xipxlp/quick_guide_to_having_100g_by_level_40/", date: "2026-10-30", site: "r/wowforever" }
    ]
  },
  {
    id: "waylaid-crates",
    name: "Waylaid Crates for Merchant's Favor",
    zone: "Turn-in: Horde west of the Crossroads; Alliance at Three Corners in Redridge",
    loc: "Horde: Dokimi / Durotar Supply and Logistics outside the Crossroads. Alliance: Marcy Baker at Three Corners in Redridge. Fill crates with leftover low-level mats instead of vendoring them.",
    levelMin: 10, levelMax: 40, mobLevel: "",
    faction: "both",
    classes: ["any"],
    professions: [],
    bonusProfs: [],
    type: "craft",
    loot: [{ id: 2589, name: "Linen Cloth" }, { id: 2318, name: "Light Leather" }, { id: 2770, name: "Copper Ore" }, { id: 2447, name: "Peacebloom" }],
    sourced: {
      note: "Forever-specific. boosting.pro and theforeverguides: Apprentice Textiles from level 10 (example bundles 20 Light Leather or 40 Linen). A sealed Apprentice crate is reported as 5 Merchant's Favor (10 with uncommon bundles); Journeyman 10 (20). This is a currency turn-in, not a raw-gold farm. Sell the mats on the AH if they beat vendor plus Favor value.",
      date: "2026-11-01"
    },
    risk: "Favor values for Expert/Artisan crates were still unpublished in the launch-week guides. Some Wowhead comments reported crate counts that did not match the tooltip.",
    tag: "forever",
    sources: [
      { title: "WoW Forever Gold Guide: Best Gold Farms by Level", url: "https://boosting.pro/wow-forever-gold-guide/", date: "2026-11-01", site: "boosting.pro" },
      { title: "WoW Forever Gold Farming by Level: 1–60 Brackets", url: "https://theforeverguides.com/gold-making/gold-by-level/", date: "2026-11-04", site: "theforeverguides" }
    ]
  },

  {
    id: "arathi-burning-exiles",
    name: "Burning Exiles",
    zone: "Arathi Highlands",
    loc: "Northwest circle of the inner elementals (the Burning Exile camp).",
    levelMin: 36, levelMax: 45, mobLevel: "38–39",
    faction: "both",
    factionNote: "Contested. Horde has Hammerfall nearby; the camp is still a PvP magnet.",
    classes: ["any"],
    professions: [],
    bonusProfs: [],
    type: "mob",
    loot: [
      { id: 4479, name: "Burning Charm", chance: 0.34 },
      { id: 7068, name: "Elemental Fire", chance: 0.11 },
      { id: 3857, name: "Coal", chance: 0.12 }
    ],
    sourced: {
      perKill: 1434,
      perKillNote: "14s 34c loot value per kill on EU AH, 15 Nov 2026 (volume items only; coins and greys extra).",
      goldPerHourNote: "At around 100 kills an hour, Conquest Capped puts the best 30–45 spots at about 12 to 14 gold from loot alone, before coins and greys.",
      killsPerHour: 100,
      killsPerHourNote: "The 100 kills/hour figure is Conquest Capped's stated assumption, not a measured pull rate.",
      date: "2026-11-15",
      realm: "EU"
    },
    risk: "Contested and busy on PvP realms. Charm prices swing more than eggs. They ranked this first on 15 Nov after Burning Charms recovered.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Best Spots for Levels 30-45", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming/", date: "2026-11-16", site: "Conquest Capped" },
      { title: "WoW Forever Gold Farming: 10 Spots Priced on Nov 13", url: "https://frostyboost.com/blog/guides/wow-forever-gold-farming-guide", date: "2026-11-13", site: "FrostyBoost" }
    ]
  },
  {
    id: "arathi-thundering-exiles",
    name: "Thundering Exiles",
    zone: "Arathi Highlands",
    loc: "Middle elemental circle (Thundering Exile camp).",
    levelMin: 36, levelMax: 45, mobLevel: "38–39",
    faction: "both",
    factionNote: "Contested, same PvP risk as the other exile camps.",
    classes: ["any"],
    professions: [],
    bonusProfs: [],
    type: "mob",
    loot: [
      { id: 4480, name: "Thundering Charm", chance: 0.39 },
      { id: 7069, name: "Elemental Air", chance: 0.13 }
    ],
    sourced: {
      perKill: 1138,
      perKillNote: "11s 38c per kill, EU AH, 15 Nov 2026 (Conquest Capped). FrostyBoost had 11s 96c on 13 Nov.",
      killsPerHour: 100,
      killsPerHourNote: "Conquest Capped's 100 kills/hour assumption for this bracket.",
      date: "2026-11-15",
      realm: "EU"
    },
    risk: "Contested. Charm prices move quickly.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Best Spots for Levels 30-45", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming/", date: "2026-11-16", site: "Conquest Capped" },
      { title: "WoW Forever Gold Farming: 10 Spots Priced on Nov 13", url: "https://frostyboost.com/blog/guides/wow-forever-gold-farming-guide", date: "2026-11-13", site: "FrostyBoost" }
    ]
  },
  {
    id: "arathi-cresting-exiles",
    name: "Cresting Exiles",
    zone: "Arathi Highlands",
    loc: "Northeast elemental circle (Cresting Exile camp).",
    levelMin: 36, levelMax: 45, mobLevel: "38–39",
    faction: "both",
    factionNote: "Contested.",
    classes: ["any"],
    professions: [],
    bonusProfs: [],
    type: "mob",
    loot: [
      { id: 4481, name: "Cresting Charm", chance: 0.32 },
      { id: 7070, name: "Elemental Water", chance: 0.10 }
    ],
    sourced: {
      perKill: 874,
      perKillNote: "8s 74c per kill, EU AH, 15 Nov 2026. The source also lists Enchanted Water at 36%. FrostyBoost had 11s 36c on 13 Nov.",
      killsPerHour: 100,
      killsPerHourNote: "Conquest Capped's 100 kills/hour assumption for this bracket.",
      date: "2026-11-15",
      realm: "EU"
    },
    risk: "Contested. Ranking moved between 13 and 15 Nov as charm prices moved.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Best Spots for Levels 30-45", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "hinterlands-owlbeasts",
    name: "Hinterlands owlbeasts — Giant Eggs",
    zone: "The Hinterlands",
    loc: "Primitive and Savage Owlbeasts in the hills (Vicious Owlbeasts are in the same family of camps).",
    levelMin: 42, levelMax: 50, mobLevel: "42–47",
    faction: "both",
    factionNote: "Contested. Horde has Revantusk Village; Alliance has Aerie Peak.",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Skinning"],
    type: "mob",
    loot: [
      { id: 12207, name: "Giant Egg", chance: 0.50 },
      { id: 4599, name: "Cured Ham Steak", chance: 0.07 },
      { id: 5117, name: "Vibrant Plume", chance: 0.08 }
    ],
    sourced: {
      perKill: 1164,
      perKillNote: "11s 64c per kill, EU AH, 15 Nov 2026 (Conquest Capped). FrostyBoost had 13s 36c on 13 Nov, when eggs were higher. Giant Eggs were close to 1 gold on 7 Nov and about 18 silver by the 13th.",
      goldPerHourNote: "Conquest Capped: the top spots at about 100 kills/hour were about 10 to 14 gold/hour from loot. They call owlbeasts the steadier level-42 choice because egg prices swing less than charms.",
      killsPerHour: 100,
      killsPerHourNote: "Conquest Capped's 100 kills/hour assumption.",
      date: "2026-11-15",
      realm: "EU"
    },
    risk: "Contested and often farmed. Post eggs in modest stacks — dumping a full bag crashed the price in the first week. Skinning adds leather on top.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Best Spots for Levels 30-45", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming/", date: "2026-11-16", site: "Conquest Capped" },
      { title: "WoW Forever Gold Farming: 10 Spots Priced on Nov 13", url: "https://frostyboost.com/blog/guides/wow-forever-gold-farming-guide", date: "2026-11-13", site: "FrostyBoost" }
    ]
  },
  {
    id: "tanaris-rocs",
    name: "Rocs and Fire Rocs",
    zone: "Tanaris",
    loc: "North of Gadgetzan (Conquest Capped / FrostyBoost). forevergold.dad also lists Searing Rocs around 40, 65 for the level-50 bracket.",
    levelMin: 41, levelMax: 50, mobLevel: "41–45, Searing Rocs 47–49",
    faction: "both",
    factionNote: "Gadgetzan is neutral. Conquest Capped calls Tanaris one of the safer PvP-realm farms because the birds sit away from faction towns.",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Skinning"],
    type: "mob",
    loot: [
      { id: 12207, name: "Giant Egg", chance: 0.33 },
      { id: 3404, name: "Buzzard Wing", chance: 0.38 },
      { id: 5117, name: "Vibrant Plume", chance: 0.05 }
    ],
    sourced: {
      perKill: 1049,
      perKillNote: "10s 49c per kill for Roc / Fire Roc, EU AH, 15 Nov 2026 (33% Giant Egg, 38% Buzzard Wing, 5% Vibrant Plume).",
      goldPerHour: 77300,
      goldPerHourNote: "forevergold.dad, US Normal Horde, 20 Nov 2026 07:22 UTC: Searing Roc about 7g 73s per hour (no skinning). Alliance listing was about 8g 39s. Different mob (Searing Roc, 47–49) and a different AH than the EU per-kill figure.",
      killsPerHour: 100,
      killsPerHourNote: "The 100 kills/hour assumption applies to the EU per-kill ranking, not to the forevergold.dad hourly figure.",
      date: "2026-11-15",
      realm: "EU / US Normal"
    },
    risk: "Safer than Hinterlands or Arathi on a PvP realm, but still contested. Egg prices can collapse if everyone farms birds.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Best Spots for Levels 30-45", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming/", date: "2026-11-16", site: "Conquest Capped" },
      { title: "Best gold farm at level 50 on WoW Forever", url: "https://forevergold.dad/farm/level-50", date: "2026-11-20", site: "forevergold.dad" }
    ]
  },
  {
    id: "badlands-rock-elementals",
    name: "Rock Elementals",
    zone: "Badlands",
    loc: "Open elemental camps in the Badlands, levels 37–40.",
    levelMin: 37, levelMax: 45, mobLevel: "37–40",
    faction: "both",
    factionNote: "Contested; Kargath is the Horde hub.",
    classes: ["any"],
    professions: [],
    bonusProfs: [],
    type: "mob",
    loot: [{ id: 7067, name: "Elemental Earth", chance: 0.10 }],
    sourced: {
      perKill: 719,
      perKillNote: "7s 19c per kill, EU AH, 15 Nov 2026, also listing Jagged Piece of Stone 35% and Lifeless Stone 48% (those junk items are not id-mapped here).",
      killsPerHour: 100,
      killsPerHourNote: "Conquest Capped's 100 kills/hour assumption.",
      date: "2026-11-15",
      realm: "EU"
    },
    risk: "Contested. Live value here only prices Elemental Earth unless the other drops appear in the AH snapshot.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Best Spots for Levels 30-45", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "tanaris-steeljaw",
    name: "Steeljaw Snappers",
    zone: "Tanaris",
    loc: "Tanaris coast turtles.",
    levelMin: 42, levelMax: 48, mobLevel: "42–45",
    faction: "both",
    factionNote: "Neutral hub at Gadgetzan. Safer PvP-realm pick than Arathi.",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Skinning"],
    type: "mob",
    loot: [
      { id: 3712, name: "Turtle Meat", chance: 0.39 },
      { id: 7973, name: "Big-mouth Clam", chance: 0.32 }
    ],
    sourced: {
      perKill: 699,
      perKillNote: "6s 99c per kill, EU AH, 15 Nov 2026 (Speckled Shell Fragment 46%, Turtle Meat 39%, Big-mouth Clam 32%). Clams can contain pearls; Conquest Capped says a clam is worth about 4 silver on average and a Black Pearl is only a 4% open, so do not farm clams for pearls alone.",
      killsPerHour: 100,
      date: "2026-11-15",
      realm: "EU"
    },
    risk: "Open the clams you get. Do not make this a dedicated pearl farm.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Best Spots for Levels 30-45", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "dustwallow-mudrock",
    name: "Mudrock turtles",
    zone: "Dustwallow Marsh",
    loc: "Mudrock Borer and Mudrock Burrower on the Dustwallow coast.",
    levelMin: 39, levelMax: 46, mobLevel: "39–43",
    faction: "both",
    factionNote: "Theramore is Alliance; Brackenwall is Horde. The coast is contested.",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Skinning"],
    type: "mob",
    loot: [
      { id: 3712, name: "Turtle Meat", chance: 0.41 },
      { id: 7973, name: "Big-mouth Clam", chance: 0.33 }
    ],
    sourced: {
      perKill: 632,
      perKillNote: "6s 32c per kill, EU AH, 15 Nov 2026 (shell fragments 45%, Turtle Meat 41%, Big-mouth Clam 33%).",
      killsPerHour: 100,
      date: "2026-11-15",
      realm: "EU"
    },
    risk: "Contested coastline. Same clam caveat as Steeljaw Snappers.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Best Spots for Levels 30-45", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "feralas-longtooth",
    name: "Longtooth Howlers",
    zone: "Feralas",
    loc: "Longtooth Howler packs, levels 40–44.",
    levelMin: 40, levelMax: 48, mobLevel: "40–44",
    faction: "both",
    factionNote: "Contested. Camp Mojache is the Horde hub.",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Skinning"],
    type: "mob",
    loot: [
      { id: 12208, name: "Tender Wolf Meat", chance: 0.37 },
      { id: 12203, name: "Red Wolf Meat", chance: 0.46 },
      { id: 8146, name: "Wicked Claw", chance: 0.03 }
    ],
    sourced: {
      perKill: 626,
      perKillNote: "6s 26c per kill, EU AH, 15 Nov 2026.",
      killsPerHour: 100,
      date: "2026-11-15",
      realm: "EU"
    },
    risk: "Contested forest. Skinning is the usual extra.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Best Spots for Levels 30-45", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "tanaris-dunemaul-mageweave",
    name: "Dunemaul Enforcers — Mageweave",
    zone: "Tanaris",
    loc: "Dunemaul ogre camps, levels 46–47.",
    levelMin: 45, levelMax: 52, mobLevel: "46–47",
    faction: "both",
    factionNote: "Near the Gadgetzan side of Tanaris; still contested.",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Tailoring"],
    type: "cloth",
    loot: [
      { id: 4338, name: "Mageweave Cloth", chance: 0.73 },
      { id: 3928, name: "Superior Healing Potion", chance: 0.03 }
    ],
    sourced: {
      perKill: 427,
      perKillNote: "4s 27c per kill, EU AH, 15 Nov 2026 (Mageweave 73%, Cured Ham Steak 10%, Superior Healing Potion 3%).",
      killsPerHour: 100,
      date: "2026-11-15",
      realm: "EU"
    },
    risk: "Lower material value than the elemental or egg camps; volume of Mageweave is the point.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Best Spots for Levels 30-45", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "feralas-gordunni-mageweave",
    name: "Gordunni ogres — Mageweave",
    zone: "Feralas",
    loc: "Gordunni Ogre and Gordunni Mauler camps, levels 40–44.",
    levelMin: 40, levelMax: 48, mobLevel: "40–44",
    faction: "both",
    factionNote: "Contested. Camp Mojache is close for Horde.",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Tailoring"],
    type: "cloth",
    loot: [
      { id: 4338, name: "Mageweave Cloth", chance: 0.55 },
      { id: 3928, name: "Superior Healing Potion", chance: 0.03 }
    ],
    sourced: {
      perKill: 375,
      perKillNote: "3s 75c per kill, EU AH, 15 Nov 2026 (Mageweave 55%, Cured Ham Steak 10%, Superior Healing Potion 3%).",
      killsPerHour: 100,
      date: "2026-11-15",
      realm: "EU"
    },
    risk: "Contested ogre camps. A reliable Mageweave grind, not a top material farm.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Best Spots for Levels 30-45", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "thousand-needles-sparkleshell",
    name: "Sparkleshell Snappers",
    zone: "Thousand Needles",
    loc: "Sparkleshell turtles, levels 34–35.",
    levelMin: 33, levelMax: 40, mobLevel: "34–35",
    faction: "both",
    factionNote: "The Shimmering Flats are shared; Freewind Post is Horde.",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Skinning"],
    type: "mob",
    loot: [{ id: 3712, name: "Turtle Meat", chance: 0.32 }],
    sourced: {
      perKill: 405,
      perKillNote: "4s 5c per kill, EU AH, 15 Nov 2026 (Turtle Meat 32%, Speckled Shell Fragment 32%, Thick Scaly Tail 33%).",
      killsPerHour: 100,
      date: "2026-11-15",
      realm: "EU"
    },
    risk: "Lower value than the mid-40 turtle farms, but reachable earlier.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Best Spots for Levels 30-45", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "thousand-needles-vortex",
    name: "Swirling Vortexes — Elemental Air",
    zone: "Thousand Needles",
    loc: "Swirling Vortex, levels 33–34 on the open flats.",
    levelMin: 32, levelMax: 40, mobLevel: "33–34",
    faction: "both",
    classes: ["any"],
    professions: [],
    bonusProfs: [],
    type: "mob",
    loot: [{ id: 7069, name: "Elemental Air", chance: 0.13 }],
    sourced: {
      perKill: 296,
      perKillNote: "2s 96c per kill, EU AH, 15 Nov 2026, from a 13% Elemental Air drop.",
      killsPerHour: 100,
      date: "2026-11-15",
      realm: "EU"
    },
    risk: "Low per-kill value; an early elemental option, not a top farm.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Best Spots for Levels 30-45", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "hinterlands-gather-loop",
    name: "Hinterlands loop — leather, troll cloth, Mithril and herbs",
    zone: "The Hinterlands",
    loc: "A loop from Aerie Peak or Revantusk: Silvermane wolves, owlbeasts, Witherbark camps (including Shadra'Alor), southern cliffs for Mithril/Truesilver, then the eastern Vilebranch edges.",
    levelMin: 44, levelMax: 52, mobLevel: "44–50",
    faction: "both",
    factionNote: "Both factions have a town in the zone. Jintha'Alor terraces are crowded; the guide says most players turn back at the outer edges.",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Skinning", "Mining", "Herbalism"],
    type: "gathering",
    loot: [
      { id: 4304, name: "Thick Leather" }, { id: 4338, name: "Mageweave Cloth" },
      { id: 3858, name: "Mithril Ore" }, { id: 7911, name: "Truesilver Ore" },
      { id: 8838, name: "Sungrass" }, { id: 8831, name: "Purple Lotus" },
      { id: 3821, name: "Goldthorn" }, { id: 3358, name: "Khadgar's Whisker" },
      { id: 8153, name: "Wildvine" }
    ],
    sourced: {
      goldPerHour: 40000,
      goldPerHourNote: "botwowforever: with Skinning and Mining, a level 46–50 character makes roughly 3–5 gold an hour, about half from leather and ore and the rest from cloth, coin and greys. A herbalist instead of a miner earns about the same, sometimes more when Purple Lotus is in demand. Stored here as 4g/hour (the midpoint of that range).",
      date: "2026-11-20"
    },
    risk: "Contested. Vilebranch interiors are dangerous. Realm age and node competition move the number.",
    tag: "forever",
    sources: [
      { title: "Hinterlands Farming Route for Levels 44–50: Leather, Troll Cloth, Mithril and Herbs", url: "https://botwowforever.com/guides/hinterlands-farming-route", date: "2026-11-20", site: "botwowforever" }
    ]
  },
  {
    id: "mid-herbs-ore-sungrass",
    name: "Sungrass, Firebloom, Gold and Mithril",
    zone: "The Hinterlands, Feralas, Azshara, Tanaris, Badlands, Arathi Highlands, Alterac Mountains",
    loc: "Sungrass: Hinterlands, Feralas, Azshara. Firebloom: Tanaris, Badlands, Blasted Lands. Wintersbite: Alterac only. Truesilver: Hinterlands and Tanaris have the most veins. Gold: Arathi and the Badlands.",
    levelMin: 35, levelMax: 52, mobLevel: "",
    faction: "both",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Herbalism", "Mining"],
    type: "gathering",
    loot: [
      { id: 8838, name: "Sungrass" }, { id: 4625, name: "Firebloom" },
      { id: 3821, name: "Goldthorn" }, { id: 3818, name: "Fadeleaf" },
      { id: 3369, name: "Grave Moss" }, { id: 2776, name: "Gold Ore" },
      { id: 3858, name: "Mithril Ore" }, { id: 7911, name: "Truesilver Ore" }
    ],
    sourced: {
      note: "Conquest Capped (EU, 15 Nov 2026 listing prices): Sungrass 12s 88c, Truesilver Ore 12s 63c, Firebloom 9s 98c, Gold Ore 9s 87c, Mithril Ore 9s 74c, Goldthorn 6s 17c, Fadeleaf 5s 19c, Grave Moss 3s 38c. They note Firebloom fell from about 48s to 11s and Fadeleaf from 23s to 9s in two days. Wowhead Forever Mining sends 125–175 to Arathi, Alterac, STV and Thousand Needles, then 175–245 to Badlands, Searing Gorge, Feralas, Tanaris and the Hinterlands.",
      date: "2026-11-15",
      realm: "EU"
    },
    risk: "Node competition is high. Herb prices in this bracket already crashed once in week one.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Best Spots for Levels 30-45", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming/", date: "2026-11-16", site: "Conquest Capped" },
      { title: "Mining Profession Overview in Forever", url: "https://www.wowhead.com/forever/guide/professions/mining/overview-leveling", date: "2026-11-20", site: "Wowhead" },
      { title: "Herbalism Profession Overview in Forever", url: "https://www.wowhead.com/forever/guide/professions/herbalism/overview-leveling", date: "2026-11-20", site: "Wowhead" }
    ]
  },
  {
    id: "scarlet-monastery-silk",
    name: "Scarlet Monastery — Silk Cloth",
    zone: "Scarlet Monastery (Tirisfal Glades)",
    loc: "Any wing. Beta logs singled out Scarlet Scryers and Unfettered Spirits.",
    levelMin: 30, levelMax: 42, mobLevel: "30–40",
    faction: "both",
    factionNote: "The instance sits in Horde territory, but both factions run it constantly.",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Tailoring"],
    type: "instance",
    loot: [{ id: 4306, name: "Silk Cloth" }],
    sourced: {
      note: "theforeverguides (beta): Scarlet Monastery was the standout Silk farm. Scarlet Scryers dropped Silk on all 13 logged kills; Unfettered Spirits on 49% of 37. Small samples, no gold/hour.",
      date: "2026-11-04"
    },
    risk: "Beta logs, not live Forever drop tables. Busy instance; a normal reset run, not a workaround.",
    tag: "classic",
    sources: [
      { title: "WoW Forever Gold Farming by Level: 1–60 Brackets", url: "https://theforeverguides.com/gold-making/gold-by-level/", date: "2026-11-04", site: "theforeverguides" }
    ]
  },

  {
    id: "wpl-venom-mist-lurkers",
    name: "Venom Mist Lurkers",
    zone: "Western Plaguelands",
    loc: "Around 35, 63 in the Western Plaguelands.",
    levelMin: 49, levelMax: 58, mobLevel: "50–53",
    faction: "both",
    factionNote: "Contested plague zone. Horde has The Bulwark just south.",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Skinning"],
    type: "mob",
    loot: [
      { id: 14227, name: "Ironweb Spider Silk" },
      { id: 4337, name: "Thick Spider's Silk" },
      { id: 10285, name: "Shadow Silk" }
    ],
    sourced: {
      goldPerHour: 95100,
      goldPerHourNote: "forevergold.dad, US Normal, 20 Nov 2026 07:22 UTC: Horde about 9g 51s/hour, Alliance about 8g 60s/hour. The site ranks this as the best level-50 farm on that snapshot. No skinning is included in those numbers.",
      date: "2026-11-20",
      realm: "US Normal"
    },
    risk: "Contested. Hourly figures move with silk prices and with how many people pull the same camp.",
    tag: "forever",
    sources: [
      { title: "Best gold farm at level 50 on WoW Forever", url: "https://forevergold.dad/farm/level-50", date: "2026-11-20", site: "forevergold.dad" }
    ]
  },
  {
    id: "azshara-thunderhead",
    name: "Thunderhead Hippogryphs",
    zone: "Azshara",
    loc: "Around 18, 54 in Azshara.",
    levelMin: 48, levelMax: 56, mobLevel: "50–52",
    faction: "both",
    factionNote: "Contested. Valormok is the Horde outpost.",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Skinning"],
    type: "mob",
    loot: [{ id: 10450, name: "Undamaged Hippogryph Feather" }],
    sourced: {
      goldPerHour: 80900,
      goldPerHourNote: "forevergold.dad, US Normal Horde, 20 Nov 2026 07:22 UTC: about 8g 9s/hour (no skinning).",
      date: "2026-11-20",
      realm: "US Normal"
    },
    risk: "Contested coast. Feather demand drives the value.",
    tag: "forever",
    sources: [
      { title: "Best gold farm at level 50 on WoW Forever", url: "https://forevergold.dad/farm/level-50", date: "2026-11-20", site: "forevergold.dad" }
    ]
  },
  {
    id: "ungoro-ravasaurs",
    name: "Ravasaur Hunters",
    zone: "Un'Goro Crater",
    loc: "The southeastern raptor grounds in Un'Goro.",
    levelMin: 48, levelMax: 56, mobLevel: "50–52",
    faction: "both",
    factionNote: "Marshal's Refuge is a shared camp.",
    classes: ["any"],
    professions: ["Skinning"],
    bonusProfs: [],
    type: "gathering",
    loot: [
      { id: 8170, name: "Rugged Leather" },
      { id: 11018, name: "Un'Goro Soil" }
    ],
    sourced: {
      goldPerHour: 77200,
      goldPerHourNote: "forevergold.dad, US Normal Horde, 20 Nov 2026 07:22 UTC: Ravasaur Hunter about 7g 72s/hour. Skinning is required for the leather; the site's hourly number is listed as excluding skinning, so treat leather as extra if it is not already in their model.",
      date: "2026-11-20",
      realm: "US Normal"
    },
    risk: "Busy crater. Packs of raptors can overrun a undergeared 50.",
    tag: "forever",
    sources: [
      { title: "Best gold farm at level 50 on WoW Forever", url: "https://forevergold.dad/farm/level-50", date: "2026-11-20", site: "forevergold.dad" }
    ]
  },
  {
    id: "searing-gorge-lava-spiders",
    name: "Searing Lava Spiders",
    zone: "Searing Gorge",
    loc: "Around 53, 71 in Searing Gorge.",
    levelMin: 48, levelMax: 55, mobLevel: "49–51",
    faction: "both",
    factionNote: "Thorium Point is used by both factions. The gorge is contested.",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Skinning"],
    type: "mob",
    loot: [
      { id: 14227, name: "Ironweb Spider Silk" },
      { id: 4337, name: "Thick Spider's Silk" }
    ],
    sourced: {
      goldPerHour: 76500,
      goldPerHourNote: "forevergold.dad, US Normal Horde, 20 Nov 2026 07:22 UTC: about 7g 65s/hour (no skinning).",
      date: "2026-11-20",
      realm: "US Normal"
    },
    risk: "Fire damage and contested lava flats.",
    tag: "forever",
    sources: [
      { title: "Best gold farm at level 50 on WoW Forever", url: "https://forevergold.dad/farm/level-50", date: "2026-11-20", site: "forevergold.dad" }
    ]
  },
  {
    id: "tanaris-glasshide",
    name: "Glasshide Petrifiers",
    zone: "Tanaris",
    loc: "Around 33, 75 in southern Tanaris, level 49.",
    levelMin: 48, levelMax: 55, mobLevel: "49",
    faction: "both",
    factionNote: "Neutral Gadgetzan is the closest town.",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Skinning"],
    type: "mob",
    loot: [{ id: 8170, name: "Rugged Leather" }],
    sourced: {
      goldPerHour: 74800,
      goldPerHourNote: "forevergold.dad, US Normal Horde, 20 Nov 2026 07:22 UTC: about 7g 48s/hour (no skinning).",
      date: "2026-11-20",
      realm: "US Normal"
    },
    risk: "Southern Tanaris can be quiet; value depends on whatever materials they actually drop on your realm.",
    tag: "forever",
    sources: [
      { title: "Best gold farm at level 50 on WoW Forever", url: "https://forevergold.dad/farm/level-50", date: "2026-11-20", site: "forevergold.dad" }
    ]
  },
  {
    id: "ungoro-devilsaurs",
    name: "Devilsaurs — Devilsaur Leather",
    zone: "Un'Goro Crater",
    loc: "Wandering Tyrant Devilsaur, Devilsaur and Ironhide Devilsaur around the crater floor.",
    levelMin: 54, levelMax: 60, mobLevel: "54–58",
    faction: "both",
    factionNote: "Shared crater; still a PvP magnet because of the skin.",
    classes: ["any"],
    professions: ["Skinning"],
    bonusProfs: [],
    type: "gathering",
    loot: [
      { id: 15417, name: "Devilsaur Leather" },
      { id: 8170, name: "Rugged Leather" }
    ],
    sourced: {
      perKill: 17300,
      perKillNote: "Conquest Capped, PvP-realm AH, 15 Nov 2026: Tyrant Devilsaur 1g 79s per kill (2 skins, 89s 64c each); regular Devilsaur 1g 67s. They also mention about 8s of vendor loot. These are per-kill values, not gold/hour — spawn timers are long.",
      date: "2026-11-15",
      realm: "PvP realm AH"
    },
    risk: "Heavily contested. Long respawns. Requires 250+ Skinning (check the source before you walk out there under-skilled).",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Gold Farming at Level 60", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming-60/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "silithus-firetail",
    name: "Firetail Stingers — Heavy Scorpid Scale",
    zone: "Silithus",
    loc: "Firetail Stinger packs in Silithus.",
    levelMin: 57, levelMax: 60, mobLevel: "57–59",
    faction: "both",
    factionNote: "Cenarion Hold is a shared hub; the desert is still contested.",
    classes: ["any"],
    professions: ["Skinning"],
    bonusProfs: [],
    type: "gathering",
    loot: [
      { id: 15408, name: "Heavy Scorpid Scale" },
      { id: 19933, name: "Glowing Scorpid Blood" }
    ],
    sourced: {
      perKill: 3600,
      perKillNote: "Conquest Capped, PvP-realm AH, 15 Nov 2026: about 6s of loot plus 30s from the skin (Heavy Scorpid Scale 29s 90c, 75% drop) for about 36s a kill. They also list 7% Glowing Scorpid Blood.",
      date: "2026-11-15",
      realm: "PvP realm AH"
    },
    risk: "Contested hive outskirts. Needs Skinning in the late 200s.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Gold Farming at Level 60", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming-60/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "silithus-cyclone-warriors",
    name: "Cyclone Warriors — Essence of Air",
    zone: "Silithus",
    loc: "Air elementals (Cyclone Warriors) in Silithus.",
    levelMin: 57, levelMax: 60, mobLevel: "57–59",
    faction: "both",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Enchanting"],
    type: "mob",
    loot: [
      { id: 7082, name: "Essence of Air", chance: 0.04 },
      { id: 7069, name: "Elemental Air" }
    ],
    sourced: {
      perKill: 3600,
      perKillNote: "Conquest Capped, PvP-realm AH, 15 Nov 2026: about 36s a kill. Essence of Air listed at 7g 44s; the other mid-level air drops add a bit more. Drop chance for the essence is low.",
      date: "2026-11-15",
      realm: "PvP realm AH"
    },
    risk: "Contested. Value is almost entirely the rare essence. Prices already moved in week one.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Gold Farming at Level 60", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming-60/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "silithus-dredge-crushers",
    name: "Dredge Crushers — Sandworm Meat",
    zone: "Silithus",
    loc: "Dredge Crusher worms in Silithus.",
    levelMin: 57, levelMax: 60, mobLevel: "56–58",
    faction: "both",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Skinning", "Cooking"],
    type: "mob",
    loot: [{ id: 20424, name: "Sandworm Meat" }],
    sourced: {
      perKill: 3100,
      perKillNote: "Conquest Capped, PvP-realm AH, 15 Nov 2026: about 31s a kill, mostly Sandworm Meat.",
      date: "2026-11-15",
      realm: "PvP realm AH"
    },
    risk: "Contested desert. Cooking demand for the meat will change the number.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Gold Farming at Level 60", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming-60/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "ungoro-scorching-elementals",
    name: "Scorching Elementals — Essence of Fire",
    zone: "Un'Goro Crater",
    loc: "Fire Plume Ridge, mid-crater.",
    levelMin: 52, levelMax: 60, mobLevel: "53–55",
    faction: "both",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Enchanting", "Alchemy"],
    type: "mob",
    loot: [
      { id: 7078, name: "Essence of Fire", chance: 0.05 },
      { id: 7077, name: "Heart of Fire" },
      { id: 7068, name: "Elemental Fire" }
    ],
    sourced: {
      perKill: 3000,
      perKillNote: "Conquest Capped, PvP-realm AH, 15 Nov 2026: about 30s a kill, led by Essence of Fire at a low drop rate.",
      date: "2026-11-15",
      realm: "PvP realm AH"
    },
    risk: "Busy ridge. Fire damage. Essence prices swing.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Gold Farming at Level 60", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming-60/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "silithus-desert-ragers",
    name: "Desert Ragers and Desert Rumblers — Essence of Earth",
    zone: "Silithus",
    loc: "Desert Rager and Desert Rumbler earth elementals.",
    levelMin: 56, levelMax: 60, mobLevel: "56–59",
    faction: "both",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Enchanting"],
    type: "mob",
    loot: [
      { id: 7076, name: "Essence of Earth", chance: 0.033 },
      { id: 7067, name: "Elemental Earth" }
    ],
    sourced: {
      perKill: 2900,
      perKillNote: "Conquest Capped, PvP-realm AH, 15 Nov 2026: Desert Rager about 29s a kill, Desert Rumbler about 18s. Essence of Earth was 6g 90s; drop rates about 3.3% (Rager) and 2.2% (Rumbler).",
      date: "2026-11-15",
      realm: "PvP realm AH"
    },
    risk: "Contested. Low drop rate on the expensive essence.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Gold Farming at Level 60", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming-60/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "winterspring-frostsabers",
    name: "Frostsabers",
    zone: "Winterspring",
    loc: "Frostsaber, Frostsaber Pride Watcher, Huntress and Stalker packs in Winterspring.",
    levelMin: 56, levelMax: 60, mobLevel: "56–60",
    faction: "both",
    factionNote: "Everlook is a neutral town. The frostsaber grounds are still contested.",
    classes: ["any"],
    professions: ["Skinning"],
    bonusProfs: [],
    type: "gathering",
    loot: [
      { id: 15422, name: "Frostsaber Leather" },
      { id: 8170, name: "Rugged Leather" }
    ],
    sourced: {
      perKill: 3100,
      perKillNote: "Conquest Capped, PvP-realm AH, 15 Nov 2026: up to 7s of loot plus 24s from the skin (Frostsaber Leather), about 31s a kill at the top of that family.",
      date: "2026-11-15",
      realm: "PvP realm AH"
    },
    risk: "Contested snow. Needs high Skinning.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Gold Farming at Level 60", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming-60/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "wpl-diseased-bears",
    name: "Diseased bears — Warbear Leather",
    zone: "Western Plaguelands",
    loc: "Diseased bears in the Western Plaguelands.",
    levelMin: 51, levelMax: 58, mobLevel: "51–53",
    faction: "both",
    factionNote: "The Bulwark is Horde; Chillwind is Alliance. The fields are contested.",
    classes: ["any"],
    professions: ["Skinning"],
    bonusProfs: [],
    type: "gathering",
    loot: [
      { id: 15419, name: "Warbear Leather" },
      { id: 8170, name: "Rugged Leather" }
    ],
    sourced: {
      perKill: 2300,
      perKillNote: "Conquest Capped, PvP-realm AH, 15 Nov 2026: about 23s a kill from the skin (Warbear Leather).",
      date: "2026-11-15",
      realm: "PvP realm AH"
    },
    risk: "Contested plague fields. Needs Skinning.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Gold Farming at Level 60", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming-60/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "deadwind-runecloth",
    name: "Deadwind ogres — Runecloth",
    zone: "Deadwind Pass",
    loc: "Ogre camps in Deadwind Pass.",
    levelMin: 55, levelMax: 60, mobLevel: "55–58",
    faction: "both",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Tailoring"],
    type: "cloth",
    loot: [{ id: 14047, name: "Runecloth" }],
    sourced: {
      perKill: 1450,
      perKillNote: "Conquest Capped, PvP-realm AH, 15 Nov 2026: 14–15s a kill from Runecloth and vendor loot.",
      date: "2026-11-15",
      realm: "PvP realm AH"
    },
    risk: "A compact camp, but a lower material value than essence or special-leather farms.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Gold Farming at Level 60", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming-60/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "blasted-lands-felguards",
    name: "Felguard Sentries — Felcloth",
    zone: "Blasted Lands",
    loc: "Felguard Sentry camps in the Blasted Lands.",
    levelMin: 55, levelMax: 60, mobLevel: "55–57",
    faction: "both",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Tailoring", "Enchanting"],
    type: "cloth",
    loot: [
      { id: 14256, name: "Felcloth", chance: 0.10 },
      { id: 14047, name: "Runecloth" }
    ],
    sourced: {
      perKill: 1400,
      perKillNote: "Conquest Capped, PvP-realm AH, 15 Nov 2026: about 14s a kill, including a 10% Felcloth drop.",
      date: "2026-11-15",
      realm: "PvP realm AH"
    },
    risk: "Felguards hit hard. Felcloth prices will move with Tailoring demand.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Gold Farming at Level 60", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming-60/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "epl-water-elementals",
    name: "Eastern Plaguelands water elementals — Essence of Water",
    zone: "Eastern Plaguelands",
    loc: "Water elementals along the EPL coast.",
    levelMin: 54, levelMax: 60, mobLevel: "54–57",
    faction: "both",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Enchanting"],
    type: "mob",
    loot: [
      { id: 7080, name: "Essence of Water", chance: 0.027 },
      { id: 7079, name: "Globe of Water" },
      { id: 7070, name: "Elemental Water" }
    ],
    sourced: {
      perKill: 1250,
      perKillNote: "Conquest Capped, PvP-realm AH, 15 Nov 2026: 12–13s a kill, down from 25s two days earlier. Essence of Water drop about 2.3–3.1%. Stored as 12s 50c, the midpoint of that 12–13s range.",
      date: "2026-11-15",
      realm: "PvP realm AH"
    },
    risk: "Already halved in two days once Essence of Water crashed. Expect more swings.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Gold Farming at Level 60", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming-60/", date: "2026-11-16", site: "Conquest Capped" }
    ]
  },
  {
    id: "thorium-dreamfoil-routes",
    name: "Thorium, Dreamfoil, Plaguebloom and Mountain Silversage",
    zone: "Winterspring, Un'Goro, Burning Steppes, Eastern / Western Plaguelands, Azshara, Felwood, Searing Gorge, Silithus",
    loc: "Wowhead Forever: Azshara, Felwood, Searing Gorge, Burning Steppes, Ungoro, Winterspring, EPL and WPL for late Mining. Herbalism: Dreamfoil and Mountain Silversage in Un'Goro, Azshara and Winterspring; Plaguebloom and Icecap in the Plaguelands and Winterspring; Black Lotus in Winterspring, Burning Steppes, EPL and Silithus.",
    levelMin: 50, levelMax: 60, mobLevel: "",
    faction: "both",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Herbalism", "Mining"],
    type: "gathering",
    loot: [
      { id: 10620, name: "Thorium Ore" }, { id: 12363, name: "Arcane Crystal" },
      { id: 13463, name: "Dreamfoil" }, { id: 13466, name: "Plaguebloom" },
      { id: 13465, name: "Mountain Silversage" }, { id: 13467, name: "Icecap" },
      { id: 8845, name: "Ghost Mushroom" }, { id: 8839, name: "Blindweed" },
      { id: 13468, name: "Black Lotus" }
    ],
    sourced: {
      note: "Conquest Capped, PvP-realm AH, 15 Nov 2026 listing prices: Thorium Ore 5s 84c, Dreamfoil 5s 22c, Plaguebloom 8s 89c, Mountain Silversage 12s 32c, Icecap 3s 97c. Wowhead's Forever profession guides map the routes. They did not publish a gold/hour for a loop.",
      date: "2026-11-15",
      realm: "PvP realm AH"
    },
    risk: "Black Lotus and Arcane Crystal are rare and heavily camped. Mid-tier herb prices already dipped in week one.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Gold Farming at Level 60", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming-60/", date: "2026-11-16", site: "Conquest Capped" },
      { title: "Mining Profession Overview in Forever", url: "https://www.wowhead.com/forever/guide/professions/mining/overview-leveling", date: "2026-11-20", site: "Wowhead" },
      { title: "Herbalism Profession Overview in Forever", url: "https://www.wowhead.com/forever/guide/professions/herbalism/overview-leveling", date: "2026-11-20", site: "Wowhead" }
    ]
  },
  {
    id: "alchemy-transmutes",
    name: "Alchemy transmutes (Arcanite and essences)",
    zone: "Any city with an alchemy trainer and a quiet AH",
    loc: "Daily (or cooldown) transmutes. Wowhead Forever Alchemy lists Arcanite, the essence transmutes, and the rest of the high-end table.",
    levelMin: 50, levelMax: 60, mobLevel: "",
    faction: "both",
    classes: ["any"],
    professions: ["Alchemy"],
    bonusProfs: [],
    type: "craft",
    loot: [
      { id: 12360, name: "Arcanite Bar" },
      { id: 12359, name: "Thorium Bar" },
      { id: 12363, name: "Arcane Crystal" },
      { id: 7078, name: "Essence of Fire" },
      { id: 7082, name: "Essence of Air" },
      { id: 7076, name: "Essence of Earth" },
      { id: 7080, name: "Essence of Water" }
    ],
    sourced: {
      note: "Wowhead's Forever Alchemy overview: transmutes (especially Arcanite) are a standard cooldown gold method once you can buy or farm the crystals and bars. Check live prices before each transmute — there is no published gold/hour, because it depends on cooldown and on whether the output beats the reagents.",
      date: "2026-11-20"
    },
    risk: "You can lose gold if Arcane Crystals or essences are mispriced. This is a cooldown flip, not a grind.",
    tag: "forever",
    sources: [
      { title: "Alchemy Profession Overview in Forever", url: "https://www.wowhead.com/forever/guide/professions/alchemy/overview-leveling", date: "2026-11-20", site: "Wowhead" }
    ]
  },
  {
    id: "ah-price-check",
    name: "Auction House price-check flips",
    zone: "Orgrimmar, Undercity, Thunder Bluff, Stormwind, Ironforge, Darnassus, or a neutral AH",
    loc: "Scan trade goods this site already prices (cloth, leather, herbs, ores, essences) and buy under market when a listing is clearly cheap.",
    levelMin: 1, levelMax: 60, mobLevel: "",
    faction: "both",
    classes: ["any"],
    professions: [],
    bonusProfs: [],
    type: "craft",
    loot: [
      { id: 14047, name: "Runecloth" }, { id: 4338, name: "Mageweave Cloth" },
      { id: 8170, name: "Rugged Leather" }, { id: 13463, name: "Dreamfoil" },
      { id: 10620, name: "Thorium Ore" }
    ],
    sourced: {
      note: "Method, not a camp. FrostyBoost (13 Nov) and Conquest Capped (15–16 Nov) both show mid-bracket materials crashing in days (Giant Eggs from about 1 gold to 18s; Firebloom from 48s to 11s). Forever Goblin and this site's Profession guide exist to compare listings to a live market value. No gold/hour — only flip what is clearly under the current market, and count the deposit.",
      date: "2026-11-16"
    },
    risk: "You can lose the deposit and the gold if the market keeps falling. Never buy from unofficial gold sellers.",
    tag: "forever",
    sources: [
      { title: "WoW Forever — Gold Farming Guide: Best Spots for Levels 30-45", url: "https://conquestcapped.com/guides/wow-forever/wow-forever-gold-farming/", date: "2026-11-16", site: "Conquest Capped" },
      { title: "WoW Forever Gold Farming: 10 Spots Priced on Nov 13", url: "https://frostyboost.com/blog/guides/wow-forever-gold-farming-guide", date: "2026-11-13", site: "FrostyBoost" }
    ]
  },
  {
    id: "maraudon-orange-purple",
    name: "Maraudon orange-to-purple — Mage AoE",
    zone: "Maraudon (Desolace)",
    loc: "The usual orange-to-purple loop for a Mage who can AoE packs of same-level or slightly lower satyrs and elementals, then reset.",
    levelMin: 46, levelMax: 54, mobLevel: "44–48",
    faction: "both",
    factionNote: "Desolace is contested. Both factions run the instance.",
    classes: ["Mage"],
    professions: [],
    bonusProfs: ["Tailoring"],
    type: "instance",
    loot: [
      { id: 4306, name: "Silk Cloth" },
      { id: 4338, name: "Mageweave Cloth" },
      { id: 3928, name: "Superior Healing Potion" }
    ],
    sourced: {
      note: "warcraftmaps.com documents this as a Classic 1.60.1 Mage farm using published spawn data (Maraudon was closed on the Forever beta, so there is no beta gold/hour). Warcraft Tavern's Forever Mage AoE guide says AoE pulling was slowed and you should farm same-level or lower packs, not 9–12 high-level packs. Tag is Classic-era, likely applies. No gold/hour is stored because none of the Forever sources published one.",
      date: "2026-11-20"
    },
    risk: "Classic spawn data, not a live Forever clear-time. Warcraft Tavern reports AoE was nerfed relative to some private-server / Season of Discovery habits. A normal instance reset, not a dungeon workaround.",
    tag: "classic",
    sources: [
      { title: "Mage Gold Farm in Maraudon", url: "https://warcraftmaps.com/guides/mage-gold-farm-maraudon/", date: "2026-11-20", site: "warcraftmaps" },
      { title: "WoW Forever Mage AoE Farming Guide", url: "https://www.warcrafttavern.com/wow-classic/guides/wow-forever-mage-aoe-farming/", date: "2026-11-20", site: "Warcraft Tavern" }
    ]
  }
];
