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
LAUNCH_COLUMNS = "id,tier,project,price_from_rm"


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

    def _search_catalog(
        self, column: str, pattern: str, row_limit: int
    ) -> list[dict[str, Any]]:
        response = (
            self.client.table("road_catalog")
            .select(CATALOG_COLUMNS)
            .ilike(column, f"%{pattern}%")
            .order("n_recent_3y", desc=True)
            .limit(row_limit)
            .execute()
        )
        return response.data or []

    def _catalog_rows_for_roads(
        self, road_norms: Iterable[str]
    ) -> list[dict[str, Any]]:
        response = (
            self.client.table("road_catalog")
            .select(CATALOG_COLUMNS)
            .in_("road_norm", sorted(set(road_norms)))
            .order("n_recent_3y", desc=True)
            .execute()
        )
        return response.data or []

    def search_roads(self, query: str, limit: int) -> list[dict[str, Any]]:
        road_query = normalize_road(query).replace("%", "").replace("_", " ")
        rows = self._search_catalog("road_norm", road_query, limit * 10)
        if not rows:
            scheme_query = re.sub(r"\s+", " ", query.strip().upper())
            rows = self._search_catalog("scheme", scheme_query, limit * 10)

        # The ranked page is capped by row, not by road, so a road's rarer
        # property types can fall past the cap. Rank the distinct roads from
        # that page, then refetch every catalog row for the roads we keep so
        # each result lists all of the property types that road really has.
        keys: list[tuple[str, str]] = []
        for row in rows:
            key = (str(row["road_norm"]), str(row["scheme"]))
            if key not in keys:
                keys.append(key)
            if len(keys) == limit:
                break
        if not keys:
            return []

        grouped = {
            (group["road_norm"], group["scheme"]): group
            for group in group_road_rows(
                self._catalog_rows_for_roads(road for road, _ in keys)
            )
        }
        return [grouped[key] for key in keys if key in grouped]

    def catalog_for_road(
        self,
        road_norm: str,
        property_type: str,
        scheme: str | None = None,
    ) -> dict[str, Any] | None:
        query = (
            self.client.table("road_catalog")
            .select(CATALOG_COLUMNS)
            .eq("road_norm", road_norm)
            .eq("ptype", property_type)
        )
        if scheme:
            query = query.eq("scheme", scheme)
        response = query.order("n_total", desc=True).limit(2).execute()
        if not scheme and len(response.data or []) > 1:
            raise ValueError(
                "road_norm matches multiple schemes; select and supply a scheme"
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

    def scheme_lacks_floor_area(self, scheme: str, property_type: str) -> bool:
        """True when a scheme/type has transactions but none record floor area.

        High-rise transactions carry the unit size in land/area and leave floor
        empty, and their road is blank, so they never reach ``road_catalog``.
        This distinguishes that case from a scheme that simply does not exist.
        """

        with_floor = (
            self.client.table("transactions")
            .select("id")
            .eq("scheme", scheme)
            .eq("ptype", property_type)
            .not_.is_("floor_sqm", "null")
            .limit(1)
            .execute()
        )
        if with_floor.data:
            return False

        any_row = (
            self.client.table("transactions")
            .select("id")
            .eq("scheme", scheme)
            .eq("ptype", property_type)
            .limit(1)
            .execute()
        )
        return bool(any_row.data)

    def launch_by_id(self, launch_id: int) -> dict[str, Any] | None:
        response = (
            self.client.table("sdp_launches")
            .select(LAUNCH_COLUMNS)
            .eq("id", launch_id)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None


def get_repository() -> ValuationRepository:
    return ValuationRepository(get_supabase_client())
