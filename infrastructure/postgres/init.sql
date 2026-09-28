-- Inicialización de PostgreSQL para CompraVendeAqui.
-- Corre una sola vez, al crear el volumen de datos.
-- El schema de dominio (users, listings, etc.) se agrega en Fase 1 con migraciones.

-- Extensiones necesarias:
--   pgcrypto  → gen_random_uuid() para PKs UUID
--   unaccent  → búsqueda full-text en español sin tildes
--   pg_trgm   → sugerencias / autocomplete por similitud
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
