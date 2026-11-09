"""Ingreso por email: OTP con destino genérico, link mágico y teléfono no único.

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("idx_otp_phone", table_name="otp_codes")
    op.alter_column(
        "otp_codes",
        "phone",
        new_column_name="destination",
        type_=sa.String(length=255),
        existing_nullable=False,
    )
    op.create_index(
        "idx_otp_destination", "otp_codes", ["destination", "purpose"], unique=False
    )
    op.add_column(
        "otp_codes", sa.Column("link_hash", sa.String(length=255), nullable=True)
    )
    op.create_index(
        "uq_otp_codes_link_hash",
        "otp_codes",
        ["link_hash"],
        unique=True,
        postgresql_where=sa.text("link_hash IS NOT NULL"),
    )

    # El teléfono cargado en el perfil (sin verificar) no bloquea a nadie:
    # solo es único entre los verificados por OTP.
    op.drop_constraint("uq_users_phone", "users", type_="unique")
    op.create_index(
        "uq_users_phone_verified",
        "users",
        ["phone"],
        unique=True,
        postgresql_where=sa.text("phone_verified"),
    )


def downgrade() -> None:
    op.drop_index("uq_users_phone_verified", table_name="users")
    op.create_unique_constraint("uq_users_phone", "users", ["phone"])
    op.drop_index("uq_otp_codes_link_hash", table_name="otp_codes")
    op.drop_column("otp_codes", "link_hash")
    op.drop_index("idx_otp_destination", table_name="otp_codes")
    op.execute("DELETE FROM otp_codes WHERE length(destination) > 20")
    op.alter_column(
        "otp_codes",
        "destination",
        new_column_name="phone",
        type_=sa.String(length=20),
        existing_nullable=False,
    )
    op.create_index("idx_otp_phone", "otp_codes", ["phone", "purpose"], unique=False)
