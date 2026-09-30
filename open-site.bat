@echo off
rem Starts a tiny local web server for the portfolio (with caching disabled) and opens it.
rem Close this window to stop the server. Refresh the browser normally to see any change.
cd /d "%~dp0"
start "" http://localhost:5173
python tools\dev_server.py
