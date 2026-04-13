#!/usr/bin/env bash
# =============================================================================
# init.sh — 开发入口（当前默认：link-game 连连看）
# 在仓库根目录执行: ./init.sh  （Windows 可用 Git Bash）
# =============================================================================
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Initializing link-game (Web Link Game)...${NC}"

echo "Installing dependencies..."
cd link-game && npm install && cd ..

echo "Starting development server (default port 3000)..."
cd link-game
npm run dev &
SERVER_PID=$!
cd ..

echo "Waiting for server..."
sleep 3

echo -e "${GREEN}Done.${NC}"
echo -e "${GREEN}Dev server: http://localhost:3000 (PID: $SERVER_PID)${NC}"
echo "Note: hello-nextjs/ is reference only; this script targets link-game/."
