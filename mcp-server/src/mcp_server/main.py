"""ASGI application — MCP server with token auth.

The app is built on top of FastMCP's own Starlette app so that its lifespan
(an anyio task group that drives StreamableHTTPSessionManager) is kept intact.
We insert custom routes before the MCP route and apply auth middleware on top.

Traefik strips the /mcp prefix before forwarding here:

  External                              → Internal
  GET  thelp.neburalis.space/mcp/       → GET  /       info page (no auth)
  GET  thelp.neburalis.space/mcp/health → GET  /health health check (no auth)
  POST thelp.neburalis.space/mcp/mcp    → POST /mcp    MCP JSON-RPC (auth)
"""

from starlette.requests import Request
from starlette.responses import HTMLResponse, JSONResponse
from starlette.routing import Route
from mcp.server.fastmcp import FastMCP

from .auth import AuthMiddleware
from .tools import register_tools

# ---------------------------------------------------------------------------
# Info page (served at GET / without auth)
# ---------------------------------------------------------------------------
_INFO_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TECH Help! KB — MCP Server</title>
  <style>
    body { font-family: monospace; max-width: 720px; margin: 60px auto;
           padding: 20px; background: #0d1117; color: #c9d1d9; line-height: 1.6; }
    h1   { color: #58a6ff; }
    h2   { color: #8b949e; border-bottom: 1px solid #30363d; padding-bottom: 4px; }
    code { background: #161b22; padding: 2px 6px; border-radius: 4px; color: #f0883e; }
    pre  { background: #161b22; padding: 16px; border-radius: 6px; overflow-x: auto; }
    .box { border: 1px solid #30363d; padding: 16px; border-radius: 6px; margin: 20px 0; }
    a    { color: #58a6ff; }
  </style>
</head>
<body>
  <h1>TECH Help! KB &mdash; MCP Server</h1>

  <div class="box">
    <p>This is an <strong>MCP (Model Context Protocol)</strong> server providing
    semantic search over the TECH Help! 6.0 DOS reference knowledge base.</p>
    <p>Access requires a Bearer token.</p>
    <p><strong>To request a token:</strong> email
      <a href="mailto:get-mcp@neburalis.space">get-mcp@neburalis.space</a>
    </p>
  </div>

  <h2>MCP Endpoint</h2>
  <pre>POST https://thelp.neburalis.space/mcp/mcp
Authorization: Bearer &lt;your-token&gt;
Content-Type: application/json</pre>

  <h2>Available Tools</h2>
  <ul>
    <li><code>search_knowledge(query, n_results=5)</code> &mdash; semantic search over site documentation</li>
    <li><code>list_collections()</code> &mdash; list available collections</li>
    <li><code>get_page(page_num)</code> &mdash; fetch raw HTML of a page by its number</li>
  </ul>

  <h2>Health Check</h2>
  <pre>GET https://thelp.neburalis.space/mcp/health</pre>
</body>
</html>
"""


async def _info_page(request: Request) -> HTMLResponse:
    return HTMLResponse(_INFO_HTML)


async def _health(request: Request) -> JSONResponse:
    return JSONResponse({"status": "ok"})


# ---------------------------------------------------------------------------
# Build the app
#
# We take FastMCP's own Starlette app (which has the lifespan that starts the
# anyio task group for StreamableHTTPSessionManager) and:
#   1. Prepend our custom routes so they match before /mcp
#   2. Add the auth middleware
# ---------------------------------------------------------------------------
# host="0.0.0.0" prevents FastMCP from auto-enabling DNS rebinding protection
# (which by default only allows localhost). We run behind Traefik+TLS, so this
# is fine — Cloudflare/Traefik handle external security.
_mcp = FastMCP("tech-help-kb", stateless_http=True, host="0.0.0.0")
register_tools(_mcp)

# FastMCP's Starlette app — has the correct lifespan and a Route("/mcp", ...)
app = _mcp.streamable_http_app()

# Insert custom routes at the front so they take priority
app.router.routes = [
    Route("/", _info_page, methods=["GET"]),
    Route("/health", _health, methods=["GET"]),
] + list(app.router.routes)

# Auth middleware — skips GET / and GET /health (see auth.py)
app.add_middleware(AuthMiddleware)
