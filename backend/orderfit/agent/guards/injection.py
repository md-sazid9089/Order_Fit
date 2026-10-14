"""Injection scanner: flags imperative text aimed at the system inside documents
and replies (D-05, D-12). Flags only; never edits the document."""


def scan(text: str) -> list[str]:
    raise NotImplementedError
