@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在打开启程学习空间：http://localhost:8765
echo 请保持此窗口运行。按 Ctrl+C 可停止。
start "" "http://localhost:8765"
python -m http.server 8765 --bind 127.0.0.1
