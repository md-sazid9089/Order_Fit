"""Fraud signals against stored baselines: bank account not in
Business.known_bank_accounts (F-01), sender domain not in known domains (F-02)."""


def check(quote, business, customer) -> list[str]:
    raise NotImplementedError
