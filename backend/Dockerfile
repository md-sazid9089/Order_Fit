# OrderFit API
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Dependencies first, in their own layer: source edits don't reinstall them.
COPY pyproject.toml uv.lock .python-version ./
RUN pip install uv==0.11.24 \
 && uv sync --frozen --no-dev --no-install-project

COPY orderfit ./orderfit
RUN uv sync --frozen --no-dev --no-editable
COPY alembic.ini ./
COPY migrations ./migrations

# Non-root user. /app/var holds uploaded documents; the named volume mounted
# there inherits this ownership on first use. Everything else is in Postgres.
RUN useradd --system --uid 10001 --no-create-home app \
 && mkdir -p /app/var/documents \
 && chown -R app:app /app/var
USER app

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)"

CMD ["uvicorn", "orderfit.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
