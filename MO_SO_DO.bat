@echo off
echo Dang khoi dong server...
start "" "http://localhost:62608/SO_DO_KIEN_TRUC.html"
node "%~dp0server.js"
pause
