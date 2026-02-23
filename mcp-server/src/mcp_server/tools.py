"""MCP tool definitions — registered onto a FastMCP instance."""

import httpx
from mcp.server.fastmcp import FastMCP

from .vector_store import VectorStore

_BASE_URL = "https://thelp.neburalis.space"

_store: VectorStore | None = None
_pages_map: dict[int, str] | None = None  # page_num -> filename (e.g. "42-foo.html")


def _get_store() -> VectorStore:
    global _store
    if _store is None:
        _store = VectorStore()
    return _store


async def _get_pages_map() -> dict[int, str]:
    """Fetch pages.json once and cache a page-number → filename mapping."""
    global _pages_map
    if _pages_map is None:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{_BASE_URL}/pages.json")
            resp.raise_for_status()
            pages = resp.json()
        _pages_map = {int(entry["id"].split("-")[0]): entry["id"] for entry in pages}
    return _pages_map


def register_tools(mcp: FastMCP) -> None:

    @mcp.tool()
    async def search_knowledge(query: str, n_results: int = 5) -> list[dict]:
        """Search the knowledge base for documents semantically similar to the query.

        Args:
            query: Natural-language search query.
            n_results: Maximum number of results to return (default 5).

        Returns:
            List of dicts with keys: id, content, metadata, distance.
        """
        return await _get_store().search(query, n_results)

    @mcp.tool()
    async def list_collections() -> list[str]:
        """List all collections available in the vector store.

        Returns:
            List of collection name strings.
        """
        return _get_store().list_collections()

    @mcp.tool()
    async def get_page(page_num: int) -> str:
        """Fetch a TECH Help! documentation page by its page number and return the raw HTML.

        Args:
            page_num: Page number (e.g. 100 for page 100). Matches the numeric
                      prefix returned in search_knowledge results.

        Returns:
            Raw HTML content of the page as a string.
        """
        pages_map = await _get_pages_map()
        filename = pages_map.get(page_num)
        if filename is None:
            raise ValueError(f"Page {page_num} not found")
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            response = await client.get(f"{_BASE_URL}/pages/{filename}")
            response.raise_for_status()
            return response.text
