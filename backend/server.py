"""Local API server; production Docker also serves the built React application."""
import argparse
from http.server import ThreadingHTTPServer
from pathlib import Path
import mimetypes
from urllib.parse import unquote, urlsplit
from backend.http import Handler

DIST = Path(__file__).resolve().parents[1] / "dist"


class LocalHandler(Handler):
    def do_GET(self):
        url = urlsplit(self.path)
        if url.path.startswith("/api/"):
            return super().do_GET()
        relative = unquote(url.path).lstrip("/") or "index.html"
        path = (DIST / relative).resolve()
        if not path.is_relative_to(DIST.resolve()):
            return self.send_json({"error": "Not found"}, 404)
        if not path.is_file():
            if "." in relative.split("/")[-1]:
                return self.send_json({"error": "Not found"}, 404)
            path = DIST / "index.html"
        if not path.exists():
            return self.send_json({"error": "Build the React frontend, or use Vite on port 5173."}, 404)
        content_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        return self.send_bytes(path.read_bytes(), content_type)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), LocalHandler)
    print(f"Aeris Python server http://{args.host}:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
