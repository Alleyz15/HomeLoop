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
    integer_columns: tuple[str, ...] = ()
    requires_empty: bool = False


FILE_SPECS = {
    "out_transactions_clean.csv": ImportSpec(
        table="transactions",
        rename={"land": "land_sqm", "floor": "floor_sqm", "area": "area_sqm"},
        drop=("file", "y"),
        requires_empty=True,
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
    "sdp_launches.csv": ImportSpec(
        table="sdp_launches",
        primary_key=("project",),
        integer_columns=("units",),
    ),
    "backtest_ratios.csv": ImportSpec(
        table="backtest_ratios",
        requires_empty=True,
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
    for column in spec.integer_columns:
        if column not in normalized:
            continue
        normalized[column] = pd.Series(
            [int(value) if value is not None else None for value in normalized[column]],
            index=normalized.index,
            dtype=object,
        )
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


def ensure_table_empty(client: Any, table: str) -> None:
    response = client.table(table).select("id").limit(1).execute()
    if response.data:
        raise RuntimeError(
            f"{table} table is not empty; clear it before importing this identity-keyed file again"
        )


def parse_only(value: str) -> tuple[str, ...]:
    filenames = tuple(part.strip() for part in value.split(","))
    if not filenames or any(not filename for filename in filenames):
        raise SystemExit("--only must contain comma-separated CSV filenames")

    unknown = [filename for filename in filenames if filename not in FILE_SPECS]
    if unknown:
        raise SystemExit(f"unknown --only file(s): {', '.join(unknown)}")

    return filenames


def import_directory(
    directory: Path,
    client: Any,
    only: Sequence[str] | None = None,
) -> dict[str, int]:
    counts: dict[str, int] = {}
    selected = set(only) if only is not None else None
    imports: list[tuple[ImportSpec, list[dict[str, object]]]] = []

    for filename, spec in FILE_SPECS.items():
        if selected is not None and filename not in selected:
            continue

        path = directory / filename
        if not path.is_file():
            if selected is not None:
                raise FileNotFoundError(f"selected import file not found: {path}")
            continue

        records = load_records(path, spec)
        imports.append((spec, records))

    for spec, records in imports:
        if spec.requires_empty and records:
            if spec.table == "transactions":
                ensure_transactions_empty(client)
            else:
                ensure_table_empty(client, spec.table)

    for spec, records in imports:
        completed = 0
        if not records:
            print(f"{spec.table}: 0/0")
        for batch in batched(records):
            conflict_target = ",".join(spec.primary_key) or None
            client.table(spec.table).upsert(
                batch,
                on_conflict=conflict_target,
            ).execute()
            completed += len(batch)
            print(f"{spec.table}: {completed}/{len(records)}")

        counts[spec.table] = len(records)

    return counts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import HomeLoop reference CSVs")
    parser.add_argument("--dir", type=Path, required=True, help="Directory of processed CSV files")
    parser.add_argument(
        "--only",
        type=parse_only,
        help="Comma-separated CSV filenames to import",
    )
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

    import_directory(args.dir, client, only=args.only)


if __name__ == "__main__":
    main()

