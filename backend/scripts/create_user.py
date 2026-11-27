"""Create a dashboard user, or reset an existing user's password.

Usage (from backend/):
    python -m scripts.create_user jane --name "Jane Doe" [--email jane@example.com] [--role admin]
    python -m scripts.create_user jane --reset-password

The password is asked for interactively (not echoed). Pass --generate to get a random one printed instead.
"""

from __future__ import annotations

import argparse
import getpass
import secrets

from app.core.security import find_user, hash_password
from app.db.session import SessionLocal
from app.models import User

MIN_LENGTH = 8


def _password(generate: bool) -> str:
    if generate:
        return secrets.token_urlsafe(12)
    while True:
        pw = getpass.getpass("Password: ")
        if len(pw) < MIN_LENGTH:
            print(f"Use at least {MIN_LENGTH} characters.")
            continue
        if getpass.getpass("Repeat password: ") != pw:
            print("Passwords don't match.")
            continue
        return pw


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("user_id", help="login name (case-insensitive)")
    parser.add_argument("--name", help="display name (required for a new user)")
    parser.add_argument("--email")
    parser.add_argument("--role", default="member", choices=["admin", "member"])
    parser.add_argument("--reset-password", action="store_true", help="change the password of an existing user")
    parser.add_argument("--generate", action="store_true", help="generate a random password and print it")
    args = parser.parse_args()

    uid = args.user_id.strip().lower()
    with SessionLocal() as db:
        user = find_user(db, uid)
        if args.reset_password:
            if user is None:
                raise SystemExit(f"No user '{uid}'.")
            pw = _password(args.generate)
            user.password_hash = hash_password(pw)
            action = "Password reset for"
        else:
            if user is not None:
                raise SystemExit(f"User '{uid}' already exists. Use --reset-password to change the password.")
            if not args.name:
                raise SystemExit("--name is required for a new user.")
            pw = _password(args.generate)
            db.add(User(user_id=uid, name=args.name.strip(), email=args.email, role=args.role,
                        password_hash=hash_password(pw)))
            action = "Created"
        db.commit()
    print(f"{action} '{uid}'." + (f" Password: {pw}" if args.generate else ""))


if __name__ == "__main__":
    main()
