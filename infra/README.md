# infra/

Инфраструктурные конфиги. Наполняются по мере готовности этапов:

- `docker/` — Dockerfile'ы для api/web, `docker-compose.yml` (Этап 13).
- `nginx/` — reverse-proxy конфиги, CSP, rate-limit (Этап 13).
- `xray/` — шаблоны `config.json` для VPN-нод (Этап 10).
  Обязательно: `"log": { "loglevel": "warning", "access": "none", "error": "none" }`
  (см. §4a CLAUDE.md и `docs/PRIVACY-ARCHITECTURE.md`).
