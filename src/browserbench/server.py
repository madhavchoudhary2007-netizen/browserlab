from __future__ import annotations

import functools
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format: str, *args) -> None:
        return


class WorkloadServer:
    FILES = {
        "static": "static.html",
        "javascript": "javascript.html",
        "video": "video.html",
        "compute": "compute.html",
    }

    def __init__(self, directory: Path, host: str = "127.0.0.1", port: int = 0):
        self.directory = directory.resolve()
        handler = functools.partial(NoCacheHandler, directory=str(self.directory))
        self.httpd = ThreadingHTTPServer((host, port), handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    @property
    def base_url(self) -> str:
        host, port = self.httpd.server_address[:2]
        return f"http://{host}:{port}"

    def start(self) -> None:
        self.thread.start()

    def stop(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join(timeout=3)

    def url(self, workload: str, **params) -> str:
        filename = self.FILES[workload]
        if not params:
            return f"{self.base_url}/{filename}"
        from urllib.parse import urlencode
        return f"{self.base_url}/{filename}?{urlencode(params)}"
