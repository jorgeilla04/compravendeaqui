"""Publica en redes lo programado en el calendario cuya hora ya llegó.

Uso (cron del servidor, cada minuto):
    * * * * *  docker compose exec -T api python -m app.scripts.publicar_programadas
"""

from __future__ import annotations

from app.services.calendario import publicar_vencidas

if __name__ == "__main__":
    hechas = publicar_vencidas()
    if hechas:
        print(f"Programadas procesadas: {hechas}")
