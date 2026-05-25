#!/bin/bash
# sync-opencode.sh — Fetches OpenCode session & cost data and writes it to a cache
# that the Calendarly backend can read and serve to the frontend.
#
# Usage: ./scripts/sync-opencode.sh
# Run this on the HOST (where the opencode CLI is available).
# The Calendarly backend (inside Docker) reads the resulting cache files
# via a shared volume mount.
#
# For auto-sync, add to cron:
#   */30 * * * * cd /path/to/calendarly && ./scripts/sync-opencode.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CACHE_DIR="$PROJECT_ROOT/server/opencode-cache"

mkdir -p "$CACHE_DIR"

# --- Fetch session list ---
echo "[sync-opencode] Fetching session list..."
if command -v opencode &>/dev/null; then
  OPENCODE_BIN="opencode"
elif [ -x "$HOME/.opencode/bin/opencode" ]; then
  OPENCODE_BIN="$HOME/.opencode/bin/opencode"
else
  echo "[sync-opencode] ERROR: opencode CLI not found. Make sure OpenCode is installed."
  exit 1
fi

"$OPENCODE_BIN" session list --format json --max-count 500 > "$CACHE_DIR/sessions.json" 2>/dev/null || {
  echo "[sync-opencode] WARN: session list failed"
  echo '[]' > "$CACHE_DIR/sessions.json"
}

# --- Fetch stats (last 30 days) ---
echo "[sync-opencode] Fetching stats..."
"$OPENCODE_BIN" stats --days 30 --models > "$CACHE_DIR/stats.raw.txt" 2>/dev/null || {
  echo "[sync-opencode] WARN: stats failed"
  touch "$CACHE_DIR/stats.raw.txt"
}

# --- Write metadata ---
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$CACHE_DIR/last-sync.txt"

echo "[sync-opencode] Done. Cache written to $CACHE_DIR"
