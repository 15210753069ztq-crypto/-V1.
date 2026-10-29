#!/usr/bin/env bash
# 直接用默认浏览器打开系统；若无图形界面，可执行 python3 -m http.server 8080 后访问 http://localhost:8080
cd "$(dirname "$0")"
(xdg-open index.html || open index.html) >/dev/null 2>&1
