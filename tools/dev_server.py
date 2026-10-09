"""Local dev server for the portfolio site — like `python -m http.server`, but tells the
browser never to cache anything. Plain http.server has no Cache-Control header, so browsers
apply their own heuristic caching and can keep serving an old CSS/JS file after it's edited,
even on a hard navigation. That made every CSS tweak unreliable to preview, so this exists.

It also answers HTTP Range requests, which plain http.server doesn't: without them a browser
treats a <video> as unseekable, so a scrub bar snaps back to 0 and `loop` can fail to restart.
Real hosting supports ranges; this makes the local preview behave the same.
"""
import functools
import http.server
import os
import re
import shutil

DIRECTORY = "site"
PORT = int(os.environ.get("PORT", 5173))  # another project may already hold 5173
RANGE = re.compile(r"bytes=(\d*)-(\d*)$")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        # Drop conditional-GET headers so the parent handler can never answer with a
        # stale "304 Not Modified" against whatever the browser already has cached.
        for h in ("If-Modified-Since", "If-None-Match"):
            del self.headers[h]
        if self.headers.get("Range") and self.send_range():
            return
        super().do_GET()

    def send_range(self):
        """Serve a single `Range: bytes=a-b` request as 206. False = not handled (fall back)."""
        path = self.translate_path(self.path)
        match = RANGE.match(self.headers["Range"].strip())
        if not match or not os.path.isfile(path):
            return False
        size = os.path.getsize(path)
        first, last = match.groups()
        if first == "":  # "bytes=-N": the last N bytes
            if last == "":
                return False
            start, end = max(0, size - int(last)), size - 1
        else:
            start = int(first)
            end = min(int(last), size - 1) if last else size - 1
        if start >= size or start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return True
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        with open(path, "rb") as fh:
            fh.seek(start)
            shutil.copyfileobj(_Limited(fh, end - start + 1), self.wfile)
        return True


class _Limited:
    """A file-like that reads at most `n` bytes from `fh`."""

    def __init__(self, fh, n):
        self.fh, self.left = fh, n

    def read(self, size=-1):
        size = self.left if size < 0 else min(size, self.left)
        data = self.fh.read(size)
        self.left -= len(data)
        return data


if __name__ == "__main__":
    handler = functools.partial(NoCacheHandler, directory=DIRECTORY)
    with http.server.ThreadingHTTPServer(("", PORT), handler) as httpd:
        print(f"Serving {DIRECTORY} on http://localhost:{PORT} (no-cache, range requests)")
        httpd.serve_forever()
