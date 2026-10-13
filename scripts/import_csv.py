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
    primary_key: tuple[str, ...] = ()


FILE_SPECS = {
    "out_transactions_clean.csv": ImportSpec(
        table="transactions",
        rename={"land": "land_sqm", "floor": "floor_sqm", "area": "area_sqm"},
        drop=("file", "y"),
    ),
    "out_sdp_schemes.csv": ImportSpec(
        table="sdp_schemes",
        rename={"file": "district"},
        primary_key=("township", "scheme"),
    ),
    "mhpi_quarterly.csv": ImportSpec(
        table="mhpi_quarterly",
        rename={"table": "source_table", "index": "index_value"},
        primary_key=("source_table", "series", "quarter"),
    ),
    "cost_assumptions.csv": ImportSpec(
        table="cost_assumptions",
        primary_key=("item",),
    ),
    "out_fairness.csv": ImportSpec(
        table="fairness_curve",
        primary_key=("plan", "cost", "buffer"),
    ),
    "out_backtest.csv": ImportSpec(
        table="backtest_results",
        primary_key=("variant", "scope"),
    ),
}


def validate_primary_keys(frame: pd.DataFrame, spec: ImportSpec) -> None:
    if not spec.primary_key:
        return

    key_columns = list(spec.primary_key)
    duplicate_rows = frame.loc[
        frame.duplicated(subset=key_columns, keep=False),
        key_columns,
    ].drop_duplicates()
    if duplicate_rows.empty:
        return

    duplicate_keys = ", ".join(
        f"({', '.join(repr(value) for value in row)})"
        for row in duplicate_rows.head(5).itertuples(index=False, name=None)
    )
    raise SystemExit(
        f"{spec.table}: duplicate primary-key values for "
        f"({', '.join(spec.primary_key)}): {duplicate_keys}"
    )


def load_records(path: Path, spec: ImportSpec) -> list[dict[str, object]]:
    frame = pd.read_csv(path)
    frame = frame.rename(columns=spec.rename).drop(
        columns=list(spec.drop),
        errors="ignore",
    )
    validate_primary_keys(frame, spec)
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

        completed = 0
        if not records:
            print(f"{spec.table}: 0/0")
        for batch in batched(records):
            client.table(spec.table).upsert(batch).execute()
            completed += len(batch)
            print(f"{spec.table}: {completed}/{len(records)}")

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

    import_directory(args.dir, client)


if __name__ == "__main__":
    main()

