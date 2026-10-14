"""LangGraph checkpointer on the same Postgres database (AsyncPostgresSaver,
connected with settings.psycopg_conninfo; call .setup() once at startup).

On Neon this goes through the pooled endpoint (PgBouncer, transaction mode):
open connections with autocommit=True and prepare_threshold=0 so no session
state or server-side prepared statements are assumed.

prune(): when a deal closes, keep only the final checkpoint (~500 KB -> ~20 KB).
"""


def get_checkpointer():
    raise NotImplementedError


def prune(thread_id: str) -> None:
    raise NotImplementedError
