"""Fixtures compartidas para los tests.

Los tests corren contra PostgreSQL y Redis reales (base `compravende_test`,
Redis índice 15), con el esquema creado por las migraciones de Alembic.
Las integraciones externas (WhatsApp, Twilio, S3, DolarApi) se reemplazan por
dobles: los tests nunca envían mensajes ni suben archivos reales.
"""

from __future__ import annotations

import os

# Debe ir antes de importar la app: Settings se instancia al importar.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://localhost:5432/compravende_test"
)
os.environ["REDIS_URL"] = os.environ.get("TEST_REDIS_URL", "redis://localhost:6379/15")
os.environ["ENVIRONMENT"] = "test"
os.environ["BCRYPT_ROUNDS"] = "4"
os.environ["CORS_ORIGINS"] = "http://localhost:3000"
os.environ["TRUSTED_PROXIES"] = "testclient"
os.environ["PUBLIC_SITE_URL"] = "https://compravendeaqui.test"
# Los tests existentes ingresan por celular; los de email lo cambian por test.
os.environ["LOGIN_METHOD"] = "phone"
for _secret in (
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_OTP_TEMPLATE_NAME",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM_NUMBER",
    "TWILIO_MESSAGING_SERVICE_SID",
    "SMTP_HOST",
    "EMAIL_FROM",
    "MP_ACCESS_TOKEN",
    "MP_WEBHOOK_SECRET",
):
    os.environ[_secret] = ""
os.environ["S3_ACCESS_KEY_ID"] = "test"
os.environ["S3_SECRET_ACCESS_KEY"] = "test"
os.environ["S3_PUBLIC_BASE_URL"] = "https://cdn.test/media"

import io  # noqa: E402
import uuid  # noqa: E402
from collections.abc import Callable, Iterator  # noqa: E402
from decimal import Decimal  # noqa: E402
from typing import Any  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402
from sqlalchemy import select, text  # noqa: E402

from app.config import settings  # noqa: E402
from app.core.redis import get_redis  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Category  # noqa: E402
from app.services import fx, storage  # noqa: E402
from app.services.otp_delivery import OtpDispatcher, get_otp_dispatcher  # noqa: E402

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
ORIGIN = {"Origin": "http://localhost:3000"}


@pytest.fixture(scope="session", autouse=True)
def _schema() -> Iterator[None]:
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public"))
    cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BACKEND_DIR, "migrations"))
    cfg.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(cfg, "head")
    yield


@pytest.fixture(autouse=True)
def _clean_state() -> Iterator[None]:
    get_redis().flushdb()
    yield
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE listing_images, listings, refresh_tokens, otp_codes, users, "
                "tienda_pedido_items, tienda_pedidos, tienda_precios, "
                "tienda_grupos, tienda_admins RESTART IDENTITY CASCADE"
            )
        )
        # La tienda de uniformes y sus prendas vienen de la migración: se
        # restauran (los tests las editan) y se borran las tiendas creadas.
        conn.execute(text("DELETE FROM tiendas WHERE slug <> 'uniformes'"))
        conn.execute(
            text(
                "DELETE FROM tienda_productos WHERE slug NOT IN ('remera', "
                "'pantalon', 'pollera', 'corbata', 'buzo', 'campera', 'bermuda', "
                "'jogging')"
            )
        )
        conn.execute(
            text(
                "UPDATE tienda_productos SET precio_base = 10000, activo = true, "
                "foto_url = NULL"
            )
        )
        conn.execute(text(RESET_UNIFORMES))
    get_redis().flushdb()


RESET_UNIFORMES = """
UPDATE tiendas SET nombre = 'Uniformes escolares', activo = true,
  envio_habilitado = true, envio_monto = 5000, envio_gratis_desde = NULL,
  envio_demora = '48 hs', express_habilitado = true, express_recargo_pct = 20,
  express_monto = 0, express_demora = '24 hs', retiro_habilitado = false,
  sena_habilitada = true, sena_pct = 10, total_habilitado = true,
  productos_en_todos = true, vendedor_email = 'virginialauratello@gmail.com',
  departamentos_envio = '["Capital", "Chimbas", "Pocito", "Rawson",
    "Rivadavia", "Santa Lucía"]'
WHERE slug = 'uniformes'
"""


class RecordingSender:
    """Doble de proveedor OTP: guarda el último código en vez de enviarlo."""

    channel = "whatsapp"

    def __init__(self) -> None:
        self.sent: list[tuple[str, str]] = []
        self.links: list[str | None] = []

    def send(self, destination: str, code: str, link: str | None = None) -> str:
        self.sent.append((destination, code))
        self.links.append(link)
        return f"wamid.{len(self.sent)}"

    def last_code(self) -> str:
        return self.sent[-1][1]

    def last_link(self) -> str | None:
        return self.links[-1]


@pytest.fixture
def otp_sender() -> Iterator[RecordingSender]:
    sender = RecordingSender()
    app.dependency_overrides[get_otp_dispatcher] = lambda: OtpDispatcher([sender])
    yield sender
    app.dependency_overrides.pop(get_otp_dispatcher, None)


@pytest.fixture(autouse=True)
def fake_storage(monkeypatch: pytest.MonkeyPatch) -> dict[str, bytes]:
    objects: dict[str, bytes] = {}

    def put_object(key: str, data: bytes, content_type: str) -> str:
        objects[key] = data
        return storage.public_url(key)

    def delete_objects(keys: list[str]) -> None:
        for key in keys:
            objects.pop(key, None)

    monkeypatch.setattr(storage, "put_object", put_object)
    monkeypatch.setattr(storage, "delete_objects", delete_objects)
    return objects


@pytest.fixture(autouse=True)
def fixed_fx(monkeypatch: pytest.MonkeyPatch) -> None:
    """Cotización fija de 1 USD = 1000 ARS."""
    monkeypatch.setattr(fx, "fetch_rate", lambda: Decimal("1000"))


@pytest.fixture
def client() -> TestClient:
    """Cliente HTTP de pruebas contra la app FastAPI."""
    return TestClient(app, headers=ORIGIN)


@pytest.fixture
def db() -> Iterator[Any]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def login(
    client: TestClient, sender: RecordingSender, phone: str = "2644123456"
) -> dict[str, Any]:
    """Ingreso completo por OTP + perfil completo. Deja la cookie en el cliente."""
    assert (
        client.post("/api/v1/auth/otp/request", json={"phone": phone}).status_code
        == 200
    )
    response = client.post(
        "/api/v1/auth/otp/verify", json={"phone": phone, "code": sender.last_code()}
    )
    assert response.status_code == 200, response.text
    data: dict[str, Any] = response.json()
    if data["user"]["profile_pending"]:
        username = f"user{uuid.uuid4().hex[:8]}"
        done = client.post(
            "/api/v1/auth/register",
            json={
                "username": username,
                "full_name": "Vendedor Test",
                "accept_terms": True,
            },
        )
        assert done.status_code == 200, done.text
        data["user"] = done.json()
    return data


@pytest.fixture
def make_user(
    otp_sender: RecordingSender,
) -> Callable[..., tuple[TestClient, dict[str, Any]]]:
    counter = iter(range(1000))

    def _make(phone: str | None = None) -> tuple[TestClient, dict[str, Any]]:
        user_client = TestClient(app, headers=ORIGIN)
        number = phone or f"264{4000000 + next(counter):07d}"
        return user_client, login(user_client, otp_sender, number)

    return _make


@pytest.fixture
def category_id(db: Any) -> str:
    return str(db.scalars(select(Category.id).where(Category.slug == "autos")).one())


def jpeg_bytes(size: tuple[int, int] = (2400, 1800), with_gps: bool = False) -> bytes:
    img = Image.new("RGB", size, (200, 30, 30))
    out = io.BytesIO()
    if with_gps:
        exif = Image.Exif()
        exif[0x8825] = {2: (31.0, 32.0, 0.0)}  # GPSInfo
        exif[0x010F] = "Cámara Test"  # Make
        img.save(out, format="JPEG", exif=exif.tobytes())
    else:
        img.save(out, format="JPEG")
    return out.getvalue()


def create_listing(
    client: TestClient, category_id: str, **overrides: Any
) -> dict[str, Any]:
    body = {
        "title": "Toyota Corolla XEI 2018",
        "description": "Impecable, único dueño, service al día en concesionario.",
        "category_id": category_id,
        "price": "15900",
        "price_currency": "USD",
        "condition": "usado",
        "department": "Capital",
        **overrides,
    }
    response = client.post("/api/v1/listings", json=body)
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()
    return data
