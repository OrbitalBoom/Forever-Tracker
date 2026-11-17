#!/usr/bin/env python3
"""Build compact leveling-route data for the Forever Tracker (local personal use)."""
from __future__ import annotations

import json, math, re, html
from collections import defaultdict, Counter
from html import unescape
from pathlib import Path

SRC = Path("/tmp/wowdata/quests")
OUT = Path("/workspace/wow-forever/js/leveling-data.js")
STATS = Path("/workspace/wow-forever/tools/leveling-stats.json")

RACE_BITS = {
    "Human": 1,
    "Orc": 2,
    "Dwarf": 4,
    "Night Elf": 8,
    "Undead": 16,
    "Tauren": 32,
    "Gnome": 64,
    "Troll": 128,
    # Forever Skyborne bits observed on Zephras Isle quests in forever-quests:
    # 4294967296 = 2**32 (often with Alliance 77), 8589934592 = 2**33 (often with Horde 178).
    "High Order Skyborne": 4294967296,
    "Windshaper Skyborne": 8589934592,
}
ALLIANCE_BITS = RACE_BITS["Human"] | RACE_BITS["Dwarf"] | RACE_BITS["Night Elf"] | RACE_BITS["Gnome"]
HORDE_BITS = RACE_BITS["Orc"] | RACE_BITS["Undead"] | RACE_BITS["Tauren"] | RACE_BITS["Troll"]
CLASS_BITS = {
    "Warrior": 1, "Paladin": 2, "Hunter": 4, "Rogue": 8, "Priest": 16,
    "Shaman": 32, "Mage": 64, "Warlock": 128, "Druid": 256,
}

# Classic AreaTable IDs + Forever IDs confirmed from Zephras zone pages (build 1.60.1.70938).
ZONE_AREAS = {
    "Elwynn Forest": {12, 9, 24, 18},
    "Northshire Valley": {9, 24},
    "Dun Morogh": {1, 132, 133, 77, 131, 134, 135, 136, 137, 138},
    "Coldridge Valley": {132, 133},
    "Teldrassil": {141, 188, 186, 187, 256, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266, 702},
    "Shadowglen": {188},
    "Durotar": {14, 363, 362, 367, 368, 369, 370, 371, 372, 373, 374, 375, 392, 393},
    "Valley of Trials": {363},
    "Mulgore": {215, 220, 221, 222, 223, 224, 225, 360, 404},
    "Red Cloud Mesa": {220, 221},
    "Tirisfal Glades": {85, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 211, 212, 459},
    "Deathknell": {154},
    "Zephras Isle": {16593},
    "Westfall": {40, 107, 108, 109, 917, 918, 919, 920, 921, 922},
    "Loch Modan": {38, 836, 837, 838, 839, 840, 841, 842, 843, 844, 845, 846, 847, 848, 849},
    "Darkshore": {148, 442, 443, 444, 445, 446, 447, 448, 449, 450, 456},
    "Silverpine Forest": {130, 204, 205, 226, 227, 228, 229, 230, 231, 232, 233, 235, 236, 237, 238, 239, 240, 925, 926, 927},
    "The Barrens": {17, 359, 379, 380, 381, 382, 383, 384, 385, 386, 387, 388, 390, 391, 169, 170, 171, 1717, 401, 511, 720, 815, 878, 1156, 1316},
    "Redridge Mountains": {44, 68, 69, 70, 71, 95, 96, 97, 98, 996, 997, 998},
    "Stonetalon Mountains": {406, 460, 461, 463, 464, 465, 467, 468, 469, 1076, 1276, 1277},
    "Ashenvale": {331, 413, 414, 415, 416, 417, 418, 419, 420, 421, 422, 424, 425, 426, 427, 428, 429, 430, 431, 432, 433, 434, 437, 438, 411, 412, 4157},
    "Wetlands": {11, 150, 1016, 1017, 1018, 1019, 1020, 1021, 1022, 1023, 1024, 1025, 1036, 1037, 1038, 1039, 1186, 298, 299, 309, 836},
    "Duskwood": {10, 42, 43, 49, 73, 74, 75, 76, 94, 241, 242, 243, 244, 245, 246, 573, 576, 799, 856, 1097, 1098, 1211},
    "Hillsbrad Foothills": {267, 271, 272, 275, 286, 287, 288, 289, 290, 294, 295, 296, 1056, 1679, 1680, 1681, 1682, 1683, 1684, 2397, 2839},
    "Thousand Needles": {400, 439, 480, 481, 482, 2097, 2238, 2239, 2240, 2241, 2242, 3037, 3038, 3039},
    "Stranglethorn Vale": {33, 35, 37, 43, 117, 122, 125, 126, 127, 128, 129, 1740, 1741, 1742, 297, 43, 19, 100, 101, 102, 103, 104, 105, 106, 117, 122, 477, 478, 1043, 1577, 1578, 1739, 1740, 1741, 1742, 2338, 2339, 3357},
    "Desolace": {405, 596, 597, 598, 599, 600, 602, 603, 604, 606, 607, 608, 609, 2198, 2404, 2405, 2406, 2407, 2408, 2417, 2617},
    "Arathi Highlands": {45, 313, 314, 315, 316, 317, 318, 320, 321, 327, 334, 335, 336, 1857, 1858, 1877, 2032, 2040, 324},
    "Riverglades": {16591},
    "Shen'dralas": {16651},
    "Dustwallow Marsh": {15, 496, 497, 498, 499, 507, 508, 509, 513, 2079, 2302, 403, 498},
    "Swamp of Sorrows": {8, 75, 74, 76, 300, 1161, 1162, 1224, 1431, 1777, 1778, 1797, 1817, 1978, 2403},
    "Badlands": {3, 337, 338, 339, 340, 341, 342, 343, 344, 345, 346, 347, 348, 349, 350, 351, 352, 353, 354, 355, 356, 1517},
    "Feralas": {357, 1099, 1100, 1101, 1106, 1116, 1120, 1121, 1136, 1137, 1219, 1220, 1230, 1231, 1232, 1233, 1234, 1235, 1236, 1237, 1296, 1297, 1397, 2159, 2400, 2401, 2402, 2522, 2537, 2538, 2539, 2540, 3117},
    "Tanaris": {440, 974, 976, 977, 978, 979, 980, 981, 982, 983, 984, 985, 986, 987, 988, 989, 990, 991, 992, 1937, 1938, 1939, 1940, 1941, 1942, 2300, 303, 1336, 1943},
    "The Hinterlands": {47, 1880, 1881, 1882, 1883, 1884, 1885, 1886, 1887, 1917, 307, 348, 349, 350, 351, 353, 354, 355, 356},
    "Searing Gorge": {51, 1442, 1443, 1444, 1445, 1446, 1957, 1958, 1959, 246, 247, 1442},
    "Azshara": {16, 1216, 1217, 1218, 1219, 1220, 1221, 1222, 1223, 1224, 1225, 1226, 1227, 1228, 1229, 1230, 1231, 1232, 1233, 1234, 1235, 1236, 1237, 2497, 3137, 3140},
    "Felwood": {361, 1761, 1762, 1763, 1764, 1765, 1766, 1767, 1768, 1769, 1770, 1771, 1998, 2479, 2480, 2481, 2618},
    "Un'Goro Crater": {490, 537, 538, 539, 540, 541, 1943, 303, 1336},
    "Western Plaguelands": {28, 190, 192, 193, 195, 197, 198, 199, 200, 201, 202, 203, 813, 318, 1520, 193, 2260, 2261, 2262, 2263, 2264, 2266, 2268, 2270, 2271, 2272, 2273, 2275, 2276, 2277, 2278, 2279, 2297, 2298},
    "Eastern Plaguelands": {139, 2258, 2260, 2261, 2262, 2263, 2264, 2265, 2266, 2267, 2268, 2269, 2270, 2271, 2272, 2273, 2274, 2275, 2276, 2277, 2278, 2279, 2297, 2298, 2619, 2620, 2621, 2622, 2623, 2624},
    "Winterspring": {618, 2241, 2242, 2243, 2244, 2245, 2246, 2247, 2248, 2249, 2250, 2251, 2252, 2253, 2254, 2255, 2256, 2258, 3139},
    "Silithus": {1377, 2740, 2741, 2742, 2743, 2744, 3077, 3097, 3098, 3099, 3100, 3425, 3426, 3427, 3446, 3447, 3454},
    "Mount Hyjal": {616},
    "Blasted Lands": {4, 72, 73, 1435, 1437, 1438, 1439, 1440, 1441, 1456, 1457, 1458},
    "Burning Steppes": {46, 249, 250, 251, 252, 253, 254, 255, 2418, 2419, 2420, 2421},
}

# Aliases so quests in starter subzones attach to the parent zone segment.
SUBZONE_PARENT = {
    "Northshire Valley": "Elwynn Forest",
    "Northshire Abbey": "Elwynn Forest",
    "Coldridge Valley": "Dun Morogh",
    "Anvilmar": "Dun Morogh",
    "Shadowglen": "Teldrassil",
    "Valley of Trials": "Durotar",
    "Red Cloud Mesa": "Mulgore",
    "Camp Narache": "Mulgore",
    "Deathknell": "Tirisfal Glades",
}

SKIP_ZONES = {
    "Ahn'Qiraj", "Ahn'Qiraj War", "Alterac Valley", "Arathi Basin", "Warsong Gulch",
    "Naxxramas", "Molten Core", "Blackwing Lair", "Onyxia's Lair", "Zul'Gurub",
    "Ruins of Ahn'Qiraj", "Hyjal Summit", "Seasonal", "Lunar Festival", "Midsummer",
    "Darkmoon Faire", "Invasion", "Epic", "Legendary", "Special", "Other",
    "Camping", "Crafting", "Reputation",
}

# Negative zoneOrSort / sort categories to drop (professions, holidays, pvp, etc.)
# Keep class sorts only when the class matches (handled later).
DROP_SORT_ABS = {
    22, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33,  # professions-ish (classic QuestSort)
    81, 82, 141, 161, 162, 163, 201, 221, 241, 263, 284,  # more sorts
    364, 365, 366, 367, 368, 369, 370, 371, 372, 373, 374, 375, 376,
    398, 404, 409, 410, 411, 422, 423, 424,
}

# ForeverDB published zone order (guide updated 2026-11-05, checked build 1.60.1.70938).
# Each entry: (zone, level_lo, level_hi)
# Race-specific prefixes are applied first; then the faction mid/late route.

RACE_START = {
    "Human": [("Elwynn Forest", 1, 12)],
    "Dwarf": [("Dun Morogh", 1, 12)],
    "Gnome": [("Dun Morogh", 1, 12)],
    "Night Elf": [("Teldrassil", 1, 12)],
    "High Order Skyborne": [("Zephras Isle", 1, 13)],
    "Orc": [("Durotar", 1, 13)],
    "Troll": [("Durotar", 1, 13)],
    "Tauren": [("Mulgore", 1, 13)],
    "Undead": [("Tirisfal Glades", 1, 12)],
    "Windshaper Skyborne": [("Zephras Isle", 1, 13)],
}

ALLIANCE_BY_RACE = {
    "Human": [
        ("Westfall", 10, 20),
        ("Loch Modan", 10, 20),
        ("Darkshore", 12, 20),
        ("Redridge Mountains", 14, 25),
        ("Duskwood", 18, 32),
        ("Wetlands", 20, 32),
        ("Ashenvale", 18, 30),
        ("Stonetalon Mountains", 18, 28),
        ("Hillsbrad Foothills", 24, 37),
    ],
    "Dwarf": [
        ("Loch Modan", 10, 20),
        ("Westfall", 10, 20),
        ("Redridge Mountains", 14, 25),
        ("Wetlands", 20, 32),
        ("Darkshore", 12, 20),
        ("Duskwood", 18, 32),
        ("Ashenvale", 18, 30),
        ("Stonetalon Mountains", 18, 28),
        ("Hillsbrad Foothills", 24, 37),
    ],
    "Gnome": [
        ("Loch Modan", 10, 20),
        ("Westfall", 10, 20),
        ("Redridge Mountains", 14, 25),
        ("Wetlands", 20, 32),
        ("Darkshore", 12, 20),
        ("Duskwood", 18, 32),
        ("Ashenvale", 18, 30),
        ("Stonetalon Mountains", 18, 28),
        ("Hillsbrad Foothills", 24, 37),
    ],
    "Night Elf": [
        ("Darkshore", 10, 20),
        ("Ashenvale", 18, 30),
        ("Stonetalon Mountains", 18, 28),
        ("Westfall", 10, 20),
        ("Loch Modan", 10, 20),
        ("Redridge Mountains", 14, 25),
        ("Wetlands", 21, 32),
        ("Duskwood", 24, 32),
        ("Hillsbrad Foothills", 24, 37),
    ],
    "High Order Skyborne": [
        ("Westfall", 10, 20),
        ("Loch Modan", 10, 20),
        ("Darkshore", 12, 20),
        ("Redridge Mountains", 14, 25),
        ("Duskwood", 18, 32),
        ("Wetlands", 20, 32),
        ("Ashenvale", 18, 30),
        ("Stonetalon Mountains", 18, 28),
        ("Hillsbrad Foothills", 24, 37),
    ],
}

HORDE_BY_RACE = {
    "Orc": [
        ("The Barrens", 10, 25),
        ("Stonetalon Mountains", 18, 28),
        ("Ashenvale", 18, 30),
        ("Silverpine Forest", 10, 18),
        ("Hillsbrad Foothills", 24, 37),
        ("Thousand Needles", 28, 41),
    ],
    "Troll": [
        ("The Barrens", 10, 25),
        ("Stonetalon Mountains", 18, 28),
        ("Ashenvale", 18, 30),
        ("Silverpine Forest", 10, 18),
        ("Hillsbrad Foothills", 24, 37),
        ("Thousand Needles", 28, 41),
    ],
    "Tauren": [
        ("The Barrens", 10, 25),
        ("Stonetalon Mountains", 18, 28),
        ("Ashenvale", 18, 30),
        ("Thousand Needles", 28, 41),
        ("Hillsbrad Foothills", 24, 37),
        ("Silverpine Forest", 10, 18),
    ],
    "Undead": [
        ("Silverpine Forest", 10, 18),
        ("The Barrens", 10, 25),
        ("Hillsbrad Foothills", 24, 37),
        ("Ashenvale", 18, 30),
        ("Stonetalon Mountains", 18, 28),
        ("Thousand Needles", 28, 41),
    ],
    "Windshaper Skyborne": [
        ("Silverpine Forest", 10, 18),
        ("The Barrens", 10, 25),
        ("Hillsbrad Foothills", 24, 37),
        ("Ashenvale", 18, 30),
        ("Stonetalon Mountains", 18, 28),
        ("Thousand Needles", 28, 41),
    ],
}

# Shared 30–60 order (ForeverDB per-level table + official new zones).
# Shen'dralas and Mount Hyjal are inserted from official/Zephras zone data
# (they are named as new Forever places in the same guide, but the per-level
# estimate table did not yet list them).
LATE_ALLIANCE = [
    ("Stranglethorn Vale", 30, 45),
    ("Desolace", 30, 40),
    ("Arathi Highlands", 30, 40),
    ("Riverglades", 36, 45),
    ("Shen'dralas", 38, 45),
    ("Dustwallow Marsh", 35, 45),
    ("Swamp of Sorrows", 35, 45),
    ("Badlands", 35, 45),
    ("Feralas", 40, 52),
    ("Tanaris", 40, 52),
    ("The Hinterlands", 40, 52),
    ("Searing Gorge", 43, 52),
    ("Azshara", 45, 55),
    ("Un'Goro Crater", 48, 55),
    ("Felwood", 48, 55),
    ("Burning Steppes", 50, 58),
    ("Western Plaguelands", 50, 60),
    ("Winterspring", 53, 60),
    ("Eastern Plaguelands", 53, 60),
    ("Silithus", 55, 60),
    ("Mount Hyjal", 55, 60),
    ("Blasted Lands", 45, 55),
]
LATE_HORDE = [
    ("Stranglethorn Vale", 30, 45),
    ("Desolace", 30, 40),
    ("Arathi Highlands", 30, 41),
    ("Riverglades", 36, 45),
    ("Shen'dralas", 38, 45),
    ("Dustwallow Marsh", 35, 45),
    ("Swamp of Sorrows", 35, 45),
    ("Badlands", 35, 45),
    ("Feralas", 40, 52),
    ("Tanaris", 40, 52),
    ("The Hinterlands", 40, 52),
    ("Searing Gorge", 43, 52),
    ("Azshara", 45, 55),
    ("Un'Goro Crater", 48, 55),
    ("Felwood", 48, 55),
    ("Burning Steppes", 50, 58),
    ("Western Plaguelands", 50, 60),
    ("Winterspring", 53, 60),
    ("Eastern Plaguelands", 53, 60),
    ("Silithus", 55, 60),
    ("Mount Hyjal", 55, 60),
    ("Blasted Lands", 45, 55),
]

NEW_ZONES = {"Zephras Isle", "Riverglades", "Shen'dralas", "Mount Hyjal"}

# Known Classic / Forever travel (no invented coordinates).
def travel_text(prev, zone, faction, race):
    key = (prev, zone, faction)
    special = {
        ("Tirisfal Glades", "Silverpine Forest", "Horde"):
            "Walk south from Brill / The Undercity into Silverpine Forest (The Sepulcher).",
        ("Tirisfal Glades", "The Barrens", "Horde"):
            "Take the zeppelin from the Undercity (Tirisfal) to Orgrimmar, then run south into The Barrens (The Crossroads).",
        ("Silverpine Forest", "The Barrens", "Horde"):
            "Run north to the Undercity zeppelin and fly to Orgrimmar, then south to The Crossroads.",
        ("Silverpine Forest", "Hillsbrad Foothills", "Horde"):
            "Follow the road east from The Sepulcher into Hillsbrad (Tarren Mill).",
        ("Durotar", "The Barrens", "Horde"):
            "Take the road west/south from Razor Hill or Orgrimmar into The Barrens (The Crossroads).",
        ("Mulgore", "The Barrens", "Horde"):
            "Leave Bloodhoof / Thunder Bluff east through the Southern Barrens (Camp Taurajo), then north to The Crossroads.",
        ("The Barrens", "Stonetalon Mountains", "Horde"):
            "From The Crossroads, take the northwest road through the Honor's Stand / Talondeep path to Sun Rock Retreat.",
        ("The Barrens", "Ashenvale", "Horde"):
            "From The Crossroads, take the north road into Ashenvale (Splintertree Post / Zoram'gar).",
        ("The Barrens", "Thousand Needles", "Horde"):
            "From Camp Taurajo, go south through the Great Lift into Thousand Needles (Freewind Post).",
        ("The Barrens", "Stranglethorn Vale", "Horde"):
            "Take the boat from Ratchet to Booty Bay, or the zeppelin from Orgrimmar to Grom'gol.",
        ("The Barrens", "Desolace", "Horde"):
            "From The Crossroads or Sun Rock Retreat, travel west/south through the Stonetalon / Charred Vale path into Desolace.",
        ("Stranglethorn Vale", "Riverglades", "Horde"):
            "Travel to Riverglades (new Eastern Kingdoms zone; Horde flight point at Rog'mar once discovered).",
        ("Stranglethorn Vale", "Riverglades", "Alliance"):
            "Travel to Riverglades (new Eastern Kingdoms zone; Alliance flight point at Farholde Keep once discovered).",
        ("Desolace", "Shen'dralas", "Horde"):
            "From Desolace, enter Shen'dralas (new Kalimdor zone between Desolace and Mulgore; no flight point recorded).",
        ("Desolace", "Shen'dralas", "Alliance"):
            "From Desolace, enter Shen'dralas (new Kalimdor zone between Desolace and Mulgore; no flight point recorded).",
        ("The Barrens", "Tanaris", "Horde"):
            "From Ratchet you can eventually reach Tanaris (boat / run through Thousand Needles and Shimmering Flats to Gadgetzan).",
        ("Feralas", "Tanaris", "Horde"):
            "Ride or fly (once you have the points) between Camp Mojache / Feathermoon and Gadgetzan.",
        ("Feralas", "Tanaris", "Alliance"):
            "Ride or fly between Feathermoon / Thalanaar and Gadgetzan.",
        ("Felwood", "Winterspring", "Horde"):
            "Use the Timbermaw Hold tunnel from Felwood to Winterspring (Everlook) — Timbermaw reputation helps.",
        ("Felwood", "Winterspring", "Alliance"):
            "Use the Timbermaw Hold tunnel from Felwood to Winterspring (Everlook) — Timbermaw reputation helps.",
        ("Western Plaguelands", "Eastern Plaguelands", "Horde"):
            "Follow the road east from the Western Plaguelands into the Eastern Plaguelands (Light's Hope / Thondroril).",
        ("Western Plaguelands", "Eastern Plaguelands", "Alliance"):
            "Follow the road east from the Western Plaguelands into the Eastern Plaguelands (Light's Hope / Thondroril).",
        ("Winterspring", "Mount Hyjal", "Horde"):
            "Travel to Mount Hyjal (new Kalimdor endgame zone, client range 55–60; flight points at Summit of Eternity and Tainted Foothills).",
        ("Winterspring", "Mount Hyjal", "Alliance"):
            "Travel to Mount Hyjal (new Kalimdor endgame zone, client range 55–60; flight points at Summit of Eternity and Tainted Foothills).",
        ("Eastern Plaguelands", "Mount Hyjal", "Horde"):
            "Hearth or fly back to Kalimdor, then travel to Mount Hyjal (Summit of Eternity / Tainted Foothills flight points).",
        ("Eastern Plaguelands", "Mount Hyjal", "Alliance"):
            "Hearth or fly back to Kalimdor, then travel to Mount Hyjal (Summit of Eternity / Tainted Foothills flight points).",
        ("Silithus", "Mount Hyjal", "Horde"):
            "Travel north through Kalimdor to Mount Hyjal.",
        ("Silithus", "Mount Hyjal", "Alliance"):
            "Travel north through Kalimdor to Mount Hyjal.",
        ("Elwynn Forest", "Westfall", "Alliance"):
            "Take the road west from Goldshire / Stormwind into Westfall (Sentinel Hill).",
        ("Dun Morogh", "Loch Modan", "Alliance"):
            "Go through the North Gate Pass / tunnels from Dun Morogh or Ironforge into Loch Modan (Thelsamar).",
        ("Teldrassil", "Darkshore", "Alliance"):
            "From Rut'theran Village, take the boat (or flight, once learned) to Auberdine in Darkshore.",
        ("Westfall", "Loch Modan", "Alliance"):
            "Fly or take the Deeprun Tram / roads via Stormwind and Ironforge to Thelsamar.",
        ("Loch Modan", "Westfall", "Alliance"):
            "Fly or travel via Ironforge / Stormwind to Sentinel Hill.",
        ("Loch Modan", "Wetlands", "Alliance"):
            "Take the road north through Dun Algaz from Loch Modan into the Wetlands (Menethil Harbor).",
        ("Darkshore", "Ashenvale", "Alliance"):
            "Follow the south road from Auberdine into Ashenvale (Astranaar).",
        ("Darkshore", "Westfall", "Alliance"):
            "Forever adds a ship between Auberdine and Stormwind Harbor; then run west to Westfall.",
        ("Westfall", "Redridge Mountains", "Alliance"):
            "Travel east through Elwynn Forest / Stormwind to Lakeshire in Redridge.",
        ("Redridge Mountains", "Duskwood", "Alliance"):
            "Take the south road from Lakeshire into Duskwood (Darkshire).",
        ("Elwynn Forest", "Redridge Mountains", "Alliance"):
            "Follow the east road from Goldshire to Lakeshire.",
        ("Wetlands", "Hillsbrad Foothills", "Alliance"):
            "Boat from Menethil Harbor to Theramore or take the Thandol Span / hinterland roads, or the Forever ship routes involving Menethil and Southshore.",
        ("Duskwood", "Stranglethorn Vale", "Alliance"):
            "Take the road south from Darkshire into Stranglethorn (Rebel Camp / Booty Bay).",
        ("Stranglethorn Vale", "Desolace", "Alliance"):
            "Boat from Booty Bay to Ratchet, then travel west through The Barrens / Stonetalon into Desolace (Nijel's Point).",
        ("Zephras Isle", "Westfall", "Alliance"):
            "Leave Zephras Isle for the Eastern Kingdoms and pick up the Alliance 10–20 route in Westfall (Sentinel Hill). The exact exit path is not in the data we have.",
        ("Zephras Isle", "Silverpine Forest", "Horde"):
            "Leave Zephras Isle for the Horde 10–20 route. A Windshaper quest (“Exploring the Horde”) sends you to Lady Sylvanas in the Undercity; from there walk south into Silverpine (The Sepulcher).",
        ("Zephras Isle", "The Barrens", "Horde"):
            "Leave Zephras Isle, then take a zeppelin or roads to Orgrimmar and south into The Barrens.",
    }
    if key in special:
        return special[key]
    if prev and prev != zone:
        return f"Travel from {prev} to {zone}."
    return f"Go to {zone}."

HUBS = {
    "Elwynn Forest": "Goldshire (set your hearth at the inn).",
    "Dun Morogh": "Kharanos (set your hearth at the inn).",
    "Teldrassil": "Dolanaar (set your hearth at the inn).",
    "Durotar": "Razor Hill (set your hearth at the inn).",
    "Mulgore": "Bloodhoof Village (set your hearth at the inn).",
    "Tirisfal Glades": "Brill (set your hearth at the inn).",
    "Zephras Isle": "the inn of the Skyborne town you are questing from, once you find it.",
    "Westfall": "Sentinel Hill (set your hearth; get the flight path).",
    "Loch Modan": "Thelsamar (set your hearth; get the flight path).",
    "Darkshore": "Auberdine (set your hearth; get the flight path).",
    "Silverpine Forest": "The Sepulcher (set your hearth; get the flight path).",
    "The Barrens": "The Crossroads (set your hearth; get the Crossroads flight path — also pick up Camp Taurajo and Ratchet when you pass them).",
    "Redridge Mountains": "Lakeshire (set your hearth; Alliance flight path).",
    "Stonetalon Mountains": "Sun Rock Retreat (Horde) or Stonetalon Peak (Alliance) — set your hearth and get the flight path.",
    "Ashenvale": "Splintertree Post / Zoram'gar (Horde) or Astranaar (Alliance) — set your hearth and get the flight path.",
    "Wetlands": "Menethil Harbor (set your hearth; get the flight path).",
    "Duskwood": "Darkshire (set your hearth; get the flight path).",
    "Hillsbrad Foothills": "Tarren Mill (Horde) or Southshore (Alliance) — set your hearth and get the flight path.",
    "Thousand Needles": "Freewind Post (set your hearth; get the flight path).",
    "Stranglethorn Vale": "Grom'gol (Horde) or the Rebel Camp / Booty Bay (Alliance) — get flight paths and set your hearth in the town you will return to.",
    "Desolace": "Shadowprey Village (Horde) or Nijel's Point (Alliance) — set your hearth and get the flight path.",
    "Arathi Highlands": "Hammerfall (Horde) or Refuge Pointe (Alliance) — set your hearth and get the flight path.",
    "Riverglades": "Rog'mar (Horde flight point) or Farholde Keep (Alliance flight point) — set your hearth when you find an inn.",
    "Shen'dralas": "Shen'dralas has no flight point recorded in the client data we have; set your hearth if you find an inn.",
    "Dustwallow Marsh": "Brackenwall Village (Horde) or Theramore (Alliance).",
    "Swamp of Sorrows": "Stonard (Horde) or the Alliance camp you use.",
    "Badlands": "Kargath (Horde).",
    "Feralas": "Camp Mojache (Horde) or Feathermoon Stronghold (Alliance).",
    "Tanaris": "Gadgetzan (neutral) — set your hearth and get the flight path.",
    "The Hinterlands": "Revantusk Village (Horde) or Aerie Peak (Alliance).",
    "Searing Gorge": "Thorium Point (neutral).",
    "Felwood": "Bloodvenom Post (Horde) or Talonbranch Glade (Alliance).",
    "Un'Goro Crater": "Marshal's Refuge (neutral).",
    "Western Plaguelands": "The Bulwark (Horde) or Chillwind Camp (Alliance).",
    "Winterspring": "Everlook (neutral).",
    "Eastern Plaguelands": "Light's Hope Chapel (neutral) / The Undercity flight network.",
    "Silithus": "Cenarion Hold (neutral).",
    "Mount Hyjal": "Summit of Eternity or Tainted Foothills (both sides have flight points).",
}


def load_fq():
    return json.loads((SRC / "fq-quests.json").read_text())


def load_fdb():
    return json.loads((SRC / "fdb-quests.json").read_text())


def parse_zep_starts():
    """Start coords already fetched during research (quest list page, not a new scrape)."""
    html_text = (SRC / "zep-quests.html").read_text(errors="replace")
    rows = re.findall(r"<tr[\s\S]*?</tr>", html_text)
    out = {}
    for row in rows:
        if "data-name=" not in row:
            continue
        mid = re.search(r"/forever/enUS/quest/(\d+)/\">([^<]+)", row)
        if not mid:
            continue
        qid = int(mid.group(1))
        name = unescape(mid.group(2))
        level = re.search(r'data-level="([^"]*)"', row)
        place = re.search(r'data-place="([^"]*)"', row)
        side = re.search(r'data-side="([^"]*)"', row)
        giver = re.search(r'data-giver="([^"]*)"', row)
        coord = re.search(r'<span class="cell-sub">\s*\(([^)]+)\)', row)
        xy = None
        if coord:
            parts = coord.group(1).split(",")
            try:
                xy = (float(parts[0].strip()), float(parts[1].strip()))
            except (ValueError, IndexError):
                xy = None
        place_slug = unescape(place.group(1)) if place else ""
        zone = place_slug.replace("-", " ").title() if place_slug else ""
        # Fix a few titles
        fixes = {
            "Shen Dralas": "Shen'dralas",
            "Mount Hyjal": "Mount Hyjal",
            "Zephras Isle": "Zephras Isle",
            "The Barrens": "The Barrens",
            "Tirisfal Glades": "Tirisfal Glades",
            "Elwynn Forest": "Elwynn Forest",
            "Dun Morogh": "Dun Morogh",
            "Krol Dok Stronghold": "Krol'dok Stronghold",
            "The Hinterlands": "The Hinterlands",
            "Un Goro Crater": "Un'Goro Crater",
        }
        zone = fixes.get(zone, zone)
        out[qid] = {
            "name": name,
            "level": int(level.group(1)) if level and level.group(1).isdigit() else None,
            "zone": zone,
            "side": (side.group(1) if side and side.group(1) else None),
            "giver": unescape(giver.group(1)).title() if giver and giver.group(1) else None,
            "xy": xy,
        }
    return out


def race_ok(mask, race, faction):
    if mask in (None, 0):
        return True
    try:
        mask = int(mask)
    except (TypeError, ValueError):
        return True
    bit = RACE_BITS.get(race)
    if bit and (mask & bit):
        return True
    # High bits sometimes encode "all of a faction including new races".
    if faction == "Horde" and (mask & HORDE_BITS) == HORDE_BITS:
        return race in ("Orc", "Undead", "Tauren", "Troll", "Windshaper Skyborne")
    if faction == "Alliance" and (mask & ALLIANCE_BITS) == ALLIANCE_BITS:
        return race in ("Human", "Dwarf", "Night Elf", "Gnome", "High Order Skyborne")
    # Skyborne: allow if no vanilla bits at all but a high bit is set and side matches — handled via FDB side.
    if race in ("Windshaper Skyborne", "High Order Skyborne") and bit is None:
        # accept if mask looks unrestricted-for-new or faction-wide
        if (mask & (ALLIANCE_BITS | HORDE_BITS)) == 0:
            return True
    return False


def side_ok(side, faction):
    if not side or side in ("both", "Both"):
        return True
    if side in ("h", "horde", "Horde"):
        return faction == "Horde"
    if side in ("a", "alliance", "Alliance"):
        return faction == "Alliance"
    return True


def class_list(mask):
    if not mask:
        return None
    try:
        mask = int(mask)
    except (TypeError, ValueError):
        return None
    names = [n for n, b in CLASS_BITS.items() if mask & b]
    return names or None


def is_junk_quest(q, zep=None):
    name = (q.get("name") or "")
    if not name or name.upper().startswith("REUSE") or name.lower() in ("test", "test of faith"):
        # keep Test of Faith? it's a real Thousand Needles quest. Only drop REUSE.
        if name.upper().startswith("REUSE"):
            return True
    ql = q.get("questLevel") or q.get("level")
    if ql is not None and (ql <= 0 or ql > 60):
        # keep 60; drop 0 and 61+
        if ql <= 0 or ql > 60:
            return True
    flags = q.get("specialFlags") or 0
    try:
        flags = int(flags)
    except (TypeError, ValueError):
        flags = 0
    # bit 1 = repeatable — skip most repeatables for a leveling route
    if flags & 1:
        return True
    zos = q.get("zoneOrSort") or 0
    if isinstance(zos, int) and zos < 0:
        # class sorts are -61 warrior, -81 hunter, -82 shaman, -141? paladin etc. We'll allow class later.
        # drop clearly non-leveling sorts if we know them; unknown negative kept only if we have a zone.
        if not q.get("areaId") and not (zep and zep.get("zone") and zep["zone"] not in SKIP_ZONES):
            # profession / seasonal only
            if abs(zos) in DROP_SORT_ABS:
                return True
    return False


def zone_of(qid, fq, fdb, zep):
    # Prefer explicit areaId mapping, then FDB, then Zephras place.
    area = fq.get("areaId")
    if area:
        for z, ids in ZONE_AREAS.items():
            if area in ids:
                return SUBZONE_PARENT.get(z, z)
    if fdb and fdb.get("zone") and fdb["zone"].get("n"):
        n = fdb["zone"]["n"]
        if n and n not in SKIP_ZONES and n not in CLASS_BITS and n not in (
            "Warrior", "Paladin", "Hunter", "Rogue", "Priest", "Shaman", "Mage", "Warlock", "Druid",
            "Alchemy", "Blacksmithing", "Cooking", "Engineering", "First Aid", "Fishing",
            "Herbalism", "Leatherworking", "Tailoring", "Camping", "Crafting",
        ):
            return SUBZONE_PARENT.get(n, n)
    if zep and zep.get("zone") and zep["zone"] not in SKIP_ZONES:
        return SUBZONE_PARENT.get(zep["zone"], zep["zone"])
    return None


def merge_coords(fdb, zep):
    """Return (x,y,source) for start and end."""
    sx = sy = ex = ey = None
    ss = es = None
    if fdb:
        st = fdb.get("starts") or {}
        en = fdb.get("ends") or {}
        sl = st.get("location") if isinstance(st, dict) else None
        el = en.get("location") if isinstance(en, dict) else None
        if sl and sl.get("x") is not None:
            sx, sy = sl["x"], sl["y"]
            src = (sl.get("source") or st.get("source") or "")
            if "Forever" in src and "Classic" not in src:
                ss = "forever"
            elif "Classic" in src or "CMaNGOS" in src:
                ss = "classic"
            else:
                ss = "forever" if "Forever" in src else "classic"
        if el and el.get("x") is not None:
            ex, ey = el["x"], el["y"]
            src = (el.get("source") or en.get("source") or "")
            if "Forever" in src and "Classic" not in src:
                es = "forever"
            elif "Classic" in src or "CMaNGOS" in src:
                es = "classic"
            else:
                es = "forever" if "Forever" in src else "classic"
    if zep and zep.get("xy"):
        # Fill start if missing; do not invent end. Label as zephras-list (not CC BY talent data).
        if sx is None:
            sx, sy = zep["xy"]
            ss = "zephras-list"
        # If FDB classic but Zephras has a point, keep FDB (already labeled) — Zephras is a second opinion only when missing.
    return sx, sy, ss, ex, ey, es


def dist(a, b):
    if a is None or b is None or a[0] is None or b[0] is None or a[1] is None or b[1] is None:
        return None
    return math.hypot(a[0] - b[0], a[1] - b[1])


def nn_order(quests, start_xy=None):
    """Nearest-neighbor on start coords, constrained by prerequisites already chosen or not in the set."""
    ids = {q["id"] for q in quests}
    pre = {q["id"]: [p for p in (q.get("pre") or []) if p in ids] for q in quests}
    byid = {q["id"]: q for q in quests}
    remaining = set(ids)
    ordered = []
    cur = start_xy
    naive_len = 0
    opt_len = 0
    last_naive = start_xy
    # naive baseline: quest level then name
    naive = sorted(quests, key=lambda q: (q.get("level") or 99, q.get("name") or ""))
    for q in naive:
        xy = (q.get("sx"), q.get("sy")) if q.get("sx") is not None else ((q.get("ex"), q.get("ey")) if q.get("ex") is not None else None)
        if last_naive and xy and xy[0] is not None:
            d = dist(last_naive, xy)
            if d is not None:
                naive_len += d
            last_naive = xy
        elif xy and xy[0] is not None:
            last_naive = xy

    while remaining:
        ready = []
        for qid in remaining:
            if all(p not in remaining for p in pre[qid]):
                ready.append(byid[qid])
        if not ready:
            # cycle / missing prereq — take lowest level remaining
            ready = [byid[q] for q in remaining]
        def key(q):
            xy = (q.get("sx"), q.get("sy")) if q.get("sx") is not None else (q.get("ex"), q.get("ey"))
            d = dist(cur, xy) if cur and xy and xy[0] is not None else None
            return (0 if d is not None else 1, d if d is not None else 0, q.get("level") or 99, q.get("name") or "")
        ready.sort(key=key)
        pick = ready[0]
        xy = (pick.get("sx"), pick.get("sy")) if pick.get("sx") is not None else (pick.get("ex"), pick.get("ey"))
        if cur and xy and xy[0] is not None:
            d = dist(cur, xy)
            if d is not None:
                opt_len += d
        if xy and xy[0] is not None:
            cur = xy
        ordered.append(pick)
        remaining.remove(pick["id"])
    return ordered, naive_len, opt_len


def exclusive_filter(quests):
    """If A exclusiveTo B, keep the lower-level (then lower id) one when both present."""
    byid = {q["id"]: q for q in quests}
    drop = set()
    for q in quests:
        for other in (q.get("exc") or []):
            if other in byid and other not in drop and q["id"] not in drop:
                a, b = q, byid[other]
                # keep lower required/quest level; stable by id
                al = a.get("req") or a.get("level") or 99
                bl = b.get("req") or b.get("level") or 99
                if (al, a["id"]) <= (bl, b["id"]):
                    drop.add(b["id"])
                else:
                    drop.add(a["id"])
    return [q for q in quests if q["id"] not in drop]


def build_segments(race, faction):
    segs = list(RACE_START[race])
    if faction == "Alliance":
        segs += list(ALLIANCE_BY_RACE[race]) + list(LATE_ALLIANCE)
    else:
        segs += list(HORDE_BY_RACE[race]) + list(LATE_HORDE)
    # de-dup zones keeping first occurrence
    seen = set()
    out = []
    for z, lo, hi in segs:
        if z in seen:
            continue
        seen.add(z)
        out.append((z, lo, hi))
    return out


def main():
    print("Loading sources…")
    fq = load_fq()
    fdb = load_fdb()
    zep = parse_zep_starts()
    print("  fq", len(fq), "fdb", len(fdb), "zep", len(zep))

    # Discover Skyborne race masks from Zephras Isle quests
    sky_masks = Counter()
    for rec in fq.values():
        if rec.get("areaId") == 16593 and rec.get("requiredRaces"):
            sky_masks[int(rec["requiredRaces"])] += 1
    print("  zephras race masks", sky_masks.most_common(8))

    catalog = {}
    for key, rec in fq.items():
        qid = rec.get("id") or int(key)
        fd = fdb.get(str(qid)) or fdb.get(qid)
        zp = zep.get(qid)
        if is_junk_quest(rec, zp):
            continue
        zone = zone_of(qid, rec, fd, zp)
        if zone in SKIP_ZONES:
            continue
        sx, sy, ss, ex, ey, es = merge_coords(fd, zp)
        side = None
        if fd:
            side = fd.get("side")
        if not side and zp:
            side = zp.get("side")
        giver = None
        turnin = None
        if fd:
            st = fd.get("starts") or {}
            en = fd.get("ends") or {}
            if isinstance(st, dict):
                giver = st.get("name")
            if isinstance(en, dict):
                turnin = en.get("name")
        if not giver and zp:
            giver = zp.get("giver")
        pre = []
        for lst in (rec.get("preQuestSingle") or rec.get("preQuestGroup") or []):
            if isinstance(lst, list):
                pre.extend(int(x) for x in lst)
            else:
                pre.append(int(lst))
        # preQuestSingle is "one of"; preQuestGroup is "all of". Store both.
        pre_single = [int(x) for x in (rec.get("preQuestSingle") or [])]
        pre_group = [int(x) for x in (rec.get("preQuestGroup") or [])]
        exc = [int(x) for x in (rec.get("exclusiveTo") or [])]
        catalog[qid] = {
            "id": qid,
            "name": rec.get("name") or (zp or {}).get("name") or (fd or {}).get("name"),
            "level": rec.get("questLevel") or (fd or {}).get("level") or (zp or {}).get("level"),
            "req": rec.get("requiredLevel") or (fd or {}).get("requiredLevel"),
            "races": rec.get("requiredRaces"),
            "classes": class_list(rec.get("requiredClasses")),
            "zone": zone,
            "areaId": rec.get("areaId"),
            "side": side,
            "sx": sx, "sy": sy, "ss": ss,
            "ex": ex, "ey": ey, "es": es,
            "giver": giver, "turnin": turnin,
            "pre": pre_group or pre_single,  # used by NN; group preferred when present
            "preSingle": pre_single,
            "preGroup": pre_group,
            "exc": exc,
            "obj": None,
        }
        ot = rec.get("objectivesText")
        if isinstance(ot, list) and ot:
            catalog[qid]["obj"] = ot[0]
        elif isinstance(ot, str) and ot:
            catalog[qid]["obj"] = ot

    # Add zep-only / fdb-only quests not in fq (new Forever quests missing from pre-launch JSON)
    for qid, zp in zep.items():
        if qid in catalog:
            continue
        if not zp.get("name") or (zp.get("name") or "").upper().startswith("REUSE"):
            continue
        if zp.get("level") is not None and (zp["level"] <= 0 or zp["level"] > 60):
            continue
        zone = SUBZONE_PARENT.get(zp.get("zone"), zp.get("zone"))
        if not zone or zone in SKIP_ZONES:
            continue
        fd = fdb.get(str(qid)) or fdb.get(qid)
        sx, sy, ss, ex, ey, es = merge_coords(fd, zp)
        catalog[qid] = {
            "id": qid,
            "name": zp["name"],
            "level": zp.get("level") or (fd or {}).get("level"),
            "req": (fd or {}).get("requiredLevel"),
            "races": None,
            "classes": None,
            "zone": zone,
            "areaId": None,
            "side": (fd or {}).get("side") or zp.get("side"),
            "sx": sx, "sy": sy, "ss": ss,
            "ex": ex, "ey": ey, "es": es,
            "giver": ((fd.get("starts") or {}).get("name") if fd else None) or zp.get("giver"),
            "turnin": ((fd.get("ends") or {}).get("name") if fd else None),
            "pre": [],
            "preSingle": [],
            "preGroup": [],
            "exc": [],
            "obj": None,
            "extra": True,
        }
    print("  catalog", len(catalog))

    races = [
        ("Undead", "Horde"),
        ("Orc", "Horde"),
        ("Troll", "Horde"),
        ("Tauren", "Horde"),
        ("Windshaper Skyborne", "Horde"),
        ("Human", "Alliance"),
        ("Dwarf", "Alliance"),
        ("Gnome", "Alliance"),
        ("Night Elf", "Alliance"),
        ("High Order Skyborne", "Alliance"),
    ]

    routes = {}
    used_ids = set()
    stats = {"races": {}, "optimizer": {}, "newZones": {}, "guide": {
        "userGuide": "The attached file could not be decoded (custom encrypted envelope 213|…|40000; Read tool returned file not found). Zone order instead follows ForeverDB's published leveling guide (updated 2026-11-05, checked on build 1.60.1.70938), with Shen'dralas (38–45) and Mount Hyjal (55–60) inserted from official/Zephras zone data because the guide's per-level 30–60 estimate table did not yet list them.",
        "userGuidePath": "/home/box/agent-data/agents/cbf94620-2339-4daa-8185-8b4c57f2cba8/attachments/7300d0c87fa617c7f0ffbf82568a886268feab6507393d463b83a8ab5217bbb1.txt",
        "userGuideBytes": 1323474,
        "zoneOrderSource": "https://foreverdb.net/guide/leveling",
    }}

    def eligible(q, race, faction, lo, hi, zone):
        if q["zone"] != zone:
            return False
        if not side_ok(q.get("side"), faction):
            return False
        if not race_ok(q.get("races"), race, faction):
            return False
        lvl = q.get("level")
        req = q.get("req")
        # Keep if the quest can be taken in this window.
        if req is not None and req > hi + 2:
            return False
        if lvl is not None and lvl < lo - 4:
            return False
        if lvl is not None and lvl > hi + 8:
            # allow a little overflow (Riverglades has a 58 outlier) only if req is in window
            if req is None or req > hi + 2:
                return False
        return True

    for race, faction in races:
        segs = build_segments(race, faction)
        steps = []
        step_i = 0
        prev_zone = None
        cur_xy = None
        naive_total = 0
        opt_total = 0
        qcount = 0
        new_q = Counter()
        matched = 0
        auto_start = race in ("High Order Skyborne", "Windshaper Skyborne", "Night Elf", "Human", "Dwarf", "Gnome", "Orc", "Troll", "Tauren")
        # All starts except the user's Undead-Horde focus are "auto-generated and less tested"
        # Undead is also auto-generated because the user guide could not be parsed, but it is the default/tested path structurally.

        def add_step(**kw):
            nonlocal step_i
            step_i += 1
            sid = f"{faction[0].lower()}-{step_i}"
            kw["id"] = sid
            steps.append(kw)

        for zone, lo, hi in segs:
            pool = [q for q in catalog.values() if eligible(q, race, faction, lo, hi, zone)]
            pool = exclusive_filter(pool)
            if not pool and zone not in NEW_ZONES and zone not in {s[0] for s in RACE_START.get(race, [])}:
                # skip empty optional zones (e.g. Blasted Lands if nothing matched)
                continue
            if prev_zone != zone:
                add_step(
                    k="travel",
                    z=zone,
                    lv=lo,
                    title=f"Travel to {zone}",
                    detail=travel_text(prev_zone, zone, faction, race),
                    origin="foreverdb-guide",
                )
                hub = HUBS.get(zone)
                if hub:
                    add_step(
                        k="hearth",
                        z=zone,
                        lv=lo,
                        title=f"Set hearth / flight path — {zone}",
                        detail=hub,
                        origin="foreverdb-guide",
                    )
                prev_zone = zone
                cur_xy = None

            if not pool:
                if zone in NEW_ZONES:
                    add_step(
                        k="note",
                        z=zone,
                        lv=lo,
                        title=f"{zone}: no embeddable quest list for this race yet",
                        detail="This new Forever zone is on the route, but no matching quest records were in the local GPL / already-fetched databases for this race. Add your own notes or check them off as you go. Coordinates were not invented.",
                        origin="gap",
                    )
                continue

            ordered, naive_len, opt_len = nn_order(pool, cur_xy)
            naive_total += naive_len
            opt_total += opt_len
            if ordered:
                last = ordered[-1]
                if last.get("ex") is not None:
                    cur_xy = (last["ex"], last["ey"])
                elif last.get("sx") is not None:
                    cur_xy = (last["sx"], last["sy"])

            for q in ordered:
                qcount += 1
                used_ids.add(q["id"])
                if q["zone"] in NEW_ZONES:
                    new_q[q["zone"]] += 1
                if q.get("sx") is not None or q.get("id") in fq:
                    matched += 1
                obj = q.get("obj") or "Complete the quest objectives."
                giver = q.get("giver") or "quest giver"
                turnin = q.get("turnin") or "turn-in NPC"
                add_step(
                    k="quest",
                    q=q["id"],
                    z=zone,
                    lv=q.get("level") or lo,
                    classes=q.get("classes"),
                )

        routes[race] = {
            "faction": faction,
            "autoGenerated": True,
            "lessTested": race != "Undead",
            "defaultForUser": race == "Undead",
            "steps": steps,
            "questCount": qcount,
            "stepCount": len(steps),
        }
        saved = ((naive_total - opt_total) / naive_total * 100) if naive_total else 0
        stats["races"][race] = {
            "faction": faction,
            "steps": len(steps),
            "quests": qcount,
            "newZoneQuests": dict(new_q),
            "naiveTravel": round(naive_total, 1),
            "optimizedTravel": round(opt_total, 1),
            "travelReducedPct": round(saved, 1),
        }
        stats["optimizer"][race] = {
            "naive": round(naive_total, 1),
            "optimized": round(opt_total, 1),
            "reducedPct": round(saved, 1),
            "unit": "sum of zone-map percentage points between consecutive start (or turn-in) coordinates; only steps with coordinates",
        }
        print(f"  {race:24} {faction:9} quests={qcount:4} steps={len(steps):4}  travel {naive_total:.0f}->{opt_total:.0f} ({saved:.1f}% less)")

    # Compact quest lookup for used IDs only
    quests_out = {}
    for qid in sorted(used_ids):
        q = catalog[qid]
        quests_out[str(qid)] = {
            "n": q["name"],
            "z": q["zone"],
            "l": q.get("level"),
            "r": q.get("req"),
            "side": q.get("side"),
            "giver": q.get("giver"),
            "turnin": q.get("turnin"),
            "sx": q.get("sx"), "sy": q.get("sy"), "ss": q.get("ss"),
            "ex": q.get("ex"), "ey": q.get("ey"), "es": q.get("es"),
            "classes": q.get("classes"),
        }

    # New-zone coverage across catalog (not just routes)
    nz = {}
    for z in NEW_ZONES:
        qs = [q for q in catalog.values() if q["zone"] == z]
        with_c = sum(1 for q in qs if q.get("sx") is not None)
        nz[z] = {"questsInCatalog": len(qs), "withStartCoords": with_c}
    stats["newZones"] = nz
    stats["catalogSize"] = len(catalog)
    stats["questsEmbedded"] = len(quests_out)
    stats["coordSources"] = {
        "forever": "Start/end coordinates labeled 'seen in WoW Forever' in the ForeverDB snapshot of 2026-11-02 (https://foreverdb.net).",
        "classic": "Start/end coordinates labeled Classic data (CMaNGOS) in the same ForeverDB snapshot.",
        "zephras-list": "Quest-giver coordinates from the Zephras public quest list (https://zephras.com/forever/enUS/quest/), already downloaded 2026-11-17 during research; client build 1.60.1.70938. Not a new scrape, and not under Zephras's CC BY 4.0 talent-file license. Used only for this personal local copy. Game names © Blizzard.",
        "missing": "No coordinate in the local sources; nothing was invented.",
    }

    meta = {
        "builtAt": "2026-11-17",
        "levelCap": 60,
        "userGuideDecoded": False,
        "zoneOrder": "ForeverDB leveling guide (https://foreverdb.net/guide/leveling), updated 2026-11-05, checked on build 1.60.1.70938. Credit: Data from ForeverDB.net.",
        "questSources": [
            "tyler3497/forever-quests v1.3.0 (GPL-3.0), derived from Questie/QuestieDB Forever + NorgannonDB + TrinityCore Forever TDB rewards",
            "ForeverDB snapshot bundled in forever-quests/foreverdb (2026-11-02) — start/end coords and chains; credit Data from ForeverDB.net",
            "Zephras public quest list already fetched 2026-11-17 (giver coordinates only; personal local use)",
        ],
        "optimizer": "Per-zone nearest-neighbor on pickup (else turn-in) coordinates, waiting on preQuestSingle/preQuestGroup, dropping exclusiveTo duplicates. Travel between zones uses published flight/boat/zeppelin connections, not invented coordinates.",
        "gaps": [
            "The user's own 1.3 MB guide file could not be decoded, so its exact step order was not applied.",
            "ForeverDB's Nov 2 snapshot has no Riverglades / Shen'dralas / Mount Hyjal records; those quests come from forever-quests and/or the Zephras list.",
            "Objective spawn points are not embedded (only pickup and turn-in points when known).",
            "Some new-zone quests have no coordinates or no faction tag.",
            "Mount Hyjal and Shen'dralas were inserted from official/Zephras zone ranges, not from ForeverDB's per-level 30–60 estimate table.",
        ],
    }

    # Compact routes: steps are short arrays to keep file:// loads small.
    # [kind, zone, level, questId?, classes?]
    # kind: travel | hearth | quest | note
    compact_routes = {}
    for race, rec in routes.items():
        compact_steps = []
        for s in rec["steps"]:
            row = [s["k"], s.get("z") or "", int(s.get("lv") or 0)]
            if s.get("k") == "quest":
                row.append(int(s["q"]))
                if s.get("classes"):
                    row.append(s["classes"])
            else:
                # travel / hearth / note
                row.append(s.get("detail") or s.get("title") or "")
            compact_steps.append(row)
        compact_routes[race] = {
            "faction": rec["faction"],
            "autoGenerated": True,
            "lessTested": rec["lessTested"],
            "defaultForUser": rec["defaultForUser"],
            "questCount": rec["questCount"],
            "stepCount": rec["stepCount"],
            "steps": compact_steps,
        }

    payload = {
        "meta": meta,
        "races": [{"name": n, "faction": f} for n, f in races],
        "routes": compact_routes,
        "quests": quests_out,
        "hubs": HUBS,
    }

    js = "/* Leveling route data for Forever Tracker. Personal local use. See README for licenses. */\nwindow.WOW_LEVELING = "
    js += json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    js += ";\n"
    OUT.write_text(js)
    STATS.write_text(json.dumps(stats, indent=2))
    print("wrote", OUT, "bytes", OUT.stat().st_size)
    print("wrote", STATS)
    print("new zones", json.dumps(nz))


if __name__ == "__main__":
    main()
