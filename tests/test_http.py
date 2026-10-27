import csv
import io
import json
from http.server import ThreadingHTTPServer
from threading import Thread
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from backend.http import Handler


class QuietHandler(Handler):
    def log_message(self, *args):
        pass


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), QuietHandler)
        cls.thread = Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def request(self, path, method="GET"):
        try:
            return urlopen(Request(self.base + path, method=method), timeout=5)
        except HTTPError as error:
            return error

    def test_health_checks_archive(self):
        with self.request("/api/health") as response:
            self.assertEqual(response.status, 200)
            self.assertTrue(json.load(response)["archive_verified"])

    def test_analysis_parameters(self):
        with self.request("/api/analysis?date=2026-01-31&cutoff=08%3A30") as response:
            body = json.load(response)
            self.assertEqual(body["delivery_date"], "2026-02-01")
            self.assertEqual(body["cutoff"], "08:30")
            self.assertEqual(len(body["series"]), 24)

    def test_vercel_rewrite_route(self):
        with self.request("/api/index?route=analysis&date=2026-01-15&cutoff=09%3A00") as response:
            self.assertEqual(json.load(response)["summary"]["mae_mw"], 782.75)

    def test_month(self):
        with self.request("/api/accuracy?cutoff=09%3A00") as response:
            self.assertEqual(json.load(response)["summary"]["paired_hours"], 744)

    def test_sources(self):
        with self.request("/api/sources") as response:
            body = json.load(response)
            self.assertEqual(len(body["files"]), 2)
            self.assertTrue(all(len(file["sha256"]) == 64 for file in body["files"]))

    def test_invalid_query_is_400_not_success(self):
        with self.request("/api/analysis?date=2026-02-01") as response:
            self.assertEqual(response.code, 400)
            self.assertIn("error", json.load(response))

    def test_unknown_api_is_404(self):
        with self.request("/api/not-a-route") as response:
            self.assertEqual(response.code, 404)

    def test_api_is_read_only(self):
        with self.request("/api/analysis", "POST") as response:
            self.assertEqual(response.code, 405)

    def test_daily_csv(self):
        with self.request("/api/export?date=2026-01-15&cutoff=09%3A00") as response:
            self.assertIn("attachment", response.headers["Content-Disposition"])
            self.assertIn("text/csv", response.headers["Content-Type"])
            rows = list(csv.DictReader(io.StringIO(response.read().decode())))
            self.assertEqual(len(rows), 24)
            self.assertEqual(rows[0]["start_time"], "2026-01-16T00:00:00Z")

    def test_monthly_csv(self):
        with self.request("/api/export?scope=month&cutoff=09%3A00") as response:
            rows = list(csv.DictReader(io.StringIO(response.read().decode())))
            self.assertEqual(len(rows), 744)
            self.assertEqual(rows[-1]["decision_date"], "2026-01-31")
            self.assertEqual(rows[-1]["start_time"], "2026-02-01T23:00:00Z")

    def test_errors_are_not_cached(self):
        with self.request("/api/analysis?cutoff=invalid") as response:
            self.assertEqual(response.headers["Cache-Control"], "no-store")


if __name__ == "__main__":
    unittest.main()
