"""Terms guard: any rate, fee or loan term in a draft must exist in the financing
catalogue or the confirmed deal terms. Covers X-06."""


def check(text: str, catalogue, terms) -> list[str]:
    raise NotImplementedError
