"""Router de la API v1."""

from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    categories,
    listings,
    search,
    seo,
    uniformes,
    uniformes_admin,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(categories.router)
# search antes que listings: /listings (listado) vive en search.py.
api_router.include_router(search.router)
api_router.include_router(listings.router)
api_router.include_router(users.router)
api_router.include_router(seo.router)
api_router.include_router(uniformes.router)
api_router.include_router(uniformes_admin.router)
