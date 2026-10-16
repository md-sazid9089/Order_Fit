"""Response privacy applies equally to JSON, downloads, and rejected requests."""

from starlette.datastructures import MutableHeaders


class SecurityHeaders:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def secured(message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                headers["Cache-Control"] = "private, no-store"
                headers["Pragma"] = "no-cache"
                headers["X-Content-Type-Options"] = "nosniff"
                headers["X-Frame-Options"] = "DENY"
                headers["Referrer-Policy"] = "no-referrer"
                # Preserve the stronger sandbox policy on document downloads.
                headers.setdefault("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; sandbox")
                if scope.get("scheme") == "https":
                    headers["Strict-Transport-Security"] = "max-age=31536000"
            await send(message)

        await self.app(scope, receive, secured)
