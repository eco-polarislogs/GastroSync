@echo off
chcp 65001 > nul
cls
echo ===============================================================================
echo                🍽️  GASTROSYNC TEK TIKLA BAŞLATICI (ALL-IN-ONE)
echo ===============================================================================
echo.
echo [1/3] PostgreSQL Veritabanı ve Spring Boot Backend (Port: 8080) Başlatılıyor...
if exist "%~dp0backend\maven\apache-maven-3.9.9\bin\mvn.cmd" (
    start "GastroSync Backend (Spring Boot :8080)" cmd /k "cd /d %~dp0backend && ""%~dp0backend\maven\apache-maven-3.9.9\bin\mvn.cmd"" spring-boot:run"
) else (
    start "GastroSync Backend (Spring Boot :8080)" cmd /k "cd /d %~dp0backend && mvn spring-boot:run"
)

echo [2/3] Web Ön Yüz Uygulaması (Port: 3000 / 3001) Başlatılıyor...
start "GastroSync Web App (React :3000)" cmd /k "cd /d %~dp0 && npm run dev"

echo [3/3] Mobil Uygulama (Expo Tunnel & Metro :8081) Başlatılıyor...
start "GastroSync Mobile App (Expo Metro)" cmd /k "cd /d %~dp0mobile && npx expo start --tunnel"

echo.
echo ===============================================================================
echo   Tüm Sistemler Başlatıldı!
echo   -----------------------------------------------------------------------------
echo   * Web Arayüzü:        http://localhost:3000 veya http://localhost:3001
echo   * Backend REST API:   http://localhost:8080
echo   * Swagger API Docs:   http://localhost:8080/swagger-ui/index.html
echo   * Mobil Expo Metro:   http://localhost:8081 (Terminaldeki QR kodu Expo Go ile okutun)
echo ===============================================================================
echo.
pause
