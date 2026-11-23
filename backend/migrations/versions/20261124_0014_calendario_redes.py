"""Calendario de publicaciones en redes: hasta 3 productos por día.

Revision ID: 0014
Revises: 0013
Create Date: 2026-11-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: str | Sequence[str] | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "programaciones_redes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("fecha", sa.Date(), nullable=False, index=True),
        sa.Column("orden", sa.Integer(), nullable=False),
        sa.Column(
            "publicar_at", sa.DateTime(timezone=True), nullable=False, index=True
        ),
        sa.Column(
            "listing_id", sa.Uuid(), sa.ForeignKey("listings.id", ondelete="CASCADE")
        ),
        sa.Column(
            "producto_id",
            sa.Uuid(),
            sa.ForeignKey("tienda_productos.id", ondelete="CASCADE"),
        ),
        sa.Column(
            "grupo_id",
            sa.Uuid(),
            sa.ForeignKey("tienda_grupos.id", ondelete="CASCADE"),
        ),
        sa.Column("titulo", sa.String(200), nullable=False),
        sa.Column("redes", sa.JSON(), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False, index=True),
        sa.Column("error", sa.Text()),
        sa.Column(
            "creada_por", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "(listing_id IS NOT NULL) <> "
            "(producto_id IS NOT NULL AND grupo_id IS NOT NULL)",
            name=op.f("ck_programaciones_redes_destino"),
        ),
    )
    op.add_column(
        "publicaciones_redes",
        sa.Column(
            "programacion_id",
            sa.Uuid(),
            sa.ForeignKey("programaciones_redes.id", ondelete="SET NULL"),
        ),
    )
    op.create_index(
        "ix_publicaciones_redes_programacion_id",
        "publicaciones_redes",
        ["programacion_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_publicaciones_redes_programacion_id", "publicaciones_redes")
    op.drop_column("publicaciones_redes", "programacion_id")
    op.drop_table("programaciones_redes")
