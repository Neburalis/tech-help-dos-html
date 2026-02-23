#!/usr/bin/env python3
"""CLI for managing MCP bearer tokens.

Usage:
    python manage_tokens.py add "description of who this is for"
    python manage_tokens.py list
    python manage_tokens.py revoke <token>
"""

import json
import secrets
import sys
from pathlib import Path

TOKENS_FILE = Path(__file__).parent / "tokens.json"


def _load() -> dict:
    if TOKENS_FILE.exists():
        return json.loads(TOKENS_FILE.read_text())
    return {}


def _save(tokens: dict) -> None:
    TOKENS_FILE.write_text(json.dumps(tokens, indent=2) + "\n")


def cmd_add(description: str) -> None:
    tokens = _load()
    token = secrets.token_urlsafe(32)
    tokens[token] = {"description": description}
    _save(tokens)
    print(f"Token created:\n  {token}\n  Description: {description!r}")


def cmd_list() -> None:
    tokens = _load()
    if not tokens:
        print("No tokens.")
        return
    print(f"{'TOKEN (first 16 chars)':<20}  DESCRIPTION")
    print("-" * 60)
    for token, meta in tokens.items():
        print(f"  {token[:16]}...  {meta.get('description', '')}")
    print(f"\nTotal: {len(tokens)}")


def cmd_revoke(token: str) -> None:
    tokens = _load()
    if token in tokens:
        desc = tokens.pop(token).get("description", "")
        _save(tokens)
        print(f"Revoked token for: {desc!r}")
    else:
        print("Token not found.")
        sys.exit(1)


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "add":
        if len(sys.argv) < 3:
            print("Usage: manage_tokens.py add <description>")
            sys.exit(1)
        cmd_add(sys.argv[2])
    elif cmd == "list":
        cmd_list()
    elif cmd == "revoke":
        if len(sys.argv) < 3:
            print("Usage: manage_tokens.py revoke <token>")
            sys.exit(1)
        cmd_revoke(sys.argv[2])
    else:
        print(f"Unknown command: {cmd!r}")
        print("Commands: add, list, revoke")
        sys.exit(1)


if __name__ == "__main__":
    main()
