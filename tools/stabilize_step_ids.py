#!/usr/bin/env python3
"""Keep Leveling Route step IDs stable across guide re-imports.

RestedXP/OpenXP step IDs are "<chapter>:<source line>", so an edit higher up in
a guide file shifts every later ID and saved checkboxes would point at the
wrong steps. Run this after build_hand_routes.py + build_addon_zones.py:

    python3 tools/stabilize_step_ids.py <previous leveling-data.js> js/leveling-data.js

For each chapter present in both files, steps whose content is unchanged
(every field except the ID) are aligned in order with difflib and keep their
previous ID. A new or edited step whose fresh ID was used by a different
step before gets a suffixed ID (":r<date>") so it never inherits someone
else's checkbox. Nothing else in the file is touched.
"""
import difflib
import json
import sys
from datetime import date


def load(path):
    text = open(path, encoding="utf-8").read()
    prefix = "window.WOW_LEVELING = "
    assert text.startswith(prefix)
    return json.loads(text[len(prefix):].rstrip().rstrip(";"))


def groups(steps):
    """Rows sharing one source line share one ID; treat them as one unit."""
    out = []
    for i, st in enumerate(steps):
        if out and out[-1][0] == st[-1]:
            out[-1][1].append(i)
        else:
            out.append((st[-1], [i]))
    return out


def main(old_path, new_path):
    old, new = load(old_path), load(new_path)
    tag = date.today().strftime("%Y%m%d")
    kept = reassigned = renamed = 0
    for key, ch in new["chapters"].items():
        prev = old["chapters"].get(key)
        if not prev or key.startswith("addon|"):
            continue  # add-on chapter IDs are already keyed by quest, not by line
        go, gn = groups(prev["steps"]), groups(ch["steps"])
        sig = lambda steps, g: json.dumps([steps[i][:-1] for i in g[1]], ensure_ascii=False)
        a = [sig(prev["steps"], g) for g in go]
        b = [sig(ch["steps"], g) for g in gn]
        old_ids = {g[0] for g in go}
        matched = set()
        sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
        for blk in sm.get_matching_blocks():
            for k in range(blk.size):
                oid, (nid, rows) = go[blk.a + k][0], gn[blk.b + k]
                if nid == oid:
                    kept += 1
                else:
                    reassigned += 1
                for i in rows:
                    ch["steps"][i][-1] = oid
                matched.add(blk.b + k)
        used = {ch["steps"][gn[j][1][0]][-1] for j in matched}
        for j, (nid, rows) in enumerate(gn):
            if j in matched:
                continue
            sid = nid
            if sid in old_ids or sid in used:
                sid, n = f"{nid}:r{tag}", 2
                while sid in old_ids or sid in used:
                    sid, n = f"{nid}:r{tag}.{n}", n + 1
                renamed += 1
            for i in rows:
                ch["steps"][i][-1] = sid
            used.add(sid)
    with open(new_path, "w", encoding="utf-8") as f:
        f.write("window.WOW_LEVELING = " + json.dumps(new, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"step groups: kept {kept}, re-pointed to previous ID {reassigned}, new/edited with fresh ID {renamed}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
