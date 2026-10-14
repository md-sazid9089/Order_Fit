"""LangGraph checkpointer on the same Postgres database (AsyncPostgresSaver,
connected with settings.psycopg_conninfo; call .setup() once at startup).

prune(): when a deal closes, keep only the final checkpoint (~500 KB -> ~20 KB).
"""


def get_checkpointer():
    raise NotImplementedError


def prune(thread_id: str) -> None:
    raise NotImplementedError
