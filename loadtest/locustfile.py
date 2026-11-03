"""Prueba de carga del MVP: 100 usuarios concurrentes navegando y buscando.

Uso (stack de e2e levantado y datos cargados con loadtest/seed.py):
    backend/.venv/bin/locust -f loadtest/locustfile.py --host http://localhost:8010 \\
        --headless -u 100 -r 20 -t 60s --csv loadtest/results
Criterio de la Fase 1: p95 < 500 ms y 0 % de errores.
"""

from __future__ import annotations

import random

from locust import HttpUser, between, task

QUERIES = ["toyota", "heladera", "iphone", "casa", "bicicleta", "notebook", "camioneta", "moto"]
DEPARTMENTS = ["Capital", "Rawson", "Rivadavia", "Chimbas", "Santa Lucía", "Pocito"]
CATEGORIES = ["vehiculos", "autos", "celulares", "inmuebles", "electrodomesticos"]


class Visitor(HttpUser):
    wait_time = between(0.5, 2)
    slugs: list[str] = []
    ids: list[str] = []

    def on_start(self) -> None:
        page = self.client.get("/api/v1/listings?limit=48", name="/listings").json()
        self.slugs = [i["slug"] for i in page["items"]]
        self.ids = [i["id"] for i in page["items"]]

    @task(4)
    def home(self) -> None:
        self.client.get("/api/v1/categories", name="/categories")
        self.client.get("/api/v1/listings?limit=8&sort=newest", name="/listings")

    @task(5)
    def search(self) -> None:
        q = random.choice(QUERIES)
        page = self.client.get(f"/api/v1/search?q={q}", name="/search?q").json()
        if page.get("next_cursor"):
            self.client.get(
                f"/api/v1/search?q={q}&cursor={page['next_cursor']}", name="/search?q&cursor"
            )

    @task(3)
    def filter(self) -> None:
        params = {
            "category": random.choice(CATEGORIES),
            "department": random.choice(DEPARTMENTS),
            "sort": random.choice(["newest", "price_asc", "price_desc"]),
        }
        if random.random() < 0.5:
            params["price_max"] = str(random.choice([500000, 2000000, 20000000]))
        self.client.get("/api/v1/listings", params=params, name="/listings?filtros")

    @task(2)
    def suggestions(self) -> None:
        term = random.choice(QUERIES)[: random.randint(2, 5)]
        self.client.get(f"/api/v1/search/suggestions?q={term}", name="/search/suggestions")

    @task(5)
    def detail(self) -> None:
        if self.slugs:
            self.client.get(f"/api/v1/listings/{random.choice(self.slugs)}", name="/listings/{slug}")

    @task(1)
    def contact(self) -> None:
        if self.ids:
            listing_id = random.choice(self.ids)
            self.client.post(
                f"/api/v1/listings/{listing_id}/contact",
                name="/listings/{id}/contact",
                headers={"Origin": "http://localhost:3010", "X-Real-IP": f"10.1.{random.randint(0, 255)}.{random.randint(1, 254)}"},
            )
