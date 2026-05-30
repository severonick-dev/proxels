# infra/xray — настройка Xray-нод

Каждая VPN-нода Proxels — это VPS с установленным Xray-core, который
обслуживает входящие VLESS Reality соединения и принимает управляющие команды
от backend по gRPC (`HandlerService.AlterInbound` — для AddUser/RemoveUser).

> **Критичное требование (см. `docs/PRIVACY-ARCHITECTURE.md`):**
> access-логи Xray на нодах ДОЛЖНЫ быть полностью отключены. Это не «фича»,
> а архитектурный инвариант сервиса.

---

## Установка одной ноды (краткая инструкция)

### 1. Сервер

- Ubuntu 22.04 LTS (предпочтительно), 1 GB RAM, 1 vCPU достаточно для старта.
- Открытые порты:
  - **443/tcp** — VLESS Reality (внешний трафик клиентов).
  - **10085/tcp** — Xray gRPC API (доступ ТОЛЬКО из IP-сети backend).
    Закрыть для остального интернета через firewall (UFW / cloud security group).
  - Из портов наружу — всё, что нужно для proxying (по умолчанию любые).

### 2. Установка Xray

```bash
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
```

### 3. Сгенерировать ключи Reality

На свежеустановленной ноде:

```bash
xray x25519
# Output:
# Private key: <REALITY_PRIVATE_KEY>
# Public key:  <REALITY_PUBLIC_KEY>     <- этот public key пойдёт в БД (Node.publicKey)

# Короткий ID (опц., можно несколько):
openssl rand -hex 4
```

### 4. Конфиг `/usr/local/etc/xray/config.json`

Базовый шаблон — см. [`node-config.example.json`](node-config.example.json).
Обязательно:

- `"log": { "loglevel": "warning", "access": "none", "error": "none" }`
- `inbounds[0]` — Reality на :443 с заглушённым `clients: []` (управляется через API).
- `api` блок + `routing` rule, направляющий `api` инбаунд во встроенный `ApiService`.
- gRPC API инбаунд слушает на `127.0.0.1:10085` (или приватный IP, если backend
  ходит через VPN).

### 5. Запуск

```bash
systemctl enable --now xray
systemctl status xray         # должно быть active (running)
journalctl -u xray --no-pager -n 50
```

### 6. Регистрация ноды в Proxels

Из админки (Этап 12) или прямой записью в БД:

```sql
INSERT INTO "Node"
  (id, name, host, port, country, "xrayApiAddr", "publicKey", "shortId", sni,
   "inboundTag", status, weight, "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'de-1', '<PUBLIC_IP>', 443, 'DE',
   '<PRIVATE_IP_OR_LOCALHOST>:10085', '<REALITY_PUBLIC_KEY>', '<SHORT_ID>',
   'www.microsoft.com', 'vless-reality', 'online', 100, true, now(), now());
```

Затем выставить `XRAY_CLIENT=grpc` в backend ENV и перезапустить.

---

## Чего НЕЛЬЗЯ делать на ноде (§4a)

- **НЕ включать** `access` в `log` (любой не-`none`/`/dev/null` путь —
  нарушение архитектуры).
- **НЕ ставить** mitmproxy / Wireshark / tcpdump в systemd-сервисах.
- **НЕ настраивать** `dnsmasq` или другие резолверы с логированием.
- **НЕ хранить** соответствие UUID → email клиента на самой ноде
  (это сопоставление есть только в backend БД, в РФ).

Проверка после установки:

```bash
# Должно быть пусто или путь к /dev/null
jq .log /usr/local/etc/xray/config.json

# Не должно быть никаких access.log файлов:
find /var/log -name 'access*' -ls
```

---

## gRPC-клиент в backend

Реализация — `apps/api/src/xray/clients/grpc.client.ts`. Сейчас skeleton с
явной ошибкой при попытке использовать. Полное подключение:

1. Положить в `infra/xray/proto/` файлы из
   [XTLS/Xray-core/app/proxyman/command](https://github.com/XTLS/Xray-core/tree/main/app/proxyman/command):
   - `command.proto` (HandlerService с AlterInbound)
   - - транзитивные зависимости (`common/protocol/user.proto`,
       `proxy/vless/account.proto`, и т.д. — proto-loader на runtime подскажет
       чего не хватает).
2. Установить runtime: `pnpm add -F @proxels/api @grpc/grpc-js @grpc/proto-loader`.
3. Заполнить тело методов `addUser` / `removeUser` через
   `HandlerService.AlterInbound({ tag, operation: AddUserOperation({ user: ... }) })`.
4. Аутентификация — gRPC metadata `Authorization: Bearer ${XRAY_NODE_API_TOKEN}`
   ИЛИ mTLS (предпочтительнее на проде).
5. Переключить ENV `XRAY_CLIENT=grpc`.

---

## Архитектурное обоснование «своей системы выдачи»

См. `docs/PRIVACY-ARCHITECTURE.md` — мы пишем эту систему сами, а не используем
сторонние панели (Remnawave, X-UI и т.п.), потому что:

- сторонние панели часто включают access-логи по умолчанию;
- их БД хранит ПДн пользователей вне нашей юрисдикции;
- мы хотим жёсткий whitelist на gRPC API (только AddUser / RemoveUser /
  GetClientStats), а не «делайте что хотите».
