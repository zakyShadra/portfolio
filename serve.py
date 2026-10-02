#!/usr/bin/env python3
"""Serve the portfolio locally and open it in a browser.

Usage:
    python3 serve.py [port]   # default port 8000
"""
import http.server
import os
import socketserver
import sys
import threading
import webbrowser

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # No caching, so edits show up on reload during development.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass  # keep the console quiet


def open_browser():
    webbrowser.open(f"http://localhost:{PORT}/")


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving {ROOT} at http://localhost:{PORT}/  (Ctrl+C to stop)")
        threading.Timer(0.6, open_browser).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")
