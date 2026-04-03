# SQL工具桌面版
# 运行方式: 双击运行或 python sql_tool.py
# 打包后: 双击 sql_tool.exe

import http.server
import socketserver
import threading
import webbrowser
import os
import sys

PORT = 8765

# 获取资源目录（用于打包后的路径）
def get_resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        # PyInstaller 打包后的路径
        return os.path.join(sys._MEIPASS, relative_path)
    return relative_path

# 获取当前目录
if hasattr(sys, '_MEIPASS'):
    current_dir = sys._MEIPASS
else:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(current_dir)

# 创建简单HTTP服务器
class NoLogHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def translate_path(self, path):
        # 支持打包后的路径
        import urllib.parse
        path = urllib.parse.unquote(path)
        path = path.split('?', 1)[0]
        path = path.split('#', 1)[0]
        # 去除前导 /
        path = path.lstrip('/')
        # 映射到资源目录
        return os.path.join(get_resource_path(path))

def run_server():
    with socketserver.TCPServer(("", PORT), NoLogHandler) as httpd:
        print(f"服务器启动: http://localhost:{PORT}")
        httpd.serve_forever()

if __name__ == "__main__":
    # 启动HTTP服务器
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    # 打开浏览器
    url = f"http://localhost:{PORT}/index.html"
    webbrowser.open(url)

    print("SQL工具已启动！")
    print("按回车键退出...")

    try:
        input()
    except:
        pass