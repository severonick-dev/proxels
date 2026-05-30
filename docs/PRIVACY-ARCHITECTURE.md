# PRIVACY ARCHITECTURE

Архитектурное описание того, **как обеспечен принцип no-logs** в Proxels.

> Главное требование владельца: «админ (я) физически не должен иметь
> возможности увидеть, какие сайты посещают клиенты». См. `prompts/CLAUDE.md` §4a.

Это не «политика», а свойство кода и конфигов. Если в будущем кто-то
добавит эндпоинт/таблицу/логгер, нарушающий это свойство — это считается
багом безопасности и должен быть зарезан на код-ревью.

---

## 1. Что мы храним

| Слой               | Что собираем                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend PostgreSQL | email, хеш пароля (argon2id), подписка (план, даты, subToken), платежи (сумма, статус), агрегированный трафик (uplink+downlink в байтах per UUID), AuditLog админских действий |
| Backend Redis      | rate-limit счётчики (по IP/токену), кэш статуса нод                                                                                                                            |
| Backend pino-logs  | HTTP-запросы к API с маскировкой Authorization/cookie/password/refreshToken/totpCode/subToken/verify/reset (см. `apps/api/src/common/logger/pino.config.ts`)                   |
| Xray ноды          | **только присутствие клиента (UUID) в инбаунде**. Никаких логов трафика.                                                                                                       |

## 2. Что мы НЕ храним и НЕ собираем

- ❌ История посещаемых клиентом сайтов / IP-адреса назначения.
- ❌ Содержимое HTTP/HTTPS запросов клиента.
- ❌ DNS-запросы клиента.
- ❌ Время каждого соединения (только агрегированный трафик).
- ❌ Корреляция «реальный IP клиента ↔ его действия через VPN».
- ❌ Метаданные TLS-handshake (SNI клиента и т.д.).

## 3. Как это обеспечено на нодах Xray

См. [`infra/xray/node-config.example.json`](../infra/xray/node-config.example.json):

- `"log": { "loglevel": "warning", "access": "none", "error": "none" }`
  Access-логи **полностью отключены**. Никакого `access.log` файла на диске.
  `loglevel: warning` оставлен для ошибок самого процесса Xray (не для трафика).
- `inbounds[0].sniffing: { enabled: false }` — даже Xray sniffing отключён,
  чтобы не различать destination-доменов в логике маршрутизации.
- gRPC API инбаунд (`tag: api`) экспортирует ТОЛЬКО `HandlerService` и
  `StatsService`. Backend использует только `AlterInbound(AddUser/RemoveUser)`
  и (опц.) `GetClientStats` для агрегированного трафика. Остальные API
  (e.g. routing manipulation, logging control) — не вызываются.
- gRPC API listener — на `127.0.0.1` или приватной сети к backend.
  Никогда не открыт в публичный интернет.
- Аутентификация на gRPC — `Authorization: Bearer ${XRAY_NODE_API_TOKEN}` через
  metadata либо mTLS (в проде).

### Проверки на ноде после установки

```bash
# Конфиг — нет access-log файла, log.access == "none"
jq '.log' /usr/local/etc/xray/config.json
# Ожидаемо: { "loglevel": "warning", "access": "none", "error": "none" }

# В файловой системе нет access-логов:
find /var/log -name 'access*' -ls
find / -name 'xray-access*' 2>/dev/null

# Sniffer'ов в системных сервисах нет:
systemctl list-units | grep -iE 'tcpdump|mitmproxy|tshark'
```

## 4. Как это обеспечено в backend

### 4.1 API-поверхность

- Эндпоинтов вида `GET /api/admin/users/:id/visits` или
  `GET /api/admin/subscriptions/:id/destinations` **не существует и не появится**.
- В админке (§10 спека) явно прописан запрет на любые такие данные.
- При код-ревью любой PR, добавляющий «логику отслеживания», должен быть отклонён.

### 4.2 Модель данных (Prisma)

В `apps/api/prisma/schema.prisma` **отсутствуют** таблицы:

- `VisitLog` / `RequestLog`
- `TrafficLog(per_destination)` / `DestinationStat`
- `DnsQueryLog`
- `ConnectionLog`

Единственное, что хранится про трафик — `Subscription.trafficUsedBytes` (BigInt),
агрегат за всё время. См. §5 спека.

### 4.3 Контракт `XrayNodeClient`

Интерфейс ([`apps/api/src/xray/xray.types.ts`](../apps/api/src/xray/xray.types.ts))
определяет ровно три метода:

```typescript
addUser(node, uuid, identifier): Promise<void>
removeUser(node, identifier): Promise<void>
getClientStats?(node, identifier): Promise<{ uplink, downlink } | null>
```

`getClientStats` возвращает **только агрегированные байты** uplink/downlink.
Ни `getClientLog`, ни `getClientDestinations` в интерфейсе нет и не появится.

### 4.4 Логирование backend

`apps/api/src/common/logger/pino.config.ts`:

- `redact: { paths: [authorization, cookie, password, refreshToken, totpCode, ...], remove: true }`
- URL-маскирование для `/api/sub/<token>`, `/api/auth/verify/<token>`, `/api/auth/reset/<token>`
- Тела запросов через VPN backend **не видит вообще** — они идут напрямую через Xray.
- HTTP-запросы к самому API API — могут содержать только метаданные платежей/подписок.

### 4.5 IP-адреса клиентов

- При логине IP попадает в `RefreshToken.ip` (для аудита подозрительных входов).
- При платежах IP попадает в `AuditLog.ip` (для антифрода).
- В rate-limiter Redis IP живёт максимум TTL счётчика (60 секунд).
- Долгосрочного хранения «IP юзера + время + действия» нет.
- После удаления аккаунта (§4 спека, право на забвение) все RefreshToken
  юзера каскадно удаляются.

## 5. Что хранят сторонние сервисы (вне нашего контроля)

- **ЮKassa**: данные платёжной карты (мы их не видим — PCI DSS на их стороне),
  email покупателя для чека 54-ФЗ. См. их Privacy Policy.
- **Yandex.Metrika** (опционально, только после согласия cookie):
  обезличенные данные посещения нашего сайта (НЕ VPN-трафика). Конфигурация:
  `webvisor: false` (нет записи действий), стандартные cookie метрики.
- **Email-провайдер SMTP** (Этап 13): получает email клиента и тело письма.

## 6. Юридические следствия

- 152-ФЗ: ПДн хранятся на сервере в РФ, согласие версионируется, право на
  забвение реализовано (см. `DELETE /api/auth/me`).
- 376-ФЗ (Закон Яровой) — формально применим к организаторам распространения
  информации. Сервис маршрутизирует трафик, но **не хранит контент и метаданные
  коммуникаций** — соответствовать «требованиям по хранению» нечего, потому
  что хранения нет.
- 149-ФЗ (порядок ОРД) — на запросы правоохранительных органов мы можем
  предоставить ТОЛЬКО то, что у нас есть: email и факт активной подписки.
  Истории посещений у нас нет физически.

> Это инженерная заметка, не юридическая консультация. Все правовые
> формулировки в публичных документах (политика, оферта) должны проверяться
> у профильного юриста.

## 7. Что проверяет владелец перед прод-запуском

- [ ] На КАЖДОЙ ноде: `log.access == "none"`, нет `access.log` файлов.
- [ ] gRPC API нода доступен только из backend (firewall/security group).
- [ ] XRAY_NODE_API_TOKEN — random ≥32 байт, в .env, не в репо.
- [ ] В Prisma schema нет новых таблиц с per-destination данными.
- [ ] В коде нет вызовов `XrayNodeClient` методов вне контракта (только AddUser/RemoveUser/GetClientStats).
- [ ] В `docs/SECURITY.md` отмечены все пункты Этапа 10.
- [ ] На странице `/legal/privacy` (LegalDoc) — явный текст «не ведём журналов».

## 8. Что делать, если кто-то требует «отчёт по активности юзера X»

Ответ: «Технически такая информация в системе отсутствует. Мы можем
предоставить только: email пользователя, факт регистрации, факт активной
подписки, агрегированный объём трафика в байтах. Историю URL/IP/доменов
мы не собираем и не храним.»

Это не «отказываемся», это «у нас этого нет». См. §3 (проверки на ноде) для подтверждения.
