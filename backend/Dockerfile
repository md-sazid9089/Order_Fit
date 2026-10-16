# OrderFit API
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

# tini runs as PID 1: it forwards SIGTERM/SIGINT to the child and reaps zombies. Without it
# the kernel ignores SIGTERM for a PID 1 that installs no handler. The worker handles SIGTERM
# by finishing its in-flight job, then closing the pool and exiting 0.
RUN apt-get update  && apt-get install -y --no-install-recommends tini  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first, in their own layer: source edits don't reinstall them.
COPY pyproject.toml uv.lock .python-version ./
RUN pip install uv==0.11.24 \
 && uv sync --frozen --no-dev --no-install-project

COPY orderfit ./orderfit
RUN uv sync --frozen --no-dev --no-editable
COPY alembic.ini ./
COPY migrations ./migrations

# Non-root user. Document storage directory is configurable via DOCUMENT_DIR:
#   - Local/Compose: /app/var/documents (named volume inherits ownership)
#   - Render:        /var/data/orderfit/documents (persistent disk)
# Both paths are created so the same image works in either environment.
RUN useradd --system --uid 10001 --no-create-home app \
 && mkdir -p /app/var/documents /var/data/orderfit/documents \
 && chown -R app:app /app/var /var/data/orderfit
USER app

# Local default 8000; Render injects PORT (default 10000) and requires binding 0.0.0.0:$PORT.
ENV PORT=8000
EXPOSE 8000

# Only meaningful for the API process; Render uses healthCheckPath and the worker/migration
# services override it or have no HTTP port. /ready (not /health) checks the restricted DB
# login, schema revision and writable document storage; it returns 503 otherwise.
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3   CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/ready' % os.environ.get('PORT','8000'), timeout=4)"

ENTRYPOINT ["tini", "--"]
# orderfit.api.serve reads PORT and TRUSTED_PROXY_IPS (JSON list of proxy IPs/CIDRs; default
# empty = X-Forwarded-* ignored, never uvicorn's implicit loopback trust). Exec form keeps the
# Python process as tini's child so it receives SIGTERM; uvicorn drains requests for up to 20 s.
CMD ["python", "-m", "orderfit.api.serve"]
