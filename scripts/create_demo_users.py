import os
from typing import Any


OWNER_EMAIL = "owner.demo@homeloop.my"
ADMIN_EMAIL = "admin.demo@homeloop.my"


def required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"{name} is required")
    return value


def _list_users(client: Any) -> list[Any]:
    response = client.auth.admin.list_users(page=1, per_page=1000)
    if isinstance(response, list):
        return response
    return list(response.users)


def _ensure_user(client: Any, email: str, password: str, role: str) -> None:
    user = next(
        (candidate for candidate in _list_users(client) if candidate.email == email),
        None,
    )
    outcome = "already exists"

    if user is None:
        response = client.auth.admin.create_user(
            {
                "email": email,
                "password": password,
                "email_confirm": True,
            }
        )
        user = response.user if hasattr(response, "user") else response
        outcome = "created"

    response = (
        client.table("profiles")
        .update({"role": role})
        .eq("id", user.id)
        .execute()
    )
    matched = getattr(response, "data", None)
    if not matched or not any(str(row.get("id")) == str(user.id) for row in matched):
        raise SystemExit(f"{email}: role update did not match the profile row")
    print(f"{email}: {outcome}; role={role}")


def provision_demo_users(
    client: Any,
    owner_password: str,
    admin_password: str,
) -> None:
    _ensure_user(client, OWNER_EMAIL, owner_password, "owner")
    _ensure_user(client, ADMIN_EMAIL, admin_password, "admin")


def main() -> None:
    from supabase import create_client

    client = create_client(
        required_env("SUPABASE_URL"),
        required_env("SUPABASE_SERVICE_ROLE_KEY"),
    )
    provision_demo_users(
        client,
        required_env("DEMO_OWNER_PASSWORD"),
        required_env("DEMO_ADMIN_PASSWORD"),
    )


if __name__ == "__main__":
    main()
