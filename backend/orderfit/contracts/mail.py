"""Secret-free delivery state shared by the invitation contract."""

from typing import Annotated, Literal

from pydantic import Field

from .primitives import DTO, UTCInstant


class MailDelivery(DTO):
    status: Literal[
        "not_requested",
        "queued",
        "sending",
        "accepted",
        "delivered",
        "failed",
        "bounced",
        "complained",
        "unknown",
        "cancelled",
    ]
    attempts: Annotated[int, Field(strict=True, ge=0)]
    last_attempt_at: UTCInstant | None
    accepted_at: UTCInstant | None
    delivered_at: UTCInstant | None
    failure_code: (
        Literal[
            "DELIVERY_REJECTED",
            "DELIVERY_RETRY_EXHAUSTED",
            "DELIVERY_OUTCOME_UNKNOWN",
            "DELIVERY_SUPPRESSED",
            "DELIVERY_CANCELLED",
        ]
        | None
    )

    @classmethod
    def not_requested(cls):
        return cls(
            status="not_requested",
            attempts=0,
            last_attempt_at=None,
            accepted_at=None,
            delivered_at=None,
            failure_code=None,
        )
