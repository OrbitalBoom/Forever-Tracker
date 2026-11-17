# Forever Tracker

A locally run companion site for a World of Warcraft character on **Forever** (Classic Era / vanilla, level cap 60, with room for the server’s extra content).

## How to open it

No server, no install, no internet required:

1. Open the `wow-forever` folder.
2. Double-click `index.html` (or open it in any modern browser).

Everything is saved in **this browser’s localStorage**. Use **Export JSON** in the header to download a backup, and **Import JSON** to restore it on another computer or after clearing the browser.

## Tabs

- **Character** — name, race, class, spec, and level. Other tabs use this.
- **Goals** — Classic Era dungeons (Ragefire Chasm through Scholomance / Stratholme), raids through Naxxramas plus world bosses, notable mounts, and milestones. Add custom goals for Forever-specific content.
- **Gold & Professions** — gold log in g/s/c with a running total and chart; profession skill out of 300; a crafting list with have/need materials.
- **Notes & Journal** — dated adventure journal plus a searchable notes/guides pad.
- **Items & Upgrades** — paper-doll gear list and an upgrade finder (class proficiency, level window, simple stat weights). The starter item database is Classic Era; add custom items for Forever’s new gear.
- **Leveling Route** — hand-picked paths from level 1 to 60 for every race and both factions (default Undead Horde, following the Character tab when “Follow character race” is on). Pick a **route source** and a **variant**:
  - **Combined (default):** current public [RestedXP](https://github.com/RestedXP/RXPGuides) Forever Speedrun or Dungeon Guide through about 21 (Alliance) or 22 (Horde), then [OpenXP](https://github.com/mjared123/OpenXP)’s 21–60 community route. Each author’s order is kept. Combined also inserts optional **Forever Tracker add-on** chapters (auto-optimized, not RestedXP/OpenXP) for Riverglades (35–45, both factions), Shen’dralas (38–45, Horde plus a fuller Alliance path than OpenXP’s 40–41 stub), and Mount Hyjal (55–60, both factions). The **Include new zones** toggle is on by default; OpenXP chapters in those level bands are left in place and can be skipped with **Skip overlapping OpenXP chapters**.
  - **RestedXP free:** only the public Forever chapters (they end ~21–22; later RestedXP chapters are paid and are not included).
  - **OpenXP 1–60:** OpenXP’s own files, including its copies of the early RestedXP chapters (those copies lag the current RestedXP repo) plus OpenXP 21–60.
  - **Variants:** Speedrun, Dungeon Guide (RestedXP dungeon chapters 1–22, then OpenXP overworld; OpenXP’s standalone dungeon quest lists are shown separately). Mages also get **Mage AoE (RestedXP)** where those public files exist.

  Each step has a checkbox, skip, and notes. Progress is stored per character (name + race + source + variant) in the same localStorage backup. You can hide completed steps and jump to the current one. Coordinates come from the guide files (percentages, or world coordinates converted with Blizzard’s classic map bounds) and are labeled as such. No quest or coordinate is invented. The previous “every eligible quest” auto-route was replaced; old checkboxes are reset once so they don’t point at the wrong steps.
- **Talents** — WoW: Forever talent calculator (467 talents, build 1.60.1.70938). First point at 10, 51 at 60; milestone talents at 11 / 16 / 21 / 31 points. Dual Specialization at level 40 (Primary / Secondary). Published leveling builds load with one click and cite their guide and date. A **Classic Era (reference)** toggle shows the old 1.12 trees for comparison only.

## Leveling data, licenses, and attribution

This site is for **personal non-commercial local use only**. The leveling routes are bundled under `/js/leveling-data.js` (built by `/tools/build_hand_routes.py`) from:

- [RestedXP/RXPGuides](https://github.com/RestedXP/RXPGuides) — **CC BY-NC-SA 4.0**. Only the public Forever free chapters are used (Speedrun, Dungeon Guide, and Mage AoE files under `Guides/forever/`). Paid RestedXP import strings are not included and are not decrypted.
- [mjared123/OpenXP](https://github.com/mjared123/OpenXP) — **CC BY-NC-SA 4.0**, a community derivative of RestedXP’s free guides. OpenXP is not affiliated with or endorsed by RestedXP. Late-game chapters (Alliance 21–60, Horde 22–60, plus dungeon quest lists) are OpenXP’s own work. See OpenXP’s `NOTICE.md` for the list of changes.

Credit both projects, keep this work non-commercial, and share adaptations under the same license. Quest names used to label step IDs come from [tyler3497/forever-quests](https://github.com/tyler3497/forever-quests) v1.3.0 (**GPL-3.0**). The add-on chapters for Riverglades, Shen’dralas, and Mount Hyjal are built from an already-fetched [Zephras](https://zephras.com) quest-list snapshot (pickup coordinates and faction tags only). Each zone is split into 2–3 level bands (for example Riverglades 35–37 / 38–40 / 41–43 / 44–45) so a quest is not offered more than about two levels before its quest level; walking is minimized inside each band. forever-quests and the ForeverDB snapshot had no records for those zones. The add-on builder is `/tools/build_addon_zones.py`.

### Known gaps (flagged, not reordered)

- Riverglades, Shen’dralas (Horde, and Alliance quests beyond OpenXP’s short 40–41 stub), and Mount Hyjal are not in the imported RestedXP or OpenXP routes. Combined adds optional Forever Tracker add-on chapters for them. Those chapters are auto-optimized from local catalog data (nearest-neighbor / hub batching on pickup coordinates), not author-written guides.
- forever-quests and ForeverDB have no records for these new zones, so there are no prerequisite, exclusiveTo, or turn-in coordinates from those dumps. Zephras `data-also=chain` tags were too loose to treat as a prerequisite graph and were not used as chains.
- Many catalog entries have no faction tag (especially Shen’dralas and Mount Hyjal) or no coordinates; those steps are marked **unverified** and listed at the end of the chapter as optional.
- Objective and turn-in coordinates were not in the local snapshot — only pickup/giver points and the published flight points (Rog'mar, Farholde Keep, Summit of Eternity, Tainted Foothills) are shown. Shen’dralas has no recorded flight point.
- Zephras Isle is covered in the Skyborne 1–9 and 9–13 / 9–12 RestedXP chapters.
- LevelForge 1–60 community chains were not imported: the LevelForge addon is MIT, but guide authors keep their rights and there is no clear redistribution license for bundling those routes here.

## Other data sources

- Items: curated from the public [Napalmsteak/WoW-Classic-Item-Caches](https://github.com/Napalmsteak/WoW-Classic-Item-Caches) Classic Era cache (Wowhead tooltips): named, non-random-suffix equippable rares/epics/legendaries, plus uncommon dungeon/raid/crafted/reputation/PvP/world-boss pieces.
- Forever talents: [Zephras](https://zephras.com/data/) JSON export of the WoW Forever client Trait tables, build 1.60.1.70938 (hotfix cache applied), CC BY 4.0. Credit: "Talent data: Zephras (https://zephras.com), CC BY 4.0." Game names and texts © Blizzard Entertainment. Cross-checked against [wowclassicforever.info](https://wowclassicforever.info/) (467 talents, hotfixes through Nov 12). Published builds are Timesaver.gg presets citing Maxroll, Wowhead, Method, and Icy Veins (Nov 3–6, 2026; trees checked Nov 13).
- Classic Era (reference) trees: [hseager/Classic-WoW-Talent-Planner](https://github.com/hseager/Classic-WoW-Talent-Planner), shown only behind the reference toggle.
