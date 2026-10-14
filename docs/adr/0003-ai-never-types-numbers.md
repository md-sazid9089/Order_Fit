# 0003: The AI never produces a figure

**Decision:** AI text uses placeholders. The number guard fills them from the engine output and blocks any figure that doesn't match an allowed value. The terms guard does the same for rates and loan terms against the catalogue.

**Why:** A wrong figure in a message sent to a customer or supplier is the most damaging failure the product can have.

**Cost:** Prompts must be written around placeholders, and the guard needs canonical number parsing.
