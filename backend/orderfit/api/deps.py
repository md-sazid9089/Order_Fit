"""Request dependencies.

current_business_id: MVP uses one seeded demo business; the pilot replaces
this with real authentication. Every route takes it so tenancy scoping is
in place from day one.
"""


def current_business_id() -> str:
    return "demo-rina"
