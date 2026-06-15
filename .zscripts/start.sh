#!/bin/sh

# FAZAI start script — runs Next.js standalone server
# No Caddy reverse proxy needed (FAZAI is a client-side IndexedDB app)

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR"

echo "🚀 Starting FAZAI..."
echo ""

# 切换到构建目录
cd "$BUILD_DIR" || exit 1

# FAZAI uses Dexie.js (IndexedDB, client-side) — no server-side database needed

# 启动 Next.js 服务器
if [ -f "./next-service-dist/server.js" ]; then
    cd next-service-dist/ || exit 1

    # 设置环境变量
    export NODE_ENV=production
    export PORT="${PORT:-3000}"
    # Force HOSTNAME to 0.0.0.0 so Next.js listens on all interfaces
    # (container HOSTNAME might resolve to an inaccessible IP)
    export HOSTNAME=0.0.0.0

    echo "ℹ️  FAZAI uses Dexie.js (IndexedDB) — no server-side database"
    echo "ℹ️  Starting Next.js on 0.0.0.0:${PORT}..."

    # Use bun if available, fall back to node
    RUNNER="bun"
    if ! command -v bun >/dev/null 2>&1; then
        echo "ℹ️  bun not found, falling back to node"
        RUNNER="node"
    fi

    # Start Next.js as the main foreground process
    echo "✅ Starting FAZAI with $RUNNER on port $PORT"
    exec $RUNNER server.js
else
    echo "❌ Server file not found: ./next-service-dist/server.js"
    echo "📂 Build directory contents:"
    ls -la
    exit 1
fi
