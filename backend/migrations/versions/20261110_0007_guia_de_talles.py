"""Guía de talles por prenda, con medidas de referencia para uniformes.

Las medidas son aproximadas (cm de la prenda, no del cuerpo) y la encargada
las corrige desde el panel; al guardarlas dejan de figurar como aproximadas.

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-10
"""

import json
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | Sequence[str] | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TALLES = ["4", "6", "8", "10", "12", "14", "16", "S", "M", "L", "XL", "XXL"]

# Por tipo de prenda: columnas y una fila de valores por talle (orden TALLES).
REFERENCIA: dict[str, tuple[list[str], list[list[float]]]] = {
    "remera": (
        ["Largo total", "Ancho de pecho (axila a axila)"],
        [
            [44, 33],
            [47, 35],
            [50, 37],
            [53, 39],
            [56, 41],
            [59, 43],
            [62, 45],
            [66, 48],
            [69, 51],
            [72, 54],
            [74, 57],
            [76, 60],
        ],
    ),
    "buzo": (
        ["Largo total", "Ancho de pecho (axila a axila)", "Largo de manga"],
        [
            [42, 35, 38],
            [45, 37, 42],
            [48, 39, 46],
            [51, 41, 50],
            [54, 43, 54],
            [57, 45, 57],
            [60, 47, 59],
            [64, 50, 61],
            [67, 53, 62],
            [70, 56, 63],
            [72, 59, 64],
            [74, 62, 65],
        ],
    ),
    "pantalon": (
        ["Largo total", "Contorno de cintura", "Entrepierna"],
        [
            [60, 50, 40],
            [67, 53, 46],
            [74, 56, 52],
            [81, 59, 58],
            [87, 62, 63],
            [92, 66, 68],
            [96, 70, 72],
            [100, 74, 75],
            [102, 80, 76],
            [104, 86, 77],
            [106, 92, 78],
            [108, 98, 79],
        ],
    ),
    "pollera": (
        ["Largo total", "Contorno de cintura"],
        [
            [28, 50],
            [31, 53],
            [34, 56],
            [37, 59],
            [40, 62],
            [42, 66],
            [44, 70],
            [45, 72],
            [46, 78],
            [47, 84],
            [48, 90],
            [49, 96],
        ],
    ),
    "bermuda": (
        ["Largo total", "Contorno de cintura"],
        [
            [30, 50],
            [33, 53],
            [36, 56],
            [39, 59],
            [42, 62],
            [45, 66],
            [48, 70],
            [50, 74],
            [52, 80],
            [54, 86],
            [55, 92],
            [56, 98],
        ],
    ),
}
# Mismo molde que su par.
REFERENCIA["campera"] = REFERENCIA["buzo"]
REFERENCIA["jogging"] = REFERENCIA["pantalon"]


def _medidas(tipo: str, opciones: list[str]) -> dict | None:
    if tipo not in REFERENCIA:
        return None
    columnas, valores = REFERENCIA[tipo]
    por_talle = dict(zip(TALLES, valores, strict=True))
    filas = [{"talle": t, "valores": por_talle[t]} for t in opciones if t in por_talle]
    if not filas:
        return None
    return {"columnas": columnas, "filas": filas, "aproximadas": True}


def upgrade() -> None:
    op.add_column("tienda_productos", sa.Column("medidas", sa.JSON(), nullable=True))
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            "SELECT p.id, p.tipo, p.opciones FROM tienda_productos p "
            "JOIN tiendas t ON t.id = p.tienda_id WHERE t.slug = 'uniformes'"
        )
    ).fetchall()
    for producto_id, tipo, opciones in rows:
        if isinstance(opciones, str):
            opciones = json.loads(opciones)
        medidas = _medidas(tipo, opciones or [])
        if medidas:
            conn.execute(
                sa.text("UPDATE tienda_productos SET medidas = :m WHERE id = :id"),
                {"m": json.dumps(medidas), "id": producto_id},
            )


def downgrade() -> None:
    op.drop_column("tienda_productos", "medidas")
