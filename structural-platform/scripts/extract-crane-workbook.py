#!/usr/bin/env python3
"""Read formulas and Excel's saved values without running VBA or recalculating.

Usage: python scripts/extract-crane-workbook.py source.xlsm output.json
Only Python's standard library is needed. The original workbook remains private.
"""
import hashlib
import json
import posixpath
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"


def extract(source):
    with zipfile.ZipFile(source) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            shared = ["".join(node.itertext()) for node in ET.fromstring(archive.read("xl/sharedStrings.xml"))]
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = {r.attrib["Id"]: r.attrib["Target"] for r in ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))}
        sheets = {}
        for sheet in workbook.find("s:sheets", NS):
            name = sheet.attrib["name"]
            if name not in ["AISC360-ASD", "AISC360-LRFD"]:
                continue
            target = relationships[sheet.attrib[f"{{{REL}}}id"]]
            path = posixpath.normpath(posixpath.join("xl", target)) if not target.startswith("/") else target[1:]
            cells = {}
            for cell in ET.fromstring(archive.read(path)).findall(".//s:sheetData/s:row/s:c", NS):
                value, formula = cell.find("s:v", NS), cell.find("s:f", NS)
                raw = value.text if value is not None else None
                kind = cell.attrib.get("t", "n")
                if kind == "s" and raw is not None:
                    parsed = shared[int(raw)]
                elif kind == "inlineStr":
                    parsed = "".join(cell.find("s:is", NS).itertext())
                elif raw is not None and kind == "n":
                    parsed = float(raw)
                elif kind == "b" and raw is not None:
                    parsed = raw == "1"
                else:
                    parsed = raw
                if parsed is not None or formula is not None:
                    cells[cell.attrib["r"]] = {"value": parsed, **({"formula": "=" + (formula.text or "")} if formula is not None else {})}
            sheets[name] = {"cells": cells}
        if set(sheets) != {"AISC360-ASD", "AISC360-LRFD"}:
            raise ValueError("Both ASD and LRFD sheets are required")
        return {
            "schema_version": "1.0", "source_filename": Path(source).name,
            "source_sha256": hashlib.sha256(Path(source).read_bytes()).hexdigest(),
            "basis": "EXCEL_SAVED_CACHE_NOT_RECALCULATED_NOT_AISC_VERIFICATION",
            "macros_executed": False,
            "sheet_names": [s.attrib["name"] for s in workbook.find("s:sheets", NS)],
            "defined_names": [{"name": n.attrib["name"], "scope": n.attrib.get("localSheetId"), "reference": n.text} for n in workbook.findall("s:definedNames/s:definedName", NS)],
            "sheets": sheets,
        }


if __name__ == "__main__":
    Path(sys.argv[2]).write_text(json.dumps(extract(sys.argv[1]), ensure_ascii=False, indent=2) + "\n")
