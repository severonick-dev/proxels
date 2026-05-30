# Self-update инфраструктура

Полный flow self-update'а описан в [`docs/DEPLOY.md`](../../docs/DEPLOY.md).
Здесь — артефакты, которые нужно положить на сервер.

## Файлы

- `deploy.sh` — основной скрипт. Принимает 1 аргумент (ref: semver-тег или `main`).
  Делает `git fetch && checkout && pnpm install && build && systemctl restart`.
- `proxels-api.service` — systemd unit для API. Кладётся в `/etc/systemd/system/`.
- `proxels.sudoers` — минимальные права для пользователя `proxels` (только
  рестарт конкретных сервисов, никакого `ALL`). Через `visudo -cf` →
  `/etc/sudoers.d/proxels`.

## Одноразовая установка на сервере

```bash
# Пользователь и каталоги
sudo useradd -r -m -s /bin/bash proxels
sudo mkdir -p /opt/proxels /var/log/proxels-deploy /var/www/proxels
sudo chown -R proxels:proxels /opt/proxels /var/log/proxels-deploy /var/www/proxels

# Клон + первый build
sudo -u proxels git clone https://github.com/severonick-dev/proxels.git /opt/proxels
cd /opt/proxels
sudo -u proxels pnpm install --frozen-lockfile
sudo -u proxels pnpm --filter @proxels/api prisma:deploy
sudo -u proxels pnpm --filter @proxels/api build
sudo -u proxels pnpm --filter @proxels/web build
sudo -u proxels rsync -a apps/web/dist/ /var/www/proxels/

# Скрипт деплоя
sudo install -m 0755 infra/deploy/deploy.sh /opt/proxels/infra/deploy/deploy.sh
# (Уже на месте — он в репо. На всякий случай chmod +x.)
sudo chmod +x /opt/proxels/infra/deploy/deploy.sh

# Sudoers (минимальные права на systemctl)
sudo visudo -cf infra/deploy/proxels.sudoers && \
  sudo install -m 0440 infra/deploy/proxels.sudoers /etc/sudoers.d/proxels

# Systemd unit
sudo install -m 0644 infra/deploy/proxels-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now proxels-api
sudo systemctl status proxels-api  # должно быть active (running)
```

## Включение кнопки в админке

В `/opt/proxels/.env`:

```
DEPLOY_ENABLED=true
DEPLOY_SCRIPT=/opt/proxels/infra/deploy/deploy.sh
DEPLOY_LOG_DIR=/var/log/proxels-deploy
DEPLOY_REPO_DIR=/opt/proxels
```

Перезапустить API один раз вручную:

```bash
sudo systemctl restart proxels-api
```

Дальше: `/admin/deploy` в браузере → «Проверить обновления» → если есть новый
тег → ввести TOTP-код → «Обновить». API spawn'ит `deploy.sh <ref>`, логи
тейлятся прямо в UI.

## Безопасность

- API НЕ может выполнять произвольные shell-команды — только заранее
  установленный `deploy.sh`. Путь к скрипту жёстко зафиксирован в env.
- sudoers разрешает рестарт только `proxels-api` и `nginx reload`, ничего
  больше. Никакой `sudo -i` или `sudo bash`.
- Ref валидируется regex'ом (semver-тег или `main`) — нельзя подсунуть
  `; rm -rf /` или произвольный SHA.
- POST `/api/admin/deploy/run` требует **TOTP-код на каждый запрос** (см.
  `apps/api/src/admin/admin-deploy.controller.ts`). Даже если access-токен
  украден, без устройства с 2FA деплой не запустить.
- Audit-лог: каждый запуск пишется в `AuditLog` как `admin.deploy.run`
  с `actorId + ip + meta { runId, ref }`.
- Параллельные запуски запрещены — пока предыдущий `running`, второй POST → 400.
