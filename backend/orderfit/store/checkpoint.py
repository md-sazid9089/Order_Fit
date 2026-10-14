"""LangGraph checkpointer factory (SQLite now, Postgres later) and the
prune-to-final-state step run when a deal closes (~500 KB -> ~20 KB)."""


def get_checkpointer():
    raise NotImplementedError


def prune(thread_id: str) -> None:
    raise NotImplementedError
