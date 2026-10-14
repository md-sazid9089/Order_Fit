"""Workflow graph.

    ingest -> extract -> validate -> [confirm] -> compute -> explain -> draft
           -> [approve] -> send -> (await reply) -> read_reply -> validate -> [confirm] -> compute ...

[confirm] and [approve] are LangGraph interrupts (the two pause points).
Replies go back through validate and confirm: counterparty text is the most
adversarial input in the system and never reaches the engine unchecked.
The negotiation loop stops after round 3.
"""


def build_graph(checkpointer):
    """Wire nodes and edges; compile with the given checkpointer."""
    raise NotImplementedError
