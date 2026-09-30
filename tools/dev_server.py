"""Local dev server for the portfolio site — like `python -m http.server`, but tells the
browser never to cache anything. Plain http.server has no Cache-Control header, so browsers
apply their own heuristic caching and can keep serving an old CSS/JS file after it's edited,
even on a hard navigation. That made every CSS tweak unreliable to preview, so this exists.
"""
import functools
import http.server

DIRECTORY = "site"
PORT = 5173


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
        super().do_GET()


if __name__ == "__main__":
    handler = functools.partial(NoCacheHandler, directory=DIRECTORY)
    with http.server.ThreadingHTTPServer(("", PORT), handler) as httpd:
        print(f"Serving {DIRECTORY} on http://localhost:{PORT} (no-cache)")
        httpd.serve_forever()
