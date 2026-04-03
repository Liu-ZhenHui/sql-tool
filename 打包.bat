@echo off
echo 正在打包 SQL 工具...
echo.

cd /d "%~dp0"

pyinstaller sql_tool.py --onedir ^
    --name "SQL工具" ^
    --add-data "index.html;." ^
    --add-data "css;css" ^
    --add-data "js;js" ^
    --noconfirm ^
    --clean

echo.
echo 打包完成！可执行文件在 dist 目录中
pause