"""Ranking: safe enough, then cheapest.

1. Options meeting the target tolerance, by cost, then amount borrowed, then
   the fixed lever order (option_id).
2. Options below target, by tolerance (descending), then the same tie-breaks.
"""

from orderfit.engine.models import OptionResult


def rank(options: list[OptionResult]) -> list[OptionResult]:
    raise NotImplementedError
