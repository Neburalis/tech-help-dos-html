"""ChromaDB wrapper with sentence-transformers embeddings."""

import asyncio
from concurrent.futures import ThreadPoolExecutor
from functools import partial

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

_COLLECTION_NAME = "knowledge_base"
_EMBED_MODEL = "all-MiniLM-L6-v2"
_PERSIST_DIR = "/data/chroma"


class VectorStore:
    def __init__(self, persist_dir: str = _PERSIST_DIR) -> None:
        self._executor = ThreadPoolExecutor(max_workers=2)
        ef = SentenceTransformerEmbeddingFunction(model_name=_EMBED_MODEL)
        self._client = chromadb.PersistentClient(path=persist_dir)
        self._col = self._client.get_or_create_collection(
            name=_COLLECTION_NAME,
            embedding_function=ef,
            metadata={"hnsw:space": "cosine"},
        )

    # ------------------------------------------------------------------
    # Async helpers
    # ------------------------------------------------------------------

    async def _run(self, fn, *args, **kwargs):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, partial(fn, *args, **kwargs))

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def search(self, query: str, n_results: int = 5) -> list[dict]:
        count = await self._run(self._col.count)
        if count == 0:
            return []
        n = min(n_results, count)
        result = await self._run(
            self._col.query,
            query_texts=[query],
            n_results=n,
        )
        output = []
        for i, doc_id in enumerate(result["ids"][0]):
            output.append(
                {
                    "id": doc_id,
                    "content": result["documents"][0][i],
                    "metadata": result["metadatas"][0][i] or {},
                    "distance": round(result["distances"][0][i], 4),
                }
            )
        return output

    def list_collections(self) -> list[str]:
        return [c.name for c in self._client.list_collections()]
