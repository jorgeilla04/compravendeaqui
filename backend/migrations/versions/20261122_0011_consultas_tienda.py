"""Consultas de clientes en las tiendas (ej.: un colegio que no está cargado).

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-22
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | Sequence[str] | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tienda_consultas",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "tienda_id",
            sa.Uuid(),
            sa.ForeignKey("tiendas.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("grupo", sa.String(160)),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("telefono", sa.String(30), nullable=False),
        sa.Column("mensaje", sa.Text()),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("tienda_consultas")
