"""Synthetic per-script PDF text-layer extraction through the bounded production parser."""

import json
import unicodedata

import pytest

from orderfit.services.documents import parse, parse_pdf_child, quote_supports, sniff_mime
from orderfit.services.language import detect_page
from tests.pdf_synthetic import make_pdf

PAGES = {
    "en": ("Purchase Order 42\nOrder value: BDT 1,000.00\nOrder date: 2026-11-02\nPayment due 30 days after invoice.",
           "invoice", "Payment due 30 days after invoice.", "Order value: BDT 1,000.00"),
    "bn": ("ক্রয়াদেশ ৪২\nমোট মূল্য: ১,০০০.০০ টাকা\nঅর্ডারের তারিখ: ২ নভেম্বর ২০২৬\nচালান পাওয়ার ৩০ দিন পরে পেমেন্ট।",
           "invoice", "চালান পাওয়ার ৩০ দিন পরে পেমেন্ট।", "মোট মূল্য: ১,০০০.০০ টাকা"),
    "hi": ("क्रय आदेश 42\nकुल राशि: १,०००.०० रुपये\nऑर्डर की तारीख: २ नवंबर २०२६\nडिलीवरी के ३० दिन बाद भुगतान।",
           "delivery", "डिलीवरी के ३० दिन बाद भुगतान।", "कुल राशि: १,०००.०० रुपये"),
    "zh-Hans": ("采购订单 42\n订单金额：1,000.00 元\n订单日期：2026年11月2日\n交付后30天付款。",
                "delivery", "交付后30天付款。", "订单金额：1,000.00 元"),
}


def _same(a: str, b: str) -> bool:
    return unicodedata.normalize("NFC", a).split() == unicodedata.normalize("NFC", b).split()


@pytest.mark.parametrize("language", PAGES)
def test_text_layer_pdf_roundtrips_each_supported_script(language):
    text, basis, quote, amount = PAGES[language]
    data = make_pdf([text])
    assert sniff_mime(data, "application/pdf") == "application/pdf"
    result = parse_pdf_child(data)
    assert result.status == "parsed", result
    page = result.pages[0]
    assert _same(page, text), (page, text)
    assert detect_page(page)[0] == language
    # The extracted page text, not a translation, is what grounding runs against.
    assert quote_supports("payment_days", "30", quote, page) == "ok"
    assert quote_supports("payment_basis", basis, quote, page) == "ok"
    assert quote_supports("order_value_minor", "100000", amount, page) == "ok"


def test_multi_page_script_pdf_keeps_page_boundaries_and_runs_in_the_bounded_child():
    pages = [PAGES["bn"][0], PAGES["hi"][0]]
    result = parse(make_pdf(pages), "application/pdf")  # production path: isolated child process
    assert result.status == "parsed" and len(result.pages) == 2
    assert [detect_page(page)[0] for page in result.pages] == ["bn", "hi"]


def test_pdf_without_a_text_layer_still_requires_manual_entry():
    result = parse_pdf_child(make_pdf([""]))
    assert result.status == "ocr_required" and result.error_code == "NO_TEXT_LAYER"


def test_reordered_or_broken_shaping_is_visible_to_review_not_silently_accepted():
    """A producer that stores a Bengali pre-base vowel sign in visual order changes the text.

    The reviewer sees the original quote (and an optional gloss); grounding cannot repair
    it. A model-proposed quote spelled in logical order then fails verbatim matching.
    """
    logical = "চালান পাওয়ার ৩০ দিন পরে পেমেন্ট।"
    visual = logical.replace("দিন", "িদন")  # vowel sign moved before its consonant
    page = parse_pdf_child(make_pdf([visual])).pages[0]
    assert not _same(page, logical)
    assert quote_supports("payment_days", "30", logical, page) == "quote_mismatch"
    json.dumps({"page": page}, ensure_ascii=False)  # the stored page stays valid Unicode text
