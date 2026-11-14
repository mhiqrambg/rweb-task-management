#!/usr/bin/env python3
"""Read-only structural check for the five Phase 2 .drawio artefacts.

The five files under design/diagrams/ are authored with explicit page geometry
(no generator step), so this script only reads them: it parses the XML, counts
vertices and edges, checks that labels are present and that coordinates sit on
the 5 px grid, and flags placeholder text or non-canonical vocabulary.

    python3 design/diagrams/verify-drawio.py

Exit code 0 means every check passed. Standard library only.
"""

import os
import re
import sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))

FILES = {
    "01-system-context.drawio": "01 System context",
    "02-container-architecture.drawio": "02 Container architecture",
    "03-navigation-map.drawio": "03 Navigation map",
    "04-task-lifecycle.drawio": "04 Task lifecycle",
    "05-upload-and-session-flow.drawio": "05 Upload and session flow",
}

PLACEHOLDER = re.compile(r"TBD|FIXME|placeholder|lorem|XXX", re.I)
# `todo` is a canonical tasks.status value (00 §6), not a placeholder, so TODO is not scanned.
BANNED_TERMS = re.compile(r"todo item|to-do|memo|task item|note item", re.I)
UNLABELLED_OK = {"title", "start", "end", "aend", "nstart"}


def check(path):
    tree = ET.parse(path)
    root = tree.getroot()
    diagrams = root.findall("diagram")
    assert len(diagrams) == 1, "%s: expected 1 page, found %d" % (path, len(diagrams))
    model = diagrams[0].find("mxGraphModel")
    assert model is not None, "%s: mxGraphModel missing" % path

    vertices = model.findall(".//mxCell[@vertex='1']")
    edges = model.findall(".//mxCell[@edge='1']")
    ids = {c.get("id") for c in model.iter("mxCell")}
    labels = []
    warnings = []

    for cell in vertices:
        cid = cell.get("id")
        value = cell.get("value") or ""
        labels.append(value)
        geo = cell.find("mxGeometry")
        assert geo is not None, "%s: %s has no geometry" % (path, cid)
        for attr in ("x", "y", "width", "height"):
            raw = geo.get(attr)
            assert raw is not None, "%s: %s missing %s" % (path, cid, attr)
            if float(raw) % 5 != 0:
                warnings.append("%s %s=%s off the 5 px grid" % (cid, attr, raw))
        if cid not in UNLABELLED_OK:
            assert value.strip(), "%s: %s has no label" % (path, cid)

    for cell in edges:
        labels.append(cell.get("value") or "")
        src, dst = cell.get("source"), cell.get("target")
        if src is not None:
            assert src in ids, "%s: %s source %s unknown" % (path, cell.get("id"), src)
        if dst is not None:
            assert dst in ids, "%s: %s target %s unknown" % (path, cell.get("id"), dst)
        assert src or dst or cell.find(".//mxPoint") is not None, (
            "%s: %s has neither endpoints nor points" % (path, cell.get("id")))

    text = " ".join(labels)
    assert not PLACEHOLDER.search(text), "%s: placeholder text" % path
    assert not BANNED_TERMS.search(text), "%s: non-canonical vocabulary" % path

    return {
        "page": diagrams[0].get("name"),
        "width": model.get("pageWidth"),
        "height": model.get("pageHeight"),
        "vertices": len(vertices),
        "edges": len(edges),
        "warnings": warnings,
    }


def main():
    failures = 0
    for name, expected_page in sorted(FILES.items()):
        path = os.path.join(HERE, name)
        try:
            info = check(path)
            assert info["page"] == expected_page, "%s: page name %r" % (path, info["page"])
            print("%-34s page=%-28s %sx%s  vertices=%-3d edges=%-3d OK"
                  % (name, info["page"], info["width"], info["height"],
                     info["vertices"], info["edges"]))
            for warning in info["warnings"]:
                print("%-34s   warn: %s" % ("", warning))
        except (AssertionError, ET.ParseError) as exc:
            failures += 1
            print("%-34s FAIL %s" % (name, exc))
    if failures:
        print("\n%d file(s) failed" % failures)
        return 1
    print("\nall %d artefacts parsed and checked" % len(FILES))
    return 0


if __name__ == "__main__":
    sys.exit(main())
