"""Synthetic edge-case fixtures + integration checks against the real archive."""
from datetime import datetime, timedelta, timezone
import math
import unittest
from backend.analysis import Archive, get_archive, metrics, timestamp, validate_inputs
from backend.http import csv_payload


def forecast(generation, publication="2026-01-15T07:30:00Z", target="2026-01-16T00:00:00Z"):
    return {"startTime": target, "publishTime": publication, "generation": generation}


def actual(generation, target="2026-01-16T00:00:00Z", publication="2026-01-16T01:00:00Z", fuel="WIND"):
    return {"startTime": target, "publishTime": publication, "generation": generation, "fuelType": fuel}


class VintageSelectionTests(unittest.TestCase):
    def setUp(self):
        self.records = [forecast(1000, "2026-01-15T05:30:00Z"), forecast(2000),
                        forecast(9999, "2026-01-15T10:30:00Z")]
        self.archive = Archive(self.records, [])

    def test_no_future_forecast_leakage(self):
        self.assertEqual(self.archive.day("2026-01-15")["series"][0]["forecast_mw"], 2000)

    def test_exact_cutoff_inclusive(self):
        self.assertEqual(self.archive.day("2026-01-15", "07:30")["series"][0]["forecast_mw"], 2000)

    def test_earlier_cutoff_selects_earlier_vintage(self):
        self.assertEqual(self.archive.day("2026-01-15", "07:29")["series"][0]["forecast_mw"], 1000)

    def test_missing_prior_forecast_not_future_or_zero(self):
        day = self.archive.day("2026-01-15", "00:00")
        self.assertIsNone(day["series"][0]["forecast_mw"])
        self.assertIsNone(day["summary"]["mae_mw"])
        self.assertEqual(day["summary"]["forecast_hours"], 0)

    def test_unsorted_input(self):
        archive = Archive(list(reversed(self.records)), [])
        self.assertEqual(archive.day("2026-01-15")["series"][0]["forecast_mw"], 2000)

    def test_per_target_hour_selection(self):
        archive = Archive(self.records + [forecast(3000, "2026-01-15T08:00:00Z", "2026-01-16T01:00:00Z")], [])
        rows = archive.day("2026-01-15")["series"]
        self.assertEqual(rows[0]["forecast_published_at"], "2026-01-15T07:30:00Z")
        self.assertEqual(rows[1]["forecast_published_at"], "2026-01-15T08:00:00Z")

    def test_duplicate_identical_records_are_deduplicated(self):
        archive = Archive(self.records * 2, [])
        self.assertEqual(len(archive.forecasts[timestamp("2026-01-16T00:00:00Z")][0]), 3)

    def test_conflicting_duplicates_are_not_silently_overwritten(self):
        with self.assertRaisesRegex(ValueError, "Conflicting forecast"):
            Archive([forecast(1000), forecast(2000)], [])

    def test_non_hourly_forecast_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "cadence"):
            Archive([forecast(1000, target="2026-01-16T00:30:00Z")], [])

    def test_age_and_lead_are_distinct(self):
        row = self.archive.day("2026-01-15")["series"][0]
        self.assertEqual(row["lead_hours"], 15)
        self.assertEqual(row["forecast_age_hours"], 1.5)


class AlignmentTests(unittest.TestCase):
    def test_average_both_half_hours_and_signed_error(self):
        archive = Archive([forecast(2000)], [actual(1000), actual(2000, "2026-01-16T00:30:00Z")])
        row = archive.day("2026-01-15")["series"][0]
        self.assertEqual(row["actual_mw"], 1500)
        self.assertEqual(row["error_mw"], 500)
        self.assertEqual(row["actual_half_hours"], 2)

    def test_one_half_hour_does_not_become_whole_hour(self):
        archive = Archive([forecast(2000)], [actual(1000)])
        day = archive.day("2026-01-15")
        self.assertIsNone(day["series"][0]["actual_mw"])
        self.assertIsNone(day["series"][0]["error_mw"])
        self.assertEqual(day["summary"]["actual_half_hours"], 1)
        self.assertIsNone(day["summary"]["actual_energy_gwh"])

    def test_ignore_other_fuels(self):
        archive = Archive([], [actual(3000, fuel="CCGT"), actual(2000, "2026-01-16T00:30:00Z")])
        self.assertIsNone(archive.day("2026-01-15")["series"][0]["actual_mw"])

    def test_latest_outturn_revision(self):
        archive = Archive([], [actual(1000), actual(3000, publication="2026-01-17T00:00:00Z"),
                               actual(2000, "2026-01-16T00:30:00Z")])
        self.assertEqual(archive.day("2026-01-15")["series"][0]["actual_mw"], 2500)

    def test_nonfinite_data_is_missing(self):
        archive = Archive([forecast(float("nan"))], [actual(float("inf"))])
        row = archive.day("2026-01-15")["series"][0]
        self.assertIsNone(row["forecast_mw"])
        self.assertIsNone(row["actual_mw"])

    def test_actual_conflicting_revision(self):
        with self.assertRaisesRegex(ValueError, "Conflicting outturn"):
            Archive([], [actual(1000), actual(2000)])


class MetricsTests(unittest.TestCase):
    @staticmethod
    def rows():
        return [{"forecast_mw": 3000, "actual_mw": 2000, "error_mw": 1000, "actual_half_hours": 2},
                {"forecast_mw": 1000, "actual_mw": 3000, "error_mw": -2000, "actual_half_hours": 2}]

    def test_exact_metrics(self):
        result = metrics(self.rows())
        self.assertEqual(result["mae_mw"], 1500)
        self.assertAlmostEqual(result["rmse_mw"], math.sqrt(2500000))
        self.assertEqual(result["bias_mw"], -500)
        self.assertEqual(result["nmae_pct"], 60)
        self.assertEqual(result["max_absolute_error_mw"], 2000)
        self.assertEqual(result["p90_absolute_error_mw"], 2000)

    def test_energy_units_and_hour_duration(self):
        result = metrics(self.rows())
        self.assertEqual(result["forecast_energy_gwh"], 4)
        self.assertEqual(result["actual_energy_gwh"], 5)
        self.assertEqual(result["net_error_gwh"], -1)

    def test_empty_no_divide_by_zero(self):
        result = metrics([])
        self.assertIsNone(result["mae_mw"])
        self.assertIsNone(result["rmse_mw"])
        self.assertEqual(result["paired_coverage_pct"], 0)

    def test_zero_generation_is_real_not_missing(self):
        result = metrics([{"forecast_mw": 0, "actual_mw": 0, "error_mw": 0, "actual_half_hours": 2}])
        self.assertEqual(result["mae_mw"], 0)
        self.assertEqual(result["paired_hours"], 1)
        self.assertIsNone(result["nmae_pct"])

    def test_missing_values_excluded_and_totals_suppressed(self):
        rows = self.rows() + [{"forecast_mw": None, "actual_mw": 4000, "error_mw": None, "actual_half_hours": 2}]
        result = metrics(rows)
        self.assertEqual(result["mae_mw"], 1500)
        self.assertEqual(result["paired_hours"], 2)
        self.assertAlmostEqual(result["paired_coverage_pct"], 200 / 3)
        self.assertIsNone(result["forecast_energy_gwh"])
        self.assertIsNone(result["net_error_gwh"])


class ValidationTests(unittest.TestCase):
    def test_january_boundary_delivery(self):
        archive = Archive([], [])
        self.assertEqual(archive.day("2026-01-01")["delivery_date"], "2026-01-02")
        self.assertEqual(archive.day("2026-01-31")["delivery_date"], "2026-02-01")

    def test_outside_scope_rejected(self):
        for value in ("2025-12-31", "2026-02-01", "2026-01-32", "garbage", "2026-01-01<script>"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_inputs(value, "09:00")

    def test_invalid_time_rejected(self):
        for value in ("24:00", "09:60", "9:00", "09:00:00", "", "xx"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_inputs("2026-01-01", value)

    def test_naive_source_timestamp_rejected(self):
        with self.assertRaises(ValueError):
            timestamp("2026-01-01T00:00:00")

    def test_csv_preserves_missing_and_real_zero(self):
        row = {"start_time": "2026-01-16T00:00:00Z", "forecast_mw": 0, "actual_mw": None}
        csv = csv_payload([row]).decode()
        self.assertIn("2026-01-16T00:00:00Z,0,,", csv)
        self.assertTrue(csv.startswith("start_time,forecast_mw,actual_mw"))


class RealArchiveIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.archive = get_archive()

    def test_source_counts(self):
        self.assertEqual(len(self.archive.actuals), 1488)
        self.assertEqual(sum(file["records"] for file in self.archive.manifest["files"]), 23680)

    def test_reproducible_reference_day(self):
        day = self.archive.day("2026-01-15")
        self.assertEqual(day["summary"]["mae_mw"], 782.75)
        self.assertEqual(day["summary"]["actual_energy_gwh"], 181.883)
        self.assertEqual(day["summary"]["paired_hours"], 24)

    def test_month_pools_errors_not_daily_rmse(self):
        result = self.archive.month()
        self.assertEqual(len(result["days"]), 31)
        self.assertEqual(result["summary"]["paired_hours"], 744)
        self.assertAlmostEqual(result["summary"]["mae_mw"], 2038.9126344086021)
        hourly = [row["error_mw"] for i in range(31) for row in self.archive.day(f"2026-01-{i + 1:02d}")["series"] if row["error_mw"] is not None]
        self.assertAlmostEqual(result["summary"]["rmse_mw"], math.sqrt(sum(e * e for e in hourly) / len(hourly)))

    def test_all_ui_cutoffs_all_january_days_are_leak_free(self):
        for hour in range(24):
            for minute in (0, 30):
                cutoff = f"{hour:02d}:{minute:02d}"
                for day_number in range(1, 32):
                    day = self.archive.day(f"2026-01-{day_number:02d}", cutoff)
                    self.assertEqual(len(day["series"]), 24)
                    for row in day["series"]:
                        if row["forecast_published_at"]:
                            self.assertLessEqual(timestamp(row["forecast_published_at"]), timestamp(day["decision_time"]))

    def test_cutoff_changes_real_forecast(self):
        morning = self.archive.day("2026-01-15", "00:00")["series"]
        afternoon = self.archive.day("2026-01-15", "16:00")["series"]
        self.assertNotEqual([row["forecast_mw"] for row in morning], [row["forecast_mw"] for row in afternoon])


if __name__ == "__main__":
    unittest.main()
