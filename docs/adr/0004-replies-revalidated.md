# 0004: Negotiation replies go back through validate and confirm

**Decision:** `read_reply` routes to `validate`, then `[confirm]`, never straight to `compute`.

**Why:** Counterparty text is the most adversarial input in the system. It needs the same injection and fraud checks as the original documents, and the owner should confirm the changed terms.

**Cost:** One more owner click per negotiation round.
