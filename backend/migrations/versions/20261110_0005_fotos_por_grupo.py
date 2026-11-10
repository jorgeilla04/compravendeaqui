"""Fotos propias de cada grupo: foto de cada producto y galería del uniforme.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-10
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("tienda_precios", sa.Column("foto_url", sa.Text(), nullable=True))
    op.add_column(
        "tienda_grupos",
        sa.Column("fotos", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("tienda_grupos", "fotos")
    op.drop_column("tienda_precios", "foto_url")
