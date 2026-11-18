#!/usr/bin/env python3
"""Minimal reader for NorgannonDB data files (GPL-3.0, https://github.com/zmarotrix/NorgannonDB).

NorgannonDB packs records as R(id,"name",[[lua table body]]). This reads the subset of
Lua literal syntax those files use (tables, strings, numbers, booleans) without running Lua.
Used by build_addon_zones.py for quest starters/finishers, prerequisites and NPC spawns.
"""
from __future__ import annotations

import re
from pathlib import Path

_NUM = re.compile(r"-?\d+(?:\.\d+)?(?:[eE]-?\d+)?")
_KEY = re.compile(r"[A-Za-z_][A-Za-z0-9_]*\s*=(?!=)")
_REC = re.compile(r'^R\((\d+),"((?:[^"\\]|\\.)*)",\[\[(.*)\]\]\)\s*$', re.M)


class _Parser:
    def __init__(self, text):
        self.t = text
        self.i = 0

    def ws(self):
        t, n = self.t, len(self.t)
        while self.i < n and t[self.i] in " \t\r\n":
            self.i += 1

    def value(self):
        self.ws()
        c = self.t[self.i]
        if c == "{":
            return self.table()
        if c == '"':
            return self.string()
        m = _NUM.match(self.t, self.i)
        if m:
            self.i = m.end()
            s = m.group(0)
            return float(s) if ("." in s or "e" in s or "E" in s) else int(s)
        for word, v in (("true", True), ("false", False), ("nil", None)):
            if self.t.startswith(word, self.i):
                self.i += len(word)
                return v
        raise ValueError("unexpected Lua token near: " + self.t[self.i:self.i + 40])

    def string(self):
        self.i += 1
        out = []
        while True:
            c = self.t[self.i]
            if c == "\\":
                nxt = self.t[self.i + 1]
                out.append({"n": "\n", "t": "\t"}.get(nxt, nxt))
                self.i += 2
                continue
            if c == '"':
                self.i += 1
                return "".join(out)
            out.append(c)
            self.i += 1

    def table(self):
        self.i += 1
        arr, d = [], {}
        while True:
            self.ws()
            if self.t[self.i] == "}":
                self.i += 1
                break
            if self.t[self.i] == "[":
                self.i += 1
                k = self.value()
                self.ws()
                self.i += 1  # ]
                self.ws()
                self.i += 1  # =
                d[k] = self.value()
            else:
                m = _KEY.match(self.t, self.i)
                if m:
                    self.i = m.end()
                    d[m.group(0).split("=")[0].strip()] = self.value()
                else:
                    arr.append(self.value())
            self.ws()
            if self.t[self.i] in ",;":
                self.i += 1
        if d and arr:
            for n, v in enumerate(arr, 1):
                d[n] = v
            return d
        return d if d else arr


def load_records(path: Path, ids=None):
    """Return {id: record} from a NorgannonDB packed data file (quests/npcs/objects)."""
    out = {}
    text = Path(path).read_text(encoding="utf-8")
    for m in _REC.finditer(text):
        rid = int(m.group(1))
        if ids is not None and rid not in ids:
            continue
        rec = _Parser("{" + m.group(3) + "}").value()
        if not isinstance(rec, dict):
            rec = {}
        rec["name"] = _Parser('"' + m.group(2) + '"').string()
        out[rid] = rec
    return out


def load_zone_names(path: Path):
    """AreaTable id -> zone name from data/world.lua (entries like [1497]={name="Undercity",...})."""
    text = Path(path).read_text(encoding="utf-8")
    return {int(a): n for a, n in re.findall(r'\[(\d+)\]=\{name="((?:[^"\\]|\\.)*)"', text)}


def load_info(path: Path):
    text = Path(path).read_text(encoding="utf-8")
    m = re.search(r"NorgannonDB\.info\s*=\s*(\{.*\})", text, re.S)
    return _Parser(m.group(1)).value() if m else {}
