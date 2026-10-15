"""Terms guard: any rate, fee or loan term in a draft must exist in the financing
catalogue or the confirmed deal terms. Covers X-06."""


def check(text: str, catalogue, terms) -> list[str]:
    """Closed sentence grammar prevents changing a number's semantic term slot."""
    lines = text.splitlines()
    return [line for line in lines if line not in catalogue] + [
        line for line in terms if lines.count(line) != 1
    ]
