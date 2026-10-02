import json

from backend.app.core.config import ALLOWED_ORIGINS, MAX_UPLOAD_BYTES


class LocalSecurityMiddleware:
    """Loopback app: block foreign browser origins and bound even chunked request bodies."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = {key.decode().lower(): value.decode() for key, value in scope["headers"]}
        origin = headers.get("origin")
        if (origin and origin not in ALLOWED_ORIGINS) or headers.get("sec-fetch-site") == "cross-site":
            return await self.reject(send, 403, "This local app does not accept requests from other websites")
        limit = MAX_UPLOAD_BYTES + 65_536 if scope["path"] == "/api/documents" else 1024 * 1024
        try:
            if int(headers.get("content-length", "0")) > limit:
                return await self.reject(send, 413, "Request is too large")
        except ValueError:
            return await self.reject(send, 400, "Invalid content length")
        # Bound the body before JSON/multipart parsing. Framework parsers can
        # swallow receive exceptions and return a misleading generic error.
        parts, size = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            body = message.get("body", b"")
            size += len(body)
            if size > limit:
                return await self.reject(send, 413, "Request is too large")
            parts.append(body)
            if not message.get("more_body", False):
                break
        delivered = False

        async def bounded_receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {"type": "http.request", "body": b"".join(parts), "more_body": False}
            return await receive()

        async def secure_send(message):
            if message["type"] == "http.response.start":
                message["headers"] = list(message.get("headers", [])) + [
                    (b"x-content-type-options", b"nosniff"),
                    (b"cache-control", b"no-store"),
                    (b"x-frame-options", b"DENY"),
                    (b"referrer-policy", b"no-referrer"),
                ]
            await send(message)

        await self.app(scope, bounded_receive, secure_send)

    @staticmethod
    async def reject(send, code, message):
        await send(
            {
                "type": "http.response.start",
                "status": code,
                "headers": [(b"content-type", b"application/json")],
            }
        )
        await send({"type": "http.response.body", "body": json.dumps({"detail": message}).encode()})
