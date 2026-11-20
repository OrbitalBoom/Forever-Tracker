/* Static Classic Era reference data for the Forever tracker. */
window.WOW_DATA = {
  version: 1,
  races: [
    { name: "Human", faction: "Alliance" },
    { name: "Dwarf", faction: "Alliance" },
    { name: "Night Elf", faction: "Alliance" },
    { name: "Gnome", faction: "Alliance" },
    { name: "High Order Skyborne", faction: "Alliance" },
    { name: "Orc", faction: "Horde" },
    { name: "Undead", faction: "Horde" },
    { name: "Tauren", faction: "Horde" },
    { name: "Troll", faction: "Horde" },
    { name: "Windshaper Skyborne", faction: "Horde" }
  ],
  classes: ["Warrior","Paladin","Hunter","Rogue","Priest","Shaman","Mage","Warlock","Druid"],
  classColors: {
    Warrior: "#C79C6E", Paladin: "#F58CBA", Hunter: "#ABD473", Rogue: "#FFF569",
    Priest: "#FFFFFF", Shaman: "#0070DE", Mage: "#69CCF0", Warlock: "#9482C9", Druid: "#FF7D0A"
  },
  classRaces: {
    Warrior: ["Human","Dwarf","Night Elf","Gnome","Orc","Undead","Tauren","Troll"],
    Paladin: ["Human","Dwarf"],
    Hunter: ["Dwarf","Night Elf","Orc","Tauren","Troll"],
    Rogue: ["Human","Dwarf","Night Elf","Gnome","Orc","Undead","Troll"],
    Priest: ["Human","Dwarf","Night Elf","Undead","Troll"],
    Shaman: ["Orc","Tauren","Troll"],
    Mage: ["Human","Gnome","Undead","Troll"],
    Warlock: ["Human","Gnome","Orc","Undead"],
    Druid: ["Night Elf","Tauren"]
  },
  specs: {
    Warrior: ["Arms","Fury","Protection"],
    Paladin: ["Holy","Protection","Retribution"],
    Hunter: ["Beast Mastery","Marksmanship","Survival"],
    Rogue: ["Assassination","Combat","Subtlety"],
    Priest: ["Discipline","Holy","Shadow"],
    Shaman: ["Elemental","Enhancement","Restoration"],
    Mage: ["Arcane","Fire","Frost"],
    Warlock: ["Affliction","Demonology","Destruction"],
    Druid: ["Balance","Feral","Restoration"]
  },
  professions: [
    "Alchemy","Blacksmithing","Enchanting","Engineering","Herbalism",
    "Leatherworking","Mining","Skinning","Tailoring","Cooking","Fishing","First Aid"
  ],
  slots: [
    { id: "head", label: "Head" },
    { id: "neck", label: "Neck" },
    { id: "shoulder", label: "Shoulder" },
    { id: "back", label: "Back" },
    { id: "chest", label: "Chest" },
    { id: "shirt", label: "Shirt" },
    { id: "tabard", label: "Tabard" },
    { id: "wrist", label: "Wrist" },
    { id: "hands", label: "Hands" },
    { id: "waist", label: "Waist" },
    { id: "legs", label: "Legs" },
    { id: "feet", label: "Feet" },
    { id: "finger1", label: "Finger 1", slot: "finger" },
    { id: "finger2", label: "Finger 2", slot: "finger" },
    { id: "trinket1", label: "Trinket 1", slot: "trinket" },
    { id: "trinket2", label: "Trinket 2", slot: "trinket" },
    { id: "mainhand", label: "Main Hand" },
    { id: "offhand", label: "Off Hand" },
    { id: "ranged", label: "Ranged / Relic" }
  ],
  /* Armor / weapon proficiency in vanilla 1.12 */
  proficiencies: {
    Warrior: {
      armor: ["cloth","leather","mail","plate"],
      plateAt: 40, mailAt: 1,
      weapons: ["sword","axe","mace","dagger","staff","polearm","fist","bow","gun","crossbow","thrown","shield"],
      dualWield: true, twoHand: true, shield: true, relic: null
    },
    Paladin: {
      armor: ["cloth","leather","mail","plate"],
      plateAt: 40, mailAt: 1,
      weapons: ["sword","axe","mace","polearm","shield","libram"],
      dualWield: false, twoHand: true, shield: true, relic: "libram"
    },
    Hunter: {
      armor: ["cloth","leather","mail"],
      plateAt: 99, mailAt: 40,
      weapons: ["sword","axe","dagger","staff","polearm","fist","bow","gun","crossbow","thrown"],
      dualWield: false, twoHand: true, shield: false, relic: null
    },
    Rogue: {
      armor: ["cloth","leather"],
      plateAt: 99, mailAt: 99,
      weapons: ["sword","mace","dagger","fist","bow","gun","crossbow","thrown"],
      dualWield: true, twoHand: false, shield: false, relic: null,
      oneHandOnly: true
    },
    Priest: {
      armor: ["cloth"],
      plateAt: 99, mailAt: 99,
      weapons: ["mace","dagger","staff","wand","held"],
      dualWield: false, twoHand: true, shield: false, relic: null,
      noTwoHandMace: true
    },
    Shaman: {
      armor: ["cloth","leather","mail"],
      plateAt: 99, mailAt: 40,
      weapons: ["axe","mace","dagger","staff","fist","shield","totem"],
      dualWield: false, twoHand: true, shield: true, relic: "totem"
    },
    Mage: {
      armor: ["cloth"],
      plateAt: 99, mailAt: 99,
      weapons: ["sword","dagger","staff","wand","held"],
      dualWield: false, twoHand: true, shield: false, relic: null,
      oneHandOnly: true
    },
    Warlock: {
      armor: ["cloth"],
      plateAt: 99, mailAt: 99,
      weapons: ["sword","dagger","staff","wand","held"],
      dualWield: false, twoHand: true, shield: false, relic: null,
      oneHandOnly: true
    },
    Druid: {
      armor: ["cloth","leather"],
      plateAt: 99, mailAt: 99,
      weapons: ["mace","dagger","staff","fist","polearm","idol","held"],
      dualWield: false, twoHand: true, shield: false, relic: "idol"
    }
  },
  /* Simple 1.12-style stat weights used only to rank upgrades. */
  statWeights: {
    Warrior: {
      Arms: { str: 2.2, agi: 1.1, sta: 0.4, ap: 1, crit: 8, hit: 12, dps: 2.4, armor: 0.02, skillAxes: 3, skillSwords: 3, skillMaces: 3, ilvl: 0.8 },
      Fury: { str: 2.0, agi: 1.3, sta: 0.3, ap: 1, crit: 9, hit: 12, dps: 2.6, armor: 0.02, skillSwords: 3, skillAxes: 3, ilvl: 0.8 },
      Protection: { sta: 1.8, str: 0.9, agi: 1.1, defense: 3.5, dodge: 2.2, parry: 2.2, blockChance: 2, blockValue: 0.4, block: 0.12, armor: 0.06, ap: 0.3, hit: 5, crit: 2, ilvl: 0.6 }
    },
    Paladin: {
      Holy: { int: 1.6, spi: 1.1, sta: 0.3, mp5: 2.2, healing: 1, sp: 0.4, spellCrit: 6, ilvl: 0.7 },
      Protection: { sta: 1.6, str: 0.8, agi: 0.9, defense: 3, dodge: 2, parry: 1.6, blockChance: 2.2, blockValue: 0.5, block: 0.12, armor: 0.06, int: 0.4, spellCrit: 2, sp: 0.3, ilvl: 0.6 },
      Retribution: { str: 2, agi: 1, sta: 0.4, ap: 1, crit: 8, hit: 10, int: 0.5, sp: 0.6, dps: 2.2, ilvl: 0.8 }
    },
    Hunter: {
      "Beast Mastery": { agi: 2.2, sta: 0.3, ap: 1, rap: 1, crit: 8, hit: 12, dps: 2.4, str: 0.3, ilvl: 0.8 },
      Marksmanship: { agi: 2.2, sta: 0.3, ap: 1, rap: 1, crit: 8.5, hit: 12, dps: 2.5, ilvl: 0.8 },
      Survival: { agi: 2.0, sta: 0.4, ap: 1, rap: 1, crit: 8, hit: 12, dps: 2.2, sta2: 0, ilvl: 0.8 }
    },
    Rogue: {
      Assassination: { agi: 2.2, str: 1.0, sta: 0.3, ap: 1, crit: 8, hit: 14, dps: 2.8, skillDaggers: 3, ilvl: 0.8 },
      Combat: { agi: 2.0, str: 1.1, sta: 0.3, ap: 1, crit: 8, hit: 14, dps: 2.8, skillSwords: 3, skillMaces: 2, skillDaggers: 2, ilvl: 0.8 },
      Subtlety: { agi: 2.2, str: 1.0, sta: 0.3, ap: 1, crit: 8, hit: 14, dps: 2.6, ilvl: 0.8 }
    },
    Priest: {
      Discipline: { int: 1.4, spi: 1.2, sta: 0.3, mp5: 2, healing: 1, sp: 0.5, spellCrit: 5, spellHit: 8, ilvl: 0.7 },
      Holy: { int: 1.5, spi: 1.3, sta: 0.3, mp5: 2.2, healing: 1.1, sp: 0.35, spellCrit: 5, ilvl: 0.7 },
      Shadow: { int: 1.6, spi: 0.8, sta: 0.3, sp: 1, spShadow: 1.1, spellCrit: 8, spellHit: 12, mp5: 1, dps: 0.3, ilvl: 0.8 }
    },
    Shaman: {
      Elemental: { int: 1.6, sta: 0.3, spi: 0.4, sp: 1, spNature: 1.1, spellCrit: 8, spellHit: 12, mp5: 1, ilvl: 0.8 },
      Enhancement: { str: 1.8, agi: 1.2, sta: 0.4, ap: 1, crit: 8, hit: 12, int: 0.6, sp: 0.5, dps: 2.2, ilvl: 0.8 },
      Restoration: { int: 1.5, spi: 1.1, sta: 0.3, mp5: 2.2, healing: 1.1, sp: 0.4, spellCrit: 5, ilvl: 0.7 }
    },
    Mage: {
      Arcane: { int: 1.6, spi: 0.6, sta: 0.3, sp: 1, spArcane: 1.1, spellCrit: 8, spellHit: 12, mp5: 0.8, ilvl: 0.8 },
      Fire: { int: 1.5, spi: 0.5, sta: 0.3, sp: 1, spFire: 1.1, spellCrit: 9, spellHit: 12, mp5: 0.6, ilvl: 0.8 },
      Frost: { int: 1.5, spi: 0.5, sta: 0.3, sp: 1, spFrost: 1.1, spellCrit: 8, spellHit: 12, mp5: 0.6, ilvl: 0.8 }
    },
    Warlock: {
      Affliction: { int: 1.5, sta: 0.4, spi: 0.5, sp: 1, spShadow: 1.1, spellHit: 12, spellCrit: 6, mp5: 0.6, ilvl: 0.8 },
      Demonology: { int: 1.5, sta: 0.5, spi: 0.5, sp: 1, spShadow: 1.05, spellHit: 12, spellCrit: 7, ilvl: 0.8 },
      Destruction: { int: 1.5, sta: 0.3, spi: 0.4, sp: 1, spShadow: 1.05, spFire: 1.05, spellCrit: 9, spellHit: 12, ilvl: 0.8 }
    },
    Druid: {
      Balance: { int: 1.6, spi: 0.7, sta: 0.3, sp: 1, spNature: 1.1, spellCrit: 8, spellHit: 12, mp5: 0.8, ilvl: 0.8 },
      Feral: { agi: 2.0, str: 1.4, sta: 0.8, ap: 1, fap: 1.1, crit: 8, hit: 12, armor: 0.04, defense: 1.2, dodge: 1.5, ilvl: 0.8 },
      Restoration: { int: 1.5, spi: 1.3, sta: 0.3, mp5: 2, healing: 1.1, sp: 0.4, spellCrit: 5, ilvl: 0.7 }
    }
  },
  dungeons: [
    { id: "rfc", name: "Ragefire Chasm", levelMin: 13, levelMax: 18, players: 5, faction: "Horde", zone: "Orgrimmar" },
    { id: "wc", name: "Wailing Caverns", levelMin: 17, levelMax: 24, players: 5, faction: "both", zone: "The Barrens" },
    { id: "deadmines", name: "The Deadmines", levelMin: 18, levelMax: 23, players: 5, faction: "both", zone: "Westfall" },
    { id: "sfk", name: "Shadowfang Keep", levelMin: 22, levelMax: 30, players: 5, faction: "both", zone: "Silverpine Forest" },
    { id: "stockade", name: "The Stockade", levelMin: 22, levelMax: 30, players: 5, faction: "Alliance", zone: "Stormwind" },
    { id: "bfd", name: "Blackfathom Deeps", levelMin: 24, levelMax: 32, players: 5, faction: "both", zone: "Ashenvale" },
    { id: "gnomer", name: "Gnomeregan", levelMin: 29, levelMax: 38, players: 5, faction: "both", zone: "Dun Morogh" },
    { id: "rfk", name: "Razorfen Kraul", levelMin: 30, levelMax: 40, players: 5, faction: "both", zone: "The Barrens" },
    { id: "sm-gy", name: "Scarlet Monastery — Graveyard", levelMin: 28, levelMax: 38, players: 5, faction: "both", zone: "Tirisfal Glades" },
    { id: "sm-lib", name: "Scarlet Monastery — Library", levelMin: 32, levelMax: 38, players: 5, faction: "both", zone: "Tirisfal Glades" },
    { id: "sm-arm", name: "Scarlet Monastery — Armory", levelMin: 36, levelMax: 40, players: 5, faction: "both", zone: "Tirisfal Glades" },
    { id: "sm-cath", name: "Scarlet Monastery — Cathedral", levelMin: 36, levelMax: 44, players: 5, faction: "both", zone: "Tirisfal Glades" },
    { id: "rfd", name: "Razorfen Downs", levelMin: 37, levelMax: 46, players: 5, faction: "both", zone: "The Barrens" },
    { id: "uldaman", name: "Uldaman", levelMin: 42, levelMax: 52, players: 5, faction: "both", zone: "Badlands" },
    { id: "zf", name: "Zul'Farrak", levelMin: 44, levelMax: 54, players: 5, faction: "both", zone: "Tanaris" },
    { id: "mara", name: "Maraudon", levelMin: 46, levelMax: 55, players: 5, faction: "both", zone: "Desolace" },
    { id: "st", name: "Temple of Atal'Hakkar", levelMin: 50, levelMax: 60, players: 5, faction: "both", zone: "Swamp of Sorrows" },
    { id: "brd", name: "Blackrock Depths", levelMin: 52, levelMax: 60, players: 5, faction: "both", zone: "Blackrock Mountain" },
    { id: "lbrs", name: "Lower Blackrock Spire", levelMin: 55, levelMax: 60, players: 5, faction: "both", zone: "Blackrock Mountain" },
    { id: "ubrs", name: "Upper Blackrock Spire", levelMin: 55, levelMax: 60, players: 10, faction: "both", zone: "Blackrock Mountain" },
    { id: "dm-east", name: "Dire Maul — East", levelMin: 55, levelMax: 60, players: 5, faction: "both", zone: "Feralas" },
    { id: "dm-west", name: "Dire Maul — West", levelMin: 56, levelMax: 60, players: 5, faction: "both", zone: "Feralas" },
    { id: "dm-north", name: "Dire Maul — North", levelMin: 57, levelMax: 60, players: 5, faction: "both", zone: "Feralas" },
    { id: "scholo", name: "Scholomance", levelMin: 58, levelMax: 60, players: 5, faction: "both", zone: "Western Plaguelands" },
    { id: "strat-live", name: "Stratholme — Live", levelMin: 58, levelMax: 60, players: 5, faction: "both", zone: "Eastern Plaguelands" },
    { id: "strat-ud", name: "Stratholme — Undead", levelMin: 58, levelMax: 60, players: 5, faction: "both", zone: "Eastern Plaguelands" }
  ],
  raids: [
    { id: "zg", name: "Zul'Gurub", levelMin: 60, levelMax: 60, players: 20, zone: "Stranglethorn Vale", phase: "20-player" },
    { id: "aq20", name: "Ruins of Ahn'Qiraj", levelMin: 60, levelMax: 60, players: 20, zone: "Silithus", phase: "20-player" },
    { id: "onyxia", name: "Onyxia's Lair", levelMin: 60, levelMax: 60, players: 40, zone: "Dustwallow Marsh", phase: "40-player" },
    { id: "mc", name: "Molten Core", levelMin: 60, levelMax: 60, players: 40, zone: "Blackrock Mountain", phase: "40-player" },
    { id: "bwl", name: "Blackwing Lair", levelMin: 60, levelMax: 60, players: 40, zone: "Blackrock Mountain", phase: "40-player" },
    { id: "aq40", name: "Temple of Ahn'Qiraj", levelMin: 60, levelMax: 60, players: 40, zone: "Silithus", phase: "40-player" },
    { id: "naxx", name: "Naxxramas", levelMin: 60, levelMax: 60, players: 40, zone: "Eastern Plaguelands", phase: "40-player" },
    { id: "azuregos", name: "Azuregos (world boss)", levelMin: 60, levelMax: 60, players: 40, zone: "Azshara", phase: "World boss" },
    { id: "kazzak", name: "Lord Kazzak (world boss)", levelMin: 60, levelMax: 60, players: 40, zone: "Blasted Lands", phase: "World boss" },
    { id: "dragons", name: "Dragons of Nightmare (world bosses)", levelMin: 60, levelMax: 60, players: 40, zone: "Four continents", phase: "World boss" }
  ],
  mounts: [
    { id: "riding-40", name: "Apprentice Riding & 60% mount", notes: "Learned at level 40. Racial trainer; cost is steep, start saving gold early." },
    { id: "riding-60", name: "Journeyman Riding & 100% epic mount", notes: "Learned at level 60. The classic epic mount grind." },
    { id: "pal-warhorse", name: "Warhorse (Paladin)", notes: "Class quest around level 40. Paladin only." },
    { id: "pal-charger", name: "Charger (Paladin)", notes: "Epic paladin class mount quest at 60." },
    { id: "lock-felsteed", name: "Felsteed (Warlock)", notes: "Class quest around level 40. Warlock only." },
    { id: "lock-dreadsteed", name: "Dreadsteed (Warlock)", notes: "Epic warlock class quest chain (Dire Maul) at 60." },
    { id: "deathcharger", name: "Deathcharger's Reins", notes: "Extremely rare drop from Baron Rivendare in Stratholme (Undead)." },
    { id: "zg-tiger", name: "Swift Zulian Tiger", notes: "Rare drop from High Priest Thekal in Zul'Gurub." },
    { id: "zg-raptor", name: "Swift Razzashi Raptor", notes: "Rare drop from Bloodlord Mandokir in Zul'Gurub." },
    { id: "black-qiraji", name: "Black Qiraji Resonating Crystal", notes: "Rewarded from the original Ahn'Qiraj war effort / Scepter of the Shifting Sands chain." },
    { id: "frostsaber", name: "Winterspring Frostsaber", notes: "Exalted with the Wintersaber Trainers in Winterspring (Alliance). Long grind." },
    { id: "av-ally", name: "Stormpike Battle Charger", notes: "Exalted with Stormpike Guard (Alterac Valley). Alliance." },
    { id: "av-horde", name: "Horn of the Frostwolf Howler", notes: "Exalted with Frostwolf Clan (Alterac Valley). Horde." }
  ],
  achievements: [
    { id: "level-60", name: "Reach level 60", notes: "The Classic cap — everything opens up from here." },
    { id: "prebis", name: "Finish a pre-raid bis / dungeon-gear set", notes: "Typical stops: Strat, Scholo, UBRS, BRD, LBRS, Dire Maul." },
    { id: "ony-attune", name: "Complete Onyxia attunement", notes: "Alliance: Marshal Windsor / DRAGONKIN MENACE chain. Horde: The Test of Skulls / For The Horde!" },
    { id: "mc-attune", name: "Complete Molten Core attunement", notes: "Attunement to the Core — Hydraxian Waterlords / Baron Geddon path, plus the BRD window shortcut." },
    { id: "bwl-attune", name: "Obtain the Drakefire Amulet (BWL)", notes: "UBRS quest: Seal of Ascension / General Drakkisath's Demise, then The Orb of Command." },
    { id: "naxx-attune", name: "Complete Naxxramas attunement", notes: "Argent Dawn reputation and the attunement quest from the Plaguelands." },
    { id: "scholo-key", name: "Earn the Key to Scholomance (Skeleton Key)", notes: "Alchemist / quest chain in Western Plaguelands." },
    { id: "ubrs-key", name: "Seal of Ascension (UBRS key)", notes: "Farm the gem pieces and complete the LBRS / UBRS quest." },
    { id: "crescent", name: "Crescent Key (Dire Maul)", notes: "Dropped by Pusillin in Dire Maul East — unlocks the rest of Dire Maul." },
    { id: "argent-exalted", name: "Exalted with the Argent Dawn", notes: "Plaguelands, Scholo, Strat, and later Naxx sharing stones / scraps." },
    { id: "timbermaw", name: "Exalted with Timbermaw Hold", notes: "Felwood / Winterspring grind. Unlocks their vendor rewards." },
    { id: "hydraxian", name: "Exalted with the Hydraxian Waterlords", notes: "Molten Core reputation; needed for the Aqual Quintessence / Eternal Essence." },
    { id: "brood", name: "Exalted with the Brood of Nozdormu", notes: "Temple of Ahn'Qiraj reputation." },
    { id: "cenarion", name: "Exalted with the Cenarion Circle", notes: "Silithus and the Ahn'Qiraj opening content." },
    { id: "zg-exalted", name: "Exalted with the Zandalar Tribe", notes: "Zul'Gurub reputation and coin / bijou turn-ins." },
    { id: "epic-craft", name: "Craft a landmark epic (or have one made)", notes: "Examples: Lionheart Helm, Sageblade, Robe of the Archmage, Devilsaur set, Truefaith Vestments." },
    { id: "thunderfury", name: "Complete Thunderfury, Blessed Blade of the Windseeker", notes: "Bind the bindings from Garr and Baron Geddon, then the MC quest." },
    { id: "atiesh", name: "Complete Atiesh, Greatstaff of the Guardian", notes: "The legendary staff quest from Naxxramas — a very long raid journey." }
  ]
};
