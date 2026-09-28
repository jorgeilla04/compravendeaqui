"""Modelos ORM. Los modelos de dominio se agregan en Fase 1."""

from app.models.base import Base, TimestampMixin

__all__ = ["Base", "TimestampMixin"]
