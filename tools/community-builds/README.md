# Community talent builds

Rebuilds `js/community-builds.js` from the public popular, tagged, and level-30 listing pages on [Talents Forever](https://talentsforever.com).

```bash
# From the repo root, during the Wednesday refresh:
python3 tools/community-builds/refresh_community_builds.py

# Reuse previously fetched listing HTML (11 pages):
python3 tools/community-builds/refresh_community_builds.py --cache-dir /tmp/tf-pages
```

The script is polite: one request per listing page with a short delay, a descriptive User-Agent, and no walk of individual calculator URLs. `robots.txt` allows these pages. Terms welcome sharing build links and forbid hammering the site. Talent data there is CC BY 4.0; popularity numbers are the site’s own tally of opens, saves, and shares (no identities).

Each calculator URL is decoded against the Zephras Forever trees in `js/talents.js`. Illegal or undecodable allocations are dropped, never invented. A build is assigned to a spec by the tree with the most points.

For each spec the script also stores:

- a heat-map sample of up to the 50 most popular valid builds (the real count is kept when fewer than 50 exist)
- a 51-point community-consensus path from the most popular 51-point builds in that sample

Do not use this script against wow-forever.gg. That site reserves its builds and pick-rate dataset, and disallows `/api/`.
