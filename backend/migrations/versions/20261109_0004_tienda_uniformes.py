"""Tienda de uniformes escolares: colegios, prendas, precios y pedidos.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TALLES = ["4", "6", "8", "10", "12", "14", "16", "S", "M", "L", "XL", "XXL"]
# (slug, nombre, tipo de ilustración, talles)
PRENDAS = [
    ("remera", "Remera / chomba", "remera", TALLES),
    ("pantalon", "Pantalón", "pantalon", TALLES),
    ("pollera", "Pollera", "pollera", TALLES),
    ("corbata", "Corbata", "corbata", ["Único"]),
    ("buzo", "Buzo / sweater", "buzo", TALLES),
    ("campera", "Campera", "campera", TALLES),
    ("bermuda", "Bermuda / short", "bermuda", TALLES),
    ("jogging", "Jogging", "jogging", TALLES),
]
MONEY = sa.Numeric(12, 2)


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    ]


def upgrade() -> None:
    uuid_pk = {"server_default": sa.text("gen_random_uuid()"), "nullable": False}
    op.create_table(
        "uniformes_colegios",
        sa.Column("id", sa.Uuid(), **uuid_pk),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("nombre", sa.String(160), nullable=False),
        sa.Column("departamento", sa.String(60), nullable=False),
        sa.Column("categoria", sa.String(30), nullable=False),
        sa.Column("color1", sa.String(7), nullable=False),
        sa.Column("color2", sa.String(7), nullable=False),
        sa.Column("logo_url", sa.Text(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_uniformes_colegios")),
        sa.UniqueConstraint("slug", name=op.f("uq_uniformes_colegios_slug")),
    )
    op.create_index(
        op.f("ix_uniformes_colegios_categoria"), "uniformes_colegios", ["categoria"]
    )
    prendas = op.create_table(
        "uniformes_prendas",
        sa.Column("id", sa.Uuid(), **uuid_pk),
        sa.Column("slug", sa.String(40), nullable=False),
        sa.Column("nombre", sa.String(80), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("precio_base", MONEY, nullable=False),
        sa.Column("talles", sa.JSON(), nullable=False),
        sa.Column("foto_url", sa.Text(), nullable=True),
        sa.Column("orden", sa.Integer(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_uniformes_prendas")),
        sa.UniqueConstraint("slug", name=op.f("uq_uniformes_prendas_slug")),
    )
    op.create_table(
        "uniformes_precios",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("colegio_id", sa.Uuid(), nullable=False),
        sa.Column("prenda_id", sa.Uuid(), nullable=False),
        sa.Column("precio", MONEY, nullable=True),
        sa.Column("disponible", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["colegio_id"],
            ["uniformes_colegios.id"],
            name=op.f("fk_uniformes_precios_colegio_id_uniformes_colegios"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["prenda_id"],
            ["uniformes_prendas.id"],
            name=op.f("fk_uniformes_precios_prenda_id_uniformes_prendas"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_uniformes_precios")),
        sa.UniqueConstraint(
            "colegio_id", "prenda_id", name=op.f("uq_uniformes_precios_colegio_id")
        ),
    )
    op.create_table(
        "uniformes_pedidos",
        sa.Column("id", sa.Uuid(), **uuid_pk),
        sa.Column("codigo", sa.String(12), nullable=False),
        sa.Column("cliente_nombre", sa.String(120), nullable=False),
        sa.Column("cliente_tel", sa.String(20), nullable=False),
        sa.Column("cliente_email", sa.String(255), nullable=True),
        sa.Column("direccion", sa.String(255), nullable=False),
        sa.Column("departamento", sa.String(60), nullable=False),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("envio", sa.String(10), nullable=False),
        sa.Column("modalidad_pago", sa.String(10), nullable=False),
        sa.Column("subtotal", MONEY, nullable=False),
        sa.Column("recargo_express", MONEY, nullable=False),
        sa.Column("envio_monto", MONEY, nullable=False),
        sa.Column("total", MONEY, nullable=False),
        sa.Column("pagado_ahora", MONEY, nullable=False),
        sa.Column("saldo", MONEY, nullable=False),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.Column("mp_preference_id", sa.String(80), nullable=True),
        sa.Column("mp_payment_id", sa.String(40), nullable=True),
        sa.Column("pagado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notificado_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_uniformes_pedidos")),
        sa.UniqueConstraint("codigo", name=op.f("uq_uniformes_pedidos_codigo")),
    )
    op.create_index(
        op.f("ix_uniformes_pedidos_estado"), "uniformes_pedidos", ["estado"]
    )
    op.create_table(
        "uniformes_pedido_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("pedido_id", sa.Uuid(), nullable=False),
        sa.Column("colegio_id", sa.Uuid(), nullable=False),
        sa.Column("prenda_id", sa.Uuid(), nullable=False),
        sa.Column("colegio_nombre", sa.String(160), nullable=False),
        sa.Column("prenda_nombre", sa.String(80), nullable=False),
        sa.Column("talle", sa.String(10), nullable=False),
        sa.Column("cantidad", sa.Integer(), nullable=False),
        sa.Column("precio_unit", MONEY, nullable=False),
        sa.ForeignKeyConstraint(
            ["pedido_id"],
            ["uniformes_pedidos.id"],
            name=op.f("fk_uniformes_pedido_items_pedido_id_uniformes_pedidos"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["colegio_id"],
            ["uniformes_colegios.id"],
            name=op.f("fk_uniformes_pedido_items_colegio_id_uniformes_colegios"),
        ),
        sa.ForeignKeyConstraint(
            ["prenda_id"],
            ["uniformes_prendas.id"],
            name=op.f("fk_uniformes_pedido_items_prenda_id_uniformes_prendas"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_uniformes_pedido_items")),
    )
    op.create_index(
        op.f("ix_uniformes_pedido_items_pedido_id"),
        "uniformes_pedido_items",
        ["pedido_id"],
    )
    op.bulk_insert(
        prendas,
        [
            {
                "slug": slug,
                "nombre": nombre,
                "tipo": tipo,
                "precio_base": 10000,
                "talles": talles,
                "orden": i,
                "activo": True,
            }
            for i, (slug, nombre, tipo, talles) in enumerate(PRENDAS)
        ],
    )


def downgrade() -> None:
    op.drop_table("uniformes_pedido_items")
    op.drop_table("uniformes_pedidos")
    op.drop_table("uniformes_precios")
    op.drop_table("uniformes_prendas")
    op.drop_table("uniformes_colegios")
