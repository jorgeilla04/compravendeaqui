"""Da (o quita) permisos de administración a un usuario por su email.

Uso:  python -m app.scripts.make_admin juan@gmail.com
      python -m app.scripts.make_admin juan@gmail.com --quitar
"""

from __future__ import annotations

import sys

from sqlalchemy import select

from app.database import SessionLocal
from app.models import User


def set_role(email: str, admin: bool = True) -> bool:
    with SessionLocal() as db:
        user = db.scalars(
            select(User).where(User.email == email.lower(), User.deleted_at.is_(None))
        ).first()
        if user is None:
            return False
        user.role = "admin" if admin else "user"
        db.commit()
        return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    address, quitar = sys.argv[1], "--quitar" in sys.argv[2:]
    if not set_role(address, admin=not quitar):
        sys.exit(
            f"No hay ningún usuario con el email {address} (tiene que ingresar antes)"
        )
    print(f"{address}: {'usuario común' if quitar else 'administrador'}")
