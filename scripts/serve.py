"""
Local preview server for the Dwaar site.

Serves the project folder with HTTP Range support, which browsers require
before they will let you seek inside a <video>. `python -m http.server`
does NOT send Range responses, so scroll-scrubbed video will stay frozen
on the first frame if you preview with it.

Usage: python scripts/serve.py [port]     (default 8000)
"""

import os
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class RangeHandler(SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler plus byte-range support for media."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        range_header = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not range_header or not os.path.isfile(path):
            return super().do_GET()

        try:
            start_s, end_s = range_header.replace("bytes=", "").split("-", 1)
            start = int(start_s) if start_s else 0
            size = os.path.getsize(path)
            end = int(end_s) if end_s else size - 1
            end = min(end, size - 1)
            if start > end:
                raise ValueError
        except ValueError:
            self.send_error(416, "Invalid range")
            return

        ctype = self.guess_type(path)
        self.send_response(206)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Cache-Control", "no-store")
        self._range_sent = True
        self.end_headers()

        with open(path, "rb") as fh:
            fh.seek(start)
            remaining = end - start + 1
            while remaining > 0:
                chunk = fh.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    return
                remaining -= len(chunk)

    def end_headers(self):
        if not getattr(self, "_range_sent", False):
            self.send_header("Accept-Ranges", "bytes")
        super().end_headers()


if __name__ == "__main__":
    os.chdir(ROOT)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), RangeHandler)
    print(f"Dwaar preview - http://localhost:{PORT}/index.html")
    print("Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
