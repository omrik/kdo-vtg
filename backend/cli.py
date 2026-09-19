"""One-off admin commands, run directly on the host.

Forgot the admin password? Reset it without touching the web app:

    python3 -m backend.cli reset-password admin MyNewPass123

The command writes directly to the same database the container uses
(default ./config/kdo-vtg.db, override with DATABASE_URL).
"""

import os
import sys


def main() -> None:
    args = sys.argv[1:]
    if len(args) < 3 or args[0] != "reset-password":
        print("Usage: python3 -m backend.cli reset-password <username> <new-password>")
        sys.exit(1)

    username, new_password = args[1], args[2]
    if len(new_password) < 6:
        print("Error: password must be at least 6 characters")
        sys.exit(1)

    os.makedirs("./config", exist_ok=True)
    from backend.database import SessionLocal, User
    from backend.auth import get_password_hash

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            print(f"Error: user '{username}' not found")
            sys.exit(1)
        user.hashed_password = get_password_hash(new_password)
        db.commit()
        print(f"Password reset for '{username}'")
    finally:
        db.close()


if __name__ == "__main__":
    main()