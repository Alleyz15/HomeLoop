import asyncio
import unittest

from fastapi import HTTPException

from app.config import Settings
from app.main import health, valuate
from app.schemas import ValuationRequest


class ValuationApiTests(unittest.TestCase):
    def test_health_reports_ok(self) -> None:
        self.assertEqual(asyncio.run(health()), {"status": "ok"})

    def test_request_allows_omitted_optional_property_fields(self) -> None:
        request = ValuationRequest(scheme="Example", ptype="Terrace")

        self.assertIsNone(request.land_sqm)
        self.assertIsNone(request.floor_sqm)
        self.assertIsNone(request.tenure)

    def test_valuate_is_explicitly_not_implemented(self) -> None:
        request = ValuationRequest(scheme="Example", ptype="Terrace")

        with self.assertRaises(HTTPException) as raised:
            asyncio.run(valuate(request))

        self.assertEqual(raised.exception.status_code, 501)
        self.assertEqual(raised.exception.detail, "Valuation model not implemented")

    def test_allowed_origins_are_parsed_from_comma_separated_setting(self) -> None:
        settings = Settings(
            allowed_origins="https://one.example, https://two.example",
            _env_file=None,
        )

        self.assertEqual(
            settings.allowed_origins_list,
            ["https://one.example", "https://two.example"],
        )

    def test_blank_allowed_origins_uses_the_local_default(self) -> None:
        settings = Settings(allowed_origins="", _env_file=None)

        self.assertEqual(
            settings.allowed_origins_list,
            ["http://localhost:3000"],
        )


if __name__ == "__main__":
    unittest.main()

