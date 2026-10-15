#!/usr/bin/env python3
"""Extract AISC 360-10 PDF bookmarks as private, reviewable JSON.

Usage: python scripts/extract_standard_outline.py /path/to/AISC-360-10.pdf /path/to/outline.json
Requires PyMuPDF (pip install pymupdf). Does not store copyrighted PDF/page text in git.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

import fitz

def extract(pdf_path: Path):
    doc = fitz.open(str(pdf_path))
    if len(doc) < 250:
        raise ValueError("Document is too short for the combined AISC 360-10 specification/commentary PDF")
    bookmark_rows = []
    stack = []
    seen = set()
    for index, (level, title, page) in enumerate(doc.get_toc(), 1):
        title = " ".join(title.split())
        if page < 1 or page > len(doc):
            continue
        kind = "front_matter" if page < 57 else ("normative" if page < 297 else "commentary")
        # Preserve chapter and numbered paragraph labels; never guess an equation from a title.
        match = re.match(r"^(?:CHAP(?:TER)?\s+)?([A-N](?:\d{1,2})?)\s*[-. ]", title, re.IGNORECASE)
        match = match or re.match(r"^(APPENDIX\s+\d+)\s*[-. ]", title, re.IGNORECASE)
        label = match.group(1).upper().replace(" ", "") if match else None
        code = label or f"BOOKMARK-{index:04d}"
        # Repeated labels can occur in secondary outline branches.
        if (kind, code) in seen:
            code = f"{code}-TOC-{index:04d}"
        seen.add((kind, code))
        while stack and stack[-1][0] >= level:
            stack.pop()
        parent_code = stack[-1][1] if stack and stack[-1][2] == kind else None
        bookmark_rows.append({
            "code": code, "title": title, "kind": kind, "pdf_page": page,
            "parent_code": parent_code, "verification_status": "index_only"
        })
        stack.append((level, code, kind))
    return {
        "edition_code": "AISC360-10", "source_sha256": hashlib.sha256(pdf_path.read_bytes()).hexdigest(),
        "pdf_page_count": len(doc), "bookmark_count": len(bookmark_rows),
        "bookmarks": bookmark_rows,
    }

if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: extract_standard_outline.py INPUT.pdf OUTPUT.json")
    result = extract(Path(sys.argv[1]))
    Path(sys.argv[2]).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Indexed {result['bookmark_count']} bookmarks across {result['pdf_page_count']} pages")
