"""Tiendas virtuales: tiendas, encargados, grupos, productos, precios y pedidos.

Crea la primera tienda (uniformes escolares) con sus 8 prendas.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-09
"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

MONEY = sa.Numeric(12, 2)
TALLES = ["4", "6", "8", "10", "12", "14", "16", "S", "M", "L", "XL", "XXL"]
PRENDAS = [
    ("remera", "Remera / chomba", "remera", TALLES),
    ("pantalon", "Pantalón", "pantalon", TALLES),
    ("pollera", "Pollera", "pollera", TALLES),
    ("corbata", "Corbata", "corbata", []),
    ("buzo", "Buzo / sweater", "buzo", TALLES),
    ("campera", "Campera", "campera", TALLES),
    ("bermuda", "Bermuda / short", "bermuda", TALLES),
    ("jogging", "Jogging", "jogging", TALLES),
]
GRAN_SAN_JUAN = ["Capital", "Chimbas", "Pocito", "Rawson", "Rivadavia", "Santa Lucía"]


def _uuid_pk() -> sa.Column:
    return sa.Column(
        "id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False
    )


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column(
            name,
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        )
        for name in ("created_at", "updated_at")
    ]


def upgrade() -> None:
    tiendas = op.create_table(
        "tiendas",
        _uuid_pk(),
        sa.Column("slug", sa.String(60), nullable=False),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("grupo_label", sa.String(40), nullable=False),
        sa.Column("opcion_label", sa.String(40), nullable=False),
        sa.Column("categorias", sa.JSON(), nullable=False),
        sa.Column("productos_en_todos", sa.Boolean(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column("vendedor_nombre", sa.String(120), nullable=False),
        sa.Column("vendedor_email", sa.String(255), nullable=False),
        sa.Column("vendedor_whatsapp", sa.String(20), nullable=False),
        sa.Column("envio_habilitado", sa.Boolean(), nullable=False),
        sa.Column("envio_monto", MONEY, nullable=False),
        sa.Column("envio_gratis_desde", MONEY, nullable=True),
        sa.Column("envio_demora", sa.String(40), nullable=False),
        sa.Column("departamentos_envio", sa.JSON(), nullable=False),
        sa.Column("express_habilitado", sa.Boolean(), nullable=False),
        sa.Column("express_recargo_pct", sa.Integer(), nullable=False),
        sa.Column("express_monto", MONEY, nullable=False),
        sa.Column("express_demora", sa.String(40), nullable=False),
        sa.Column("retiro_habilitado", sa.Boolean(), nullable=False),
        sa.Column("retiro_direccion", sa.String(255), nullable=True),
        sa.Column("sena_habilitada", sa.Boolean(), nullable=False),
        sa.Column("sena_pct", sa.Integer(), nullable=False),
        sa.Column("total_habilitado", sa.Boolean(), nullable=False),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tiendas")),
        sa.UniqueConstraint("slug", name=op.f("uq_tiendas_slug")),
    )
    op.create_table(
        "tienda_admins",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("tienda_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["tienda_id"],
            ["tiendas.id"],
            name=op.f("fk_tienda_admins_tienda_id_tiendas"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_tienda_admins_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tienda_admins")),
        sa.UniqueConstraint(
            "tienda_id", "user_id", name=op.f("uq_tienda_admins_tienda_id")
        ),
    )
    op.create_index(op.f("ix_tienda_admins_user_id"), "tienda_admins", ["user_id"])
    op.create_table(
        "tienda_grupos",
        _uuid_pk(),
        sa.Column("tienda_id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("nombre", sa.String(160), nullable=False),
        sa.Column("subtitulo", sa.String(80), nullable=True),
        sa.Column("categoria", sa.String(80), nullable=True),
        sa.Column("color1", sa.String(7), nullable=False),
        sa.Column("color2", sa.String(7), nullable=False),
        sa.Column("logo_url", sa.Text(), nullable=True),
        sa.Column("activo", sa.Boolean(), nullable=False),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["tienda_id"],
            ["tiendas.id"],
            name=op.f("fk_tienda_grupos_tienda_id_tiendas"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tienda_grupos")),
        sa.UniqueConstraint(
            "tienda_id", "slug", name=op.f("uq_tienda_grupos_tienda_id")
        ),
    )
    op.create_index(op.f("ix_tienda_grupos_tienda_id"), "tienda_grupos", ["tienda_id"])
    productos = op.create_table(
        "tienda_productos",
        _uuid_pk(),
        sa.Column("tienda_id", sa.Uuid(), nullable=False),
        sa.Column("slug", sa.String(60), nullable=False),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("precio_base", MONEY, nullable=False),
        sa.Column("opciones", sa.JSON(), nullable=False),
        sa.Column("foto_url", sa.Text(), nullable=True),
        sa.Column("orden", sa.Integer(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["tienda_id"],
            ["tiendas.id"],
            name=op.f("fk_tienda_productos_tienda_id_tiendas"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tienda_productos")),
        sa.UniqueConstraint(
            "tienda_id", "slug", name=op.f("uq_tienda_productos_tienda_id")
        ),
    )
    op.create_index(
        op.f("ix_tienda_productos_tienda_id"), "tienda_productos", ["tienda_id"]
    )
    op.create_table(
        "tienda_precios",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("grupo_id", sa.Uuid(), nullable=False),
        sa.Column("producto_id", sa.Uuid(), nullable=False),
        sa.Column("precio", MONEY, nullable=True),
        sa.Column("disponible", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(
            ["grupo_id"],
            ["tienda_grupos.id"],
            name=op.f("fk_tienda_precios_grupo_id_tienda_grupos"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["producto_id"],
            ["tienda_productos.id"],
            name=op.f("fk_tienda_precios_producto_id_tienda_productos"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tienda_precios")),
        sa.UniqueConstraint(
            "grupo_id", "producto_id", name=op.f("uq_tienda_precios_grupo_id")
        ),
    )
    op.create_table(
        "tienda_pedidos",
        _uuid_pk(),
        sa.Column("tienda_id", sa.Uuid(), nullable=False),
        sa.Column("codigo", sa.String(12), nullable=False),
        sa.Column("cliente_nombre", sa.String(120), nullable=False),
        sa.Column("cliente_tel", sa.String(20), nullable=False),
        sa.Column("cliente_email", sa.String(255), nullable=True),
        sa.Column("direccion", sa.String(255), nullable=True),
        sa.Column("departamento", sa.String(60), nullable=True),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("entrega", sa.String(10), nullable=False),
        sa.Column("modalidad_pago", sa.String(10), nullable=False),
        sa.Column("subtotal", MONEY, nullable=False),
        sa.Column("envio_monto", MONEY, nullable=False),
        sa.Column("recargo_express", MONEY, nullable=False),
        sa.Column("total", MONEY, nullable=False),
        sa.Column("pagado_ahora", MONEY, nullable=False),
        sa.Column("saldo", MONEY, nullable=False),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.Column("mp_preference_id", sa.String(80), nullable=True),
        sa.Column("mp_init_point", sa.Text(), nullable=True),
        sa.Column("mp_payment_id", sa.String(40), nullable=True),
        sa.Column("pagado_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notificado_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.ForeignKeyConstraint(
            ["tienda_id"],
            ["tiendas.id"],
            name=op.f("fk_tienda_pedidos_tienda_id_tiendas"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tienda_pedidos")),
        sa.UniqueConstraint("codigo", name=op.f("uq_tienda_pedidos_codigo")),
    )
    op.create_index(
        op.f("ix_tienda_pedidos_tienda_id"), "tienda_pedidos", ["tienda_id"]
    )
    op.create_index(op.f("ix_tienda_pedidos_estado"), "tienda_pedidos", ["estado"])
    op.create_table(
        "tienda_pedido_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("pedido_id", sa.Uuid(), nullable=False),
        sa.Column("grupo_id", sa.Uuid(), nullable=False),
        sa.Column("producto_id", sa.Uuid(), nullable=False),
        sa.Column("grupo_nombre", sa.String(160), nullable=False),
        sa.Column("producto_nombre", sa.String(120), nullable=False),
        sa.Column("opcion", sa.String(40), nullable=True),
        sa.Column("cantidad", sa.Integer(), nullable=False),
        sa.Column("precio_unit", MONEY, nullable=False),
        sa.ForeignKeyConstraint(
            ["pedido_id"],
            ["tienda_pedidos.id"],
            name=op.f("fk_tienda_pedido_items_pedido_id_tienda_pedidos"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["grupo_id"],
            ["tienda_grupos.id"],
            name=op.f("fk_tienda_pedido_items_grupo_id_tienda_grupos"),
        ),
        sa.ForeignKeyConstraint(
            ["producto_id"],
            ["tienda_productos.id"],
            name=op.f("fk_tienda_pedido_items_producto_id_tienda_productos"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tienda_pedido_items")),
    )
    op.create_index(
        op.f("ix_tienda_pedido_items_pedido_id"), "tienda_pedido_items", ["pedido_id"]
    )

    # Primera tienda: uniformes escolares (Virginia Tello).
    uniformes = uuid.uuid4()
    op.bulk_insert(
        tiendas,
        [
            {
                "id": uniformes,
                "slug": "uniformes",
                "nombre": "Uniformes escolares",
                "descripcion": (
                    "El uniforme de tu colegio con envío a tu casa. Pagás una seña "
                    "y el resto cuando lo recibís."
                ),
                "grupo_label": "Colegio",
                "opcion_label": "Talle",
                "categorias": [
                    "Parroquiales y confesionales",
                    "Privados laicos y bilingües",
                    "Preuniversitarios (UNSJ)",
                ],
                "productos_en_todos": True,
                "activo": True,
                "vendedor_nombre": "Virginia Tello",
                "vendedor_email": "virginialauratello@gmail.com",
                "vendedor_whatsapp": "+5492645408193",
                "envio_habilitado": True,
                "envio_monto": 5000,
                "envio_gratis_desde": None,
                "envio_demora": "48 hs",
                "departamentos_envio": GRAN_SAN_JUAN,
                "express_habilitado": True,
                "express_recargo_pct": 20,
                "express_monto": 0,
                "express_demora": "24 hs",
                "retiro_habilitado": False,
                "retiro_direccion": "Santiago del Estero Sur 1131, Capital",
                "sena_habilitada": True,
                "sena_pct": 10,
                "total_habilitado": True,
            }
        ],
    )
    op.bulk_insert(
        productos,
        [
            {
                "id": uuid.uuid4(),
                "tienda_id": uniformes,
                "slug": slug,
                "nombre": nombre,
                "tipo": tipo,
                "precio_base": 10000,
                "opciones": opciones,
                "orden": i,
                "activo": True,
            }
            for i, (slug, nombre, tipo, opciones) in enumerate(PRENDAS)
        ],
    )


def downgrade() -> None:
    for table in (
        "tienda_pedido_items",
        "tienda_pedidos",
        "tienda_precios",
        "tienda_productos",
        "tienda_grupos",
        "tienda_admins",
        "tiendas",
    ):
        op.drop_table(table)
