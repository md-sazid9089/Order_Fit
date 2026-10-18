"""Dependency-free synthetic text-layer PDFs for per-script extraction checks.

The font is a non-embedded Identity-H Type0 font whose glyph ids are arbitrary codes with a
ToUnicode map, which is how PDF producers expose text to extractors. It exercises the
real text-layer path (pypdf in the bounded child) for any script without a font file, so
no font licence or optional library is involved. It does NOT reproduce a given producer's
shaping or reordering: complex-script PDFs from real tools must still be sampled.
"""


def _hex_utf16(char: str) -> str:
    return char.encode("utf-16-be").hex().upper()


def make_pdf(pages: list[str]) -> bytes:
    """One page per entry; each line of text becomes one text-showing operation."""
    alphabet = sorted({ch for page in pages for ch in page if ch not in "\n"})
    code = {ch: index + 1 for index, ch in enumerate(alphabet)}
    objects: list[bytes] = []

    def add(body: str | bytes) -> int:
        objects.append(body.encode("latin-1") if isinstance(body, str) else body)
        return len(objects)

    catalog = add("")  # placeholders keep object numbers stable while pages are appended
    tree = add("")
    font = add("")
    descendant = add("")
    descriptor = add("")
    tounicode = add("")
    page_ids = []
    for text in pages:
        operations = []
        for number, line in enumerate(text.split("\n")):
            shown = "".join(f"{code[ch]:04X}" for ch in line)
            if shown:
                operations.append(f"BT /F1 12 Tf 72 {760 - 18 * number} Td <{shown}> Tj ET")
        stream = "\n".join(operations).encode("latin-1")
        content = add(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
        page_ids.append(add(
            f"<< /Type /Page /Parent {tree} 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 {font} 0 R >> >> /Contents {content} 0 R >>"))
    objects[catalog - 1] = f"<< /Type /Catalog /Pages {tree} 0 R >>".encode()
    kids = " ".join(f"{i} 0 R" for i in page_ids)
    objects[tree - 1] = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode()
    objects[font - 1] = (
        f"<< /Type /Font /Subtype /Type0 /BaseFont /SyntheticSans /Encoding /Identity-H "
        f"/DescendantFonts [{descendant} 0 R] /ToUnicode {tounicode} 0 R >>").encode()
    objects[descendant - 1] = (
        f"<< /Type /Font /Subtype /CIDFontType2 /BaseFont /SyntheticSans "
        f"/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> "
        f"/FontDescriptor {descriptor} 0 R /DW 600 >>").encode()
    objects[descriptor - 1] = (
        b"<< /Type /FontDescriptor /FontName /SyntheticSans /Flags 4 /FontBBox [0 -200 1000 900] "
        b"/ItalicAngle 0 /Ascent 900 /Descent -200 /CapHeight 700 /StemV 80 >>")
    mapping = "\n".join(f"<{value:04X}> <{_hex_utf16(ch)}>" for ch, value in code.items())
    cmap = (
        "/CIDInit /ProcSet findresource begin 12 dict begin begincmap\n"
        "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n"
        "/CMapName /Adobe-Identity-UCS def /CMapType 2 def\n"
        "1 begincodespacerange <0000> <FFFF> endcodespacerange\n"
        f"{len(code)} beginbfchar\n{mapping}\nendbfchar\nendcmap end end").encode("latin-1")
    objects[tounicode - 1] = b"<< /Length %d >>\nstream\n" % len(cmap) + cmap + b"\nendstream"

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % number + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % offset for offset in offsets)
    out += b"trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, catalog, xref)
    return bytes(out)
