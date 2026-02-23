"""Token-based authentication middleware."""

import json
from pathlib import Path

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

TOKENS_FILE = Path("/app/tokens.json")

# Paths accessible without a token
_PUBLIC = {("/", "GET"), ("/health", "GET")}


def _load_tokens() -> dict:
    try:
        return json.loads(TOKENS_FILE.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def is_valid_token(token: str) -> bool:
    return token in _load_tokens()


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if (request.url.path, request.method) in _PUBLIC:
            return await call_next(request)

        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)

        token = auth[7:].strip()
        if not is_valid_token(token):
            return JSONResponse({"error": "Unauthorized"}, status_code=401)

        return await call_next(request)
