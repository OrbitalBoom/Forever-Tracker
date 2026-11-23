#!/usr/bin/env python3
"""Refresh community talent builds for Forever Tracker.

Pulls the public popular, tagged, and level-30 listing pages on
talentsforever.com (robots.txt allows these; terms welcome sharing build
links and forbid hammering the site). Decodes calculator URLs against the
Zephras Forever trees in js/talents.js, keeps only valid allocations, and
writes js/community-builds.js.

Also, for each spec of each class, takes up to the 50 most popular valid
builds (never padded), computes a pick-rate heat map, and greedy-builds a
separate 51-point community consensus.

This does not scrape wow-forever.gg (their license reserves builds, pick
rates, and datasets; /api/ is disallowed).

Usage (from the repo root, during the Wednesday refresh):

    python3 tools/community-builds/refresh_community_builds.py
    python3 tools/community-builds/refresh_community_builds.py --cache-dir /tmp/tf-pages

Be polite: one listing page per class plus /popular and /level-30, with a
short delay. Do not fetch thousands of individual calculator pages.
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import date, datetime
from html import unescape
from pathlib import Path

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None


ROOT = Path(__file__).resolve().parents[2]
TALENTS_JS = ROOT / "js" / "talents.js"
OUT_JS = ROOT / "js" / "community-builds.js"
USER_AGENT = (
    "ForeverTracker/1.0 (community-builds refresh; "
    "+https://orbitalboom.github.io/Forever-Tracker/)"
)
BASE = "https://talentsforever.com"
LISTING_PAGES = [
    "popular",
    "level-30",
    "warrior/builds",
    "paladin/builds",
    "hunter/builds",
    "rogue/builds",
    "priest/builds",
    "shaman/builds",
    "mage/builds",
    "warlock/builds",
    "druid/builds",
]
CLASS_SLUGS = {
    "warrior": "Warrior",
    "paladin": "Paladin",
    "hunter": "Hunter",
    "rogue": "Rogue",
    "priest": "Priest",
    "shaman": "Shaman",
    "mage": "Mage",
    "warlock": "Warlock",
    "druid": "Druid",
}
# Zephras tree name -> character-sheet spec name in js/data.js
TREE_TO_SPEC = {
    "Shadow Magic": "Shadow",
    "Elemental Combat": "Elemental",
    "Feral Combat": "Feral",
}
SPEC_TO_TREE = {v: k for k, v in TREE_TO_SPEC.items()}
LETTER_INDEX = {ch: i for i, ch in enumerate("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")}
MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9, "oct": 10,
    "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}


def warn(msg: str) -> None:
    print(msg, file=sys.stderr)


def slug_to_class(slug: str) -> str | None:
    return CLASS_SLUGS.get(slug.lower())


def spec_name(tree_name: str) -> str:
    return TREE_TO_SPEC.get(tree_name, tree_name)


def tree_name_of_spec(spec: str, class_data: dict) -> str:
    if spec in SPEC_TO_TREE:
        return SPEC_TO_TREE[spec]
    for tree in class_data["trees"]:
        if tree["name"] == spec:
            return tree["name"]
    return spec


def load_zephras(path: Path) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    m = re.search(r"window\.WOW_TALENTS\s*=\s*", text)
    if not m:
        raise SystemExit(f"Could not find window.WOW_TALENTS in {path}")
    data, _ = json.JSONDecoder().raw_decode(text[m.end():])
    return data


def class_map(talents: list[dict]) -> dict[str, dict]:
    return {c["name"]: c for c in talents}


def points_at_level(level: int) -> int:
    if level < 10:
        return 0
    return min(51, level - 9)


def strip_tags(html: str) -> str:
    html = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<[^>]+>", " ", html)
    html = unescape(html)
    return re.sub(r"\s+", " ", html).strip()


def parse_int(s: str | None) -> int | None:
    if s is None:
        return None
    s = s.replace(",", "").strip()
    if not s:
        return None
    try:
        return int(s)
    except ValueError:
        return None


def parse_date_text(text: str) -> str | None:
    """Return ISO date if a 'Counted on 23 Nov 2026' style stamp is present."""
    m = re.search(
        r"Counted on\s+(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})",
        text,
        re.I,
    )
    if m:
        day = int(m.group(1))
        month = MONTHS.get(m.group(2).lower())
        year = int(m.group(3))
        if month:
            return date(year, month, day).isoformat()
    m = re.search(r"dateModified\"\s*:\s*\"(20\d{2}-\d{2}-\d{2})", text)
    if m:
        return m.group(1)
    return None


def cache_name(page: str) -> str:
    return page.replace("/", "_") + ".html"


def fetch_page(page: str, cache_dir: Path | None, sleep_s: float, force: bool) -> str:
    if cache_dir:
        cached = cache_dir / cache_name(page)
        if cached.exists() and not force:
            return cached.read_text(encoding="utf-8", errors="replace")
    url = f"{BASE}/{page}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as e:
        if cache_dir:
            cached = cache_dir / cache_name(page)
            if cached.exists():
                warn(f"Fetch failed for {url} ({e}); using cache")
                return cached.read_text(encoding="utf-8", errors="replace")
        raise
    if cache_dir:
        cache_dir.mkdir(parents=True, exist_ok=True)
        (cache_dir / cache_name(page)).write_text(body, encoding="utf-8")
    if sleep_s:
        time.sleep(sleep_s)
    return body


def parse_share_url(href: str) -> dict | None:
    if not href:
        return None
    href = href.strip()
    m = re.match(
        r"^(?:https://talentsforever\.com)?/([a-z-]+)/(\d+)/([^/?#]+)$",
        href,
    )
    if not m:
        return None
    slug, level_s, code = m.group(1), m.group(2), m.group(3)
    cls = slug_to_class(slug)
    if not cls:
        return None
    level = int(level_s)
    if level < 10 or level > 60:
        return None
    parts = code.split("-")
    if len(parts) < 3:
        return None
    trees = parts[:3]
    rest = parts[3:]
    version = None
    order_token = None
    if rest and re.fullmatch(r"\d{1,3}", rest[-1] or ""):
        version = rest[-1]
        rest = rest[:-1]
    if rest:
        order_token = rest[0] if len(rest) == 1 else "-".join(rest)
        if not order_token:
            order_token = None
    return {
        "class": cls,
        "slug": slug,
        "level": level,
        "code": code,
        "treeStrings": trees,
        "orderToken": order_token,
        "version": version,
        "url": f"{BASE}/{slug}/{level}/{code}",
        "allocKey": f"{slug}/{level}/" + "-".join((s.rstrip("0") if s else "") for s in trees),
    }


def decode_allocation(parsed: dict, class_data: dict) -> dict | None:
    trees_out = {}
    counts = []
    flat = []  # list of (tree, talent, max) in encoding order
    for i, tree in enumerate(class_data["trees"]):
        digits = parsed["treeStrings"][i] if i < len(parsed["treeStrings"]) else ""
        if len(digits) > len(tree["talents"]):
            return None
        ranks = {}
        spent = 0
        for j, talent in enumerate(tree["talents"]):
            ch = digits[j] if j < len(digits) else "0"
            if ch < "0" or ch > "9":
                return None
            rank = int(ch)
            if rank < 0 or rank > talent["maxRank"]:
                return None
            if rank:
                ranks[str(talent["id"])] = rank
                spent += rank
            flat.append((tree, talent, rank))
        # leftover non-zero digits would already fail the length check
        trees_out[tree["name"]] = ranks
        counts.append(spent)
    total = sum(counts)
    expected = points_at_level(parsed["level"])
    # Some mid-level URLs encode a 21-point plan on a /30/ path (expected 21).
    # Accept a total that matches the URL level, or a smaller total that still
    # matches a legal talent-point count (the listing may show a mid-level slice).
    if total < 1 or total > 51:
        return None
    if total > expected:
        # Too many points for the stated level.
        return None
    return {
        "trees": trees_out,
        "counts": counts,
        "totalPoints": total,
        "points": "/".join(str(n) for n in counts),
        "flat": flat,
    }


def allocation_is_legal(class_data: dict, trees: dict) -> bool:
    """Final allocation must obey caps, row/tier gates, and prerequisites."""
    for tree in class_data["trees"]:
        spent = 0
        ranks = trees.get(tree["name"]) or {}
        by_id = {str(t["id"]): t for t in tree["talents"]}
        # Spend in row order so we can check reqPoints as we go? Final state:
        # a talent with reqPoints R is legal if total points in the tree >= R
        # (the points can include this talent's own points in some engines,
        # but Classic requires the *previous* points). Use Classic/Forever
        # rule: points already in the tree, not counting this talent, must
        # be >= reqPoints. reqPoints is typically (row-1)*5.
        # Checking final state: treeSpent >= reqPoints + rank, equivalent to
        # (treeSpent - rank) >= reqPoints.
        tree_spent = sum(int(ranks.get(str(t["id"]), 0) or 0) for t in tree["talents"])
        for t in tree["talents"]:
            rank = int(ranks.get(str(t["id"]), 0) or 0)
            if rank < 0 or rank > t["maxRank"]:
                return False
            if rank == 0:
                continue
            req = t.get("reqPoints") or ((t["row"] - 1) * 5)
            if (tree_spent - rank) < req:
                # Could still be legal if other talents in later rows... no,
                # tree_spent - rank is all other points in the tree.
                return False
            prereq = t.get("prereq")
            if prereq:
                pid = str(prereq.get("id"))
                need = int(prereq.get("rank") or 0)
                have = int(ranks.get(pid, 0) or 0)
                if have < need:
                    return False
        spent += tree_spent
    return True


def decode_order(order_token: str | None, class_data: dict, trees: dict) -> list[dict] | None:
    if not order_token:
        return None
    if not re.fullmatch(r"[A-Za-z]+", order_token):
        return None
    flat = []
    for tree in class_data["trees"]:
        for talent in tree["talents"]:
            flat.append((tree, talent))
    planned = {}
    for tree in class_data["trees"]:
        src = trees.get(tree["name"]) or {}
        for talent in tree["talents"]:
            r = int(src.get(str(talent["id"]), 0) or 0)
            if r:
                planned[(tree["name"], str(talent["id"]))] = r
    have = defaultdict(int)
    order = []
    seen = set()
    for ch in order_token:
        idx = LETTER_INDEX.get(ch)
        if idx is None or idx >= len(flat):
            return None
        tree, talent = flat[idx]
        key = (tree["name"], str(talent["id"]))
        want = planned.get(key, 0)
        if want <= 0:
            return None
        already = have[key]
        if already >= want:
            return None
        # First listing of a talent spends all remaining planned ranks in a row.
        # A repeated letter (if any) would only be legal if we spent one at a
        # time; the public strings list each talent once, so take the rest.
        take = want - already
        for _ in range(take):
            from_r = have[key]
            have[key] = from_r + 1
            order.append({
                "tree": tree["name"],
                "id": talent["id"],
                "name": talent["name"],
            })
        seen.add(key)
    if sum(have.values()) != sum(planned.values()):
        return None
    # Validate the path against gates.
    if not order_path_is_legal(class_data, order):
        return None
    return order


def order_path_is_legal(class_data: dict, order: list[dict]) -> bool:
    have = defaultdict(int)
    spent_in = defaultdict(int)
    trees = {t["name"]: t for t in class_data["trees"]}
    talent_of = {}
    for tree in class_data["trees"]:
        for t in tree["talents"]:
            talent_of[(tree["name"], str(t["id"]))] = t
    for step in order:
        tree = trees.get(step["tree"])
        if not tree:
            return False
        talent = talent_of.get((step["tree"], str(step["id"])))
        if not talent:
            return False
        key = (step["tree"], str(step["id"]))
        if have[key] >= talent["maxRank"]:
            return False
        req = talent.get("reqPoints") or ((talent["row"] - 1) * 5)
        if spent_in[step["tree"]] < req:
            return False
        prereq = talent.get("prereq")
        if prereq:
            pkey = (step["tree"], str(prereq.get("id")))
            if have[pkey] < int(prereq.get("rank") or 0):
                return False
        have[key] += 1
        spent_in[step["tree"]] += 1
    return True


def infer_section(li) -> str:
    # Walk ancestors for tagged tabs or headings.
    node = li
    while node is not None:
        el_id = (node.get("id") or "") if hasattr(node, "get") else ""
        if el_id == "for-leveling":
            return "leveling"
        if el_id == "for-pve":
            return "pve"
        if el_id == "for-pvp":
            return "pvp"
        if el_id == "level-30":
            return "level-30"
        node = getattr(node, "parent", None)
    # Look at previous h2
    for prev in li.find_all_previous(["h2", "h1"]):
        text = prev.get_text(" ", strip=True).lower()
        if "what they're for" in text or "what they are for" in text:
            return "tagged"
        if "level 30" in text:
            return "level-30"
        if "most popular" in text:
            return "popular"
        break
    return "listing"


def source_spec_from_name(name: str, class_data: dict) -> str | None:
    if not name:
        return None
    # Prefer longer tree names first (Feral Combat before Combat, etc.)
    trees = sorted((t["name"] for t in class_data["trees"]), key=len, reverse=True)
    low = name.lower()
    for tree in trees:
        if tree.lower() in low:
            return spec_name(tree)
    for short in (spec_name(t["name"]) for t in class_data["trees"]):
        if short.lower() in low:
            return short
    return None


def clean_summary(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text).strip()
    # Drop trailing UI chrome
    text = re.sub(r"\s*Load(?:\s*Try it)?\s*$", "", text, flags=re.I)
    text = re.sub(r"\s*Try it\s*$", "", text, flags=re.I)
    text = re.sub(r"\s*;?\s+the\s*$", "", text, flags=re.I)
    return text.strip(" ,;.")


def parse_popularity(block_text: str) -> dict:
    out = {}
    m = re.search(r"shared\s+([\d,]+)", block_text, re.I)
    if m:
        out["shared"] = parse_int(m.group(1))
    m = re.search(r"saved\s+([\d,]+)", block_text, re.I)
    if m:
        out["saved"] = parse_int(m.group(1))
    m = re.search(r"opened\s+([\d,]+)", block_text, re.I)
    if m:
        out["opened"] = parse_int(m.group(1))
    m = re.search(r"([\d.]+)\s*% of every", block_text, re.I)
    if m:
        try:
            out["sharePercent"] = float(m.group(1))
        except ValueError:
            pass
    m = re.search(r"([\d,]+)\s+people-days", block_text, re.I)
    if m:
        out["peopleDays"] = parse_int(m.group(1))
    m = re.search(r"across\s+([\d,]+)\s+close builds", block_text, re.I)
    if m:
        out["closeBuilds"] = parse_int(m.group(1))
    tags = []
    tag_counts = {}
    for label in ("Leveling", "PvE", "PvP"):
        tm = re.search(
            rf"(\d+)\s+{label}\s+tags",
            block_text,
            re.I,
        )
        if tm:
            tag_counts[label.lower()] = int(tm.group(1))
            if label not in tags:
                tags.append(label)
        elif re.search(rf"tagged[^\n]{{0,80}}{label}", block_text, re.I) or re.search(
            rf"also\s+{label}\s+\d+", block_text, re.I
        ):
            if label not in tags:
                tags.append(label)
        elif re.search(rf"\b{label}\s+tags\b", block_text, re.I):
            if label not in tags:
                tags.append(label)
    # "tagged PvE" / "tagged Leveling PvE"
    tm = re.search(r"tagged\s+((?:Leveling|PvE|PvP)(?:\s+(?:Leveling|PvE|PvP))*)", block_text, re.I)
    if tm:
        for part in re.findall(r"Leveling|PvE|PvP", tm.group(1), re.I):
            canon = {"leveling": "Leveling", "pve": "PvE", "pvp": "PvP"}[part.lower()]
            if canon not in tags:
                tags.append(canon)
    if tags:
        out["tags"] = tags
    if tag_counts:
        out["tagCounts"] = tag_counts
    return out


def popularity_score(pop: dict | None) -> tuple:
    pop = pop or {}
    opened = pop.get("opened") or 0
    saved = pop.get("saved") or 0
    shared = pop.get("shared") or 0
    people = pop.get("peopleDays") or 0
    orders = pop.get("orders") or 0
    tags = sum((pop.get("tagCounts") or {}).values())
    share = pop.get("sharePercent") or 0
    # Opened counts are the strongest tally; people-days / leveling-order
    # counts for the beta cap; tag counts for the "what it's for" lists.
    return (opened, saved + shared, people or orders, tags, share)


def iter_jsonld_builds(html: str):
    """Yield (parsed_share, name) from public schema.org ItemList blocks."""
    for m in re.finditer(
        r'<script type="application/ld\+json">(.*?)</script>',
        html,
        re.S | re.I,
    ):
        try:
            data = json.loads(m.group(1))
        except json.JSONDecodeError:
            continue
        graph = data.get("@graph") if isinstance(data, dict) else data
        if isinstance(graph, dict):
            graph = [graph]
        if not isinstance(graph, list):
            continue
        for node in graph:
            if not isinstance(node, dict):
                continue
            for el in node.get("itemListElement") or []:
                if not isinstance(el, dict):
                    continue
                item = el.get("item") if isinstance(el.get("item"), dict) else el
                name = item.get("name") or el.get("name") or ""
                url = item.get("url") or el.get("url") or ""
                parsed = parse_share_url(url)
                if parsed:
                    yield parsed, name


def record_from_anchor(a, page_url: str, counted: str | None, default_section: str | None = None, container=None, extra_text: str = "") -> dict | None:
    parsed = parse_share_url(a.get("href", "") if a else "")
    if not parsed:
        return None
    classes = set(a.get("class") or [])
    li = a.find_parent("li")
    if container is None:
        if "load" in classes and li is not None:
            container = li
        elif classes & {"bp-lead", "bp-big", "bp-cta"}:
            container = a
        elif li is not None and li.find("a", class_="load"):
            # A list card that wrapped this link
            container = li
        else:
            container = a
    name_el = None
    if container is not None and hasattr(container, "find"):
        if container is not a:
            name_el = container.find(["h3", "h4"], class_="bn") or container.find(["h3", "h4"])
    name = name_el.get_text(" ", strip=True) if name_el else ""
    if not name:
        name = a.get_text(" ", strip=True)
        name = re.sub(r"\s+", " ", name)
        name = re.sub(r"\s*#\d+\s*$", "", name).strip()
        # bp-big puts a long <small> inside the same anchor
        name = re.sub(r"\s*\d+(?:\.\d+)?%\s+of\s+[\d,]+\s+leveling orders.*$", "", name, flags=re.I).strip()
    key_el = container.find(class_="key") if container is not None and hasattr(container, "find") and container is not a else None
    pts_el = container.find(class_="pts") if container is not None and hasattr(container, "find") and container is not a else None
    meta_bits = []
    if container is not None and container is not a and hasattr(container, "find_all"):
        meta_bits = [el.get_text(" ", strip=True) for el in container.find_all(class_="meta")]
    if container is not None and hasattr(container, "get_text") and container is not a:
        block_text = container.get_text(" ", strip=True)
    else:
        block_text = a.get_text(" ", strip=True)
    if extra_text:
        block_text = (block_text + " " + extra_text).strip()
    summary = clean_summary(key_el.get_text(" ", strip=True) if key_el else "")
    quote_m = re.search(r'(Lone Wolf:\s*"[^"]+")', block_text)
    if quote_m and quote_m.group(1) not in summary:
        summary = (summary.rstrip(".") + ". " + quote_m.group(1)) if summary else quote_m.group(1)
    pop = parse_popularity(block_text)
    # Only the short clause next to a leveling-order link ("from 61,742 Survival
    # orders" or "from 29,355.") is a tally for this exact build. The level-30
    # headline "46.5% of 132,727 leveling orders" is the spec's share of every
    # leveling order for the class, not this allocation's count.
    scope = extra_text or (block_text if default_section == "leveling-order" or (a.get("class") or [None])[0] == "load" else "")
    om = re.search(r"from\s+([\d,]+)(?:\s+(?:[A-Za-z][A-Za-z '/]*\s+)?orders)?", scope, re.I)
    if om:
        pop["orders"] = parse_int(om.group(1))
    section = default_section or (infer_section(li) if li is not None else infer_section(a))
    return {
        "parsed": parsed,
        "name": name or f"{parsed['class']} {parsed['level']}",
        "summary": summary,
        "section": section,
        "popularity": pop,
        "pageUrl": page_url,
        "listedPoints": pts_el.get_text(" ", strip=True) if pts_el else "",
        "meta": " · ".join(meta_bits),
        "countedOn": counted,
    }



def parse_listing_html(html: str, page_url: str, class_lookup: dict) -> tuple[list[dict], str | None]:
    counted = parse_date_text(html)
    if BeautifulSoup is None:
        raise SystemExit("beautifulsoup4 is required to parse listing pages")

    jsonld_names = {}
    for parsed, name in iter_jsonld_builds(html):
        if name:
            jsonld_names[parsed["url"]] = name
            jsonld_names[parsed["allocKey"]] = name

    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()

    found = []
    seen = set()  # url

    def add(rec: dict | None) -> None:
        if not rec:
            return
        parsed = rec["parsed"]
        if parsed["class"] not in class_lookup:
            return
        # Prefer a JSON-LD title when the visible label is thin
        jd = jsonld_names.get(parsed["url"]) or jsonld_names.get(parsed["allocKey"])
        if jd:
            visible = rec.get("name") or ""
            if (not visible or visible.lower() in parsed["url"] or re.fullmatch(r".*\d+/\d+/\d+.*", visible) and len(visible) < len(jd)):
                # Keep JSON-LD name when it is more descriptive
                if len(jd) >= len(visible):
                    rec["name"] = jd
        found.append(rec)
        seen.add(parsed["url"])

    for a in soup.find_all("a", href=True):
        href = a.get("href") or ""
        parsed = parse_share_url(href)
        if not parsed:
            continue
        classes = set(a.get("class") or [])
        parent_p = a.find_parent("p")
        in_order_para = bool(
            parent_p and re.search(r"leveling orders place|from\s+[\d,]+\s+.*orders", parent_p.get_text(" ", strip=True), re.I)
        )
        interesting = bool(classes & {"load", "bp-lead", "bp-big", "bp-cta"}) or in_order_para
        if not interesting:
            # Skip bare talent-name links and icon tiles; those have no card.
            continue
        section = None
        if in_order_para:
            section = "leveling-order"
        extra = ""
        if in_order_para:
            bits = []
            for sib in a.next_siblings:
                if getattr(sib, "name", None) == "a":
                    break
                bits.append(sib.get_text(" ", strip=True) if hasattr(sib, "get_text") else str(sib))
            extra = " ".join(bits)
        rec = record_from_anchor(
            a,
            page_url,
            counted,
            section,
            container=a if (in_order_para or (set(a.get("class") or []) & {"bp-lead", "bp-big", "bp-cta"})) else None,
            extra_text=extra,
        )
        if rec and in_order_para:
            rec["section"] = "leveling-order"
            if not rec.get("summary"):
                rec["summary"] = clean_summary(
                    "Leveling order for the first 21 points, as Talents Forever recorded it."
                    + ((" " + extra.strip(" ,;.")) if extra.strip(" ,;.") else "")
                )
        if rec and not rec.get("summary"):
            # Level-30 class cards often describe the order in a nearby paragraph.
            box = a.find_parent("div", class_="bp-card") or a.find_parent("div", class_="bp-pan") or a.parent
            if box is not None:
                for para in box.find_all("p"):
                    t = para.get_text(" ", strip=True)
                    m = re.search(r"Its first 21 points:\s*(.+)", t, re.I)
                    if m:
                        rec["summary"] = clean_summary(m.group(0))
                        break
        add(rec)

    # JSON-LD entries not represented by a card still count (names + urls).
    for parsed, name in iter_jsonld_builds(html):
        if parsed["url"] in seen:
            # Fill name if we only had a short label
            continue
        add({
            "parsed": parsed,
            "name": name or f"{parsed['class']} {parsed['level']}",
            "summary": "",
            "section": "jsonld",
            "popularity": {},
            "pageUrl": page_url,
            "listedPoints": "",
            "meta": "",
            "countedOn": counted,
        })

    return found, counted



def assign_spec(counts: list[int], class_data: dict, source_spec: str | None) -> dict:
    trees = [t["name"] for t in class_data["trees"]]
    best = max(counts) if counts else 0
    tied = [trees[i] for i, n in enumerate(counts) if n == best and best > 0]
    if not tied:
        return {"spec": None, "specTree": None, "specSource": "inferred", "specTie": False}
    if len(tied) == 1:
        tree = tied[0]
        short = spec_name(tree)
        if source_spec and source_spec == short:
            src = "source"
        else:
            src = "inferred" if not source_spec else "inferred"
            # If the source named this spec (possibly among others), call it source
            # only when the source's leading/only spec matches.
            if source_spec == short:
                src = "source"
        # If the title clearly names this spec as the lead, treat as source.
        if source_spec == short:
            src = "source"
        else:
            src = "inferred"
        return {"spec": short, "specTree": tree, "specSource": src, "specTie": False}
    # Tie: prefer the source label if it names one of the tied trees.
    if source_spec:
        for tree in tied:
            if spec_name(tree) == source_spec:
                return {
                    "spec": source_spec,
                    "specTree": tree,
                    "specSource": "source",
                    "specTie": True,
                }
    tree = tied[0]
    return {
        "spec": spec_name(tree),
        "specTree": tree,
        "specSource": "inferred",
        "specTie": True,
    }


def merge_records(existing: dict, incoming: dict) -> dict:
    # Keep the richer popularity, keep an order if either has it, union tags.
    if popularity_score(incoming.get("popularity")) > popularity_score(existing.get("popularity")):
        pop = dict(existing.get("popularity") or {})
        for k, v in (incoming.get("popularity") or {}).items():
            if k == "tags":
                continue
            if k == "tagCounts":
                continue
            if v is not None and (pop.get(k) is None or (isinstance(v, (int, float)) and v > (pop.get(k) or 0))):
                pop[k] = v
        tags = []
        for src in (existing, incoming):
            for t in ((src.get("popularity") or {}).get("tags") or []):
                if t not in tags:
                    tags.append(t)
        if tags:
            pop["tags"] = tags
        tc = dict((existing.get("popularity") or {}).get("tagCounts") or {})
        for k, v in ((incoming.get("popularity") or {}).get("tagCounts") or {}).items():
            tc[k] = max(tc.get(k, 0), v)
        if tc:
            pop["tagCounts"] = tc
        incoming = dict(incoming)
        incoming["popularity"] = pop
        # Prefer incoming's name/summary if longer or if existing lacked them
        if not incoming.get("summary") and existing.get("summary"):
            incoming["summary"] = existing["summary"]
        if existing.get("order") and not incoming.get("order"):
            incoming["order"] = existing["order"]
            incoming["orderSource"] = existing.get("orderSource")
            incoming["allocationKind"] = existing.get("allocationKind")
        if existing.get("countedOn") and not incoming.get("countedOn"):
            incoming["countedOn"] = existing["countedOn"]
        return incoming
    # existing is more popular; fill gaps
    if incoming.get("order") and not existing.get("order"):
        existing["order"] = incoming["order"]
        existing["orderSource"] = incoming.get("orderSource")
        existing["allocationKind"] = "point-order"
    if incoming.get("summary") and (
        not existing.get("summary") or len(incoming["summary"]) > len(existing["summary"])
    ):
        existing["summary"] = incoming["summary"]
    def _name_quality(n):
        n = n or ""
        # Prefer "Survival Hunter leveling order, level 30" over "Survival" or "Survival 0/0/21".
        return (len(n), 1 if re.search(r"leveling order|level \d+|build", n, re.I) else 0)
    if _name_quality(incoming.get("name")) > _name_quality(existing.get("name")):
        existing["name"] = incoming["name"]
    pop = existing.setdefault("popularity", {})
    for t in ((incoming.get("popularity") or {}).get("tags") or []):
        pop.setdefault("tags", [])
        if t not in pop["tags"]:
            pop["tags"].append(t)
    tc = pop.setdefault("tagCounts", {})
    for k, v in ((incoming.get("popularity") or {}).get("tagCounts") or {}).items():
        tc[k] = max(tc.get(k, 0), v)
    if not tc:
        pop.pop("tagCounts", None)
    if incoming.get("countedOn") and not existing.get("countedOn"):
        existing["countedOn"] = incoming["countedOn"]
    return existing


def talent_req_points(talent: dict) -> int:
    if talent.get("reqPoints") is not None:
        return int(talent["reqPoints"])
    return (talent["row"] - 1) * 5


def legal_candidates(class_data: dict, have: dict, spent_in: dict) -> list[tuple]:
    out = []
    for tree in class_data["trees"]:
        for talent in tree["talents"]:
            key = (tree["name"], str(talent["id"]))
            rank = have.get(key, 0)
            if rank >= talent["maxRank"]:
                continue
            if spent_in[tree["name"]] < talent_req_points(talent):
                continue
            prereq = talent.get("prereq")
            if prereq:
                pkey = (tree["name"], str(prereq.get("id")))
                if have.get(pkey, 0) < int(prereq.get("rank") or 0):
                    continue
            out.append((tree, talent))
    return out


def build_consensus(class_data: dict, sample: list[dict], spec_tree: str) -> dict | None:
    """Greedy 51-point path: at each point take the legal talent most sample builds have at the next rank.

    When several sample builds also publish a point order, the most common
    pick at this point index breaks ties (and is preferred when it is legal).
    """
    if not sample:
        return None
    # Rank counts: how many sample builds have at least r in this talent
    freq = defaultdict(lambda: defaultdict(int))  # (tree,id) -> rank -> count
    ordered = []
    for b in sample:
        for tree in class_data["trees"]:
            src = (b.get("trees") or {}).get(tree["name"]) or {}
            for talent in tree["talents"]:
                r = int(src.get(str(talent["id"]), 0) or 0)
                for k in range(1, r + 1):
                    freq[(tree["name"], str(talent["id"]))][k] += 1
        if b.get("order"):
            ordered.append(b["order"])

    def score(tree, talent, next_rank, point_index):
        key = (tree["name"], str(talent["id"]))
        base = freq[key].get(next_rank, 0)
        # Tie-break / gentle boost from ordered picks at this index
        mode_boost = 0
        if ordered:
            votes = 0
            for od in ordered:
                if point_index < len(od):
                    step = od[point_index]
                    if step["tree"] == tree["name"] and str(step["id"]) == str(talent["id"]):
                        votes += 1
            mode_boost = votes
        # Prefer the consensus spec's tree on remaining ties, then earlier rows.
        spec_pref = 1 if tree["name"] == spec_tree else 0
        return (base, mode_boost, spec_pref, -talent["row"], -talent["col"], -talent["id"])

    have = {}
    spent_in = defaultdict(int)
    order = []
    trees_out = defaultdict(dict)

    def try_fill(start_have, start_spent, start_order, start_trees):
        have_l = dict(start_have)
        spent_l = defaultdict(int, start_spent)
        order_l = list(start_order)
        trees_l = defaultdict(dict, {k: dict(v) for k, v in start_trees.items()})
        while len(order_l) < 51:
            cands = legal_candidates(class_data, have_l, spent_l)
            if not cands:
                break
            point_index = len(order_l)
            best = None
            best_s = None
            for tree, talent in cands:
                key = (tree["name"], str(talent["id"]))
                nxt = have_l.get(key, 0) + 1
                s = score(tree, talent, nxt, point_index)
                if best_s is None or s > best_s:
                    best_s, best = s, (tree, talent)
            tree, talent = best
            # If nothing in the sample takes the next rank, stop rather than invent.
            key = (tree["name"], str(talent["id"]))
            if freq[key].get(have_l.get(key, 0) + 1, 0) <= 0:
                # Try the next-best candidate that the sample actually takes
                found = False
                ranked = sorted(
                    cands,
                    key=lambda tc: score(tc[0], tc[1], have_l.get((tc[0]["name"], str(tc[1]["id"])), 0) + 1, point_index),
                    reverse=True,
                )
                for tree, talent in ranked:
                    key = (tree["name"], str(talent["id"]))
                    if freq[key].get(have_l.get(key, 0) + 1, 0) > 0:
                        found = True
                        break
                if not found:
                    break
            nxt = have_l.get(key, 0) + 1
            have_l[key] = nxt
            spent_l[tree["name"]] += 1
            trees_l[tree["name"]][str(talent["id"])] = nxt
            order_l.append({"tree": tree["name"], "id": talent["id"], "name": talent["name"]})
        return have_l, spent_l, order_l, trees_l

    have, spent_in, order, trees_out = try_fill(have, spent_in, order, trees_out)
    if len(order) < 51:
        # Shallow backtrack: undo the last few greedy picks and try the second choice.
        for undo in range(1, min(8, len(order) + 1)):
            have2 = {}
            spent2 = defaultdict(int)
            trees2 = defaultdict(dict)
            order2 = []
            for step in order[:-undo]:
                key = (step["tree"], str(step["id"]))
                have2[key] = have2.get(key, 0) + 1
                spent2[step["tree"]] += 1
                trees2[step["tree"]][str(step["id"])] = have2[key]
                order2.append(step)
            # At the fork, take the second-best legal pick the sample uses
            cands = legal_candidates(class_data, have2, spent2)
            if not cands:
                continue
            point_index = len(order2)
            ranked = sorted(
                cands,
                key=lambda tc: score(tc[0], tc[1], have2.get((tc[0]["name"], str(tc[1]["id"])), 0) + 1, point_index),
                reverse=True,
            )
            if len(ranked) < 2:
                continue
            tree, talent = ranked[1]
            key = (tree["name"], str(talent["id"]))
            if freq[key].get(have2.get(key, 0) + 1, 0) <= 0:
                continue
            nxt = have2.get(key, 0) + 1
            have2[key] = nxt
            spent2[tree["name"]] += 1
            trees2[tree["name"]][str(talent["id"])] = nxt
            order2.append({"tree": tree["name"], "id": talent["id"], "name": talent["name"]})
            have2, spent2, order2, trees2 = try_fill(have2, spent2, order2, trees2)
            if len(order2) > len(order):
                have, spent_in, order, trees_out = have2, spent2, order2, trees2
            if len(order) >= 51:
                break

    if not order:
        return None
    if not order_path_is_legal(class_data, order):
        return None
    counts = [sum((trees_out.get(t["name"]) or {}).values()) for t in class_data["trees"]]
    return {
        "trees": {k: v for k, v in trees_out.items() if v},
        "order": order,
        "counts": counts,
        "points": "/".join(str(n) for n in counts),
        "totalPoints": len(order),
    }


def median(xs: list[float]) -> float | None:
    if not xs:
        return None
    return float(statistics.median(xs))


def mean(xs: list[float]) -> float | None:
    if not xs:
        return None
    return float(sum(xs) / len(xs))


def build_heatmap(class_data: dict, sample: list[dict]) -> dict:
    talents_out = {}
    n = len(sample)
    n_order = sum(1 for b in sample if b.get("order"))
    n51 = sum(1 for b in sample if b.get("totalPoints") == 51)
    for tree in class_data["trees"]:
        for talent in tree["talents"]:
            tid = str(talent["id"])
            req = talent_req_points(talent)
            eligible_ranks = []
            taken_ranks = []
            first_levels = []
            level_hist = defaultdict(int)
            n_eligible = 0
            n_taken = 0
            for b in sample:
                total = b.get("totalPoints") or 0
                # A build can only have reached this talent if it had enough
                # points overall to pay the tier gate plus one.
                if total < req + 1:
                    continue
                n_eligible += 1
                r = int((b.get("trees") or {}).get(tree["name"], {}).get(tid, 0) or 0)
                eligible_ranks.append(r)
                if r:
                    n_taken += 1
                    taken_ranks.append(r)
                if b.get("order"):
                    levels = []
                    for i, step in enumerate(b["order"]):
                        if step["tree"] == tree["name"] and str(step["id"]) == tid:
                            lvl = 10 + i
                            levels.append(lvl)
                            level_hist[str(lvl)] += 1
                    if levels:
                        first_levels.append(levels[0])
            pick_rate = (n_taken / n_eligible) if n_eligible else 0.0
            talents_out[tid] = {
                "id": talent["id"],
                "name": talent["name"],
                "tree": tree["name"],
                "maxRank": talent["maxRank"],
                "nEligible": n_eligible,
                "nTaken": n_taken,
                "pickRate": round(pick_rate, 4),
                "avgRank": round(mean(taken_ranks) or 0, 3) if taken_ranks else 0,
                "avgRankAll": round(mean(eligible_ranks) or 0, 3) if eligible_ranks else 0,
                "nOrder": len(first_levels),
                "avgFirstLevel": round(mean(first_levels), 2) if first_levels else None,
                "medianFirstLevel": round(median(first_levels), 2) if first_levels else None,
                "levelHistogram": {k: level_hist[k] for k in sorted(level_hist, key=lambda x: int(x))},
            }
    return {
        "n": n,
        "n51": n51,
        "nOrder": n_order,
        "talents": talents_out,
    }


def compact_build(rec: dict) -> dict:
    pop = rec.get("popularity") or {}
    out = {
        "id": rec["id"],
        "class": rec["class"],
        "spec": rec["spec"],
        "specTree": rec["specTree"],
        "specSource": rec["specSource"],
        "name": rec["name"],
        "role": rec["role"],
        "summary": rec.get("summary") or "",
        "points": rec["points"],
        "trees": rec["trees"],
        "source": "community",
        "sourceLabel": rec["sourceLabel"],
        "sourceName": "Talents Forever",
        "sourceUrl": rec["url"],
        "author": "Talents Forever community tally",
        "allocationKind": rec.get("allocationKind") or "final-allocation",
        "totalPoints": rec["totalPoints"],
        "level": rec["level"],
    }
    if rec.get("specTie"):
        out["specTie"] = True
    if rec.get("order"):
        out["order"] = rec["order"]
        out["orderSource"] = rec.get("orderSource") or "talentsforever-share-link"
    if rec.get("countedOn"):
        out["sourceDate"] = rec["countedOn"]
    if rec.get("tags"):
        out["tags"] = rec["tags"]
    elif pop.get("tags"):
        out["tags"] = pop["tags"]
    popularity = {}
    for k in ("opened", "saved", "shared", "sharePercent", "peopleDays", "orders", "closeBuilds", "tagCounts"):
        if pop.get(k) is not None:
            popularity[k] = pop[k]
    if popularity:
        out["popularity"] = popularity
        if popularity.get("opened") is not None:
            out["popularityScore"] = popularity["opened"]
        elif popularity.get("peopleDays") is not None:
            out["popularityScore"] = popularity["peopleDays"]
        elif popularity.get("orders") is not None:
            out["popularityScore"] = popularity["orders"]
        elif (pop.get("tagCounts") or {}):
            out["popularityScore"] = sum(pop["tagCounts"].values())
    return out


def source_label_for(rec: dict) -> str:
    pop = rec.get("popularity") or {}
    bits = ["Talents Forever community tally"]
    if pop.get("opened") is not None:
        parts = []
        if pop.get("shared") is not None:
            parts.append(f"shared {pop['shared']:,}")
        if pop.get("saved") is not None:
            parts.append(f"saved {pop['saved']:,}")
        parts.append(f"opened {pop['opened']:,}")
        bits.append(" · ".join(parts))
    elif pop.get("peopleDays") is not None:
        bits.append(f"{pop['peopleDays']:,} people-days at the level 30 cap")
    elif pop.get("orders") is not None:
        bits.append(f"{pop['orders']:,} leveling orders")
    elif pop.get("tagCounts"):
        bits.append(", ".join(f"{v} {k} tags" for k, v in pop["tagCounts"].items()))
    if rec.get("countedOn"):
        bits.append(f"counted {rec['countedOn']}")
    if rec.get("allocationKind") == "point-order":
        bits.append("point order from the share link")
    else:
        bits.append("final allocation (no published point order)")
    return " · ".join(bits)


def make_id(cls: str, level: int, code_key: str, idx: int) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", code_key.lower()).strip("-")[:80]
    return f"community-tf-{cls.lower()}-{level}-{slug}-{idx}"


def write_js(payload: dict, dest: Path) -> None:
    header = (
        "/* Community talent builds for WoW: Forever.\n"
        " * Generated by tools/community-builds/refresh_community_builds.py.\n"
        " * Popular-build listings and calculator share links: talentsforever.com\n"
        " * (https://talentsforever.com). Talent / racial data there is CC BY 4.0;\n"
        " * popularity numbers are that site's first-party tally of opens, saves\n"
        " * and shares (no identities). Do not treat this file as a dump of\n"
        " * wow-forever.gg — that site reserves its builds and pick-rate dataset.\n"
        f" * Generated {payload['meta']['generated']}. Counted on listing pages:\n"
        f" * {payload['meta'].get('countedOn') or 'see each build'}.\n"
        " */\n"
    )
    parts = [header]
    parts.append(
        "window.WOW_TALENT_COMMUNITY_SOURCE = "
        + json.dumps(payload["sourceNote"], ensure_ascii=False)
        + ";\n"
    )
    parts.append(
        "window.WOW_TALENT_COMMUNITY_META = "
        + json.dumps(payload["meta"], ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    parts.append(
        "window.WOW_TALENT_COMMUNITY_BUILDS = "
        + json.dumps(payload["builds"], ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    parts.append(
        "window.WOW_TALENT_COMMUNITY_CONSENSUS = "
        + json.dumps(payload["consensus"], ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    parts.append(
        "window.WOW_TALENT_COMMUNITY_HEAT = "
        + json.dumps(payload["heat"], ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    dest.write_text("".join(parts), encoding="utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("Usage", 1)[0])
    ap.add_argument("--cache-dir", type=Path, default=None, help="Read/write listing HTML here")
    ap.add_argument("--force-fetch", action="store_true", help="Refetch even if a cache file exists")
    ap.add_argument("--sleep", type=float, default=0.4, help="Delay between live fetches (seconds)")
    ap.add_argument("--out", type=Path, default=OUT_JS)
    args = ap.parse_args()

    talents = load_zephras(TALENTS_JS)
    lookup = class_map(talents)

    raw_records = []
    counted_dates = set()
    for page in LISTING_PAGES:
        html = fetch_page(page, args.cache_dir, args.sleep, args.force_fetch)
        page_url = f"{BASE}/{page}"
        recs, counted = parse_listing_html(html, page_url, lookup)
        if counted:
            counted_dates.add(counted)
        raw_records.extend(recs)
        print(f"{page}: {len(recs)} listing rows")

    rejected = defaultdict(int)
    merged: dict[str, dict] = {}
    for rec in raw_records:
        parsed = rec["parsed"]
        class_data = lookup[parsed["class"]]
        alloc = decode_allocation(parsed, class_data)
        if not alloc:
            rejected["decode"] += 1
            continue
        if not allocation_is_legal(class_data, alloc["trees"]):
            rejected["illegal"] += 1
            continue
        order = decode_order(parsed.get("orderToken"), class_data, alloc["trees"])
        source_spec = source_spec_from_name(rec["name"], class_data)
        assigned = assign_spec(alloc["counts"], class_data, source_spec)
        if not assigned["spec"]:
            rejected["no-spec"] += 1
            continue
        # If the title names a different lead spec than the points, keep inferred.
        if source_spec and source_spec == assigned["spec"] and not assigned["specTie"]:
            assigned["specSource"] = "source"
        elif source_spec and source_spec == assigned["spec"]:
            assigned["specSource"] = "source"
        else:
            assigned["specSource"] = "inferred"

        tags = list((rec.get("popularity") or {}).get("tags") or [])
        if rec["section"] in ("leveling", "pve", "pvp"):
            label = {"leveling": "Leveling", "pve": "PvE", "pvp": "PvP"}[rec["section"]]
            if label not in tags:
                tags.append(label)
        if rec["section"] == "level-30" and "Leveling" not in tags:
            tags.append("Leveling")

        role_bits = [assigned["spec"]]
        if alloc["totalPoints"] < 51:
            role_bits.append(f"Level {parsed['level']}")
        if "PvP" in tags and "PvE" not in tags and "Leveling" not in tags:
            role_bits.append("PvP")
        elif "Leveling" in tags:
            role_bits.append("Leveling")
        elif "PvE" in tags:
            role_bits.append("PvE")
        elif "PvP" in tags:
            role_bits.append("PvP")

        name = rec["name"]
        if parsed["level"] < 60 and rec.get("section") in ("leveling-order", "level-30", "jsonld"):
            if re.fullmatch(r"[A-Za-z /]+(?:\s+\d+/\d+/\d+)?", name or "") and "level" not in (name or "").lower():
                name = f"{assigned['spec']} {parsed['class']} leveling order, level {parsed['level']}"
        built = {
            "allocKey": parsed["allocKey"],
            "class": parsed["class"],
            "level": parsed["level"],
            "url": parsed["url"],
            "name": name,
            "summary": rec["summary"],
            "trees": alloc["trees"],
            "points": alloc["points"],
            "totalPoints": alloc["totalPoints"],
            "counts": alloc["counts"],
            "popularity": rec.get("popularity") or {},
            "countedOn": rec.get("countedOn"),
            "tags": tags,
            "role": " · ".join(role_bits),
            **assigned,
        }
        if order:
            built["order"] = order
            built["orderSource"] = "talentsforever-share-link"
            built["allocationKind"] = "point-order"
        else:
            built["allocationKind"] = "final-allocation"
        built["sourceLabel"] = source_label_for(built)

        key = (
            parsed["class"]
            + "|"
            + str(parsed["level"])
            + "|"
            + json.dumps(alloc["trees"], sort_keys=True, separators=(",", ":"))
        )
        if key in merged:
            merged[key] = merge_records(merged[key], built)
        else:
            merged[key] = built

    # Stable ids after sort
    builds = list(merged.values())
    builds.sort(
        key=lambda b: (
            b["class"],
            -popularity_score(b.get("popularity"))[0],
            -popularity_score(b.get("popularity"))[1],
            -popularity_score(b.get("popularity"))[2],
            -popularity_score(b.get("popularity"))[3],
            b["name"],
        )
    )
    for i, b in enumerate(builds, 1):
        b["id"] = make_id(b["class"], b["level"], b["allocKey"], i)
        b["sourceLabel"] = source_label_for(b)

    compact = [compact_build(b) for b in builds]

    # Per-spec samples, heat, consensus
    heat = {}
    consensus = []
    sample_sizes = []
    by_spec: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for b in builds:
        by_spec[(b["class"], b["spec"])].append(b)

    for class_data in talents:
        cls = class_data["name"]
        for tree in class_data["trees"]:
            short = spec_name(tree["name"])
            group = list(by_spec.get((cls, short), []))
            group.sort(key=lambda b: popularity_score(b.get("popularity")), reverse=True)
            heat_sample = group[:50]
            full = [b for b in group if b.get("totalPoints") == 51]
            full.sort(key=lambda b: popularity_score(b.get("popularity")), reverse=True)
            cons_sample = full[:50]
            hm = build_heatmap(class_data, heat_sample)
            key = f"{cls}|{short}"
            heat[key] = {
                "class": cls,
                "spec": short,
                "specTree": tree["name"],
                "countedOn": sorted(counted_dates)[-1] if counted_dates else None,
                "nListed": len(group),
                "nSample": len(heat_sample),
                "n51": len(cons_sample),
                "nOrder": sum(1 for b in heat_sample if b.get("order")),
                "cappedAt50": len(group) >= 50,
                **{k: v for k, v in hm.items() if k in ("talents",)},
            }
            # n/n51/nOrder from heatmap on the heat sample; also record consensus n
            heat[key]["n"] = len(heat_sample)
            heat[key]["n51"] = len(cons_sample)
            heat[key]["nOrder"] = sum(1 for b in heat_sample if b.get("order"))
            sample_sizes.append({
                "class": cls,
                "spec": short,
                "listed": len(group),
                "heatSample": len(heat_sample),
                "consensusSample": len(cons_sample),
                "withOrder": sum(1 for b in heat_sample if b.get("order")),
                "cappedAt50": len(group) >= 50,
            })
            cons = build_consensus(class_data, cons_sample, tree["name"])
            if cons:
                n = len(cons_sample)
                c_assign = assign_spec(cons["counts"], class_data, short)
                consensus.append({
                    "id": f"community-consensus-{cls.lower()}-{short.lower().replace(' ', '-')}",
                    "class": cls,
                    "spec": short,
                    "specTree": tree["name"],
                    "specSource": "inferred",
                    "kind": "consensus",
                    "name": f"Community consensus ({n} build{'s' if n != 1 else ''})",
                    "role": f"{short} · Consensus",
                    "summary": (
                        f"A 51-point {short} {cls} path filled level by level from the "
                        f"{n} most popular valid 51-point community "
                        f"{'build' if n == 1 else 'builds'} leading in {tree['name']}. "
                        "At each point the talent the most of those builds take next "
                        "is chosen, staying inside Forever tier and prerequisite rules. "
                        "This is a derived snapshot, not a single author's build."
                    ),
                    "points": cons["points"],
                    "trees": cons["trees"],
                    "order": cons["order"],
                    "allocationKind": "point-order",
                    "orderSource": "community-consensus",
                    "source": "community-consensus",
                    "sourceLabel": (
                        f"Forever Tracker consensus from {n} Talents Forever "
                        f"community builds leading in {short}"
                        + (f", counted {sorted(counted_dates)[-1]}" if counted_dates else "")
                    ),
                    "sourceName": "Talents Forever",
                    "sourceUrl": f"{BASE}/{[s for s,n_ in CLASS_SLUGS.items() if n_==cls][0]}/builds/{short.lower().replace(' ', '-')}",
                    "author": "Forever Tracker community consensus",
                    "sampleSize": n,
                    "totalPoints": cons["totalPoints"],
                    "sourceDate": sorted(counted_dates)[-1] if counted_dates else None,
                })
            else:
                warn(f"No consensus build for {cls} {short} (sample {len(cons_sample)})")

    generated = datetime.now().strftime("%Y-%m-%d")
    counted_on = sorted(counted_dates)[-1] if counted_dates else None
    by_class = defaultdict(int)
    for b in compact:
        by_class[b["class"]] += 1

    source_note = (
        "Community builds are the popular, tagged, and level-30 listings published "
        "on Talents Forever (https://talentsforever.com), counted by that site's "
        "own tally of share, save, and link opens (no identities). Calculator links "
        "are decoded against the Zephras Forever talent trees; only allocations that "
        "are legal on the current trees are kept. Popularity is theirs; the "
        "community-consensus path and the heat map are derived here from up to the "
        "50 most popular builds per spec (never padded). Talent / racial data on "
        "Talents Forever is CC BY 4.0. "
        "wow-forever.gg also hosts a large public build directory, but its license "
        "does not allow republishing that catalog here — browse it there."
    )
    if counted_on:
        source_note += f" Listing pages counted on {counted_on}."

    meta = {
        "generated": generated,
        "countedOn": counted_on,
        "source": "https://talentsforever.com",
        "sourcePages": [f"{BASE}/{p}" for p in LISTING_PAGES],
        "buildCount": len(compact),
        "countsByClass": dict(by_class),
        "sampleSizes": sample_sizes,
        "rejected": dict(rejected),
        "license": (
            "Talents Forever popular-build listings and share links; talent data "
            "CC BY 4.0 (https://talentsforever.com). Credit required."
        ),
    }

    write_js(
        {
            "meta": meta,
            "sourceNote": source_note,
            "builds": compact,
            "consensus": consensus,
            "heat": heat,
        },
        args.out,
    )

    print(f"\nWrote {args.out} ({args.out.stat().st_size} bytes)")
    print(f"Valid community builds: {len(compact)}")
    print("By class:")
    for cls in CLASS_SLUGS.values():
        print(f"  {cls}: {by_class[cls]}")
    print("Per-spec samples (listed / heat ≤50 / 51-point consensus / with order):")
    for row in sample_sizes:
        cap = " (capped at 50)" if row["cappedAt50"] else ""
        print(
            f"  {row['class']} {row['spec']}: "
            f"{row['listed']} / {row['heatSample']} / {row['consensusSample']} / {row['withOrder']}{cap}"
        )
    print(f"Consensus builds: {len(consensus)}")
    if rejected:
        print("Rejected:", dict(rejected))
    # Hunter highlights for the operator
    hunters = [b for b in compact if b["class"] == "Hunter"]
    print(f"\nHunter builds kept: {len(hunters)}")
    for b in hunters[:8]:
        pop = b.get("popularity") or {}
        print(
            f"  [{b['spec']} {b['specSource']}] {b['name']} {b['points']} "
            f"{b['allocationKind']} opened={pop.get('opened')} {b['sourceUrl']}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
