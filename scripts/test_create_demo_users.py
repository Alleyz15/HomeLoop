import io
import unittest
from contextlib import redirect_stdout
from types import SimpleNamespace

from scripts.create_demo_users import provision_demo_users


class FakeProfilesQuery:
    def __init__(self, client: "FakeSupabase") -> None:
        self.client = client
        self.role = ""
        self.user_id = ""

    def update(self, values: dict[str, str]) -> "FakeProfilesQuery":
        self.role = values["role"]
        return self

    def eq(self, column: str, value: str) -> "FakeProfilesQuery":
        if column != "id":
            raise AssertionError(f"unexpected filter column: {column}")
        self.user_id = value
        return self

    def execute(self) -> SimpleNamespace:
        self.client.profile_updates.append((self.user_id, self.role))
        data = [] if self.client.drop_profile_update_result else [{"id": self.user_id}]
        return SimpleNamespace(data=data)


class FakeAdmin:
    def __init__(self, client: "FakeSupabase") -> None:
        self.client = client

    def list_users(self, page: int, per_page: int) -> list[SimpleNamespace]:
        if page != 1 or per_page != 1000:
            raise AssertionError("unexpected pagination")
        return list(self.client.users)

    def create_user(self, values: dict[str, object]) -> SimpleNamespace:
        self.client.created_payloads.append(values)
        user = SimpleNamespace(id=f"created-{len(self.client.created_payloads)}", email=values["email"])
        self.client.users.append(user)
        return SimpleNamespace(user=user)

class FakeSupabase:
    def __init__(
        self,
        users: list[SimpleNamespace] | None = None,
        *,
        drop_profile_update_result: bool = False,
    ) -> None:
        self.users = users or []
        self.created_payloads: list[dict[str, object]] = []
        self.profile_updates: list[tuple[str, str]] = []
        self.drop_profile_update_result = drop_profile_update_result
        self.auth = SimpleNamespace(admin=FakeAdmin(self))

    def table(self, name: str) -> FakeProfilesQuery:
        if name != "profiles":
            raise AssertionError(f"unexpected table: {name}")
        return FakeProfilesQuery(self)


class CreateDemoUsersTests(unittest.TestCase):
    def test_creates_missing_user_skips_existing_user_and_sets_both_roles(self) -> None:
        client = FakeSupabase(
            [SimpleNamespace(id="owner-id", email="owner.demo@homeloop.my")]
        )

        provision_demo_users(client, "owner-secret", "admin-secret")

        self.assertEqual(
            client.created_payloads,
            [
                {
                    "email": "admin.demo@homeloop.my",
                    "password": "admin-secret",
                    "email_confirm": True,
                }
            ],
        )
        self.assertEqual(
            client.profile_updates,
            [("owner-id", "owner"), ("created-1", "admin")],
        )
    def test_output_never_contains_passwords(self) -> None:
        output = io.StringIO()

        with redirect_stdout(output):
            provision_demo_users(FakeSupabase(), "owner-secret", "admin-secret")

        self.assertNotIn("owner-secret", output.getvalue())
        self.assertNotIn("admin-secret", output.getvalue())
        self.assertIn("owner.demo@homeloop.my: created", output.getvalue())
        self.assertIn("admin.demo@homeloop.my: created", output.getvalue())

    def test_exits_when_profile_role_update_matches_no_row(self) -> None:
        with self.assertRaisesRegex(SystemExit, "role update did not match"):
            provision_demo_users(
                FakeSupabase(drop_profile_update_result=True),
                "owner-secret",
                "admin-secret",
            )


if __name__ == "__main__":
    unittest.main()
