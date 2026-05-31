# LAUNCH-MVP — поднять Proxels на голое железо

Этот файл — конкретная инструкция: какие команды на каком сервере запустить,
чтобы получить **работающий MVP** Proxels: сайт, регистрация, Free-подписка,
VPN-подключение и failover между нодами.

**В этой версии:**

- Сайт работает по IP, без TLS (HTTP). Домен переедет позже — TLS включим
  тогда же.
- Тариф один: **Free**, безлимит, без оплаты. ЮKassa подключим, когда
  пройдёт верификация документов.
- Обе DE-ноды используют **общий UUID** (`Node.fallbackUuid` в БД +
  статически прописан в Xray-конфиге). Это MVP-режим: gRPC AddUser не нужен,
  Xray принимает любого клиента с этим UUID.
- Failover работает за счёт того, что подписка содержит две VLESS-ссылки
  (по одной на каждую ноду). Клиент Nekobox/Hiddify сам пробует обе.

**Что вам нужно перед стартом:**

- 1 сервер RF (reg.ru), Ubuntu 22.04, ≥ 2 GB RAM, белый IP, доступ root по SSH.
- 2 сервера DE (koara.cloud), Ubuntu 22.04, ≥ 1 GB RAM, белый IP каждый, root по SSH.
- Telegram-бот для уведомлений (опц., не критично для MVP).

Дальше — три части в строгом порядке: **сначала DE-ноды, потом RF, потом
проверки**. Не меняйте порядок — RF опирается на готовые ноды.

---

## Часть 1. Германия — нода DE-1 (koara.cloud)

> Все команды на этом сервере под `root` (или `sudo`).

### 1.1 Базовая безопасность

```bash
# Обновить систему
apt update && apt upgrade -y

# Сменить порт SSH и отключить пароль
sed -i 's/^#\?Port .*/Port 2222/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart sshd
# !!! Не закрывайте текущий SSH, в другой вкладке проверьте подключение по
# !!! новому порту 2222: ssh -p 2222 root@<DE-1-IP>

# Firewall: только 22+2222 (SSH) и 443 (Xray)
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 2222/tcp
ufw allow 443/tcp
ufw --force enable

# Опционально: fail2ban
apt install -y fail2ban
systemctl enable --now fail2ban
```

### 1.2 Установить Xray

```bash
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
xray version  # должно вывести версию >= 1.8
```

### 1.3 Сгенерировать Reality keys + shared UUID

> **ВНИМАНИЕ:** эти три значения нужно потом скопировать **на DE-2 в точно
> такой же конфиг и в БД на RF**. Сохраните их сейчас в отдельный файл.

```bash
# Reality keypair (одна пара на обе ноды!)
xray x25519
# Пример вывода:
#   Private key: aBcDeF...                      <-- скопируйте оба
#   Public key:  XyZ123...                       <--

# Short ID — 8 hex-символов
openssl rand -hex 8
# Пример: 1a2b3c4d5e6f7890

# Shared UUID (один на обе ноды)
xray uuid
# Пример: 11111111-2222-3333-4444-555555555555
```

Сохраните **на локальной машине** (не на сервере!) эти 4 значения:

```
REALITY_PRIV=...
REALITY_PUB=...
REALITY_SID=...
SHARED_UUID=...
```

### 1.4 Xray config

```bash
cat > /usr/local/etc/xray/config.json <<EOF
{
  "log": {
    "loglevel": "warning",
    "access": "none",
    "error": "none"
  },
  "inbounds": [
    {
      "tag": "vless-reality",
      "listen": "0.0.0.0",
      "port": 443,
      "protocol": "vless",
      "settings": {
        "clients": [
          {
            "id": "<SHARED_UUID>",
            "flow": "xtls-rprx-vision"
          }
        ],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "tcp",
        "security": "reality",
        "realitySettings": {
          "dest": "www.microsoft.com:443",
          "serverNames": ["www.microsoft.com"],
          "privateKey": "<REALITY_PRIV>",
          "shortIds": ["<REALITY_SID>"]
        }
      },
      "sniffing": {
        "enabled": false
      }
    }
  ],
  "outbounds": [
    { "protocol": "freedom", "tag": "direct" }
  ]
}
EOF
```

**Замените** `<SHARED_UUID>`, `<REALITY_PRIV>`, `<REALITY_SID>` своими значениями.

> Принципиально: `"access": "none"` + `"error": "none"` + `sniffing.enabled: false`.
> Это наша гарантия no-logs (см. `docs/PRIVACY-ARCHITECTURE.md`).

### 1.5 Запуск

```bash
systemctl restart xray
systemctl enable xray
systemctl status xray  # active (running)?

# Проверка снаружи (с локальной машины):
nc -zv <DE-1-IP> 443    # должно показать "open"
```

---

## Часть 2. Германия — нода DE-2

**Тот же сервер, тот же дистрибутив, тот же playbook.** Скопируйте шаги 1.1–1.5
дословно — **с теми же значениями `SHARED_UUID`, `REALITY_PRIV`, `REALITY_PUB`,
`REALITY_SID`**.

То есть DE-1 и DE-2 — клоны друг друга на уровне Xray-конфига. Разные у них
только публичные IP и hostname сервера.

> Почему одинаковый конфиг? В MVP-режиме gRPC AddUser не используется. Клиент
> подключается по VLESS Reality с одним UUID — он одинаковый на обоих
> серверах. Когда один из них падает, клиент идёт на второй с теми же
> credentials — failover автоматический.

---

## Часть 3. РФ — backend + сайт (reg.ru)

> Все команды под пользователем с sudo (обычно `root`).

### 3.1 Базовая безопасность (как в 1.1)

```bash
apt update && apt upgrade -y
sed -i 's/^#\?Port .*/Port 2222/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin .*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart sshd

apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 2222/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### 3.2 Системные пакеты

```bash
apt install -y curl git rsync nginx postgresql redis-server fail2ban

# Node 20 + pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm i -g pnpm@9
node -v && pnpm -v
```

### 3.3 Postgres и Redis

```bash
# Postgres: создать пользователя и базу
sudo -u postgres psql <<SQL
CREATE USER proxels WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE proxels OWNER proxels;
SQL

# Запомните пароль — он пойдёт в DATABASE_URL.

# Redis по умолчанию на 127.0.0.1:6379 — оставляем как есть.
systemctl enable --now redis-server
systemctl enable --now postgresql
```

### 3.4 Системный пользователь и каталоги

```bash
useradd -r -m -s /bin/bash proxels
mkdir -p /opt/proxels /var/log/proxels-deploy /var/www/proxels
chown -R proxels:proxels /opt/proxels /var/log/proxels-deploy /var/www/proxels
```

### 3.5 Клон + начальный build

```bash
sudo -iu proxels
cd /opt/proxels
git clone https://github.com/severonick-dev/proxels.git .

# Скопируйте .env.example в .env и отредактируйте (см. ниже)
cp .env.example .env
nano .env
```

**В `.env` обязательно отредактируйте (минимум для MVP):**

```bash
NODE_ENV=production
APP_URL=http://<RF-IP>                  # пока без домена
API_URL=http://<RF-IP>
API_PORT=3000

DATABASE_URL=postgresql://proxels:CHANGE_ME_STRONG_PASSWORD@127.0.0.1:5432/proxels
REDIS_URL=redis://127.0.0.1:6379

# !!! Сильные секреты — обязательно сгенерировать заново !!!
# Откройте 2 раза: openssl rand -base64 48
JWT_ACCESS_SECRET=<48+ символов случайных>
JWT_REFRESH_SECRET=<48+ символов случайных, другие>

COOKIE_DOMAIN=                          # пусто, пока без домена (Chrome отбрасывает Domain=<IP>)
COOKIE_SECURE=false                     # пока HTTP

# Captcha — для MVP None (потом включим Yandex SmartCaptcha)
CAPTCHA_PROVIDER=none

# Xray: noop (gRPC AddUser не используется в MVP)
XRAY_CLIENT=noop

# Токен для будущего gRPC — generate чтобы валидация не упала
XRAY_NODE_API_TOKEN=<32+ случайных символов>

# ЮKassa оставляем пустой — Free-тариф её не использует
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=

# Реквизиты ИП (уже в env.example, проверьте что верные)
OWNER_FIO=Коробейников Сергей Сергеевич
OWNER_OGRNIP=324253600103000
OWNER_INN=250501904935
CONTACT_TELEGRAM=https://t.me/proxels

# Seed admin
SEED_ADMIN_EMAIL=admin@proxels.ru
SEED_ADMIN_PASSWORD=<сильный пароль >= 10 символов>

# Self-update (включим после первого запуска)
DEPLOY_ENABLED=false

# Health-check
HEALTH_CHECK_INTERVAL_SECONDS=15        # для MVP чаще, чтобы failover был быстрый
HEALTH_FLAP_UP_THRESHOLD=2
HEALTH_FLAP_DOWN_THRESHOLD=2
```

Сохраните файл (`Ctrl+O`, `Ctrl+X`).

```bash
# Build
pnpm install --frozen-lockfile
pnpm --filter @proxels/api prisma:deploy
pnpm --filter @proxels/api prisma:seed         # создаст 3 тарифа + админа
pnpm --filter @proxels/api build
pnpm --filter @proxels/web build

# Перенести собранный фронт
rsync -a apps/web/dist/ /var/www/proxels/

# Выйти из user proxels — дальше под sudo
exit
```

### 3.6 systemd unit для API

```bash
install -m 0644 /opt/proxels/infra/deploy/proxels-api.service \
    /etc/systemd/system/proxels-api.service
systemctl daemon-reload
systemctl enable --now proxels-api
systemctl status proxels-api  # должно быть active (running)
journalctl -u proxels-api -n 50 --no-pager   # проверьте логи
```

Если что-то падает — смотрите journal, обычно проблема в `.env`
(невалидный URL, забыли секрет, и т.п.).

### 3.7 nginx (HTTP по IP)

```bash
cat > /etc/nginx/sites-available/proxels <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    client_max_body_size 4m;

    # API
    location /api/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Статика SPA
    root /var/www/proxels;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    # gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               application/x-javascript text/xml application/xml application/xml+rss
               text/javascript image/svg+xml application/wasm;
    gzip_min_length 1024;

    # Кэширование статики (не index.html — её надо всегда свежей)
    location ~* \.(?:js|css|svg|png|jpg|jpeg|gif|webp|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

ln -sf /etc/nginx/sites-available/proxels /etc/nginx/sites-enabled/proxels
rm -f /etc/nginx/sites-enabled/default
nginx -t            # должно сказать "syntax is ok"
systemctl reload nginx
```

### 3.8 Проверка: открыть сайт

С локальной машины:

```bash
curl -I http://<RF-IP>          # ожидаем 200 OK
curl -sS http://<RF-IP>/api/health   # {"status":"ok",...}
curl -sS http://<RF-IP>/api/plans    # три плана: Free / Medium / High
```

В браузере: `http://<RF-IP>` — должен открыться лендинг Proxels.

### 3.9 Залогиниться админом, добавить ноды

В браузере:

1. Откройте `http://<RF-IP>/auth/login`
2. Войдите как `admin@proxels.ru` / тот пароль, что задали в `SEED_ADMIN_PASSWORD`
3. Перейдите на `http://<RF-IP>/admin/nodes`

Сейчас там пусто (или дев-ноды из seed). Удалить дев-ноды и добавить
реальные **через curl** (UI для CRUD нод сделаем позже):

```bash
# Получите admin access-токен через login. Сначала логин в браузере, потом
# открыть DevTools → Network → запрос `/api/auth/login` → скопировать
# `accessToken` из ответа.
TOKEN="paste-access-token-here"
API="http://<RF-IP>/api"

# Добавить DE-1
curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$API/admin/nodes" -d '{
    "name": "de-1",
    "host": "<DE-1-PUBLIC-IP>",
    "port": 443,
    "country": "DE",
    "xrayApiAddr": "127.0.0.1:10085",
    "publicKey": "<REALITY_PUB>",
    "shortId": "<REALITY_SID>",
    "sni": "www.microsoft.com",
    "inboundTag": "vless-reality",
    "fallbackUuid": "<SHARED_UUID>",
    "weight": 100
  }'

# Добавить DE-2 (всё то же, кроме host и name)
curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$API/admin/nodes" -d '{
    "name": "de-2",
    "host": "<DE-2-PUBLIC-IP>",
    "port": 443,
    "country": "DE",
    "xrayApiAddr": "127.0.0.1:10085",
    "publicKey": "<REALITY_PUB>",
    "shortId": "<REALITY_SID>",
    "sni": "www.microsoft.com",
    "inboundTag": "vless-reality",
    "fallbackUuid": "<SHARED_UUID>",
    "weight": 100
  }'
```

> `xrayApiAddr` для MVP — заглушка. Поле обязательное в схеме, но `XRAY_CLIENT=noop`
> его не дёргает. Когда внедрим gRPC AddUser — впишем реальный адрес и
> настроим в Xray HandlerService inbound.

> `fallbackUuid` — это тот же `SHARED_UUID`, что вы прописали в Xray config на
> обеих DE-нодах. Backend будет использовать его в VLESS-ссылках.

### 3.10 Подождать health-check

Health-check работает периодически (`HEALTH_CHECK_INTERVAL_SECONDS=15`).
Через 30-40 секунд после добавления нод откройте `http://<RF-IP>/admin/nodes`
— обе должны стать **online** (зелёная галочка).

Если не становятся online — посмотрите в `journalctl -u proxels-api -f`:
скорее всего TCP-проба не достучалась до xrayApiAddr.

**Лайфхак для MVP:** TCP-проба пробит `xrayApiAddr` (`127.0.0.1:10085`),
которого на ноде нет. Чтобы health-check работал, можно:

- Заменить `xrayApiAddr` на тот же `<DE-IP>:443` — health-check будет
  пробить Xray-инбаунд (он живой).
- Или поднять на нодах dummy-listener (`socat TCP-LISTEN:10085,fork /dev/null`).

Для MVP проще **первый вариант**:

```bash
# Обновить ноды (admin token и API те же)
curl -sS -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$API/admin/nodes/<de-1-node-id>" -d '{"xrayApiAddr":"<DE-1-IP>:443"}'

curl -sS -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$API/admin/nodes/<de-2-node-id>" -d '{"xrayApiAddr":"<DE-2-IP>:443"}'
```

ID нод можно достать так: `curl -H "Authorization: Bearer $TOKEN" "$API/admin/nodes/health" | jq`.

---

## Часть 4. Тест от лица пользователя

### 4.1 Регистрация + Free

1. Откройте `http://<RF-IP>` в режиме инкогнито (чтобы не пересеклось с
   админ-сессией).
2. На главной выберите платформу (Windows / Android / iOS).
3. Пройдите регистрацию (любой email, пароль).
4. На странице авторизации войдите.
5. Вас перебросит в гайд по выбранной платформе.
6. Перейдите в `/lk` (личный кабинет) — там пусто, нет подписки.
7. Перейдите в `/pricing` или `/lk` → выбор тарифа → **Free** → «Активировать».
8. После активации в `/lk` появится **subscription URL** вида
   `http://<RF-IP>/api/sub/<32-symbol-token>`.
9. Скопируйте этот URL.

### 4.2 Импорт в клиент

Поставьте на устройство клиент по выбранной платформе:

- **Android:** Nekobox (Google Play или [GitHub Releases](https://github.com/MatsuriDayo/NekoBoxForAndroid/releases))
- **iOS:** Hiddify (App Store)
- **Windows:** [v2rayN](https://github.com/2dust/v2rayN/releases) или [V2RayTun](https://v2raytun.com)

В клиенте:

1. Add subscription / Import → URL.
2. Вставьте subscription URL из ЛК.
3. Обновите подписку.
4. Должно появиться **2 сервера** в списке: `Proxels · de-1` и `Proxels · de-2`.
5. Выберите любой → подключиться → откройте google.com → должен открыться.

Если не подключается:

- Проверьте firewall на DE-сервере: `ufw status` — должен быть открыт 443.
- Проверьте Xray: `systemctl status xray`, `journalctl -u xray -n 50`.
- Проверьте, что `fallbackUuid` в БД и `id` в Xray config совпадают.
- Проверьте, что `publicKey` в БД и `privateKey` в Xray — одна пара (через
  `xray x25519 -i <priv>` можно перепроверить публичный).

### 4.3 Тест failover

Откройте `http://<RF-IP>/admin/nodes` в админ-вкладке — обе ноды online.

На сервере **DE-1**:

```bash
systemctl stop xray
```

Подождите 30-40 секунд (health-check два провала подряд → offline).

В админке обновите страницу — **de-1** должна стать **offline**.

В клиенте (Nekobox/Hiddify) — пере-подключитесь. Если выбран был de-1 —
переключитесь на de-2 вручную, либо включите автоматический выбор лучшего
сервера в настройках клиента. Интернет через VPN должен продолжать работать.

Дополнительно: в клиенте дёрните «обновить подписку» — backend теперь
отдаст **только** de-2 (de-1 исключён из списка, так как offline).

Верните DE-1:

```bash
systemctl start xray
```

Через ~30 секунд в админке de-1 снова **online**. После следующего обновления
подписки клиент опять увидит обе.

---

## Часть 5. Что делать дальше

### 5.1 Когда переедет домен

1. На timeweb: перенести `proxels.ru` к новому регистратору (DNS-нашему или
   reg.ru — куда удобно).
2. На целевом регистраторе: A-запись `proxels.ru` → `<RF-IP>`,
   `www.proxels.ru` → `<RF-IP>`.
3. На RF-сервере дождаться обновления DNS (от 5 минут до 24 часов):
   ```bash
   dig proxels.ru +short      # должно вернуть <RF-IP>
   ```
4. Получить TLS:
   ```bash
   apt install -y python3-certbot-nginx
   certbot --nginx -d proxels.ru -d www.proxels.ru
   # certbot сам обновит nginx-конфиг на 443 + редирект 80 → 443
   ```
5. Обновить `.env`:
   ```
   APP_URL=https://proxels.ru
   API_URL=https://proxels.ru
   COOKIE_DOMAIN=proxels.ru
   COOKIE_SECURE=true
   ```
6. `sudo systemctl restart proxels-api`.

### 5.2 Когда подтвердят ЮKassa

1. В личном кабинете ЮKassa заберите `shopId` и `secretKey`.
2. В `.env` на RF:
   ```
   YOOKASSA_SHOP_ID=<реальный>
   YOOKASSA_SECRET_KEY=<реальный>
   YOOKASSA_WEBHOOK_SECRET=<сгенерировать openssl rand -base64 32>
   YOOKASSA_RETURN_URL=https://proxels.ru/lk/payments
   ```
3. В личном кабинете ЮKassa настройте webhook на URL `https://proxels.ru/api/payments/webhook`.
4. `sudo systemctl restart proxels-api`.
5. Тарифы Medium и High сразу станут доступны для покупки в `/pricing`.

### 5.3 Включить self-update

Когда хотите обновлять сайт прямо из админки без захода на сервер:

```bash
# Установить sudoers-правило
sudo install -m 0440 /opt/proxels/infra/deploy/proxels.sudoers /etc/sudoers.d/proxels

# В .env:
DEPLOY_ENABLED=true
DEPLOY_SCRIPT=/opt/proxels/infra/deploy/deploy.sh
DEPLOY_LOG_DIR=/var/log/proxels-deploy
DEPLOY_REPO_DIR=/opt/proxels

sudo systemctl restart proxels-api
```

Дальше: в коде → `git tag v0.2.0 && git push --tags` → в админке
`/admin/deploy` → «Обновить» → ввод TOTP-кода → ждать 1-3 минуты.

Подробнее: [`docs/DEPLOY.md`](DEPLOY.md), раздел 5.

### 5.4 Включить 2FA для админа

В `/lk/security` → «Включить 2FA» → отсканировать QR в Google Authenticator /
Authy → ввести 6-значный код. С этого момента вход в админку требует код, и
self-update тоже.

### 5.5 Бэкапы Postgres

Простой ежедневный скрипт (положите в `/etc/cron.daily/proxels-backup`):

```bash
#!/bin/bash
set -e
TS=$(date +%Y-%m-%d)
DIR=/var/backups/proxels
mkdir -p $DIR
sudo -u postgres pg_dump proxels | gzip > $DIR/proxels-$TS.sql.gz
# Удалить старые (>30 дней)
find $DIR -name 'proxels-*.sql.gz' -mtime +30 -delete
```

`chmod +x /etc/cron.daily/proxels-backup`. Cron автоматически запустит раз в сутки.

> Перед запуском в прод: настройте offsite-копию (например, в Yandex Cloud Object
> Storage, или просто на свой PC через rsync) — иначе бэкапы погибнут вместе с сервером.

---

## Шпаргалка по проверке здоровья

На RF-сервере под `proxels`:

```bash
# Сервисы
systemctl status proxels-api
systemctl status nginx
systemctl status postgresql
systemctl status redis-server

# Логи
journalctl -u proxels-api -n 100 --no-pager
journalctl -u proxels-api -f                  # live

# DB
sudo -u postgres psql proxels -c "SELECT count(*) FROM \"User\";"
sudo -u postgres psql proxels -c "SELECT id,name,status,host FROM \"Node\";"

# Redis: список онлайн-нод
redis-cli SMEMBERS proxels:nodes:online
```

На DE-сервере:

```bash
systemctl status xray
journalctl -u xray -n 50 --no-pager
ss -tlnp | grep 443    # Xray должен слушать
```

---

## Когда что-то сломалось

| Симптом                               | Куда смотреть                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Сайт не открывается                   | `systemctl status nginx`, `ss -tlnp \| grep 80`                                                                     |
| Login 500                             | `journalctl -u proxels-api -n 100`, Postgres коннект из `.env`                                                      |
| /api/plans 404                        | API не запустилась, см. journal                                                                                     |
| Подписочный URL 404                   | у юзера нет активной подписки, либо `subToken` невалидный                                                           |
| В подписке 0 серверов                 | health-check считает все ноды offline — TCP-проба не доходит до `xrayApiAddr`                                       |
| Клиент подключается, но интернета нет | UUID в Xray ≠ `fallbackUuid` в БД, либо `privateKey` Xray не от `publicKey` в БД                                    |
| Failover не сработал                  | `HEALTH_FLAP_DOWN_THRESHOLD` слишком большой, либо клиент не обновил подписку (тапни «обновить подписку» в Nekobox) |

---

Если что-то идёт сильно не по плану — `journalctl -u proxels-api -f` и
`journalctl -u xray -f` дают 95% диагностики. Удачного запуска.
