@echo off
title Vessie AI Server
color 0A

echo.
echo  ╔══════════════════════════════════════╗
echo  ║          VESSIE AI SERVER            ║
echo  ║    Sistema Avancado de IA v1.0       ║
echo  ╚══════════════════════════════════════╝
echo.

:: Verificar Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org
    pause
    exit /b 1
)

:: Instalar dependencias se necessario
if not exist "node_modules" (
    echo [INFO] Instalando dependencias...
    npm install
    echo.
)

:: Criar diretorios necessarios
if not exist "public" mkdir public
if not exist "vessels-data" mkdir vessels-data
if not exist "projects" mkdir projects
if not exist "vessieai-core\skills\saved" mkdir "vessieai-core\skills\saved"
if not exist "vessieai-core\context\saved" mkdir "vessieai-core\context\saved"
if not exist "vessieai-core\cache" mkdir "vessieai-core\cache"
if not exist "vessieai-core\sharing" mkdir "vessieai-core\sharing"

:: Iniciar servidor
echo [INFO] Iniciando Vessie AI em http://localhost:3000
echo [INFO] Pressione Ctrl+C para parar
echo.
:loop
node server.js
goto loop

pause
