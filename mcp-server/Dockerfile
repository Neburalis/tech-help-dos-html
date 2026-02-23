FROM python:3.11-slim

# Install uv
RUN pip install --no-cache-dir uv

WORKDIR /app

# Copy project definition first for layer caching
COPY pyproject.toml .
COPY src/ src/

# Install all dependencies + the package itself
RUN uv pip install --system --no-cache .

# Pre-download the embedding model so first request isn't slow
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY manage_tokens.py .

# tokens.json is expected to be bind-mounted from the host;
# create a fallback so the container starts even without a mount.
RUN echo '{}' > /app/tokens.json

RUN mkdir -p /data/chroma

EXPOSE 8000

CMD ["uvicorn", "mcp_server.main:app", "--host", "0.0.0.0", "--port", "8000"]
