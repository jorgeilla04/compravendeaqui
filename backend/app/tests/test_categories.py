"""Categorías: árbol, detalle con breadcrumb y cache."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.core.redis import get_redis
from app.services.categories import TREE_CACHE_KEY


def test_tree(client: TestClient) -> None:
    tree = client.get("/api/v1/categories").json()
    vehiculos = next(c for c in tree if c["slug"] == "vehiculos")
    assert vehiculos["icon"] == "car"
    assert {c["slug"] for c in vehiculos["children"]} >= {"autos", "motos"}
    assert get_redis().get(TREE_CACHE_KEY)
    assert client.get("/api/v1/categories").json() == tree


def test_detail_with_path_and_children(client: TestClient) -> None:
    autos = client.get("/api/v1/categories/autos").json()
    assert [c["slug"] for c in autos["path"]] == ["vehiculos", "autos"]
    parent = client.get("/api/v1/categories/vehiculos").json()
    assert len(parent["children"]) == 5
    children = client.get(f"/api/v1/categories/{parent['id']}/children").json()
    assert [c["slug"] for c in children] == [c["slug"] for c in parent["children"]]
    assert client.get("/api/v1/categories/no-existe").status_code == 404


def test_departments(client: TestClient) -> None:
    departments = client.get("/api/v1/meta/departments").json()
    assert len(departments) == 19 and "Valle Fértil" in departments
