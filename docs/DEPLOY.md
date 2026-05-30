# DEPLOY — перенос Proxels на боевой сервер

## Окружение

- **Локально (разработка):** Windows 10 + Node 20+ + pnpm + Docker. Все
  скрипты должны работать как на Windows (bash-совместимый shell), так и на
  Linux.
- **Прод:** Ubuntu 22.04 LTS (рекомендуется) на VPS в **РФ** (для
  соответствия 152-ФЗ ч.5 ст.18 — хранение ПДн на территории РФ).
- VPN-ноды Xray — отдельные VPS вне РФ (сейчас в Германии).

> Важно: backend и Postgres с ПДн — в РФ. Сами VPN-ноды Xray могут быть где
> угодно, потому что они **не хранят** ПДн пользователей (только UUID, см.
> §4a/4b CLAUDE.md).

---

## 1. Первичная установка на сервере

Под пользователем с sudo (обычно `root` или ваша персональная учётка):

```bash
# Системные пакеты
sudo apt update
sudo apt install -y curl git rsync postgresql redis-server nginx \
    fail2ban certbot python3-certbot-nginx

# Node + pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pnpm@9

# Системный пользователь сервиса (без shell-логина из вне)
sudo useradd -r -m -s /bin/bash proxels
sudo mkdir -p /opt/proxels /var/log/proxels-deploy /var/www/proxels
sudo chown -R proxels:proxels /opt/proxels /var/log/proxels-deploy /var/www/proxels
```

## 2. Postgres и Redis

```bash
sudo -u postgres createuser proxels --pwprompt
sudo -u postgres createdb -O proxels proxels
# Redis по умолчанию на 6379, локально без пароля — OK для bind 127.0.0.1
```

## 3. Клон + начальный build

Под пользователем `proxels`:

```bash
sudo -iu proxels
cd /opt/proxels
git clone https://github.com/severonick-dev/proxels.git .
cp .env.example .env
# Отредактировать .env: DATABASE_URL, REDIS_URL, JWT_*_SECRET, OWNER_*, YOOKASSA_*,
# и обязательно DEPLOY_ENABLED=true (см. §5).

pnpm install --frozen-lockfile
pnpm --filter @proxels/api prisma:deploy
pnpm --filter @proxels/api build
pnpm --filter @proxels/web build
rsync -a apps/web/dist/ /var/www/proxels/
exit
```

## 4. systemd + sudoers + nginx

```bash
# Systemd unit (см. infra/deploy/proxels-api.service)
sudo install -m 0644 /opt/proxels/infra/deploy/proxels-api.service \
    /etc/systemd/system/proxels-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now proxels-api
sudo systemctl status proxels-api  # active (running)?

# Sudoers — минимальные права для self-update (см. infra/deploy/proxels.sudoers)
sudo visudo -cf /opt/proxels/infra/deploy/proxels.sudoers
sudo install -m 0440 /opt/proxels/infra/deploy/proxels.sudoers /etc/sudoers.d/proxels

# nginx (см. infra/nginx — конфиг создаётся в Этапе 13.1 при наличии домена)
# Базовая идея: static из /var/www/proxels (SPA fallback на index.html),
# `/api/*` → proxy_pass http://127.0.0.1:3000, лимиты на /auth/* и /api/sub/*.

# TLS
sudo certbot --nginx -d proxels.ru -d www.proxels.ru
```

## 5. Self-update из админки (Этап 13)

После выполнения шагов 1-4 self-update готов работать. В админке появится
раздел **«Деплой»** (`/admin/deploy`) с:

- Текущая версия: `tag` или `shortSha` + ветка + дата коммита.
- Последний релиз на git: `latestTag` (через `git ls-remote --tags origin`).
- Плашка «Доступна новая версия v1.2.3» — если current ≠ latest.
- Список последних тегов (можно выбрать конкретный для деплоя).
- Кнопка «Обновить» → диалог с TOTP-кодом → запуск.
- Live-тейл лога деплоя (polling каждые 2 секунды).

**Что происходит при клике «Обновить»:**

1. Frontend → `POST /api/admin/deploy/run { ref: "v1.2.3", totpCode: "123456" }`.
2. Backend проверяет: `role === 'admin'`, `totpSecret != null`, TOTP-код валиден,
   `DEPLOY_ENABLED === true`, нет идущего параллельного деплоя.
3. Backend spawn'ит **внешний скрипт** `/opt/proxels/infra/deploy/deploy.sh
<ref>` в detached-режиме, redirect stdout/stderr → файл в `DEPLOY_LOG_DIR`.
4. Скрипт делает:
   - `git fetch --tags --prune`
   - `git checkout <tag>` (detached HEAD на тег)
   - `pnpm install --frozen-lockfile`
   - `pnpm --filter @proxels/api prisma:deploy` (миграции)
   - `pnpm --filter @proxels/api build && pnpm --filter @proxels/web build`
   - `rsync apps/web/dist/ /var/www/proxels/`
   - `sudo /bin/systemctl restart proxels-api`
   - `sudo /bin/systemctl reload nginx`
5. API процесс рестартится через systemd. Frontend всё это время поллит
   `GET /api/admin/deploy/log` и показывает прогресс. После рестарта первые
   1-2 поллинга могут получить 502 от nginx — UI это переживёт.

**Безопасность self-update:**

- API НЕ выполняет произвольные shell-команды — только заранее установленный
  путь к `deploy.sh`.
- sudoers-правило **только** на `systemctl restart proxels-api` и `nginx
reload`. Никакого `sudo bash` или `sudo -i`.
- Ref валидируется regex'ом `^(?:main|v?\d+\.\d+\.\d+(?:-.*)?)$` — нельзя
  подсунуть `; rm -rf /`, произвольный SHA, или URL.
- **TOTP обязателен на каждый запуск** — даже если access-токен утёк,
  без устройства с 2FA деплой не запустится.
- Каждый запуск (успех + фейл) пишется в `AuditLog` как `admin.deploy.run`
  с `actorId + ip + runId + ref`.
- Параллельные запуски запрещены (400 при попытке).

## 6. fail2ban (минимум)

- Jail для nginx auth (404/401 spam на `/api/auth/*`).
- Jail для SSH.
- Jail для попыток перебора `/api/sub/*` (по логам nginx).

## 7. SSH hardening

- Отключить вход по паролю (`PasswordAuthentication no`).
- Только ключи (ed25519 предпочтительно).
- Сменить порт со стандартного 22.
- `AllowUsers <username>` — белый список (не включать `proxels` — это
  системный сервисный аккаунт без интерактивного входа).

## 8. Бэкапы

- Ежедневный `pg_dump` Postgres → шифрованный архив (`age`/`gpg`) → offsite
  (S3-совместимое хранилище в РФ).
- Ротация: 7 ежедневных + 4 еженедельных + 6 ежемесячных.
- Регулярная проверка восстановления (раз в квартал).

## 9. Мониторинг

- Healthcheck-эндпоинт `/api/health` (есть, Terminus: DB + Redis).
- Uptime-мониторинг внешним сервисом (UptimeRobot / Healthchecks.io).
- Метрики nginx/postgres/redis (опц. Prometheus + Grafana на отдельном
  поддомене за basic auth + 2FA).

## 10. Релизный цикл

Рекомендуемый flow (теги управляют деплоем):

1. На локальной машине: разработка → коммит в `main`.
2. Когда хочется выкатить — `git tag v1.2.3 && git push --tags`.
3. В админке нажимаем «Проверить обновления» → видим v1.2.3 → «Обновить» →
   ввод TOTP → клик.
4. Лог в UI показывает прогресс. Через 1-3 минуты API на новой версии.

Если что-то пошло не так — `ssh` на сервер, `git checkout v1.2.2`, `pnpm
install + build`, `sudo systemctl restart proxels-api`. Скрипт self-update —
для штатных обновлений, не для emergency rollback.

## Чек-лист перед запуском

См. [SECURITY.md](SECURITY.md), [LEGAL.md](LEGAL.md),
[PRIVACY-ARCHITECTURE.md](PRIVACY-ARCHITECTURE.md), а также
[`../infra/deploy/README.md`](../infra/deploy/README.md) — короткий cheatsheet
по self-update инфраструктуре.
