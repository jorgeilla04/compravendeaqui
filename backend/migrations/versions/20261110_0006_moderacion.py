"""Moderación: motivo en avisos suspendidos e historial de acciones.

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-10
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("listings", sa.Column("moderation_reason", sa.Text(), nullable=True))
    op.add_column(
        "listings",
        sa.Column("moderated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("users", sa.Column("suspension_reason", sa.Text(), nullable=True))
    op.create_table(
        "moderation_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "actor_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("target_type", sa.String(20), nullable=False),
        sa.Column("target_id", sa.Uuid(), nullable=False),
        sa.Column("target_label", sa.String(255), nullable=False),
        sa.Column("action", sa.String(20), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("idx_moderation_log_created", "moderation_log", ["created_at"])


def downgrade() -> None:
    op.drop_index("idx_moderation_log_created", table_name="moderation_log")
    op.drop_table("moderation_log")
    op.drop_column("users", "suspension_reason")
    op.drop_column("listings", "moderated_at")
    op.drop_column("listings", "moderation_reason")
