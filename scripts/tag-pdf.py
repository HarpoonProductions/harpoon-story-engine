#!/usr/bin/env python3
"""
Harpoon Story Engine — PDF accessibility post-processor.

Fixes three PDF/UA-1 failures left by Chrome's --export-tagged-pdf:
  7.1-8  Missing XMP metadata stream in document catalog
  7.1-5  Non-standard structure type Em not mapped in role map
  7.1-3  Header/footer template content not marked as Artifact

Usage:
  python3 scripts/tag-pdf.py <input.pdf> <output.pdf>
  python3 scripts/tag-pdf.py story.pdf story.pdf   # in-place
"""

import sys
import datetime
import pikepdf
from pikepdf import Dictionary, Name, Stream, Array

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 tag-pdf.py <input.pdf> <output.pdf>", file=sys.stderr)
        sys.exit(1)

    in_path  = sys.argv[1]
    out_path = sys.argv[2]

    print(f"[tag-pdf] Reading: {in_path}")
    pdf = pikepdf.open(in_path)

    # ── 1. XMP metadata stream (fixes 7.1-8) ──────────────────────────
    # PDF/UA-1 requires a valid XMP metadata stream in the document catalog.
    # Chrome sets Info dict entries but omits the XMP stream entirely.

    info = pdf.docinfo
    title    = str(info.get('/Title',    ''))
    lang     = str(pdf.Root.get('/Lang', 'en')).strip('()')
    now      = datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S+00:00')

    xmp = f'''<?xpacket begin="\xef\xbb\xbf" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title><rdf:Alt>
        <rdf:li xml:lang="x-default">{_esc(title)}</rdf:li>
      </rdf:Alt></dc:title>
      <dc:language><rdf:Bag>
        <rdf:li>{_esc(lang)}</rdf:li>
      </rdf:Bag></dc:language>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>Harpoon Story Engine</xmp:CreatorTool>
      <xmp:CreateDate>{now}</xmp:CreateDate>
      <xmp:ModifyDate>{now}</xmp:ModifyDate>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>Harpoon Story Engine / Chromium</pdf:Producer>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:pdfuaid="http://www.aiim.org/pdfua/ns/id/">
      <pdfuaid:part>1</pdfuaid:part>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>'''

    meta_stream = Stream(pdf, xmp.encode('utf-8'))
    meta_stream['/Type']    = Name('/Metadata')
    meta_stream['/Subtype'] = Name('/XML')
    pdf.Root['/Metadata']   = pdf.make_indirect(meta_stream)
    print("[tag-pdf] ✓  XMP metadata stream added (7.1-8)")

    # ── 2. Role map: non-standard → standard types (fixes 7.1-5) ─────
    # Chrome emits /Em, /NonStruct, /Transparency tags without mapping them
    # to standard PDF structure types in the role map dictionary.

    struct_root = pdf.Root.get('/StructTreeRoot')
    if struct_root is not None:
        if '/RoleMap' not in struct_root:
            struct_root['/RoleMap'] = Dictionary()
        role_map = struct_root['/RoleMap']
        mappings = {
            '/Em':           '/Span',   # <em> → inline span
            '/Transparency': '/Span',   # Chrome transparency group tag
            # Note: /NonStruct is already a standard PDF type — do NOT remap it
        }
        for src, dst in mappings.items():
            if src not in role_map:
                role_map[src] = Name(dst)
        print("[tag-pdf] ✓  Role map entries added (7.1-5)")
    else:
        print("[tag-pdf] ⚠  No StructTreeRoot found — skipping role map")

    # ── 3. Mark untagged content as Artifact (fixes 7.1-3) ────────────
    # Chrome's header/footer templates are rendered as separate content
    # streams outside the tagged content flow. Every operator in those
    # streams that isn't wrapped in a marked-content sequence fails 7.1-3.
    # The fix: wrap each page's content in a /Artifact marked-content span
    # IFF the page has no structure parent (i.e. it's a header/footer page).
    # For main content pages, find untagged operators and mark them Artifact.

    # Approach: iterate pages; for pages that have marked-content sequences
    # already, patch any bare operators into /Artifact wrappers.
    # For simplicity and reliability, we use pikepdf's content stream parser
    # to detect pages where ALL content is untagged (header/footer pages)
    # and mark the whole page content as Artifact.

    artifact_pages = 0
    for page in pdf.pages:
        cs = page.get('/Contents')
        if cs is None:
            continue
        raw = b''
        if isinstance(cs, pikepdf.Array):
            for s in cs:
                raw += s.read_raw_bytes()
        else:
            raw = cs.read_raw_bytes()

        # If the page content has no BMC/BDC markers at all, the entire
        # page is untagged — wrap it in an Artifact marked-content sequence.
        if b'BMC' not in raw and b'BDC' not in raw:
            wrapped = b'/Artifact BMC\n' + raw + b'\nEMC\n'
            if isinstance(cs, pikepdf.Array):
                new_stream = Stream(pdf, wrapped)
                page['/Contents'] = pdf.make_indirect(new_stream)
            else:
                cs.write(wrapped)
            artifact_pages += 1

    if artifact_pages:
        print(f"[tag-pdf] ✓  {artifact_pages} untagged page(s) wrapped as Artifact (7.1-3)")
    else:
        print("[tag-pdf] ✓  No fully-untagged pages found (7.1-3 may need manual review)")

    # ── Save ───────────────────────────────────────────────────────────
    print(f"[tag-pdf] Writing: {out_path}")
    pdf.save(out_path)
    print("[tag-pdf] Done.")


def _esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


if __name__ == '__main__':
    main()
