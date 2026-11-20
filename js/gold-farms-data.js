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
  disclaimer: "Gold per hour and gold per kill move with the Auction House and with how fast you pull. Per-kill figures use sourced drop chances × average stack size × this site’s current US Normal Horde AH market value, plus a sourced coin drop and grey vendor value when those exist. When a source also published a kills/hour figure, that rate is used. Otherwise gold/hour is estimated as gold/kill × kills/min × 60, using a default of 2 kills/min (120/hour) for a typical solo at-level single-pull grind — the same “two kills a minute” ByteTavern uses, and in the 100–150/hour range Classic guides often cite (Conquest Capped assumes 100/hour). That estimate is marked with a ~ and does not change sourced rows. Sourced snapshots are not promises. Nothing here invents drop rates."
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
    loot: [
      { id: 249427, name: "Pristine Leather" },
      { id: 2318, name: "Light Leather" },
      { id: 2319, name: "Medium Leather" }
    ],

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
    loot: [
      { id: 2447, name: "Peacebloom" },
      { id: 765, name: "Silverleaf" },
      { id: 2449, name: "Earthroot" },
      { id: 785, name: "Mageroyal" },
      { id: 2450, name: "Briarthorn" },
      { id: 249399, name: "Frilled Lichen" }
    ],

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
    loot: [
      { id: 2770, name: "Copper Ore" },
      { id: 2771, name: "Tin Ore" },
      { id: 2775, name: "Silver Ore" },
      { id: 249391, name: "Pyrite" }
    ],

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
    loot: [
      { id: 2589, name: "Linen Cloth", chance: 0.77, qty: 1, chanceNote: "about 0.77 Linen per kill in Classic data for level 10–15 humanoids", yieldPerKill: true, kind: "drop", vendor: 13 },
      { id: 4537, name: "Tel'Abim Banana", chance: 0.034162, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 6 of 11 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 6 },
      { id: 2287, name: "Haunch of Meat", chance: 0.02891, qty: 1.323, qtyMin: 1, qtyMax: 3, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 5 of 11 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 6 },
      { id: 1179, name: "Ice Cold Milk", chance: 0.023688, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 6 },
      { id: 858, name: "Lesser Healing Potion", chance: 0.014192, qty: 1.093, qtyMin: 1, qtyMax: 2, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 25 },
      { id: 2455, name: "Minor Mana Potion", chance: 0.006914, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 10 },
      { id: 2770, name: "Copper Ore", chance: 0.001267, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 10 of 11 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 5 },
      { id: 2835, name: "Rough Stone", chance: 0.000782, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 8 of 11 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 2 },
      { id: 2771, name: "Tin Ore", chance: 0.00009, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 11 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 25 },
      { id: 2836, name: "Coarse Stone", chance: 0.000068, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 11 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 15 },
      { id: 1206, name: "Moss Agate", chance: 0.000053, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 11 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 400 },
      { id: 765, name: "Silverleaf", chance: 0.000053, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 11 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 10 }
    ],
    coinPerKill: 14.53,
    coinNote: "Wowhead Classic “average money dropped,” spawn-weighted across 11 of 11 listed mob types that have a published coin drop.",
    vendorTrashPerKill: 11.6,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Razormane Hunter (3265), Razormane Defender (3266), Razormane Water Seeker (3267), Razormane Thornweaver (3268), Razormane Geomancer (3269), Razormane Mystic (3271), Kolkar Wrangler (3272), Kolkar Stormer (3273), Kolkar Pack Runner (3274), Kolkar Marauder (3275), Kolkar Bloodcharger (3397)"
    },

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
    loot: [
      { id: 2589, name: "Linen Cloth", chance: 0.87, qty: 1, chanceNote: "ByteTavern: 0.87 Linen per kill at this camp in Classic data", yieldPerKill: true, kind: "drop", vendor: 13 },
      { id: 2287, name: "Haunch of Meat", chance: 0.050163, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 6 },
      { id: 1179, name: "Ice Cold Milk", chance: 0.031301, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 6 },
      { id: 1506, name: "Warped Leather Gloves", chance: 0.024618, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 51 },
      { id: 858, name: "Lesser Healing Potion", chance: 0.01178, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 25 },
      { id: 2455, name: "Minor Mana Potion", chance: 0.007821, qty: 1.1526, qtyMin: 1, qtyMax: 2, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 6 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 10 },
      { id: 785, name: "Mageroyal", chance: 0.007114, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 20 },
      { id: 2450, name: "Briarthorn", chance: 0.006911, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 25 },
      { id: 2447, name: "Peacebloom", chance: 0.006911, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 10 },
      { id: 2449, name: "Earthroot", chance: 0.006707, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 20 },
      { id: 765, name: "Silverleaf", chance: 0.006504, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 10 },
      { id: 2770, name: "Copper Ore", chance: 0.001337, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 4 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 5 },
      { id: 2835, name: "Rough Stone", chance: 0.000907, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 2 },
      { id: 2771, name: "Tin Ore", chance: 0.000695, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 25 },
      { id: 2836, name: "Coarse Stone", chance: 0.000659, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 15 }
    ],
    coinPerKill: 16.35,
    coinNote: "Wowhead Classic “average money dropped,” spawn-weighted across 7 of 7 listed mob types that have a published coin drop.",
    vendorTrashPerKill: 24.36,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Riverpaw Gnoll (117), Riverpaw Mongrel (123), Riverpaw Brute (124), Riverpaw Scout (500), Riverpaw Herbalist (501), Riverpaw Shaman (1065), Riverpaw Miner (1426)"
    },

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
    loot: [
      { id: 2592, name: "Wool Cloth", chance: 0.243584, qty: 1.5, qtyMin: 1, qtyMax: 2, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 33 },
      { id: 2589, name: "Linen Cloth", chance: 0.125818, qty: 2, qtyMin: 1, qtyMax: 3, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 13 },
      { id: 4306, name: "Silk Cloth", chance: 0.048792, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 150 },
      { id: 4542, name: "Moist Cornbread", chance: 0.046364, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 25 },
      { id: 1205, name: "Melon Juice", chance: 0.02487, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 25 },
      { id: 929, name: "Healing Potion", chance: 0.013519, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 75 },
      { id: 3385, name: "Lesser Mana Potion", chance: 0.006714, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 30 },
      { id: 3012, name: "Scroll of Agility", chance: 0.00561, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 50 },
      { id: 954, name: "Scroll of Strength", chance: 0.005065, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 50 },
      { id: 1478, name: "Scroll of Protection II", chance: 0.003779, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 62 },
      { id: 1712, name: "Scroll of Spirit II", chance: 0.00339, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 62 },
      { id: 1206, name: "Moss Agate", chance: 0.00187, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 400 },
      { id: 2771, name: "Tin Ore", chance: 0.000909, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 5 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 25 },
      { id: 2770, name: "Copper Ore", chance: 0.000455, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 5 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 5 },
      { id: 2836, name: "Coarse Stone", chance: 0.000455, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 5 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 15 },
      { id: 2835, name: "Rough Stone", chance: 0.000065, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 5 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 2 }
    ],
    coinPerKill: 57.9,
    coinNote: "Wowhead Classic “average money dropped,” spawn-weighted across 5 of 5 listed mob types that have a published coin drop.",
    vendorTrashPerKill: 36.6,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Bael'dun Excavator (3374), Bael'dun Foreman (3375), Bael'dun Soldier (3376), Bael'dun Rifleman (3377), Bael'dun Officer (3378)"
    },

    sourced: {
      note: "Per-kill gold uses Classic 1.12 world data (ZugZugDB / VMaNGOS), spawn-weighted across the five Bael'dun types at Bael Modan. Wool is 24.36% for 1–2 cloth (expected 0.365/kill), plus Linen, Silk, coin, and vendor trash. theforeverguides beta logs (Officers 49% of 35, Excavators 47% of 59) were smaller samples and were not used for the calculation.",
      date: "2026-11-04"
    },
    risk: "Drop rates are Classic 1.12 world data, not a published Forever table. Tag is Classic-era, likely applies.",
    tag: "classic",
    sources: [
      { title: "WoW Forever Gold Farming by Level: 1–60 Brackets", url: "https://theforeverguides.com/gold-making/gold-by-level/", date: "2026-11-04", site: "theforeverguides" },
      { title: "ZugZugDB — about the 1.12 world data", url: "https://zugzugdb.com/about", date: "2026-11-20", site: "ZugZugDB" },
      { title: "Wowhead Classic NPC money drops (e.g. Bael'dun Officer)", url: "https://www.wowhead.com/classic/npc=3378", date: "2026-11-20", site: "Wowhead Classic" }
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
    loot: [
      { id: 2319, name: "Medium Leather", chance: 0.536716, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 50 },
      { id: 4234, name: "Heavy Leather", chance: 0.029135, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 4 listed mob types that have a published percentage for this item.", kind: "skin", vendor: 150 },
      { id: 3685, name: "Raptor Egg", chance: 0.661425, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 4 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 71 },
      { id: 2318, name: "Light Leather", chance: 0.354622, qty: 1.5, qtyMin: 1, qtyMax: 2, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 3 of 4 listed mob types that have a published percentage for this item.", kind: "skin", vendor: 15 },
      { id: 1697, name: "Keen Raptor Tooth", chance: 0.208, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 4 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 445 },
      { id: 3180, name: "Flecked Raptor Scale", chance: 0.086811, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 3 of 4 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 168 },
      { id: 5635, name: "Sharp Claw", chance: 0.068207, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 3 of 4 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 45 },
      { id: 4232, name: "Medium Hide", chance: 0.051216, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 125 },
      { id: 783, name: "Light Hide", chance: 0.025189, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 3 of 4 listed mob types that have a published percentage for this item.", kind: "skin", vendor: 50 },
      { id: 5637, name: "Large Fang", chance: 0.006203, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 4 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 75 },
      { id: 4235, name: "Heavy Hide", chance: 0.003122, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 4 listed mob types that have a published percentage for this item.", kind: "skin", vendor: 200 },
      { id: 1206, name: "Moss Agate", chance: 0.001419, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 3 of 4 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 400 },
      { id: 2770, name: "Copper Ore", chance: 0.000635, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 4 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 5 },
      { id: 2450, name: "Briarthorn", chance: 0.000243, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 4 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 25 },
      { id: 2771, name: "Tin Ore", chance: 0.000149, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 4 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 25 }
    ],
    vendorTrashPerKill: 10.06,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Mottled Raptor (1020), Mottled Screecher (1021), Mottled Scytheclaw (1022), Mottled Razormaw (1023)"
    },

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
    loot: [
      
    ],

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
    loot: [
      { id: 2589, name: "Linen Cloth" },
      { id: 2318, name: "Light Leather" },
      { id: 2770, name: "Copper Ore" },
      { id: 2447, name: "Peacebloom" }
    ],

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
      { id: 4479, name: "Burning Charm", chance: 0.34, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "quest" },
      { id: 7068, name: "Elemental Fire", chance: 0.11, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 400 },
      { id: 3857, name: "Coal", chance: 0.12, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 125 },
      { id: 4787, name: "Burning Pitch", chance: 0.485, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 577 }
    ],
    vendorTrashPerKill: 5.91,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Burning Exile (2760)"
    },

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
      { id: 4480, name: "Thundering Charm", chance: 0.39, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "quest" },
      { id: 7069, name: "Elemental Air", chance: 0.13, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 400 }
    ],
    vendorTrashPerKill: 7.97,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Thundering Exile (2762)"
    },

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
      { id: 4481, name: "Cresting Charm", chance: 0.32, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "quest" },
      { id: 7070, name: "Elemental Water", chance: 0.1, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 400 },
      { id: 4791, name: "Enchanted Water", chance: 0.582, qty: 3, qtyMin: 1, qtyMax: 5, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 133 }
    ],
    vendorTrashPerKill: 1.02,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Cresting Exile (2761)"
    },

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
      { id: 12207, name: "Giant Egg", chance: 0.5, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 150 },
      { id: 4599, name: "Cured Ham Steak", chance: 0.07, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 100 },
      { id: 5117, name: "Vibrant Plume", chance: 0.08, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 825 },
      { id: 11417, name: "Feathery Wing", chance: 0.053354, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 1204 },
      { id: 5636, name: "Delicate Feather", chance: 0.045061, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 75 },
      { id: 8146, name: "Wicked Claw", chance: 0.030866, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 500 },
      { id: 1645, name: "Moonberry Juice", chance: 0.024268, qty: 1.3256, qtyMin: 1, qtyMax: 3, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 100 },
      { id: 3928, name: "Superior Healing Potion", chance: 0.014195, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 250 },
      { id: 6149, name: "Greater Mana Potion", chance: 0.013537, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 120 },
      { id: 3858, name: "Mithril Ore", chance: 0.001, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 250 },
      { id: 8838, name: "Sungrass", chance: 0.001, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 60 }
    ],
    coinPerKill: 254.28,
    coinNote: "Wowhead Classic “average money dropped,” spawn-weighted across 3 of 3 listed mob types that have a published coin drop.",
    vendorTrashPerKill: 163,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Vicious Owlbeast (2927), Primitive Owlbeast (2928), Savage Owlbeast (2929)"
    },

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
      { id: 12207, name: "Giant Egg", chance: 0.33, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 150 },
      { id: 3404, name: "Buzzard Wing", chance: 0.38, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 181 },
      { id: 5117, name: "Vibrant Plume", chance: 0.05, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 825 },
      { id: 1464, name: "Buzzard Talon", chance: 0.447486, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 71 },
      { id: 5829, name: "Razor-sharp Beak", chance: 0.225932, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 804 },
      { id: 11418, name: "Hollow Wing Bone", chance: 0.224932, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 604 },
      { id: 11417, name: "Feathery Wing", chance: 0.066527, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 1204 },
      { id: 8146, name: "Wicked Claw", chance: 0.030176, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 500 },
      { id: 3858, name: "Mithril Ore", chance: 0.000284, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 3 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 250 }
    ],
    vendorTrashPerKill: 13.34,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Roc (5428), Fire Roc (5429), Searing Roc (5430)"
    },

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
    loot: [
      { id: 7067, name: "Elemental Earth", chance: 0.1, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 400 },
      { id: 4784, name: "Lifeless Stone", chance: 0.564568, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 360 },
      { id: 7912, name: "Solid Stone", chance: 0.277227, qty: 2.0063, qtyMin: 1, qtyMax: 4, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 100 },
      { id: 4552, name: "Smooth Stone Chip", chance: 0.256136, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 530 },
      { id: 8150, name: "Deeprock Salt", chance: 0.217432, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 250 },
      { id: 4553, name: "Jagged Piece of Stone", chance: 0.192886, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 4 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 411 },
      { id: 4554, name: "Shiny Polished Stone", chance: 0.075136, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 4 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 708 },
      { id: 7075, name: "Core of Earth", chance: 0.004227, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 4 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 400 },
      { id: 3858, name: "Mithril Ore", chance: 0.00375, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 250 },
      { id: 2838, name: "Heavy Stone", chance: 0.000341, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 4 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 60 }
    ],
    vendorTrashPerKill: 12.82,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Rock Elemental (92), Lesser Rock Elemental (2735), Greater Rock Elemental (2736), Enraged Rock Elemental (2791)"
    },

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
      { id: 3712, name: "Turtle Meat", chance: 0.39, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 87 },
      { id: 7973, name: "Big-mouth Clam", chance: 0.32, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 46 },
      { id: 4555, name: "Thick Scaly Tail", chance: 0.544, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 155 },
      { id: 8167, name: "Turtle Scale", chance: 0.5, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 100 },
      { id: 4556, name: "Speckled Shell Fragment", chance: 0.496, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 903 },
      { id: 4304, name: "Thick Leather", chance: 0.49, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 300 },
      { id: 4234, name: "Heavy Leather", chance: 0.43, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 150 },
      { id: 4603, name: "Raw Spotted Yellowtail", chance: 0.109, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 4 },
      { id: 4235, name: "Heavy Hide", chance: 0.03, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 200 },
      { id: 8169, name: "Thick Hide", chance: 0.03, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 500 }
    ],
    vendorTrashPerKill: 3.15,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Steeljaw Snapper (14123)"
    },

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
      { id: 3712, name: "Turtle Meat", chance: 0.41, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 87 },
      { id: 7973, name: "Big-mouth Clam", chance: 0.33, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 46 },
      { id: 4234, name: "Heavy Leather", chance: 0.746429, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 150 },
      { id: 4555, name: "Thick Scaly Tail", chance: 0.533357, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 155 },
      { id: 4556, name: "Speckled Shell Fragment", chance: 0.375298, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 903 },
      { id: 8167, name: "Turtle Scale", chance: 0.277857, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 100 },
      { id: 4304, name: "Thick Leather", chance: 0.219524, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 300 },
      { id: 6362, name: "Raw Rockscale Cod", chance: 0.115, qty: 1.5, qtyMin: 1, qtyMax: 2, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 3 of 5 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 4 },
      { id: 4235, name: "Heavy Hide", chance: 0.03119, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 200 },
      { id: 8169, name: "Thick Hide", chance: 0.002857, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 5 listed mob types that have a published percentage for this item.", kind: "skin", vendor: 500 }
    ],
    vendorTrashPerKill: 3.21,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Mudrock Tortoise (4396), Mudrock Spikeshell (4397), Mudrock Burrower (4398), Mudrock Borer (4399), Mudrock Snapjaw (4400)"
    },

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
      { id: 12208, name: "Tender Wolf Meat", chance: 0.37, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 150 },
      { id: 12203, name: "Red Wolf Meat", chance: 0.46, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 87 },
      { id: 8146, name: "Wicked Claw", chance: 0.03, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 500 },
      { id: 4304, name: "Thick Leather", chance: 0.506, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 300 },
      { id: 4234, name: "Heavy Leather", chance: 0.393445, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 150 },
      { id: 4583, name: "Thick Furry Mane", chance: 0.330832, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 812 },
      { id: 4584, name: "Large Trophy Paw", chance: 0.142219, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 937 },
      { id: 4235, name: "Heavy Hide", chance: 0.042109, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 200 },
      { id: 8169, name: "Thick Hide", chance: 0.038723, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 500 },
      { id: 8368, name: "Thick Wolfhide", chance: 0.019723, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 1000 },
      { id: 8838, name: "Sungrass", chance: 0.000555, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 2 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 60 }
    ],
    vendorTrashPerKill: 5.51,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Longtooth Runner (5286), Longtooth Howler (5287)"
    },

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
      { id: 4338, name: "Mageweave Cloth", chance: 0.73, qty: 1, yieldPerKill: true, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 250 },
      { id: 3928, name: "Superior Healing Potion", chance: 0.03, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 250 },
      { id: 4599, name: "Cured Ham Steak", chance: 0.046615, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 100 },
      { id: 1645, name: "Moonberry Juice", chance: 0.023704, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 100 },
      { id: 6149, name: "Greater Mana Potion", chance: 0.014037, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 120 },
      { id: 8831, name: "Purple Lotus", chance: 0.000196, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 5 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 300 }
    ],
    coinPerKill: 295.61,
    coinNote: "Wowhead Classic “average money dropped,” spawn-weighted across 5 of 5 listed mob types that have a published coin drop.",
    vendorTrashPerKill: 169,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Dunemaul Ogre (5471), Dunemaul Enforcer (5472), Dunemaul Ogre Mage (5473), Dunemaul Brute (5474), Dunemaul Warlock (5475)"
    },

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
      { id: 4338, name: "Mageweave Cloth", chance: 0.55, qty: 1, yieldPerKill: true, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 250 },
      { id: 3928, name: "Superior Healing Potion", chance: 0.03, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 250 },
      { id: 4306, name: "Silk Cloth", chance: 0.098311, qty: 1.5, qtyMin: 1, qtyMax: 2, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 150 },
      { id: 4599, name: "Cured Ham Steak", chance: 0.046651, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 100 },
      { id: 1645, name: "Moonberry Juice", chance: 0.023651, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 100 },
      { id: 6149, name: "Greater Mana Potion", chance: 0.013542, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 120 }
    ],
    coinPerKill: 231.03,
    coinNote: "Wowhead Classic “average money dropped,” spawn-weighted across 5 of 5 listed mob types that have a published coin drop.",
    vendorTrashPerKill: 187.2,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Gordunni Ogre (5229), Gordunni Brute (5232), Gordunni Mauler (5234), Gordunni Shaman (5236), Gordunni Ogre Mage (5237)"
    },

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
    loot: [
      { id: 3712, name: "Turtle Meat", chance: 0.32, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 87 },
      { id: 2319, name: "Medium Leather", chance: 0.557818, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 50 },
      { id: 4234, name: "Heavy Leather", chance: 0.371818, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 150 },
      { id: 4556, name: "Speckled Shell Fragment", chance: 0.338848, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 903 },
      { id: 4555, name: "Thick Scaly Tail", chance: 0.336121, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 155 },
      { id: 6362, name: "Raw Rockscale Cod", chance: 0.074212, qty: 1.5, qtyMin: 1, qtyMax: 2, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 3 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 4 },
      { id: 6308, name: "Raw Bristle Whisker Catfish", chance: 0.060667, qty: 1.5, qtyMin: 1, qtyMax: 2, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 3 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 2 },
      { id: 4232, name: "Medium Hide", chance: 0.046091, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 125 },
      { id: 4235, name: "Heavy Hide", chance: 0.024758, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 200 }
    ],
    vendorTrashPerKill: 1.57,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Sparkleshell Tortoise (4142), Sparkleshell Snapper (4143), Sparkleshell Borer (4144)"
    },

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
    loot: [{ id: 7069, name: "Elemental Air", chance: 0.13, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source." }],

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
      { id: 4304, name: "Thick Leather" },
      { id: 4338, name: "Mageweave Cloth" },
      { id: 3858, name: "Mithril Ore" },
      { id: 7911, name: "Truesilver Ore" },
      { id: 8838, name: "Sungrass" },
      { id: 8831, name: "Purple Lotus" },
      { id: 3821, name: "Goldthorn" },
      { id: 3358, name: "Khadgar's Whisker" },
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
      { id: 8838, name: "Sungrass" },
      { id: 4625, name: "Firebloom" },
      { id: 3821, name: "Goldthorn" },
      { id: 3818, name: "Fadeleaf" },
      { id: 3369, name: "Grave Moss" },
      { id: 2776, name: "Gold Ore" },
      { id: 3858, name: "Mithril Ore" },
      { id: 7911, name: "Truesilver Ore" }
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
    loot: [
      { id: 4306, name: "Silk Cloth", chance: 0.244818, qty: 2.5282, qtyMin: 1, qtyMax: 4, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 9 of 13 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 150 },
      { id: 1707, name: "Stormwind Brie", chance: 0.047692, qty: 1.0871, qtyMin: 1, qtyMax: 3, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 12 of 13 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 62 },
      { id: 2592, name: "Wool Cloth", chance: 0.045333, qty: 1.0754, qtyMin: 1, qtyMax: 3, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 8 of 13 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 33 },
      { id: 4338, name: "Mageweave Cloth", chance: 0.031077, qty: 1.6535, qtyMin: 1, qtyMax: 3, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 250 },
      { id: 1710, name: "Greater Healing Potion", chance: 0.012846, qty: 1.2036, qtyMin: 1, qtyMax: 3, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 12 of 13 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 125 },
      { id: 3827, name: "Mana Potion", chance: 0.007462, qty: 1.1082, qtyMin: 1, qtyMax: 3, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 120 },
      { id: 4607, name: "Delicious Cave Mold", chance: 0.004077, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 5 of 13 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 50 },
      { id: 1206, name: "Moss Agate", chance: 0.000077, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 13 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 400 }
    ],
    coinPerKill: 422.15,
    coinNote: "Wowhead Classic “average money dropped,” equal-weighted across 13 of 13 listed mob types that have a published coin drop.",
    vendorTrashPerKill: 459.73,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "equal",
      npcs: "Scarlet Scryer (4293), Unfettered Spirit (4308), Scarlet Soldier (4286), Scarlet Gallant (4287), Scarlet Beastmaster (4288), Scarlet Guardsman (4290), Scarlet Myrmidon (4295), Scarlet Adept (4296), Scarlet Conjuror (4297), Scarlet Defender (4298), Scarlet Chaplain (4299), Scarlet Wizard (4300), Scarlet Monk (4540)"
    },

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
      { id: 14227, name: "Ironweb Spider Silk", chance: 0.119, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 2500 },
      { id: 4337, name: "Thick Spider's Silk", chance: 0.24, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 750 },
      { id: 10285, name: "Shadow Silk", chance: 0.177, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 1000 },
      { id: 1081, name: "Crisp Spider Meat", chance: 0.765, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 50 },
      { id: 12205, name: "White Spider Meat", chance: 0.487, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 112 },
      { id: 4585, name: "Dripping Spider Mandible", chance: 0.424, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 583 },
      { id: 1074, name: "Hard Spider Leg Tip", chance: 0.12, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 491 }
    ],
    vendorTrashPerKill: 11.45,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Venom Mist Lurker (1822)"
    },

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
    loot: [
      { id: 10450, name: "Undamaged Hippogryph Feather", chance: 0.3, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 396 },
      { id: 4304, name: "Thick Leather", chance: 0.605639, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 300 },
      { id: 15420, name: "Ironfeather", chance: 0.42035, qty: 2, qtyMin: 1, qtyMax: 3, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 3 of 5 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 100 },
      { id: 8170, name: "Rugged Leather", chance: 0.346928, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 500 },
      { id: 4590, name: "Curved Yellow Bill", chance: 0.131764, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 655 },
      { id: 11417, name: "Feathery Wing", chance: 0.107479, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 1204 },
      { id: 5117, name: "Vibrant Plume", chance: 0.10624, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 825 },
      { id: 8146, name: "Wicked Claw", chance: 0.0603, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 500 },
      { id: 11418, name: "Hollow Wing Bone", chance: 0.058966, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 3 of 5 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 604 },
      { id: 5829, name: "Razor-sharp Beak", chance: 0.058958, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 3 of 5 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 804 },
      { id: 11420, name: "Elegant Writing Tool", chance: 0.032319, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 5 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 1712 },
      { id: 8169, name: "Thick Hide", chance: 0.03192, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 500 },
      { id: 11419, name: "Mysterious Unhatched Egg", chance: 0.0287, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 5 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 1900 },
      { id: 4589, name: "Long Elegant Feather", chance: 0.028426, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 5 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 530 },
      { id: 8171, name: "Rugged Hide", chance: 0.015772, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 5 listed mob types that have a published percentage for this item.", kind: "skin", vendor: 500 },
      { id: 13463, name: "Dreamfoil", chance: 0.000932, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 3 of 5 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 100 },
      { id: 8838, name: "Sungrass", chance: 0.000753, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 4 of 5 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 60 },
      { id: 13464, name: "Golden Sansam", chance: 0.000414, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 5 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 100 },
      { id: 3858, name: "Mithril Ore", chance: 0.000259, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 5 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 250 },
      { id: 10620, name: "Thorium Ore", chance: 0.000259, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 5 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 250 }
    ],
    vendorTrashPerKill: 8.6,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Thunderhead Hippogryph (6375), Thunderhead Stagwing (6377), Thunderhead Skystormer (6378), Thunderhead Patriarch (6379), Thunderhead Consort (6380)"
    },

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
      { id: 8170, name: "Rugged Leather", chance: 0.196937, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 500 },
      { id: 11018, name: "Un'Goro Soil", chance: 0.315855, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 146 },
      { id: 4304, name: "Thick Leather", chance: 0.771692, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 300 },
      { id: 12184, name: "Raptor Flesh", chance: 0.479421, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 87 },
      { id: 4587, name: "Tribal Raptor Feathers", chance: 0.306805, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 807 },
      { id: 4588, name: "Pristine Raptor Skull", chance: 0.183113, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 900 },
      { id: 20015, name: "Elder Raptor Feathers", chance: 0.124805, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 1658 },
      { id: 8146, name: "Wicked Claw", chance: 0.062887, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 500 },
      { id: 8169, name: "Thick Hide", chance: 0.030887, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 500 }
    ],
    vendorTrashPerKill: 5.88,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Ravasaur (6505), Ravasaur Runner (6506), Ravasaur Hunter (6507)"
    },

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
      { id: 14227, name: "Ironweb Spider Silk", chance: 0.068, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 2500 },
      { id: 4337, name: "Thick Spider's Silk", chance: 0.232, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 750 },
      { id: 12205, name: "White Spider Meat", chance: 0.526, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 112 },
      { id: 4585, name: "Dripping Spider Mandible", chance: 0.481, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 583 },
      { id: 1074, name: "Hard Spider Leg Tip", chance: 0.132, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 491 },
      { id: 10285, name: "Shadow Silk", chance: 0.125, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 1000 },
      { id: 3858, name: "Mithril Ore", chance: 0.006, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 250 },
      { id: 7912, name: "Solid Stone", chance: 0.003, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 100 },
      { id: 4625, name: "Firebloom", chance: 0.001, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 250 }
    ],
    vendorTrashPerKill: 14.6,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Searing Lava Spider (5857)"
    },

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
    loot: [
      { id: 8170, name: "Rugged Leather", chance: 0.211, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 500 },
      { id: 4304, name: "Thick Leather", chance: 0.757, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 300 },
      { id: 4093, name: "Large Basilisk Tail", chance: 0.379, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 713 },
      { id: 11386, name: "Squishy Basilisk Eye", chance: 0.346, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 676 },
      { id: 4092, name: "Prismatic Basilisk Scale", chance: 0.214, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 1296 },
      { id: 11387, name: "Basilisk Heart", chance: 0.189, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 1013 },
      { id: 8146, name: "Wicked Claw", chance: 0.071, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 500 },
      { id: 8169, name: "Thick Hide", chance: 0.032, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 500 },
      { id: 3858, name: "Mithril Ore", chance: 0.001, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 250 }
    ],
    vendorTrashPerKill: 6.2,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Glasshide Petrifier (5421)"
    },

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
      { id: 15417, name: "Devilsaur Leather", chance: 1, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 500 },
      { id: 8170, name: "Rugged Leather" },
      { id: 20015, name: "Elder Raptor Feathers", chance: 0.290667, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 1658 },
      { id: 11018, name: "Un'Goro Soil", chance: 0.267667, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 146 },
      { id: 4588, name: "Pristine Raptor Skull", chance: 0.215, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 900 },
      { id: 4587, name: "Tribal Raptor Feathers", chance: 0.202667, qty: 1.5, qtyMin: 1, qtyMax: 2, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 807 },
      { id: 8146, name: "Wicked Claw", chance: 0.081333, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 500 },
      { id: 20016, name: "Trophy Raptor Skull", chance: 0.043333, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 3635 }
    ],
    vendorTrashPerKill: 65.11,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Devilsaur (6498), Ironhide Devilsaur (6499), Tyrant Devilsaur (6500)"
    },

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
      { id: 15408, name: "Heavy Scorpid Scale", chance: 0.75, qty: 1, kind: "skin", chanceNote: "Conquest Capped, PvP-realm AH, 15 Nov 2026: 75% Heavy Scorpid Scale. Firetail Stinger has no matching 1.12 NPC id (Stonelash Scorpids are a different mob)." },
      { id: 19933, name: "Glowing Scorpid Blood", chance: 0.07, qty: 1, kind: "drop", chanceNote: "Conquest Capped, 15 Nov 2026: 7% Glowing Scorpid Blood. No matching 1.12 Firetail Stinger NPC." }
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
      { id: 7082, name: "Essence of Air", chance: 0.04, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 400 },
      { id: 7069, name: "Elemental Air", chance: 0.104, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 400 },
      { id: 7081, name: "Breath of Wind", chance: 0.115, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 400 },
      { id: 10620, name: "Thorium Ore", chance: 0.001, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 250 },
      { id: 13463, name: "Dreamfoil", chance: 0.001, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 100 }
    ],
    vendorTrashPerKill: 82.88,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Cyclone Warrior (11745)"
    },

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
    loot: [
      { id: 20424, name: "Sandworm Meat", chance: 0.389, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 175 },
      { id: 3676, name: "Slimy Ichor", chance: 0.534, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 106 },
      { id: 3669, name: "Gelatinous Goo", chance: 0.53, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 195 }
    ],
    vendorTrashPerKill: 35.5,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Dredge Crusher (11741)"
    },

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
      { id: 7078, name: "Essence of Fire", chance: 0.05, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 400 },
      { id: 7077, name: "Heart of Fire", chance: 0.068, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 400 },
      { id: 7068, name: "Elemental Fire", chance: 0.0675, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 400 },
      { id: 4787, name: "Burning Pitch", chance: 0.421, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 577 },
      { id: 3857, name: "Coal", chance: 0.209, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 125 },
      { id: 10620, name: "Thorium Ore", chance: 0.001, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 250 },
      { id: 11018, name: "Un'Goro Soil", chance: 0.001, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 146 },
      { id: 12365, name: "Dense Stone", chance: 0.001, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 250 },
      { id: 13465, name: "Mountain Silversage", chance: 0.001, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 150 }
    ],
    vendorTrashPerKill: 30.12,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Scorching Elemental (6520), Living Blaze (6521)"
    },

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
      { id: 7076, name: "Essence of Earth", chance: 0.033, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 400 },
      { id: 7067, name: "Elemental Earth", chance: 0.049129, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 400 },
      { id: 4784, name: "Lifeless Stone", chance: 0.850484, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 360 },
      { id: 7912, name: "Solid Stone", chance: 0.315903, qty: 1.5, qtyMin: 1, qtyMax: 2, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 100 },
      { id: 8150, name: "Deeprock Salt", chance: 0.206032, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 250 },
      { id: 7075, name: "Core of Earth", chance: 0.049032, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 400 },
      { id: 13463, name: "Dreamfoil", chance: 0.000097, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 2 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 100 }
    ],
    vendorTrashPerKill: 53.85,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Desert Rumbler (11746), Desert Rager (11747)"
    },

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
      { id: 15422, name: "Frostsaber Leather", chance: 0.352567, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 500 },
      { id: 8170, name: "Rugged Leather", chance: 0.500683, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 500 },
      { id: 12202, name: "Tiger Meat", chance: 0.460615, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 87 },
      { id: 4580, name: "Sabertooth Fang", chance: 0.411375, qty: 1.5, qtyMin: 1, qtyMax: 2, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 787 },
      { id: 1688, name: "Long Soft Tail", chance: 0.406413, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 806 },
      { id: 4581, name: "Patch of Fine Fur", chance: 0.120192, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 862 },
      { id: 4304, name: "Thick Leather", chance: 0.097615, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 300 },
      { id: 8146, name: "Wicked Claw", chance: 0.059654, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 500 },
      { id: 8171, name: "Rugged Hide", chance: 0.049865, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 500 },
      { id: 10620, name: "Thorium Ore", chance: 0.001221, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 250 },
      { id: 13467, name: "Icecap", chance: 0.000673, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 4 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 250 },
      { id: 13465, name: "Mountain Silversage", chance: 0.000673, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 4 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 150 },
      { id: 12365, name: "Dense Stone", chance: 0.000442, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 4 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 250 }
    ],
    vendorTrashPerKill: 2.87,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Frostsaber (7431), Frostsaber Stalker (7432), Frostsaber Huntress (7433), Frostsaber Pride Watcher (7434)"
    },

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
      { id: 15419, name: "Warbear Leather", chance: 0.150855, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 600 },
      { id: 8170, name: "Rugged Leather", chance: 0.581685, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 500 },
      { id: 11409, name: "Bear Flank", chance: 0.351911, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 503 },
      { id: 11408, name: "Bear Jaw", chance: 0.343282, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 898 },
      { id: 11410, name: "Savage Bear Claw", chance: 0.247726, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 578 },
      { id: 4304, name: "Thick Leather", chance: 0.21179, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 300 },
      { id: 11411, name: "Large Bear Bone", chance: 0.15, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 1484 },
      { id: 8146, name: "Wicked Claw", chance: 0.065605, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 500 },
      { id: 8171, name: "Rugged Hide", chance: 0.043024, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "skin", vendor: 500 },
      { id: 8169, name: "Thick Hide", chance: 0.01225, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 2 listed mob types that have a published percentage for this item.", kind: "skin", vendor: 500 },
      { id: 13463, name: "Dreamfoil", chance: 0.00121, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 2 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 100 },
      { id: 10620, name: "Thorium Ore", chance: 0.000605, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 2 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 250 },
      { id: 13466, name: "Plaguebloom", chance: 0.000605, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 2 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 250 },
      { id: 7911, name: "Truesilver Ore", chance: 0.000605, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 2 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 500 },
      { id: 8836, name: "Arthas' Tears", chance: 0.000605, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 2 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 95 },
      { id: 3858, name: "Mithril Ore", chance: 0.000395, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 2 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 250 }
    ],
    vendorTrashPerKill: 45.95,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Diseased Black Bear (1815), Diseased Grizzly (1816)"
    },

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
    loot: [
      { id: 14047, name: "Runecloth", chance: 0.350435, qty: 2, qtyMin: 1, qtyMax: 3, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 400 },
      { id: 8952, name: "Roasted Quail", chance: 0.046478, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 200 },
      { id: 13446, name: "Major Healing Potion", chance: 0.028739, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 1000 },
      { id: 8766, name: "Morning Glory Dew", chance: 0.024652, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 200 },
      { id: 13444, name: "Major Mana Potion", chance: 0.013739, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 1500 }
    ],
    coinPerKill: 483.26,
    coinNote: "Wowhead Classic “average money dropped,” spawn-weighted across 4 of 4 listed mob types that have a published coin drop.",
    vendorTrashPerKill: 489.9,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Deadwind Brute (7369), Deadwind Mauler (7371), Deadwind Warlock (7372), Deadwind Ogre Mage (7379)"
    },

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
      { id: 14256, name: "Felcloth", chance: 0.1, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 2000 },
      { id: 14047, name: "Runecloth", chance: 0.248, qty: 1.5, qtyMin: 1, qtyMax: 2, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 400 },
      { id: 12662, name: "Demonic Rune", chance: 0.069, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 600 },
      { id: 8948, name: "Dried King Bolete", chance: 0.048, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 200 },
      { id: 13446, name: "Major Healing Potion", chance: 0.029, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 1000 },
      { id: 8766, name: "Morning Glory Dew", chance: 0.029, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 200 },
      { id: 13443, name: "Superior Mana Potion", chance: 0.014, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 400 }
    ],
    coinPerKill: 451,
    coinNote: "Wowhead Classic “average money dropped,” spawn-weighted across 1 of 1 listed mob types that have a published coin drop.",
    vendorTrashPerKill: 505.49,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Felguard Sentry (6011)"
    },

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
    loc: "Water elementals along the EPL coast. Classic 1.12 tables used here are Plague Ravager and Blighted Horror; some guides name Plague Monstrosity for the same camp.",
    levelMin: 54, levelMax: 60, mobLevel: "54–57",
    faction: "both",
    classes: ["any"],
    professions: [],
    bonusProfs: ["Enchanting"],
    type: "mob",
    loot: [
      { id: 7080, name: "Essence of Water", chance: 0.027, qty: 1, chanceNote: "Rate kept from this camp’s existing Forever or Classic guide source.", kind: "drop", vendor: 400 },
      { id: 7079, name: "Globe of Water", chance: 0.079, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 400 },
      { id: 7070, name: "Elemental Water", chance: 0.092333, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 400 },
      { id: 4791, name: "Enchanted Water", chance: 0.559667, qty: 3, qtyMin: 1, qtyMax: 5, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever.", kind: "drop", vendor: 133 }
    ],
    vendorTrashPerKill: 40.46,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "spawns",
      npcs: "Plague Ravager (8520), Blighted Horror (8521)"
    },

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
      { id: 10620, name: "Thorium Ore" },
      { id: 12363, name: "Arcane Crystal" },
      { id: 13463, name: "Dreamfoil" },
      { id: 13466, name: "Plaguebloom" },
      { id: 13465, name: "Mountain Silversage" },
      { id: 13467, name: "Icecap" },
      { id: 8845, name: "Ghost Mushroom" },
      { id: 8839, name: "Blindweed" },
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
      { id: 14047, name: "Runecloth" },
      { id: 4338, name: "Mageweave Cloth" },
      { id: 8170, name: "Rugged Leather" },
      { id: 13463, name: "Dreamfoil" },
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
      { id: 4306, name: "Silk Cloth", chance: 0.082857, qty: 2.5, qtyMin: 1, qtyMax: 4, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 4 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 150 },
      { id: 4338, name: "Mageweave Cloth", chance: 0.143571, qty: 2.5, qtyMin: 1, qtyMax: 4, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 5 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 250 },
      { id: 3928, name: "Superior Healing Potion", chance: 0.008571, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 5 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 250 },
      { id: 4607, name: "Delicious Cave Mold", chance: 0.044143, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 50 },
      { id: 4608, name: "Raw Black Truffle", chance: 0.043286, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 3 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 100 },
      { id: 4606, name: "Spongy Morel", chance: 0.042429, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 25 },
      { id: 10286, name: "Heart of the Wild", chance: 0.029857, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 400 },
      { id: 4599, name: "Cured Ham Steak", chance: 0.020571, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 3 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 100 },
      { id: 1645, name: "Moonberry Juice", chance: 0.018429, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 5 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 100 },
      { id: 6149, name: "Greater Mana Potion", chance: 0.009857, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 5 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 120 },
      { id: 765, name: "Silverleaf", chance: 0.007, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 10 },
      { id: 2447, name: "Peacebloom", chance: 0.006857, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 10 },
      { id: 2449, name: "Earthroot", chance: 0.006857, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 20 },
      { id: 2450, name: "Briarthorn", chance: 0.006714, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 25 },
      { id: 785, name: "Mageroyal", chance: 0.006714, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 20 },
      { id: 4625, name: "Firebloom", chance: 0.006571, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 250 },
      { id: 3821, name: "Goldthorn", chance: 0.006, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 150 },
      { id: 8836, name: "Arthas' Tears", chance: 0.005714, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 95 },
      { id: 8831, name: "Purple Lotus", chance: 0.005286, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 2 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 300 },
      { id: 3858, name: "Mithril Ore", chance: 0.000714, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 4 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 250 },
      { id: 8845, name: "Ghost Mushroom", chance: 0.000714, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 5 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 375 },
      { id: 7912, name: "Solid Stone", chance: 0.000143, qty: 1, chanceNote: "Classic 1.12 world data (ZugZugDB, seeded from VMaNGOS). Not yet confirmed in Forever. Averaged over 1 of 7 listed mob types that have a published percentage for this item.", kind: "drop", vendor: 100 }
    ],
    coinPerKill: 780.4,
    coinNote: "Wowhead Classic “average money dropped,” equal-weighted across 5 of 7 listed mob types that have a published coin drop.",
    vendorTrashPerKill: 158.9,
    vendorTrashNote: "Expected vendor value of grey and other unsold drops from the same 1.12 tables, excluding the items listed above and quest items.",
    dropSource: {
      citation: "Classic 1.12 drop and skinning tables from ZugZugDB (https://zugzugdb.com/about; seeded from VMaNGOS world data until Forever observations replace them). Coin is Wowhead Classic “average money dropped.” Rates labeled Forever on an item come from that item’s existing source, not 1.12.",
      url: "https://zugzugdb.com/about",
      coinUrl: "https://www.wowhead.com/classic/",
      weighting: "equal",
      npcs: "Putridus Satyr (11790), Putridus Trickster (11791), Putridus Shadowstalker (11792), Barbed Lasher (12219), Constrictor Vine (12220), Celebrian Dryad (11793), Sister of Celebrian (11794)"
    },

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
