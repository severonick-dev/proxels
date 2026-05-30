# DEPLOY — перенос Proxels на боевой сервер

> Финальная версия инструкции будет на Этапе 13. Сейчас — скелет с фиксацией принципов.

## Окружение

- **Локально (разработка):** Windows 10 + Node 20+ + pnpm + Docker. Все скрипты должны
  работать как на Windows (bash-совместимый shell), так и на Linux.
- **Прод:** Ubuntu 22.04 LTS (рекомендуется) на VPS в **РФ** (для соответствия 152-ФЗ
  ч.5 ст.18 — хранение ПДн на территории РФ).
- VPN-ноды Xray — отдельные VPS вне РФ (сейчас в Германии).

> Важно: backend и Postgres с ПДн — в РФ. Сами VPN-ноды Xray могут быть где угодно,
> потому что они **не хранят** ПДн пользователей (только UUID, см. §4a/4b CLAUDE.md).

## Перенос с локального ПК на сервер

1. На сервере: установить Docker, Docker Compose, git, certbot.
2. `git clone https://github.com/severonick-dev/proxels.git /opt/proxels`
3. `cd /opt/proxels && cp .env.example .env` → заполнить всеми реальными секретами.
4. Сгенерировать сильные секреты: `openssl rand -base64 48` для всех `*_SECRET`.
5. `docker compose -f infra/docker/docker-compose.yml up -d --build`
6. Накатить миграции Prisma: `docker compose exec api pnpm prisma migrate deploy`.
7. Выпустить TLS: `certbot --nginx -d proxels.ru -d www.proxels.ru`.
8. Настроить fail2ban (см. ниже).

## fail2ban (минимум)

- Jail для nginx auth (404/401 spam).
- Jail для SSH.
- Jail для попыток перебора `/api/sub/*` (по логам nginx).

## SSH hardening

- Отключить вход по паролю (`PasswordAuthentication no`).
- Только ключи (ed25519 предпочтительно).
- Сменить порт со стандартного 22.
- `AllowUsers <username>` — белый список.

## Бэкапы

- Ежедневный `pg_dump` Postgres → шифрованный архив (`age`/`gpg`) → offsite (S3-совместимое
  хранилище в РФ).
- Ротация: 7 ежедневных + 4 еженедельных + 6 ежемесячных.
- Регулярная проверка восстановления (раз в квартал).

## Мониторинг

- Healthcheck-эндпоинт `/api/health` (есть).
- Uptime-мониторинг внешним сервисом.
- Метрики nginx/postgres/redis (опц. Prometheus + Grafana на отдельной поддомене за
  basic auth + 2FA).

## Чек-лист перед запуском

См. [SECURITY.md](SECURITY.md), [LEGAL.md](LEGAL.md), [PRIVACY-ARCHITECTURE.md](PRIVACY-ARCHITECTURE.md)
(последний создаётся на Этапе 10).
