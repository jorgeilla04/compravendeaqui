"""Precios por talle (tramos) y costo de referencia de cada prenda.

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | Sequence[str] | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tienda_productos",
        sa.Column("tramos", sa.JSON(), nullable=False, server_default="[]"),
    )
    op.add_column("tienda_productos", sa.Column("costo", sa.Numeric(12, 2)))


def downgrade() -> None:
    op.drop_column("tienda_productos", "costo")
    op.drop_column("tienda_productos", "tramos")
