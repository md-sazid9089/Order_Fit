"""Fixed limits shared by every engine module.

The horizon must cover the latest possible event: delivery + payment terms +
maximum stress delay. Validation rejects deals that would exceed it.
"""

MAX_DELAY_DAYS = 180  # stress scan d = 0 .. 180 inclusive (181 runs)
MAX_PAYMENT_DAYS = 180  # longer terms are rejected at validation
MAX_DELIVERY_DAYS = 180  # delivery date, in days from today
HORIZON_DAYS = MAX_DELIVERY_DAYS + MAX_PAYMENT_DAYS + MAX_DELAY_DAYS  # 540

MAX_LEVERS = 5  # 2**5 - 1 = 31 option combinations

BPS = 10_000  # basis points per 1.0; all rates are integer bps

# Tolerance sentinel: the plan breaches the reserve even when paid on time.
FAILS_ON_TIME = -1
