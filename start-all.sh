#!/bin/bash
# GastroSync All-in-One Starter for macOS / Linux

echo "==============================================================================="
echo "               🍽️  GASTROSYNC TEK TIKLA BAŞLATICI (macOS / Linux)"
echo "==============================================================================="

# 1. Backend
echo "[1/3] Backend Başlatılıyor (Port 8080)..."
(cd backend && mvn spring-boot:run) &

# 2. Web App
echo "[2/3] Web App Başlatılıyor (Port 3000)..."
npm run dev &

# 3. Mobile
echo "[3/3] Mobil Expo Başlatılıyor..."
(cd mobile && npx expo start --tunnel) &

wait
