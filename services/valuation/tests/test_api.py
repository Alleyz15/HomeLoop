import inspect
import secrets
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app import config, main


class ValuationApiSecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        config.get_settings.cache_clear()
        get_client = getattr(config, "get_supabase_client", None)
        if get_client is not None:
            get_client.cache_clear()

    def test_health_is_sync_and_does_not_create_supabase_client(self) -> None:
        self.assertFalse(inspect.iscoroutinefunction(main.health))

        with patch.object(
            main,
            "get_supabase_client",
            side_effect=AssertionError("health must not create a Supabase client"),
            create=True,
        ):
            self.assertEqual(main.health(), {"status": "ok"})

    def test_settings_contain_only_the_required_secret_names(self) -> None:
        self.assertEqual(
            set(config.Settings.model_fields),
            {"supabase_url", "supabase_anon_key", "internal_api_key"},
        )
        self.assertNotIn("supabase_service_role_key", config.Settings.model_fields)

    def test_supabase_client_provider_is_lazy(self) -> None:
        self.assertTrue(hasattr(config, "get_supabase_client"))
        self.assertEqual(config.get_supabase_client.cache_info().currsize, 0)

    def test_missing_internal_key_is_rejected(self) -> None:
        settings = config.Settings(internal_api_key="expected", _env_file=None)

        with self.assertRaises(HTTPException) as raised:
            main.require_internal_key(settings, None)

        self.assertEqual(raised.exception.status_code, 401)

    def test_wrong_internal_key_is_rejected_with_constant_time_comparison(self) -> None:
        settings = config.Settings(internal_api_key="expected", _env_file=None)

        with patch.object(secrets, "compare_digest", return_value=False) as compare:
            with self.assertRaises(HTTPException) as raised:
                main.require_internal_key(settings, "wrong")

        compare.assert_called_once_with("wrong", "expected")
        self.assertEqual(raised.exception.status_code, 401)

    def test_correct_internal_key_is_accepted(self) -> None:
        settings = config.Settings(internal_api_key="expected", _env_file=None)

        self.assertIsNone(main.require_internal_key(settings, "expected"))

    def test_unconfigured_server_key_is_unavailable(self) -> None:
        settings = config.Settings(internal_api_key=None, _env_file=None)

        with self.assertRaises(HTTPException) as raised:
            main.require_internal_key(settings, "anything")

        self.assertEqual(raised.exception.status_code, 503)

    def test_plan_quote_route_uses_internal_key_dependency(self) -> None:
        route = next(route for route in main.app.routes if route.path == "/plans/quote")
        dependency_calls = {
            dependency.call for dependency in route.dependant.dependencies  # type: ignore[attr-defined]
        }

        self.assertIn(main.require_internal_key, dependency_calls)

    def test_cors_middleware_is_not_installed(self) -> None:
        self.assertFalse(
            any(middleware.cls is CORSMiddleware for middleware in main.app.user_middleware)
        )

    def test_only_health_is_publicly_documentable(self) -> None:
        route_paths = {route.path for route in main.app.routes}

        self.assertNotIn("/docs", route_paths)
        self.assertNotIn("/redoc", route_paths)
        self.assertNotIn("/openapi.json", route_paths)


if __name__ == "__main__":
    unittest.main()
