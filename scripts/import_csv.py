import argparse
import os
from collections.abc import Iterator, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, TypeVar

import pandas as pd

T = TypeVar("T")
BATCH_SIZE = 1000


@dataclass(frozen=True)
class ImportSpec:
    table: str
    rename: dict[str, str] = field(default_factory=dict)
    drop: tuple[str, ...] = ()


FILE_SPECS = {
    "out_transactions_clean.csv": ImportSpec(
        table="transactions",
        rename={"land": "land_sqm", "floor": "floor_sqm", "area": "area_sqm"},
        drop=("file", "y"),
    ),
    "out_sdp_schemes.csv": ImportSpec(
        table="sdp_schemes",
        rename={"file": "district"},
    ),
    "mhpi_quarterly.csv": ImportSpec(
        table="mhpi_quarterly",
        rename={"table": "source_table", "index": "index_value"},
    ),
    "cost_assumptions.csv": ImportSpec(table="cost_assumptions"),
    "out_fairness.csv": ImportSpec(table="fairness_curve"),
    "out_backtest.csv": ImportSpec(table="backtest_results"),
}


def load_records(path: Path, spec: ImportSpec) -> list[dict[str, object]]:
    frame = pd.read_csv(path)
    frame = frame.rename(columns=spec.rename).drop(
        columns=list(spec.drop),
        errors="ignore",
    )
    normalized = frame.astype(object).where(pd.notna(frame), None)
    return normalized.to_dict(orient="records")


def batched(records: Sequence[T], size: int = BATCH_SIZE) -> Iterator[list[T]]:
    if size < 1:
        raise ValueError("batch size must be positive")

    for start in range(0, len(records), size):
        yield list(records[start : start + size])


def ensure_transactions_empty(client: Any) -> None:
    response = client.table("transactions").select("id").limit(1).execute()
    if response.data:
        raise RuntimeError(
            "transactions table is not empty; the source CSV has no stable row ID, "
            "so loading it again would create duplicates"
        )


def import_directory(directory: Path, client: Any) -> dict[str, int]:
    counts: dict[str, int] = {}

    for filename, spec in FILE_SPECS.items():
        path = directory / filename
        if not path.is_file():
            continue

        records = load_records(path, spec)
        if spec.table == "transactions" and records:
            ensure_transactions_empty(client)

        for batch in batched(records):
            client.table(spec.table).upsert(batch).execute()

        counts[spec.table] = len(records)

    return counts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import HomeLoop reference CSVs")
    parser.add_argument("--dir", type=Path, required=True, help="Directory of processed CSV files")
    return parser.parse_args()


def required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"{name} is required")
    return value


def main() -> None:
    from supabase import create_client

    args = parse_args()
    client = create_client(
        required_env("SUPABASE_URL"),
        required_env("SUPABASE_SERVICE_ROLE_KEY"),
    )

    for table, count in import_directory(args.dir, client).items():
        print(f"{table}: {count} rows")


if __name__ == "__main__":
    main()

