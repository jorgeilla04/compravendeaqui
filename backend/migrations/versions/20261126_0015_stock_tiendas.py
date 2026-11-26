"""Entrega según stock: productos en stock llegan antes que los a pedido.

Revision ID: 0015
Revises: 0014
Create Date: 2026-11-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: str | Sequence[str] | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("tiendas", sa.Column("stock_demora", sa.String(40), nullable=True))
    op.add_column(
        "tienda_productos",
        sa.Column("en_stock", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("tienda_pedidos", sa.Column("demora", sa.String(40), nullable=True))


def downgrade() -> None:
    op.drop_column("tienda_pedidos", "demora")
    op.drop_column("tienda_productos", "en_stock")
    op.drop_column("tiendas", "stock_demora")
