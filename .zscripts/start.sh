#!/bin/sh

# FAZAI Start Script — minimal, robust startup
# FAZAI is a client-side IndexedDB app — no database, no Caddy needed

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting FAZAI..."
echo "📁 Script dir: $SCRIPT_DIR"

cd "$SCRIPT_DIR" || { echo "❌ Cannot cd to script dir"; exit 1; }

# Verify server file exists
if [ ! -f "./next-service-dist/server.js" ]; then
    echo "❌ Server file not found: ./next-service-dist/server.js"
    echo "📂 Directory contents:"
    ls -la
    exit 1
fi

cd next-service-dist || { echo "❌ Cannot cd to next-service-dist"; exit 1; }

# Set environment
export NODE_ENV=production
export PORT="${PORT:-3000}"
export HOSTNAME=0.0.0.0

echo "ℹ️  FAZAI — Dexie.js/IndexedDB (no server DB needed)"
echo "ℹ️  Starting on ${HOSTNAME}:${PORT}"

# Use node if available (more reliable in containers), fall back to bun
if command -v node >/dev/null 2>&1; then
    echo "✅ Starting FAZAI with node on port $PORT"
    exec node server.js
elif command -v bun >/dev/null 2>&1; then
    echo "✅ Starting FAZAI with bun on port $PORT"
    exec bun server.js
else
    echo "❌ Neither node nor bun found"
    exit 1
fi
