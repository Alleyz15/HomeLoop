"""Verify the signed-in paths the web app depends on, against a live project.

The web app's owner journey is behind authentication, so the role lookup, the
`valuation_requests` insert and the row-level security rules around them cannot
be exercised by the offline test suites. This script checks them with real
sessions for the two demo accounts.

It reads every credential from the environment and prints none of them. It
creates one `valuation_requests` row as the owner and deletes it again.

    export SUPABASE_URL=...
    export SUPABASE_ANON_KEY=...
    export DEMO_OWNER_PASSWORD=...
    export DEMO_ADMIN_PASSWORD=...
    python scripts/verify_auth.py

Exits non-zero when any check fails, so it can gate a deploy.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass

OWNER_EMAIL = "owner.demo@homeloop.my"
ADMIN_EMAIL = "admin.demo@homeloop.my"
REQUIRED_ENV = (
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "DEMO_OWNER_PASSWORD",
    "DEMO_ADMIN_PASSWORD",
)
TIMEOUT_SECONDS = 30


@dataclass(frozen=True)
class Result:
    passed: bool
    label: str


def read_environment() -> dict[str, str]:
    """Collect the required variables, naming all of the missing ones at once."""

    missing = [name for name in REQUIRED_ENV if not os.environ.get(name)]
    if missing:
        raise SystemExit(f"missing environment variables: {', '.join(missing)}")
    return {name: os.environ[name] for name in REQUIRED_ENV}


def summarize(results: list[Result]) -> tuple[int, list[str]]:
    """Return the passing count and the labels that failed."""

    return (
        sum(1 for item in results if item.passed),
        [item.label for item in results if not item.passed],
    )


class Project:
    """Minimal REST client for one Supabase project."""

    def __init__(self, url: str, anon_key: str) -> None:
        self.url = url.rstrip("/")
        self.anon_key = anon_key

    def call(
        self,
        method: str,
        path: str,
        token: str | None = None,
        body: object | None = None,
        prefer: str | None = None,
    ) -> tuple[int, object]:
        request = urllib.request.Request(
            f"{self.url}{path}",
            method=method,
            data=json.dumps(body).encode() if body is not None else None,
        )
        request.add_header("apikey", self.anon_key)
        request.add_header("Authorization", f"Bearer {token or self.anon_key}")
        request.add_header("Content-Type", "application/json")
        if prefer:
            request.add_header("Prefer", prefer)

        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                text = response.read().decode()
                return response.status, json.loads(text) if text.strip() else None
        except urllib.error.HTTPError as error:
            text = error.read().decode()
            try:
                return error.code, json.loads(text)
            except json.JSONDecodeError:
                return error.code, text

    def sign_in(self, email: str, password: str) -> tuple[str | None, str | None]:
        status, body = self.call(
            "POST",
            "/auth/v1/token?grant_type=password",
            body={"email": email, "password": password},
        )
        if status != 200 or not isinstance(body, dict):
            return None, None
        return body.get("access_token"), (body.get("user") or {}).get("id")

    def role_of(self, user_id: str, token: str) -> str | None:
        _, rows = self.call(
            "GET", f"/rest/v1/profiles?select=role&id=eq.{user_id}", token
        )
        if isinstance(rows, list) and rows:
            return rows[0].get("role")
        return None


def sample_valuation(user_id: str) -> dict[str, object]:
    """The exact shape the web app inserts after a successful valuation."""

    return {
        "user_id": user_id,
        "road_norm": "JLN BIRAI U8/69",
        "scheme": "BUKIT JELUTONG, SHAH ALAM",
        "ptype": "2 - 2 1/2 Storey Terraced",
        "unit_position": "intermediate",
        "land_sqm": 178,
        "floor_sqm": 190,
        "tenure": "Freehold",
        "estimate": 882461.54,
        "low": 821909.09,
        "high": 962250.0,
        "confidence": "high",
        "comps": [
            {
                "date": "2023-12",
                "land_sqm": 178,
                "floor_sqm": 190,
                "price": 780000,
                "price_per_sqm": 4105.26,
                "distance": 0.05,
            }
        ],
    }


def main() -> int:
    env = read_environment()
    project = Project(env["SUPABASE_URL"], env["SUPABASE_ANON_KEY"])
    results: list[Result] = []

    def check(passed: bool, label: str, detail: str = "") -> bool:
        results.append(Result(passed, label))
        print(f"  [{'PASS' if passed else 'FAIL'}] {label}" + (f" -- {detail}" if detail else ""))
        return passed

    print("1. Sign in and read the role")
    owner_token, owner_id = project.sign_in(OWNER_EMAIL, env["DEMO_OWNER_PASSWORD"])
    if not check(bool(owner_token), f"{OWNER_EMAIL} can sign in"):
        print("\nRun scripts/create_demo_users.py first.")
        return 1

    admin_token, admin_id = project.sign_in(ADMIN_EMAIL, env["DEMO_ADMIN_PASSWORD"])
    check(bool(admin_token), f"{ADMIN_EMAIL} can sign in")

    owner_role = project.role_of(str(owner_id), str(owner_token))
    check(owner_role == "owner", "owner's role is 'owner'", f"got {owner_role!r}")

    if admin_token and admin_id:
        admin_role = project.role_of(admin_id, admin_token)
        # create_demo_users.py does not check that its role update matched a
        # row, so a missing profile would leave the admin account as an owner
        # while the script still reported success.
        check(admin_role == "admin", "admin's role is 'admin'", f"got {admin_role!r}")

    print("\n2. A homeowner cannot promote themselves")
    status, body = project.call(
        "PATCH",
        f"/rest/v1/profiles?id=eq.{owner_id}",
        owner_token,
        {"role": "admin"},
        prefer="return=representation",
    )
    escalated = status < 300 and isinstance(body, list) and body and body[0].get("role") == "admin"
    check(not escalated, "role escalation is rejected", f"HTTP {status}")
    if escalated:
        project.call(
            "PATCH", f"/rest/v1/profiles?id=eq.{owner_id}", owner_token, {"role": "owner"}
        )

    print("\n3. The valuation insert the web app performs")
    status, body = project.call(
        "POST",
        "/rest/v1/valuation_requests",
        owner_token,
        sample_valuation(str(owner_id)),
        prefer="return=representation",
    )
    row_id = body[0]["id"] if status < 300 and isinstance(body, list) and body else None
    check(bool(row_id), "owner can insert a valuation", f"HTTP {status}")

    if row_id:
        print("\n4. Reading back, and isolation between accounts")
        _, rows = project.call(
            "GET",
            f"/rest/v1/valuation_requests?select=confidence,comps&id=eq.{row_id}",
            owner_token,
        )
        found = isinstance(rows, list) and rows
        check(bool(found), "owner can read their own valuation")
        if found:
            check(rows[0]["confidence"] == "high", "confidence passed its CHECK constraint")
            check(
                isinstance(rows[0]["comps"], list) and bool(rows[0]["comps"]),
                "comps round-tripped as jsonb",
            )

        forged_owner = admin_id or owner_id
        status, forged = project.call(
            "POST",
            "/rest/v1/valuation_requests",
            owner_token,
            {**sample_valuation(str(forged_owner))},
            prefer="return=representation",
        )
        accepted = status < 300
        check(not accepted, "owner cannot insert a row owned by someone else", f"HTTP {status}")
        if accepted and isinstance(forged, list) and forged:
            project.call(
                "DELETE", f"/rest/v1/valuation_requests?id=eq.{forged[0]['id']}", owner_token
            )

        if admin_token:
            _, rows = project.call(
                "GET", f"/rest/v1/valuation_requests?select=id&id=eq.{row_id}", admin_token
            )
            check(
                isinstance(rows, list) and bool(rows),
                "admin can read the owner's valuation",
            )

        print("\n5. Cleanup")
        status, _ = project.call(
            "DELETE", f"/rest/v1/valuation_requests?id=eq.{row_id}", owner_token
        )
        check(status < 300, "test row removed", f"HTTP {status}")

    passed, failures = summarize(results)
    print(f"\n{passed}/{len(results)} checks passed")
    if failures:
        print("Failed:")
        for label in failures:
            print(f"  - {label}")
        return 1
    print("Every signed-in path behaves as the web app assumes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
