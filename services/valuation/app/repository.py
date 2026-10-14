from __future__ import annotations

import re
from collections.abc import Iterable, Mapping
from typing import Any

from supabase import Client

from app.config import get_supabase_client


CATALOG_COLUMNS = (
    "road_norm,scheme,district,is_sdp,ptype,typical_land_sqm,"
    "typical_floor_sqm,typical_share,n_recent_3y,n_total"
)
TRANSACTION_COLUMNS = "id,land_sqm,floor_sqm,price,ym,likely_primary"


def normalize_road(value: str) -> str:
    normalized = re.sub(r"\s+", " ", value.strip().upper())
    return re.sub(r"^(?:JALAN|JLN\.?)\s+", "JLN ", normalized)


def _optional_float(value: object) -> float | None:
    return None if value is None else float(value)


def group_road_rows(rows: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    for row in rows:
        key = (str(row["road_norm"]), str(row["scheme"]))
        if key not in grouped:
            grouped[key] = {
                "road_norm": key[0],
                "scheme": key[1],
                "district": row.get("district"),
                "is_sdp": bool(row.get("is_sdp")),
                "property_types": [],
            }
        grouped[key]["property_types"].append(
            {
                "property_type": str(row["ptype"]),
                "typical_land_sqm": _optional_float(row.get("typical_land_sqm")),
                "typical_floor_sqm": _optional_float(row.get("typical_floor_sqm")),
                "typical_share": _optional_float(row.get("typical_share")),
                "n_recent_3y": int(row.get("n_recent_3y") or 0),
            }
        )
    return list(grouped.values())


class ValuationRepository:
    def __init__(self, client: Client) -> None:
        self.client = client

    def search_roads(self, query: str, limit: int) -> list[dict[str, Any]]:
        road_query = normalize_road(query).replace("%", "").replace("_", " ")
        response = (
            self.client.table("road_catalog")
            .select(CATALOG_COLUMNS)
            .ilike("road_norm", f"%{road_query}%")
            .order("n_recent_3y", desc=True)
            .limit(limit * 10)
            .execute()
        )
        rows = response.data or []
        if not rows:
            scheme_query = re.sub(r"\s+", " ", query.strip().upper())
            response = (
                self.client.table("road_catalog")
                .select(CATALOG_COLUMNS)
                .ilike("scheme", f"%{scheme_query}%")
                .order("n_recent_3y", desc=True)
                .limit(limit * 10)
                .execute()
            )
            rows = response.data or []
        return group_road_rows(rows)[:limit]

    def catalog_for_road(
        self, road_norm: str, property_type: str
    ) -> dict[str, Any] | None:
        response = (
            self.client.table("road_catalog")
            .select(CATALOG_COLUMNS)
            .eq("road_norm", road_norm)
            .eq("ptype", property_type)
            .order("n_total", desc=True)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    def catalog_for_scheme(
        self, scheme: str, property_type: str
    ) -> dict[str, Any] | None:
        response = (
            self.client.table("road_catalog")
            .select(CATALOG_COLUMNS)
            .eq("scheme", scheme)
            .eq("ptype", property_type)
            .order("n_total", desc=True)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    def latest_transaction_ym(self) -> float:
        response = (
            self.client.table("transactions")
            .select("ym")
            .eq("likely_primary", False)
            .order("ym", desc=True)
            .limit(1)
            .execute()
        )
        if not response.data or response.data[0].get("ym") is None:
            raise RuntimeError("No eligible transaction dates are available")
        return float(response.data[0]["ym"])

    def comparable_transactions(
        self, scheme: str, property_type: str
    ) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        page_size = 1000
        offset = 0
        while True:
            response = (
                self.client.table("transactions")
                .select(TRANSACTION_COLUMNS)
                .eq("scheme", scheme)
                .eq("ptype", property_type)
                .eq("likely_primary", False)
                .order("id")
                .range(offset, offset + page_size - 1)
                .execute()
            )
            page = response.data or []
            rows.extend(page)
            if len(page) < page_size:
                return rows
            offset += page_size


def get_repository() -> ValuationRepository:
    return ValuationRepository(get_supabase_client())
