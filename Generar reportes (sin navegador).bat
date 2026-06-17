@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Generando los 5 reportes con la misma logica de la app (sin abrir el navegador)...
echo Lee los 3 Excel de la carpeta:  ..\Encuesta_tu_voz_fundamental
echo Escribe las salidas en:        ..\Encuesta_tu_voz_fundamental\salidas_pipeline
echo.
call npm run generar
echo.
pause
