"""categorías iniciales (árbol de rubros de San Juan)

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-03 08:00:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (slug, nombre, ícono lucide, [(slug, nombre), ...])
TREE: list[tuple[str, str, str, list[tuple[str, str]]]] = [
    (
        "vehiculos",
        "Vehículos",
        "car",
        [
            ("autos", "Autos"),
            ("camionetas", "Camionetas"),
            ("motos", "Motos"),
            ("camiones", "Camiones"),
            ("repuestos-y-accesorios", "Repuestos y accesorios"),
        ],
    ),
    (
        "inmuebles",
        "Inmuebles",
        "house",
        [
            ("casas", "Casas"),
            ("departamentos", "Departamentos"),
            ("terrenos-y-lotes", "Terrenos y lotes"),
            ("alquileres", "Alquileres"),
            ("locales-y-oficinas", "Locales y oficinas"),
            ("fincas", "Fincas"),
        ],
    ),
    (
        "tecnologia",
        "Tecnología",
        "smartphone",
        [
            ("celulares", "Celulares"),
            ("computacion", "Computación"),
            ("tv-audio-y-video", "TV, audio y video"),
            ("consolas-y-videojuegos", "Consolas y videojuegos"),
        ],
    ),
    (
        "hogar-y-muebles",
        "Hogar y muebles",
        "sofa",
        [
            ("muebles", "Muebles"),
            ("electrodomesticos", "Electrodomésticos"),
            ("jardin-y-exterior", "Jardín y exterior"),
            ("decoracion", "Decoración"),
        ],
    ),
    (
        "moda",
        "Moda",
        "shirt",
        [
            ("ropa", "Ropa"),
            ("calzado", "Calzado"),
            ("accesorios", "Accesorios"),
        ],
    ),
    (
        "deportes",
        "Deportes",
        "bike",
        [
            ("bicicletas", "Bicicletas"),
            ("fitness", "Fitness"),
            ("camping-y-pesca", "Camping y pesca"),
        ],
    ),
    (
        "herramientas-y-construccion",
        "Herramientas y construcción",
        "wrench",
        [
            ("herramientas", "Herramientas"),
            ("materiales-de-construccion", "Materiales de construcción"),
        ],
    ),
    (
        "agro",
        "Agro",
        "tractor",
        [
            ("maquinaria-agricola", "Maquinaria agrícola"),
            ("insumos-agricolas", "Insumos agrícolas"),
        ],
    ),
    ("animales-y-mascotas", "Animales y mascotas", "paw-print", []),
    ("bebes-y-ninos", "Bebés y niños", "baby", []),
    ("servicios", "Servicios", "briefcase", []),
    ("empleos", "Empleos", "badge-check", []),
    ("otros", "Otros", "package", []),
]


def upgrade() -> None:
    conn = op.get_bind()
    insert = sa.text(
        "INSERT INTO categories (name, slug, icon, display_order, is_active, parent_id)"
        " VALUES (:name, :slug, :icon, :order, true, :parent_id)"
        " ON CONFLICT (slug) DO NOTHING RETURNING id"
    )
    for order, (slug, name, icon, children) in enumerate(TREE):
        parent_id = conn.execute(
            insert,
            {
                "name": name,
                "slug": slug,
                "icon": icon,
                "order": order,
                "parent_id": None,
            },
        ).scalar()
        if parent_id is None:
            continue
        for child_order, (child_slug, child_name) in enumerate(children):
            conn.execute(
                insert,
                {
                    "name": child_name,
                    "slug": child_slug,
                    "icon": None,
                    "order": child_order,
                    "parent_id": parent_id,
                },
            )


def downgrade() -> None:
    slugs = [slug for slug, *_ in TREE] + [
        child for *_, children in TREE for child, _ in children
    ]
    op.get_bind().execute(
        sa.text("DELETE FROM categories WHERE slug = ANY(:slugs)"), {"slugs": slugs}
    )
