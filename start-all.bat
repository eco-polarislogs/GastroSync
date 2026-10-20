@echo off
setlocal
cd /d "%~dp0"

echo ===============================================================================
echo                GASTROSYNC TEK TIKLA BASLATICI (ALL-IN-ONE)
echo ===============================================================================
echo.
echo [1/3] Backend (Spring Boot :8080) baslatiliyor...
if exist "%~dp0backend\maven\apache-maven-3.9.9\bin\mvn.cmd" (
    start "GastroSync Backend" cmd /k "cd /d "%~dp0backend" && "%~dp0backend\maven\apache-maven-3.9.9\bin\mvn.cmd" spring-boot:run"
) else (
    start "GastroSync Backend" cmd /k "cd /d "%~dp0backend" && mvn spring-boot:run"
)

echo [2/3] Web App (React :3000) baslatiliyor...
start "GastroSync Web" cmd /k "cd /d "%~dp0" && npm run dev"

echo [3/3] Mobil App (Expo Metro) baslatiliyor...
start "GastroSync Mobile" cmd /k "cd /d "%~dp0mobile" && npx expo start -c"

echo.
echo ===============================================================================
echo   Tum Servisler Baslatildi!
echo   -----------------------------------------------------------------------------
echo   * Web Arayuzu:        http://localhost:3000
echo   * Backend REST API:   http://localhost:8080
echo   * Swagger API Docs:   http://localhost:8080/swagger-ui/index.html
echo   * Mobil Expo Metro:   http://localhost:8081
echo   (Telefonunuz ile ayni Wi-Fi aginda olup QR kodu Expo Go ile okutun)
echo ===============================================================================
echo.
pause
