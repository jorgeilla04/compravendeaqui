"""Publicaciones de avisos en redes sociales (Facebook e Instagram).

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | Sequence[str] | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "publicaciones_redes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "listing_id",
            sa.Uuid(),
            sa.ForeignKey("listings.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("red", sa.String(20), nullable=False),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.Column("texto", sa.Text(), nullable=False),
        sa.Column("imagen_url", sa.Text()),
        sa.Column("post_id", sa.String(120)),
        sa.Column("permalink", sa.Text()),
        sa.Column("error", sa.Text()),
        sa.Column(
            "creada_por", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL")
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("publicada_at", sa.DateTime(timezone=True)),
    )


def downgrade() -> None:
    op.drop_table("publicaciones_redes")
