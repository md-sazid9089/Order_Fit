from decimal import Decimal

from orderfit.agent.guards import numbers
from orderfit.services.documents import _numbers_in, quote_supports
from orderfit.services.language import detect
from orderfit.services.preparation import bank_change


def test_native_decimal_numerals_are_grounded_without_a_gloss():
    assert _numbers_in("মূল্য ১২,৩৪৫.৬৭", "মূল্য ১২,৩৪৫.৬৭") == {Decimal("12345.67")}
    assert quote_supports("order_value_minor", "1234567", "মূল্য １２,３４５.６７", "মূল্য １２,３４５.６７") == "ok"


def test_language_detection_is_conservative_for_pure_mixed_and_short_text():
    assert detect("পেমেন্ট ডেলিভারির পরে হবে")[0:3] == ("bn", "Bengali", True)
    assert detect("付款将在交付后进行")[0:3] == ("zh-Hans", "Han", True)
    assert detect("invoice भुगतान") == ("unknown", "mixed", False)
    assert detect("abc") == ("unknown", "unknown", False)


def test_multilingual_bank_and_generated_number_guards_fail_closed():
    for text in ("নতুন ব্যাংক হিসাব ব্যবহার করুন", "नया बैंक खाता", "请使用新的银行账户"):
        assert bank_change(text)
    bad = numbers.check("金额为十二，বাংলা ১২, हिंदी १२", set())
    assert "十" in "".join(bad) and "১" in bad and "२" in bad


def test_reviewed_payment_basis_lexicons_ground_only_supported_terms():
    assert quote_supports("payment_basis", "invoice", "চালান পাওয়ার ৩০ দিন পরে", "চালান পাওয়ার ৩০ দিন পরে") == "ok"
    assert quote_supports("payment_basis", "delivery", "交付后30天付款", "交付后30天付款") == "ok"
    assert quote_supports("payment_basis", "invoice", "付款将在30天内完成", "付款将在30天内完成") == "ambiguous"
