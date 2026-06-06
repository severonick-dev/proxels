# LAUNCH-MVP — поднять Proxels на голое железо

Этот файл — конкретная инструкция: какие команды на каком сервере запустить,
чтобы получить **работающий MVP** Proxels: сайт, регистрация, Free-подписка,
VPN-подключение, failover между нодами и **уникальный UUID на каждого
пользователя** (per-user provisioning через gRPC AddUser).

**В этой версии:**

- Сайт работает по IP, без TLS (HTTP). Домен переедет позже — TLS включим
  тогда же.
- Тариф один: **Free**, безлимит, без оплаты. ЮKassa подключим, когда
  пройдёт верификация документов.
- На каждой DE-ноде поднят **Xray API inbound** (gRPC). Backend на RF
  динамически регистрирует/удаляет пользователей через `AlterInbound`.
  Каждый юзер — отдельный UUID, можно мгновенно кикнуть, можно считать
  per-user трафик.
- Канал RF→DE для gRPC API защищён **firewall'ом**: на DE открыт порт
  `10085` только для IP RF-сервера. Никаких публичных портов API.
- Failover работает за счёт того, что подписка содержит две VLESS-ссылки
  (по одной на каждую ноду). Если одна нода падает — health-check на RF
  замечает за ~30 сек, исключает её из подписки. Клиент Nekobox/Hiddify
  переключается на живую.

**Что вам нужно перед стартом:**

- 1 сервер RF (reg.ru), Ubuntu 22.04, ≥ 2 GB RAM, белый IP, доступ root по SSH.
- 2 сервера DE (koara.cloud), Ubuntu 22.04, ≥ 1 GB RAM, белый IP каждый, root по SSH.

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
# !!! Не закрывайте текущий SSH, в другой вкладке проверьте новый порт:
# !!! ssh -p 2222 root@<DE-1-IP>

# Firewall: SSH (2222), Xray VLESS (443), Xray API (10085 только для RF)
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow 2222/tcp comment 'SSH'
ufw allow 443/tcp comment 'Xray VLESS'
# ВАЖНО: <RF-IP> — публичный IP вашего RF-сервера. Когда поднимете RF и
# узнаете его IP — вернитесь и выполните эту команду на ОБЕИХ DE-нодах.
ufw allow from <RF-IP> to any port 10085 proto tcp comment 'Xray gRPC API (RF only)'
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

### 1.3 Сгенерировать Reality keys

**ВАЖНО:** эти значения нужно потом скопировать **на DE-2 в точно такой же
конфиг и в БД на RF**. Сохраните их сейчас в отдельный файл на локальной
машине.

```bash
xray x25519
# Пример вывода:
#   Private key: aBcDeF...
#   Public key:  XyZ123...

openssl rand -hex 8
# Пример: 1a2b3c4d5e6f7890   (это shortId)
```

Сохраните на локальной машине:

```
REALITY_PRIV=...
REALITY_PUB=...
REALITY_SID=...
```

> UUID юзеров здесь генерировать не нужно — их будет создавать backend
> динамически через gRPC. В конфиге Xray мы оставим **один технический
> placeholder UUID** для bootstrap (без него Xray откажется стартовать с
> пустым `clients`).

```bash
xray uuid
# Пример: 00000000-0000-0000-0000-000000000001
# Это PLACEHOLDER — НЕ выдавайте его юзерам.
```

### 1.4 Xray config

```bash
cat > /usr/local/etc/xray/config.json <<'EOF'
{
  "log": {
    "loglevel": "warning",
    "access": "none",
    "error": "none"
  },
  "api": {
    "tag": "api",
    "services": ["HandlerService", "StatsService"]
  },
  "stats": {},
  "policy": {
    "levels": {
      "0": {
        "statsUserUplink": true,
        "statsUserDownlink": true
      }
    },
    "system": {
      "statsInboundUplink": false,
      "statsInboundDownlink": false
    }
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
            "id": "<PLACEHOLDER_UUID>",
            "email": "placeholder",
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
    },
    {
      "tag": "api-in",
      "listen": "0.0.0.0",
      "port": 10085,
      "protocol": "dokodemo-door",
      "settings": { "address": "127.0.0.1" }
    }
  ],
  "outbounds": [
    { "protocol": "freedom", "tag": "direct" }
  ],
  "routing": {
    "rules": [
      {
        "type": "field",
        "inboundTag": ["api-in"],
        "outboundTag": "api"
      }
    ]
  }
}
EOF
```

**Замените** `<PLACEHOLDER_UUID>`, `<REALITY_PRIV>`, `<REALITY_SID>` своими
значениями.

> Принципиально (no-logs): `"access": "none"` + `"error": "none"` + `sniffing.enabled: false`.
> Это наша гарантия (см. `docs/PRIVACY-ARCHITECTURE.md`).

> Также важно: `api-in` слушает на `0.0.0.0:10085`. **На уровне Xray-конфига
> auth у API нет** — защита по сети через ufw `allow from <RF-IP>` (см. 1.1).
> Если RF-IP сменится — обновить ufw rule.

### 1.5 Запуск

```bash
systemctl restart xray
systemctl enable xray
systemctl status xray  # active (running)?

# Проверка снаружи (с локальной машины):
nc -zv <DE-1-IP> 443    # должно показать "open"

# Проверка API (с локальной машины, должно быть закрыто):
nc -zv <DE-1-IP> 10085  # должно показать filtered/timeout (firewall режет)
```

---

## Часть 2. Германия — нода DE-2

**Тот же сервер, тот же дистрибутив, тот же playbook.** Скопируйте шаги 1.1–1.5
дословно — **с теми же значениями `REALITY_PRIV`, `REALITY_PUB`, `REALITY_SID`,
`PLACEHOLDER_UUID`**.

То есть DE-1 и DE-2 — клоны друг друга на уровне Xray-конфига. Разные у них
только публичные IP и hostname сервера.

> Reality keys одинаковые, потому что клиенту нужно пользоваться одним и тем
> же `publicKey`/`shortId` для обеих нод. Сами юзеры (UUID'ы) будут
> регистрироваться backend'ом на каждой ноде индивидуально через gRPC.

### 2.x Добавление ноды задним числом (когда основной DE-1 уже работает)

Если RF/DE-1 уже подняты и вы добавляете ещё одну ноду:

1. Поднимите Xray на новой машине по шагам 1.1–1.5 — **одинаковые
   `REALITY_PRIV/PUB/SID/PLACEHOLDER_UUID` с DE-1**.
2. На новой ноде `ufw allow from <RF-IP> to any port 10085 proto tcp`.
3. С RF проверьте gRPC-доступ: `nc -zv <new-DE-IP> 10085`.
4. Создайте ноду через админ API (см. шаги в §3.10).
5. Подождите 30–40 сек health-check.
6. На уже выпущенных подписках клиенты получат новую ноду **автоматически**
   при следующем обновлении подписки (`Profile-Update-Interval` ≈ 24ч,
   либо вручную из клиента).
7. Если хотите немедленно — дёрните endpoint **«перезалить юзеров на ноде»**
   (см. §5 ниже).

---

## Часть 3. РФ — backend + сайт (reg.ru)

> Все команды под пользователем с sudo (обычно `root`).

### 3.1 Базовая безопасность

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
sudo -u postgres psql <<SQL
CREATE USER proxels WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE proxels OWNER proxels;
SQL

systemctl enable --now redis-server
systemctl enable --now postgresql
```

### 3.4 Системный пользователь и каталоги

```bash
useradd -r -m -s /bin/bash proxels
mkdir -p /opt/proxels /var/log/proxels-deploy /var/www/proxels
chown -R proxels:proxels /opt/proxels /var/log/proxels-deploy /var/www/proxels
```

### 3.5 Перейдите на DE и обновите ufw-правила

Прямо сейчас на каждой DE-ноде разрешите gRPC только от RF:

```bash
# На DE-1 и DE-2:
ufw allow from <RF-IP> to any port 10085 proto tcp comment 'Xray gRPC API (RF only)'
ufw reload
```

`<RF-IP>` — публичный IP RF-сервера (`curl -4 ifconfig.me` подскажет).

### 3.6 Клон + начальный build

```bash
sudo -iu proxels
cd /opt/proxels
git clone https://github.com/severonick-dev/proxels.git .

cp .env.example .env
nano .env
```

**В `.env` обязательно отредактируйте (минимум для MVP):**

```bash
NODE_ENV=production
APP_URL=http://<RF-IP>
API_URL=http://<RF-IP>
API_PORT=3000

DATABASE_URL=postgresql://proxels:CHANGE_ME_STRONG_PASSWORD@127.0.0.1:5432/proxels
REDIS_URL=redis://127.0.0.1:6379

# Сильные секреты — обязательно: openssl rand -base64 48
JWT_ACCESS_SECRET=<48+ символов случайных>
JWT_REFRESH_SECRET=<48+ символов случайных, другие>

COOKIE_DOMAIN=
COOKIE_SECURE=false

CAPTCHA_PROVIDER=none

# !!! Включаем боевой gRPC к Xray !!!
XRAY_CLIENT=grpc

# Токен для gRPC metadata. На сторонe Xray НЕТ встроенной проверки токена,
# защита — на уровне firewall. Но сам токен валидируется на старте Node-процесса.
XRAY_NODE_API_TOKEN=<32+ случайных символа: openssl rand -base64 32>

# ЮKassa оставляем пустой — Free-тариф её не использует
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=

OWNER_FIO=Коробейников Сергей Сергеевич
OWNER_OGRNIP=324253600103000
OWNER_INN=250501904935
CONTACT_TELEGRAM=https://t.me/proxels

SEED_ADMIN_EMAIL=admin@proxels.ru
SEED_ADMIN_PASSWORD=<сильный пароль >= 10 символов>

DEPLOY_ENABLED=false

# Быстрый failover (агрессивные пороги для MVP, можно ослабить позже)
HEALTH_CHECK_INTERVAL_SECONDS=15
HEALTH_FLAP_UP_THRESHOLD=2
HEALTH_FLAP_DOWN_THRESHOLD=2
```

```bash
# Build
pnpm install --frozen-lockfile
pnpm --filter @proxels/api prisma:deploy
pnpm --filter @proxels/api prisma:seed     # создаст 3 тарифа + админа
pnpm --filter @proxels/api build
pnpm --filter @proxels/web build

# Перенести собранный фронт
rsync -a apps/web/dist/ /var/www/proxels/

exit
```

### 3.7 systemd unit для API

```bash
install -m 0644 /opt/proxels/infra/deploy/proxels-api.service \
    /etc/systemd/system/proxels-api.service
systemctl daemon-reload
systemctl enable --now proxels-api
systemctl status proxels-api
journalctl -u proxels-api -n 50 --no-pager
```

### 3.8 nginx (HTTP по IP)

```bash
cat > /etc/nginx/sites-available/proxels <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    client_max_body_size 4m;

    location /api/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    root /var/www/proxels;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript
               application/x-javascript text/xml application/xml application/xml+rss
               text/javascript image/svg+xml application/wasm;
    gzip_min_length 1024;

    location ~* \.(?:js|css|svg|png|jpg|jpeg|gif|webp|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

ln -sf /etc/nginx/sites-available/proxels /etc/nginx/sites-enabled/proxels
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

### 3.9 Проверка: сайт работает

С локальной машины:

```bash
curl -I http://<RF-IP>
curl -sS http://<RF-IP>/api/health
curl -sS http://<RF-IP>/api/plans
```

В браузере: `http://<RF-IP>` — должен открыться лендинг Proxels.

### 3.10 Залогиниться админом, добавить ноды

В браузере: `http://<RF-IP>/auth/login` → войдите как `admin@proxels.ru` /
пароль из `SEED_ADMIN_PASSWORD`. Откройте DevTools → Network → запрос
`/api/auth/login` → скопируйте `accessToken` из ответа.

```bash
TOKEN="paste-access-token-here"
API="http://<RF-IP>/api"

# Добавить DE-1.
# xrayApiAddr = <DE-IP>:10085 (это Xray API inbound).
# publicKey + shortId = ваши Reality-значения.
# fallbackUuid НЕ передаём — backend будет генерировать UUID per-user через gRPC.
curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$API/admin/nodes" -d '{
    "name": "de-1",
    "host": "<DE-1-PUBLIC-IP>",
    "port": 443,
    "country": "DE",
    "xrayApiAddr": "<DE-1-PUBLIC-IP>:10085",
    "publicKey": "<REALITY_PUB>",
    "shortId": "<REALITY_SID>",
    "sni": "www.microsoft.com",
    "inboundTag": "vless-reality",
    "weight": 100
  }'

# Добавить DE-2 (всё то же, кроме host, xrayApiAddr и name)
curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  "$API/admin/nodes" -d '{
    "name": "de-2",
    "host": "<DE-2-PUBLIC-IP>",
    "port": 443,
    "country": "DE",
    "xrayApiAddr": "<DE-2-PUBLIC-IP>:10085",
    "publicKey": "<REALITY_PUB>",
    "shortId": "<REALITY_SID>",
    "sni": "www.microsoft.com",
    "inboundTag": "vless-reality",
    "weight": 100
  }'
```

> Если у вас одна нода — gRPC API работать не будет (firewall не разрешит),
> и health-check будет считать её **offline**. В этом случае можно временно
> использовать MVP-режим с общим UUID: передать `"fallbackUuid": "<PLACEHOLDER_UUID>"`
> при создании ноды → backend не будет звать gRPC, будет использовать
> placeholder UUID. Это аварийный режим — для прода всё-таки настройте gRPC.

### 3.11 Подождать health-check

Health-check работает каждые 15 секунд. Через 30-40 сек откройте
`http://<RF-IP>/admin/nodes` — обе ноды должны быть **online**.

Если не становятся online:

- `journalctl -u proxels-api -n 100` — есть ошибки gRPC?
- На DE: `ss -tlnp | grep 10085` — Xray слушает 10085?
- На DE: `ufw status | grep 10085` — правило `allow from <RF-IP>` стоит?
- На RF: `nc -zv <DE-IP> 10085` — порт доступен с этой машины?

---

## Часть 4. Тест от лица пользователя

### 4.1 Регистрация + Free

1. Откройте `http://<RF-IP>` в режиме инкогнито (чтобы не пересеклось с
   админ-сессией).
2. На главной выберите платформу (Windows / Android / iOS).
3. Пройдите регистрацию (любой email, пароль).
4. Войдите.
5. В `/lk` → выбор тарифа → **Free** → «Активировать».

В момент активации backend:

- Создаёт `Subscription` со статусом active.
- В той же Postgres-транзакции — для каждой online-ноды:
  - Генерирует случайный UUID.
  - Дёргает Xray gRPC `AlterInbound(AddUserOperation)` — Xray принимает
    нового юзера в свой `clients` массив.
  - Сохраняет `XrayClient(subscriptionId, nodeId, uuid)` в БД.

После активации в `/lk` появится subscription URL вида
`http://<RF-IP>/api/sub/<32-symbol-token>`. Внутри — по одной VLESS-ссылке
на каждую живую ноду, **с уникальным UUID** для именно этой подписки.

### 4.2 Импорт в клиент

Поставьте на устройство клиент:

- **Android:** Nekobox ([Google Play](https://play.google.com/store/apps/details?id=moe.nb4a) / [GitHub Releases](https://github.com/MatsuriDayo/NekoBoxForAndroid/releases))
- **iOS:** Hiddify (App Store)
- **Windows:** [v2rayN](https://github.com/2dust/v2rayN/releases) или [V2RayTun](https://v2raytun.com)

В клиенте: Add subscription / Import → URL → вставьте subscription URL →
обновите подписку → должно появиться **2 сервера**: `Proxels · de-1` и
`Proxels · de-2`.

Подключитесь к любому → откройте google.com — должно работать.

Если не подключается:

- В Xray-логах: `journalctl -u xray -n 50 -f` — есть отказы по UUID?
- В RF логах: `journalctl -u proxels-api -n 50 -f` — есть ошибки gRPC при activate-free?
- Проверьте: `psql -d proxels -c 'SELECT id,uuid,"nodeId" FROM "XrayClient" ORDER BY "addedAt" DESC LIMIT 5;'`
  → должны быть свежие строки с разными UUID per nodeId.

### 4.3 Тест failover

Откройте `http://<RF-IP>/admin/nodes` в админ-вкладке — обе ноды online.

На сервере **DE-1**:

```bash
systemctl stop xray
```

Подождите 30 сек. В админке обновите — **de-1** → **offline**.

В клиенте (Nekobox/Hiddify) — переподключитесь. Если активный был de-1 —
переключитесь на de-2 вручную, либо включите автоматический «лучший сервер»
в настройках клиента. Интернет через VPN продолжает работать.

Дополнительно: в клиенте → «обновить подписку» → backend теперь отдаст
**только** de-2 (de-1 отфильтрован по offline). Старый URI с de-1 пропадёт
из списка.

Верните DE-1:

```bash
systemctl start xray
```

Через ~30 сек в админке de-1 снова **online**. На следующем «обновить
подписку» клиент увидит обе.

### 4.4 Что происходит с уже-зарегистрированными юзерами при рестарте Xray

Xray читает `clients` ТОЛЬКО при старте процесса. Когда вы рестартнули его —
все UUID'ы, которые backend добавлял через gRPC AlterInbound, **пропадают**
(они были только в памяти Xray). Это известное ограничение.

Решение: админ-эндпоинт **reissue** (см. §5 ниже) — пройдётся по всем
активным подпискам, удалит юзеров из Xray (если ещё есть в памяти) и
добавит заново с **теми же UUID'ами**. Клиентам подписку перевыпускать
не нужно.

---

## Часть 5. Эксплуатация: перезалив юзеров на ноде (reissue)

Эндпоинты в `AdminNodesCrudController`:

```bash
TOKEN="paste-access-token-here"
API="http://<RF-IP>/api"

# 1) Перезалить юзеров на конкретной ноде. Использовать ПОСЛЕ:
#    - systemctl restart xray на ноде (in-memory clients потеряны);
#    - смены IP/host ноды;
#    - смены Reality keys.
curl -sS -X POST -H "Authorization: Bearer $TOKEN" \
  "$API/admin/nodes/<NODE-ID>/reissue"
# Ответ: { ok: 42, failed: 0, total: 42 }

# 2) Перезалить юзеров на ВСЕХ активных нодах сразу.
#    Полезно после массового рестарта / миграции Xray-версии.
curl -sS -X POST -H "Authorization: Bearer $TOKEN" \
  "$API/admin/nodes/reissue-all"
# Ответ: { results: [{ nodeId, nodeName, ok, failed, total }, ...] }
```

UUID'ы из БД переиспользуются — **клиентам перевыпускать подписки не нужно**.
RemoveUser перед AddUser вызывается на всякий случай (если юзер ещё есть в
памяти после graceful reload), его ошибки игнорируются.

`NODE-ID` можно получить:

```bash
sudo -u postgres psql proxels -c "SELECT id,name,host FROM \"Node\";"
```

Или из админки `/admin/nodes` (хост + статус).

---

## Часть 6. Защита от блокировки РКН (DPI)

VLESS Reality сам по себе сильно сопротивляется DPI, но **IP сервера** может
быть заблокирован, если на него идёт массовый «VPN-подобный» трафик. Сигналы:

- В `journalctl -u xray` на ноде входящих connections **нет** (а вчера были);
- С RF `nc -zv <DE-IP> 443` работает (порт жив);
- Клиент пишет `connection forcibly closed by remote` через ~300 мс после
  установления TCP.

Это означает: **DPI инжектит RST между клиентом и сервером**. Xray даже не
видит handshake.

### Что делать (по убыванию приоритета)

1. **Несколько нод на РАЗНЫХ ASN/хостерах.** Один заблокированный IP — это не
   проблема, если в подписке клиента есть ещё 2-3. `materializeForSubscription`
   автоматически выкладывает юзера на все online-ноды; failover в клиенте
   работает сам. Альтернативные хостеры:
   - **DE/NL/PL:** Aeza, Hostkey, 4VPS, Hetzner (медленнее процессит abuse), Vultr
   - **Только не один и тот же `/24` подсети** — там общие магистральные роутеры,
     DPI блочит подсеть пачкой.

2. **Смена IP заблокированной ноды.** Большинство хостеров (Aeza, Hostkey,
   koara.cloud) выдают новый IP бесплатно по тикету. После смены:
   - Обновите `host` ноды через `PATCH /api/admin/nodes/:id`.
   - Дёрните `POST /api/admin/nodes/:id/reissue` (см. §5) — пройдётся
     по подпискам.
   - Клиентам перевыпускать подписку **не нужно** — `host` подтянется
     при следующем `/api/sub/<token>`.

3. **Ротация SNI и shortId.** Зашитый в конфиг `serverNames: ["www.microsoft.com"]`
   — самый «спалённый» камуфляж. Поэкспериментируйте:
   - `www.swift.com`, `www.lovelive-anime.jp`, `dl.google.com`, `cdn.jsdelivr.net`
   - Главное: чтобы реальный сайт по этому имени **отдавал TLS 1.3** и не был
     заблокирован в РФ (проверка: `curl -I https://<sni>`).
   - При смене на DE-ноде: обновить `serverNames` в `config.json` + `sni` в Node
     в БД, рестарт Xray, reissue.

4. **Регулярная ротация Reality keys.** Раз в 2-4 недели `xray x25519` →
   новые ключи → обновить на ноде и в БД ноды → reissue. Длинная история
   handshake'ов с одним ключом — это паттерн для ML-классификаторов DPI.

5. **План B — VLESS+WS+TLS через Cloudflare.** Когда основной канал упорно
   режут. Cloudflare-фронт пока не блокируется, но и трафик идёт через них —
   ниже скорость + они видят SNI клиента. Делать как опциональный второй
   inbound на каждой ноде, не как основной.

### Чек-лист «у клиентов перестал работать VPN»

```bash
# 1. Жив ли сам Xray?
ssh root@<DE-IP> -p 2222 'systemctl is-active xray && ss -tln | grep 443'

# 2. Есть ли входящие connections?
ssh root@<DE-IP> -p 2222 'ss -tn | grep ":443" | wc -l'
# 0 = клиенты не доходят. Дальше п.3.
# >0 = клиенты доходят, проблема внутри Xray. Смотри journalctl.

# 3. Маршрутизация: есть ли DPI-инжекция RST?
# С Windows-машины клиента:
#   tracert -d <DE-IP>
#   Где обрывается ответ — там и режут.

# 4. Сравнение: с другого ISP (мобильный, чужой WiFi)
#    подключается ли тот же клиент к той же подписке?
#    - Да: ISP клиента или магистраль режут.
#    - Нет: IP ноды попал под РКН — нужна смена IP или новая нода.
```

---

## Часть 7. Что делать дальше

### 5.1 Когда переедет домен

1. На timeweb: перенести `proxels.ru` к новому регистратору.
2. A-запись `proxels.ru` → `<RF-IP>`, `www.proxels.ru` → `<RF-IP>`.
3. На RF дождаться DNS:
   ```bash
   dig proxels.ru +short
   ```
4. Получить TLS:
   ```bash
   apt install -y python3-certbot-nginx
   certbot --nginx -d proxels.ru -d www.proxels.ru
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

```
YOOKASSA_SHOP_ID=<реальный>
YOOKASSA_SECRET_KEY=<реальный>
YOOKASSA_WEBHOOK_SECRET=<openssl rand -base64 32>
YOOKASSA_RETURN_URL=https://proxels.ru/lk/payments
```

В ЮKassa: webhook на `https://proxels.ru/api/payments/webhook`. Перезапустить
API.

### 5.3 Включить self-update

```bash
sudo install -m 0440 /opt/proxels/infra/deploy/proxels.sudoers /etc/sudoers.d/proxels

# В .env:
DEPLOY_ENABLED=true
DEPLOY_SCRIPT=/opt/proxels/infra/deploy/deploy.sh
DEPLOY_LOG_DIR=/var/log/proxels-deploy
DEPLOY_REPO_DIR=/opt/proxels

sudo systemctl restart proxels-api
```

Подробнее: [`docs/DEPLOY.md`](DEPLOY.md), раздел 5.

### 5.4 Включить 2FA для админа

В `/lk/security` → «Включить 2FA» → отсканировать QR в Google Authenticator /
Authy → ввести 6-значный код. После этого админ-логин и self-update требуют
код.

### 5.5 Бэкапы Postgres

`/etc/cron.daily/proxels-backup`:

```bash
#!/bin/bash
set -e
TS=$(date +%Y-%m-%d)
DIR=/var/backups/proxels
mkdir -p $DIR
sudo -u postgres pg_dump proxels | gzip > $DIR/proxels-$TS.sql.gz
find $DIR -name 'proxels-*.sql.gz' -mtime +30 -delete
```

`chmod +x /etc/cron.daily/proxels-backup`. Cron сам запустит. Перед запуском
в прод — настройте offsite-копию.

---

## Шпаргалка по проверке здоровья

На RF:

```bash
systemctl status proxels-api nginx postgresql redis-server
journalctl -u proxels-api -f

sudo -u postgres psql proxels -c "SELECT count(*) FROM \"User\";"
sudo -u postgres psql proxels -c "SELECT name,status,host,\"xrayApiAddr\" FROM \"Node\";"
sudo -u postgres psql proxels -c "SELECT \"nodeId\",count(*) FROM \"XrayClient\" GROUP BY \"nodeId\";"

redis-cli SMEMBERS proxels:nodes:online
```

На DE:

```bash
systemctl status xray
journalctl -u xray -n 50 -f
ss -tlnp | grep -E '443|10085'
ufw status
```

---

## Когда что-то сломалось

| Симптом                               | Куда смотреть                                                                                                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Сайт не открывается                   | `systemctl status nginx`, `ss -tlnp \| grep 80`                                                                                                                        |
| Login 500                             | `journalctl -u proxels-api -n 100`, Postgres коннект                                                                                                                   |
| /api/plans 404                        | API не запустилась, см. journal                                                                                                                                        |
| Подписочный URL 404                   | у юзера нет активной подписки, либо `subToken` невалидный                                                                                                              |
| В подписке 0 серверов                 | health-check считает все ноды offline — TCP-проба не доходит на `xrayApiAddr`, либо gRPC AddUser падает (см. логи)                                                     |
| activate-free возвращает 500          | gRPC к Xray не отвечает (firewall? Xray упал?). Проверьте `nc -zv <DE-IP> 10085` с RF                                                                                  |
| Клиент подключается, но интернета нет | UUID, отданный в URI, не зарегистрирован в Xray. После рестарта Xray все динамические UUID пропадают — см. §4.4 workaround                                             |
| Один из юзеров жрёт весь трафик       | `SELECT u.email, x.uuid FROM "User" u JOIN "Subscription" s ON s."userId"=u.id JOIN "XrayClient" x ON x."subscriptionId"=s.id;` — найти подписку, через админку cancel |
| Failover не сработал                  | `HEALTH_FLAP_DOWN_THRESHOLD` слишком большой, либо клиент не обновил подписку (тапни «обновить подписку» в Nekobox)                                                    |

---

Если что-то идёт сильно не по плану — `journalctl -u proxels-api -f` и
`journalctl -u xray -f` дают 95% диагностики. Удачного запуска.
