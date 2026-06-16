@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Instalando dependencias (solo la primera vez)...
echo.
call npm install
echo.
echo Listo. Ahora puedes usar "Iniciar app.bat".
pause
