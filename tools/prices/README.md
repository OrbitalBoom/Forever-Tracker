# Auction prices

`fetch_prices.py` writes `data/prices.json` and `data/prices.js` (schema 2: `[minBuyout, marketValue, quantity, soldPerDay?]` in copper, US Normal Horde, house 114). The GitHub Action `.github/workflows/prices.yml` runs that script and force-pushes the files to the `prices-data` branch.

## Rolling 7-day history

The `prices-data` branch is a single force-pushed commit, so it does not keep git history of past snapshots. `update_price_history.py` maintains a compact rolling window inside `data/price-history.json` / `price-history.js` instead:

```bash
python3 tools/prices/update_price_history.py --root . --prev /tmp/price-history.prev.json
```

The Action fetches the previous `price-history.json` from `prices-data` (if any), merges the new snapshot, drops samples older than 7 days, and publishes the file alongside `prices.json`. A merge failure still publishes the current prices. The Gold tab flip finder uses the median `marketValue` in that window as the “usual” price.

To rebuild history from a folder of past `prices.json` snapshots (oldest is chosen by each file’s `updated` field):

```bash
python3 tools/prices/update_price_history.py --root . --import-dir /path/to/snapshots
```

## Vendor map

The flip finder also needs vendor buy/sell prices from the item database:

```bash
python3 tools/prices/build_item_vendor.py --root .
```

Re-run this after `tools/items/build_items.py`. The Gold tab loads `data/item-vendor.js` on demand only.
