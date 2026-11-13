"""Transporte para empresas: cotizador por km y unidad, con Blanca Paloma.

Las tarifas cargadas son de ejemplo: el panel le avisa a la empresa que las
revise hasta que guarde las suyas.

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-13
"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | Sequence[str] | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

MONEY = sa.Numeric(12, 2)

DESCRIPCION = (
    "Traslados de personal, eventos corporativos y viajes de negocios en San "
    "Juan y la región, con más de 17 años de experiencia. Cotizá tu viaje al "
    "instante: elegí origen, destino y cuántos viajan."
)
# Nombre, asientos y $ por km (de ejemplo).
UNIDADES = [
    ("Combi", 15, 1300),
    ("Minibús", 24, 1700),
    ("Colectivo", 45, 2300),
    ("Colectivo doble piso", 60, 2800),
]


def upgrade() -> None:
    op.create_table(
        "transportistas",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("slug", sa.String(60), nullable=False, unique=True),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("descripcion", sa.Text()),
        sa.Column("foto_url", sa.Text()),
        sa.Column("whatsapp", sa.String(20), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("minimo", MONEY, nullable=False),
        sa.Column("espera_hora", MONEY, nullable=False),
        sa.Column("iva_incluido", sa.Boolean(), nullable=False),
        sa.Column("tarifas_revisadas", sa.Boolean(), nullable=False),
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
    )
    op.create_table(
        "transporte_unidades",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "transportista_id",
            sa.Uuid(),
            sa.ForeignKey("transportistas.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("nombre", sa.String(60), nullable=False),
        sa.Column("asientos", sa.Integer(), nullable=False),
        sa.Column("precio_km", MONEY, nullable=False),
        sa.Column("foto_url", sa.Text()),
        sa.Column("activo", sa.Boolean(), nullable=False),
    )
    op.create_table(
        "transporte_admins",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "transportista_id",
            sa.Uuid(),
            sa.ForeignKey("transportistas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.UniqueConstraint("transportista_id", "user_id"),
    )
    op.create_table(
        "transporte_pedidos",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("codigo", sa.String(12), nullable=False, unique=True),
        sa.Column(
            "transportista_id",
            sa.Uuid(),
            sa.ForeignKey("transportistas.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("telefono", sa.String(30), nullable=False),
        sa.Column("empresa", sa.String(160), nullable=False),
        sa.Column("origen", sa.String(255), nullable=False),
        sa.Column("destino", sa.String(255), nullable=False),
        sa.Column("km", sa.Numeric(8, 1), nullable=False),
        sa.Column("ida_vuelta", sa.Boolean(), nullable=False),
        sa.Column("fecha", sa.Date()),
        sa.Column("horas_espera", sa.Integer(), nullable=False),
        sa.Column("pasajeros", sa.Integer(), nullable=False),
        sa.Column("unidad", sa.String(60), nullable=False),
        sa.Column("cantidad_unidades", sa.Integer(), nullable=False),
        sa.Column("total", MONEY, nullable=False),
        sa.Column("notas", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    transportista_id = uuid.uuid4()
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "INSERT INTO transportistas (id, slug, nombre, descripcion, whatsapp, "
            "email, minimo, espera_hora, iva_incluido, tarifas_revisadas, activo) "
            "VALUES (:id, 'blanca-paloma', 'Blanca Paloma · Transporte para "
            "empresas', :descripcion, '+5492644148579', "
            "'administracion@blancapalomasrl.com.ar', 120000, 15000, true, false, "
            "true)"
        ),
        {"id": transportista_id, "descripcion": DESCRIPCION},
    )
    for nombre, asientos, precio_km in UNIDADES:
        conn.execute(
            sa.text(
                "INSERT INTO transporte_unidades (id, transportista_id, nombre, "
                "asientos, precio_km, activo) VALUES (:id, :t, :n, :a, :p, true)"
            ),
            {
                "id": uuid.uuid4(),
                "t": transportista_id,
                "n": nombre,
                "a": asientos,
                "p": precio_km,
            },
        )


def downgrade() -> None:
    op.drop_table("transporte_pedidos")
    op.drop_table("transporte_admins")
    op.drop_table("transporte_unidades")
    op.drop_table("transportistas")
