# OrderFit API
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Dependencies first, in their own layer: source edits don't reinstall them.
COPY pyproject.toml ./
RUN python -c "import tomllib; print('\n'.join(tomllib.load(open('pyproject.toml','rb'))['project']['dependencies']))" > /tmp/requirements.txt \
 && pip install -r /tmp/requirements.txt

COPY orderfit ./orderfit
RUN pip install --no-deps .
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
