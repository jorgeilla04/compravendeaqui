"""Publicar en redes también productos de tiendas (ej.: uniformes por colegio).

Revision ID: 0013
Revises: 0012
Create Date: 2026-11-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: str | Sequence[str] | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("publicaciones_redes", "listing_id", nullable=True)
    op.add_column(
        "publicaciones_redes",
        sa.Column(
            "producto_id",
            sa.Uuid(),
            sa.ForeignKey("tienda_productos.id", ondelete="CASCADE"),
        ),
    )
    op.add_column(
        "publicaciones_redes",
        sa.Column(
            "grupo_id",
            sa.Uuid(),
            sa.ForeignKey("tienda_grupos.id", ondelete="CASCADE"),
        ),
    )
    op.create_index(
        "ix_publicaciones_redes_grupo_id", "publicaciones_redes", ["grupo_id"]
    )
    op.add_column("publicaciones_redes", sa.Column("titulo", sa.String(200)))
    op.add_column("publicaciones_redes", sa.Column("url", sa.Text()))
    op.create_check_constraint(
        op.f("ck_publicaciones_redes_destino"),
        "publicaciones_redes",
        "(listing_id IS NOT NULL) <> "
        "(producto_id IS NOT NULL AND grupo_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("ck_publicaciones_redes_destino"), "publicaciones_redes", type_="check"
    )
    op.execute("DELETE FROM publicaciones_redes WHERE listing_id IS NULL")
    op.drop_column("publicaciones_redes", "url")
    op.drop_column("publicaciones_redes", "titulo")
    op.drop_index("ix_publicaciones_redes_grupo_id", "publicaciones_redes")
    op.drop_column("publicaciones_redes", "grupo_id")
    op.drop_column("publicaciones_redes", "producto_id")
    op.alter_column("publicaciones_redes", "listing_id", nullable=False)
