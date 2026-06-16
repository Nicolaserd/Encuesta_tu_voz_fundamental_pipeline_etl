@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Iniciando la app...
echo Cuando aparezca "Ready", abre en tu navegador:  http://localhost:3000
echo (Para detenerla, cierra esta ventana o presiona Ctrl+C)
echo.
call npm run dev
pause
