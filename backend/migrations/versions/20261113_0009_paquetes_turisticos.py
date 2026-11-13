"""Agencia de viajes: paquetes con salidas y cupos, reservas con seña y consultas.

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | Sequence[str] | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

MONEY = sa.Numeric(12, 2)


def _fk(tabla: str, ondelete: str = "CASCADE", nullable: bool = False) -> sa.Column:
    return sa.Column(
        f"{tabla.rstrip('s')}_id" if tabla != "paquete_salidas" else "salida_id",
        sa.Uuid(),
        sa.ForeignKey(f"{tabla}.id", ondelete=ondelete),
        nullable=nullable,
        index=True,
    )


def upgrade() -> None:
    op.add_column(
        "transportistas",
        sa.Column("sena_pct", sa.Integer(), nullable=False, server_default="30"),
    )
    op.add_column("transportistas", sa.Column("datos_transferencia", sa.Text()))
    op.create_table(
        "paquetes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _fk("transportistas"),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("titulo", sa.String(160), nullable=False),
        sa.Column("resumen", sa.String(300), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("dias", sa.Integer()),
        sa.Column("noches", sa.Integer()),
        sa.Column("incluye", sa.JSON(), nullable=False),
        sa.Column("precio_desde", MONEY, nullable=False),
        sa.Column("foto_url", sa.Text()),
        sa.Column("orden", sa.Integer(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("transportista_id", "slug"),
    )
    op.create_table(
        "paquete_salidas",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _fk("paquetes"),
        sa.Column("nombre", sa.String(60), nullable=False),
        sa.Column("fecha", sa.Date()),
        sa.Column("precio_persona", MONEY, nullable=False),
        sa.Column("cupos", sa.Integer(), nullable=False),
        sa.Column("reservados", sa.Integer(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
    )
    op.create_table(
        "paquete_reservas",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("codigo", sa.String(12), nullable=False, unique=True),
        _fk("transportistas"),
        _fk("paquete_salidas"),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.Column("paquete_titulo", sa.String(160), nullable=False),
        sa.Column("salida_nombre", sa.String(60), nullable=False),
        sa.Column("pasajeros", sa.Integer(), nullable=False),
        sa.Column("precio_persona", MONEY, nullable=False),
        sa.Column("total", MONEY, nullable=False),
        sa.Column("sena", MONEY, nullable=False),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("telefono", sa.String(30), nullable=False),
        sa.Column("dni", sa.String(20)),
        sa.Column("notas", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "paquete_consultas",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _fk("transportistas"),
        _fk("paquetes", ondelete="SET NULL", nullable=True),
        sa.Column("paquete_titulo", sa.String(160)),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("telefono", sa.String(30), nullable=False),
        sa.Column("email", sa.String(255)),
        sa.Column("mensaje", sa.Text()),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("paquete_consultas")
    op.drop_table("paquete_reservas")
    op.drop_table("paquete_salidas")
    op.drop_table("paquetes")
    op.drop_column("transportistas", "datos_transferencia")
    op.drop_column("transportistas", "sena_pct")
