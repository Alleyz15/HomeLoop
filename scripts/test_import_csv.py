import csv
import io
import tempfile
import unittest
from collections import defaultdict
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace

from scripts.import_csv import (
    FILE_SPECS,
    batched,
    import_directory,
    load_records,
    parse_only,
)


class InMemoryQuery:
    def __init__(self, client: "InMemorySupabase", table: str) -> None:
        self.client = client
        self.table = table
        self.operation = ""

    def upsert(
        self,
        rows: list[dict[str, object]],
        on_conflict: str | None = None,
    ) -> "InMemoryQuery":
        self.operation = "upsert"
        self.client.rows[self.table].extend(rows)
        self.client.batch_sizes[self.table].append(len(rows))
        self.client.conflict_targets[self.table].append(on_conflict)
        return self

    def select(self, _columns: str) -> "InMemoryQuery":
        self.operation = "select"
        return self

    def limit(self, _count: int) -> "InMemoryQuery":
        return self

    def execute(self) -> SimpleNamespace | None:
        if self.operation == "select":
            return SimpleNamespace(data=self.client.rows[self.table][:1])
        return None


class InMemorySupabase:
    def __init__(self) -> None:
        self.rows: defaultdict[str, list[dict[str, object]]] = defaultdict(list)
        self.batch_sizes: defaultdict[str, list[int]] = defaultdict(list)
        self.conflict_targets: defaultdict[str, list[str | None]] = defaultdict(list)

    def table(self, table: str) -> InMemoryQuery:
        return InMemoryQuery(self, table)


class ImportCsvTests(unittest.TestCase):
    def test_every_expected_file_maps_to_its_target_table(self) -> None:
        self.assertEqual(
            {name: spec.table for name, spec in FILE_SPECS.items()},
            {
                "out_transactions_clean.csv": "transactions",
                "out_sdp_schemes.csv": "sdp_schemes",
                "mhpi_quarterly.csv": "mhpi_quarterly",
                "cost_assumptions.csv": "cost_assumptions",
                "out_fairness.csv": "fairness_curve",
                "out_backtest.csv": "backtest_results",
                "sdp_launches.csv": "sdp_launches",
                "backtest_ratios.csv": "backtest_ratios",
            },
        )

    def test_new_reference_files_use_the_expected_import_contracts(self) -> None:
        self.assertEqual(FILE_SPECS["sdp_launches.csv"].primary_key, ("project",))
        self.assertEqual(FILE_SPECS["sdp_launches.csv"].integer_columns, ("units",))
        self.assertEqual(FILE_SPECS["backtest_ratios.csv"].primary_key, ())

    def test_nullable_launch_units_are_normalized_to_integers(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "sdp_launches.csv"
            self._write_csv(
                path,
                [
                    {"tier": "selling", "project": "One", "units": "52"},
                    {"tier": "upcoming", "project": "Two", "units": ""},
                ],
            )

            records = load_records(path, FILE_SPECS[path.name])

        self.assertEqual(records[0]["units"], 52)
        self.assertIsInstance(records[0]["units"], int)
        self.assertIsNone(records[1]["units"])

    def test_project_is_the_conflict_target_for_launch_upserts(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            self._write_csv(
                directory / "sdp_launches.csv",
                [{"tier": "selling", "project": "Project One"}],
            )
            client = InMemorySupabase()

            import_directory(
                directory,
                client,
                only=("sdp_launches.csv",),
            )

        self.assertEqual(client.conflict_targets["sdp_launches"], ["project"])

    def test_only_parses_comma_separated_filenames(self) -> None:
        self.assertEqual(
            parse_only("sdp_launches.csv, backtest_ratios.csv"),
            ("sdp_launches.csv", "backtest_ratios.csv"),
        )

    def test_only_rejects_unknown_and_empty_filenames(self) -> None:
        for value in ("unknown.csv", "sdp_launches.csv,,backtest_ratios.csv"):
            with self.subTest(value=value), self.assertRaises(SystemExit):
                parse_only(value)

    def test_transaction_columns_are_renamed_dropped_and_null_normalized(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            path = Path(temporary_directory) / "out_transactions_clean.csv"
            self._write_csv(
                path,
                [
                    {
                        "ptype": "Terrace",
                        "district": "District",
                        "mukim": "Mukim",
                        "scheme": "Scheme",
                        "road": "Road",
                        "tenure": "Freehold",
                        "land": "",
                        "floor": "120",
                        "level": "",
                        "price": "",
                        "ym": "2021.58",
                        "area": "100",
                        "file": "source.xlsx",
                        "y": "ignored",
                        "yr": "2021",
                        "township": "Township",
                        "is_sdp": "True",
                        "likely_primary": "False",
                    }
                ],
            )

            record = load_records(path, FILE_SPECS[path.name])[0]

        self.assertIsNone(record["land_sqm"])
        self.assertEqual(record["floor_sqm"], 120)
        self.assertEqual(record["area_sqm"], 100)
        self.assertNotIn("land", record)
        self.assertNotIn("floor", record)
        self.assertNotIn("area", record)
        self.assertNotIn("file", record)
        self.assertNotIn("y", record)

    def test_scheme_and_mhpi_columns_are_renamed(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            scheme_path = directory / "out_sdp_schemes.csv"
            mhpi_path = directory / "mhpi_quarterly.csv"
            self._write_csv(
                scheme_path,
                [{"township": "Township", "file": "District", "scheme": "Scheme", "n": "1"}],
            )
            self._write_csv(
                mhpi_path,
                [{"table": "Source", "series": "Series", "quarter": "2021.25", "index": "100"}],
            )

            scheme = load_records(scheme_path, FILE_SPECS[scheme_path.name])[0]
            mhpi = load_records(mhpi_path, FILE_SPECS[mhpi_path.name])[0]

        self.assertEqual(scheme["district"], "District")
        self.assertNotIn("file", scheme)
        self.assertEqual(mhpi["source_table"], "Source")
        self.assertEqual(mhpi["index_value"], 100)
        self.assertNotIn("table", mhpi)
        self.assertNotIn("index", mhpi)

    def test_batches_are_limited_to_one_thousand_records(self) -> None:
        self.assertEqual(
            [len(batch) for batch in batched(list(range(2001)))],
            [1000, 1000, 1],
        )

    def test_present_files_are_upserted_and_missing_files_are_skipped(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            path = directory / "cost_assumptions.csv"
            self._write_csv(
                path,
                [
                    {
                        "item": f"item-{index}",
                        "pct_low": "0",
                        "pct_high": "0",
                        "source": "Source",
                    }
                    for index in range(1001)
                ],
            )
            client = InMemorySupabase()
            output = io.StringIO()

            with redirect_stdout(output):
                counts = import_directory(directory, client)

        self.assertEqual(counts, {"cost_assumptions": 1001})
        self.assertEqual(len(client.rows["cost_assumptions"]), 1001)
        self.assertEqual(client.batch_sizes["cost_assumptions"], [1000, 1])
        self.assertEqual(
            output.getvalue().splitlines(),
            ["cost_assumptions: 1000/1001", "cost_assumptions: 1001/1001"],
        )

    def test_each_reference_table_rejects_duplicate_primary_keys_before_upsert(self) -> None:
        fixtures = {
            "out_sdp_schemes.csv": [
                {"township": "Township", "file": "District A", "scheme": "Scheme", "n": "1"},
                {"township": "Township", "file": "District B", "scheme": "Scheme", "n": "2"},
            ],
            "mhpi_quarterly.csv": [
                {"table": "Table 1.1", "series": "All House", "quarter": "2021.25", "index": "100"},
                {"table": "Table 1.1", "series": "All House", "quarter": "2021.25", "index": "101"},
            ],
            "cost_assumptions.csv": [
                {"item": "legal", "pct_low": "1", "pct_high": "2", "source": "A"},
                {"item": "legal", "pct_low": "2", "pct_high": "3", "source": "B"},
            ],
            "out_fairness.csv": [
                {"plan": "A", "cost": "1", "buffer": "2", "sdp_loss_share": "3", "owner_pct_market": "4"},
                {"plan": "A", "cost": "1", "buffer": "2", "sdp_loss_share": "5", "owner_pct_market": "6"},
            ],
            "out_backtest.csv": [
                {"variant": "base", "scope": "all", "n": "1", "mdape": "2", "within10": "3", "within20": "4"},
                {"variant": "base", "scope": "all", "n": "5", "mdape": "6", "within10": "7", "within20": "8"},
            ],
        }

        for filename, rows in fixtures.items():
            with self.subTest(filename=filename), tempfile.TemporaryDirectory() as temporary_directory:
                directory = Path(temporary_directory)
                self._write_csv(directory / filename, rows)
                client = InMemorySupabase()

                with self.assertRaisesRegex(SystemExit, "duplicate primary-key values"):
                    import_directory(directory, client)

                self.assertEqual(client.batch_sizes[FILE_SPECS[filename].table], [])

    def test_duplicate_error_lists_only_the_first_five_keys(self) -> None:
        rows: list[dict[str, str]] = []
        for index in range(1, 7):
            for index_value in ("100", "101"):
                rows.append(
                    {
                        "table": f"Table {index}",
                        "series": "All House",
                        "quarter": "2021.25",
                        "index": index_value,
                    }
                )

        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            self._write_csv(directory / "mhpi_quarterly.csv", rows)

            with self.assertRaises(SystemExit) as raised:
                import_directory(directory, InMemorySupabase())

        message = str(raised.exception)
        for index in range(1, 6):
            self.assertIn(f"Table {index}", message)
        self.assertNotIn("Table 6", message)

    def test_transaction_import_rejects_a_nonempty_table_before_upsert(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            path = directory / "out_transactions_clean.csv"
            self._write_csv(path, [{"price": "500000"}])
            client = InMemorySupabase()
            client.rows["transactions"].append({"id": 1})

            with self.assertRaisesRegex(RuntimeError, "transactions table is not empty"):
                import_directory(directory, client)

        self.assertEqual(client.batch_sizes["transactions"], [])

    def test_backtest_ratio_import_rejects_a_nonempty_table(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            path = directory / "backtest_ratios.csv"
            self._write_csv(
                path,
                [
                    {
                        "township": "Township",
                        "scheme": "Scheme",
                        "ptype": "Terrace",
                        "tenure": "Freehold",
                        "land_sqm": "100",
                        "floor_sqm": "120",
                        "ym": "2026.5",
                        "actual_price": "500000",
                        "predicted_price": "510000",
                        "ratio": "0.980392",
                    }
                ],
            )
            client = InMemorySupabase()
            client.rows["backtest_ratios"].append({"id": 1})

            with self.assertRaisesRegex(RuntimeError, "backtest_ratios table is not empty"):
                import_directory(
                    directory,
                    client,
                    only=("backtest_ratios.csv",),
                )

        self.assertEqual(client.batch_sizes["backtest_ratios"], [])

    def test_only_imports_selected_files_and_does_not_check_transactions(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            self._write_csv(
                directory / "out_transactions_clean.csv",
                [{"price": "500000"}],
            )
            self._write_csv(
                directory / "sdp_launches.csv",
                [{"tier": "selling", "project": "Project One"}],
            )
            self._write_csv(
                directory / "backtest_ratios.csv",
                [
                    {
                        "township": "Township",
                        "scheme": "Scheme",
                        "ptype": "Terrace",
                        "tenure": "Freehold",
                        "land_sqm": "100",
                        "floor_sqm": "120",
                        "ym": "2026.5",
                        "actual_price": "500000",
                        "predicted_price": "510000",
                        "ratio": "0.980392",
                    }
                ],
            )
            client = InMemorySupabase()
            client.rows["transactions"].append({"id": 1})

            counts = import_directory(
                directory,
                client,
                only=("sdp_launches.csv", "backtest_ratios.csv"),
            )

        self.assertEqual(counts, {"sdp_launches": 1, "backtest_ratios": 1})
        self.assertEqual(client.batch_sizes["transactions"], [])
        self.assertEqual(client.batch_sizes["sdp_launches"], [1])
        self.assertEqual(client.batch_sizes["backtest_ratios"], [1])

    def test_only_rejects_a_selected_file_that_is_missing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            with self.assertRaisesRegex(FileNotFoundError, "sdp_launches.csv"):
                import_directory(
                    Path(temporary_directory),
                    InMemorySupabase(),
                    only=("sdp_launches.csv",),
                )

    def test_only_preflights_every_file_before_the_first_upsert(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            self._write_csv(
                directory / "sdp_launches.csv",
                [{"tier": "selling", "project": "Project One"}],
            )
            client = InMemorySupabase()

            with self.assertRaisesRegex(FileNotFoundError, "backtest_ratios.csv"):
                import_directory(
                    directory,
                    client,
                    only=("sdp_launches.csv", "backtest_ratios.csv"),
                )

        self.assertEqual(client.batch_sizes["sdp_launches"], [])

    @staticmethod
    def _write_csv(path: Path, rows: list[dict[str, str]]) -> None:
        with path.open("w", encoding="utf-8", newline="") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)


if __name__ == "__main__":
    unittest.main()

