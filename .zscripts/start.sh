#!/bin/sh

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR"

# 存储所有子进程的 PID
pids=""

# 清理函数：优雅关闭所有服务
cleanup() {
    echo ""
    echo "🛑 正在关闭所有服务..."
    
    # 发送 SIGTERM 信号给所有子进程
    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            service_name=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
            echo "   关闭进程 $pid ($service_name)..."
            kill -TERM "$pid" 2>/dev/null
        fi
    done
    
    # 等待所有进程退出（最多等待 5 秒）
    sleep 1
    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            # 如果还在运行，等待最多 4 秒
            timeout=4
            while [ $timeout -gt 0 ] && kill -0 "$pid" 2>/dev/null; do
                sleep 1
                timeout=$((timeout - 1))
            done
            # 如果仍然在运行，强制关闭
            if kill -0 "$pid" 2>/dev/null; then
                echo "   强制关闭进程 $pid..."
                kill -KILL "$pid" 2>/dev/null
            fi
        fi
    done
    
    echo "✅ 所有服务已关闭"
    exit 0
}

echo "🚀 开始启动所有服务..."
echo ""

# 切换到构建目录
cd "$BUILD_DIR" || exit 1

ls -lah

# FAZAI uses Dexie.js (IndexedDB, client-side) — no server-side database needed
# Legacy Prisma/db references have been removed

# 启动 Next.js 服务器
if [ -f "./next-service-dist/server.js" ]; then
    echo "🚀 启动 Next.js 服务器..."
    cd next-service-dist/ || exit 1
    
    # 设置环境变量
    export NODE_ENV=production
    export PORT="${PORT:-3000}"
    export HOSTNAME="${HOSTNAME:-0.0.0.0}"
    
    echo "ℹ️  FAZAI uses Dexie.js (IndexedDB) — no server-side database needed"
    
    # Use bun if available, fall back to node
    RUNNER="bun"
    if ! command -v bun >/dev/null 2>&1; then
        echo "ℹ️  bun not found, falling back to node"
        RUNNER="node"
    fi
    
    # 后台启动 Next.js
    $RUNNER server.js &
    NEXT_PID=$!
    pids="$NEXT_PID"
    
    # 等待一小段时间检查进程是否成功启动
    sleep 2
    if ! kill -0 "$NEXT_PID" 2>/dev/null; then
        echo "❌ Next.js 服务器启动失败 (tried: $RUNNER)"
        exit 1
    else
        echo "✅ Next.js 服务器已启动 (PID: $NEXT_PID, Port: $PORT, Runner: $RUNNER)"
    fi
    
    cd ../
else
    echo "⚠️  未找到 Next.js 服务器文件: ./next-service-dist/server.js"
fi

# 启动 mini-services
if [ -f "./mini-services-start.sh" ]; then
    echo "🚀 启动 mini-services..."
    
    # 运行启动脚本（从根目录运行，脚本内部会处理 mini-services-dist 目录）
    sh ./mini-services-start.sh &
    MINI_PID=$!
    pids="$pids $MINI_PID"
    
    # 等待一小段时间检查进程是否成功启动
    sleep 1
    if ! kill -0 "$MINI_PID" 2>/dev/null; then
        echo "⚠️  mini-services 可能启动失败，但继续运行..."
    else
        echo "✅ mini-services 已启动 (PID: $MINI_PID)"
    fi
elif [ -d "./mini-services-dist" ]; then
    echo "⚠️  未找到 mini-services 启动脚本，但目录存在"
else
    echo "ℹ️  mini-services 目录不存在，跳过"
fi

# 启动 Caddy（如果存在 Caddyfile）
if [ -f "Caddyfile" ] && command -v caddy >/dev/null 2>&1; then
    echo "🚀 启动 Caddy..."
    echo ""
    echo "🎉 所有服务已启动！"
    echo ""
    echo "💡 按 Ctrl+C 停止所有服务"
    echo ""
    # Caddy 作为主进程运行
    exec caddy run --config Caddyfile --adapter caddyfile
else
    echo "⚠️  Caddyfile or caddy not found — running without Caddy reverse proxy"
    echo "✅ Next.js server is running directly on port $PORT"
    # Keep the script alive by waiting on the Next.js process
    wait $NEXT_PID
fi
