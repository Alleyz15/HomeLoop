import pytest

from verify_auth import Project, Result, read_environment, sample_valuation, summarize


def test_summarize_counts_passes_and_names_failures() -> None:
    results = [
        Result(True, "first"),
        Result(False, "second"),
        Result(True, "third"),
        Result(False, "fourth"),
    ]

    passed, failures = summarize(results)

    assert passed == 2
    assert failures == ["second", "fourth"]


def test_summarize_handles_no_results() -> None:
    assert summarize([]) == (0, [])


def test_read_environment_names_every_missing_variable(monkeypatch) -> None:
    for name in ("SUPABASE_URL", "SUPABASE_ANON_KEY", "DEMO_OWNER_PASSWORD", "DEMO_ADMIN_PASSWORD"):
        monkeypatch.delenv(name, raising=False)

    with pytest.raises(SystemExit) as raised:
        read_environment()

    message = str(raised.value)
    assert "SUPABASE_URL" in message
    assert "DEMO_ADMIN_PASSWORD" in message


def test_read_environment_returns_the_values(monkeypatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon")
    monkeypatch.setenv("DEMO_OWNER_PASSWORD", "owner-pw")
    monkeypatch.setenv("DEMO_ADMIN_PASSWORD", "admin-pw")

    assert read_environment()["SUPABASE_URL"] == "https://example.supabase.co"


def test_project_strips_a_trailing_slash_from_the_url() -> None:
    assert Project("https://example.supabase.co/", "anon").url == (
        "https://example.supabase.co"
    )


def test_sample_valuation_matches_the_stored_contract() -> None:
    """Mirrors what apps/web inserts, including the constrained columns."""

    row = sample_valuation("user-1")

    assert row["user_id"] == "user-1"
    assert row["unit_position"] in {"intermediate", "corner_end", "custom"}
    assert row["confidence"] in {"high", "medium", "low"}
    assert isinstance(row["comps"], list) and row["comps"]
