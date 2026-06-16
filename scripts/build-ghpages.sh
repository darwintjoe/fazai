#!/bin/bash
# Build FAZAI as a static export for GitHub Pages.
# API routes (/api/ai/*) cannot exist in static export mode, so we
# temporarily move them aside, build, then restore them.

set -e
cd "$(dirname "$0")/.."

API_DIR="src/app/api"
BACKUP_DIR="/tmp/fazai-api-backup"

echo "[ghpages] Building static export for GitHub Pages..."

# 1. Move API routes aside so Next.js doesn't try to compile them as routes
if [ -d "$API_DIR" ]; then
  echo "[ghpages] Temporarily moving $API_DIR -> $BACKUP_DIR"
  rm -rf "$BACKUP_DIR"
  mv "$API_DIR" "$BACKUP_DIR"
fi

# 2. Run the static export build
GHPAGES=1 bun run next build

# 3. Restore the API routes
if [ -d "$BACKUP_DIR" ]; then
  echo "[ghpages] Restoring $API_DIR from $BACKUP_DIR"
  mkdir -p "$API_DIR"
  mv "$BACKUP_DIR"/* "$API_DIR"/ 2>/dev/null || true
  rm -rf "$BACKUP_DIR"
fi

# 4. Ensure .nojekyll exists so GitHub Pages doesn't skip _next/ folders
touch ./out/.nojekyll

echo "[ghpages] Build complete - static site is in ./out"
echo "[ghpages] AI Assistant will use built-in keyword fallback (no server needed)"
