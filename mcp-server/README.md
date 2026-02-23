# TECH Help! KB — MCP Server

A read-only [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server providing semantic search over the TECH Help! 6.0 DOS reference documentation. Built with FastAPI + ChromaDB + sentence-transformers.

## Architecture

- **Transport**: Streamable HTTP (stateless)
- **Embeddings**: `all-MiniLM-L6-v2` via sentence-transformers (local, no API key)
- **Vector store**: ChromaDB with cosine similarity
- **Auth**: Bearer tokens stored in `tokens.json`
- **Read-only**: the knowledge base is populated by an external indexing script, not through MCP
- **Tools**: `search_knowledge(query, n_results)`, `list_collections()`, `get_page(page_num)`

Traefik routes `thelp.neburalis.space/mcp/*` to this container and strips the `/mcp`
prefix, so the app sees paths without it.

| External URL | Internal path | Auth |
|---|---|---|
| `GET thelp.neburalis.space/mcp/` | `GET /` | none |
| `GET thelp.neburalis.space/mcp/health` | `GET /health` | none |
| `POST thelp.neburalis.space/mcp/mcp` | `POST /mcp` | Bearer token |

## Build & Run

```bash
# From the repo root (docker compose handles build)
docker compose up -d mcp

# Or build the image standalone
docker build -t mcp-server ./mcp-server
```

## Token Management

`manage_tokens.py` runs against the `tokens.json` file that is bind-mounted
into the container. Run it **on the server** in the project directory:

```bash
# Issue a new token
python mcp-server/manage_tokens.py add "Alice — internal testing"

# List all tokens
python mcp-server/manage_tokens.py list

# Revoke a token (paste the full token string)
python mcp-server/manage_tokens.py revoke <token>
```

No container restart needed — the middleware reads `tokens.json` on every request.

## Testing with curl

```bash
BASE="https://thelp.neburalis.space/mcp"
TOKEN="<your-token>"

# Health check (no auth)
curl "$BASE/health"

# List MCP tools (auth required)
curl -X POST "$BASE/mcp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Search the knowledge base
curl -X POST "$BASE/mcp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "search_knowledge",
      "arguments": {"query": "INT 21h DOS functions", "n_results": 3}
    }
  }'

# Fetch a page by number (resolves via pages.json → filename)
curl -X POST "$BASE/mcp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_page","arguments":{"page_num":100}}}'

# List collections
curl -X POST "$BASE/mcp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"list_collections","arguments":{}}}'

# 401 without token
curl -X POST "$BASE/mcp" -H "Content-Type: application/json" -d '{}'
```

## ChromaDB Data

ChromaDB data persists in a named Docker volume `chroma_data` at `/data/chroma` inside
the container. To back it up:

```bash
docker run --rm -v chroma_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/chroma_backup.tar.gz -C /data .
```
