#!/bin/bash

# FAZAI Build Script — simplified for reliable deployment
# FAZAI is a client-side IndexedDB app (no server DB, no Caddy, no mini-services)

# Redirect stderr to stdout so the platform doesn't misinterpret warnings as errors
exec 2>&1

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
NEXTJS_PROJECT_DIR="/home/z/my-project"

echo "🚀 FAZAI Build Starting..."
echo "📁 Project: $NEXTJS_PROJECT_DIR"

cd "$NEXTJS_PROJECT_DIR" || { echo "❌ Cannot cd to project dir"; exit 1; }

export NEXT_TELEMETRY_DISABLED=1

BUILD_DIR="/tmp/build_fullstack_${BUILD_ID:-default}"
echo "📁 Build dir: $BUILD_DIR"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# ── Install dependencies ──────────────────────────────────
echo "📦 Installing dependencies..."
if command -v bun >/dev/null 2>&1; then
    bun install
else
    echo "ℹ️  bun not found, using npm"
    npm install
fi

# ── Build Next.js ─────────────────────────────────────────
echo "🔨 Building Next.js app..."
if command -v bun >/dev/null 2>&1; then
    bun run build
else
    npm run build
fi

# ── Verify build output ───────────────────────────────────
if [ ! -d ".next/standalone" ]; then
    echo "❌ Build failed: .next/standalone not found"
    exit 1
fi
if [ ! -f ".next/standalone/server.js" ]; then
    echo "❌ Build failed: server.js not found in standalone output"
    exit 1
fi
echo "✅ Next.js build successful"

# ── Collect build artifacts ───────────────────────────────
echo "📦 Collecting build artifacts..."

# Copy standalone output (already includes static + public from package.json build script)
cp -r .next/standalone "$BUILD_DIR/next-service-dist"
echo "  ✅ Copied .next/standalone → next-service-dist"

# Double-check static and public are in the standalone output
# (package.json build script does this, but verify and fix if needed)
if [ ! -d "$BUILD_DIR/next-service-dist/.next/static" ]; then
    echo "  ⚠️  Static files missing in standalone, copying manually..."
    mkdir -p "$BUILD_DIR/next-service-dist/.next"
    cp -r .next/static "$BUILD_DIR/next-service-dist/.next/"
fi
if [ ! -d "$BUILD_DIR/next-service-dist/public" ]; then
    echo "  ⚠️  Public directory missing in standalone, copying manually..."
    cp -r public "$BUILD_DIR/next-service-dist/"
fi

# Copy start script
cp "$SCRIPT_DIR/start.sh" "$BUILD_DIR/start.sh"
chmod +x "$BUILD_DIR/start.sh"
echo "  ✅ Copied start.sh"

# ── Package ───────────────────────────────────────────────
PACKAGE_FILE="${BUILD_DIR}.tar.gz"
echo "📦 Packaging to $PACKAGE_FILE..."
cd "$BUILD_DIR" || exit 1
tar -czf "$PACKAGE_FILE" .
cd - > /dev/null || exit 1

echo ""
echo "✅ Build complete! Package: $PACKAGE_FILE"
ls -lh "$PACKAGE_FILE"
