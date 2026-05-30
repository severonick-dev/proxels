# SECURITY — чек-лист безопасности Proxels

Этот файл — живой чек-лист. Перед каждым `git push` пробегаемся по нему и убеждаемся,
что новое изменение не нарушает приватность (см. `PRIVACY-ARCHITECTURE.md`) и не открывает
новых уязвимостей.

Подробные требования и обоснование — в [`../prompts/CLAUDE.md`](../prompts/CLAUDE.md)
§4a (приватность/no-logs) и §4b (антибот/безопасность).

---

## Этап 1 — Базовый каркас

- [x] Секреты не коммитятся: `.env` в `.gitignore`, есть полный `.env.example`.
- [x] CI блокирует пуш без прохождения lint + typecheck (будет на Этапе 2+, когда появится код).
- [ ] Зависимости проверяются через `pnpm audit` в CI (добавим, когда появятся боевые deps).

## Этап 2 — Backend NestJS

- [x] Helmet включён глобально (`apps/api/src/main.ts`).
- [x] CORS — только `proxels.ru` в prod; в dev — `APP_URL` + `http://localhost:5173`,
      `credentials: true`. См. `apps/api/src/main.ts`.
- [x] Глобальный `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`,
      `transform: true`) в `apps/api/src/app.module.ts`.
- [x] Глобальный `@nestjs/throttler` (`ThrottlerGuard` через `APP_GUARD`) с Redis-storage
      (`@nest-lab/throttler-storage-redis`). Базовый лимит — 100 req / 60s, на auth-эндпоинтах
      повысим/понизим на Этапе 3.
- [x] Все ENV валидируются на старте через zod (`apps/api/src/config/env.schema.ts`).
      Сервис не стартует, если что-то обязательное не задано или имеет неверный формат.
- [x] Глобальный `AllExceptionsFilter` — никаких стектрейсов клиенту, всё на сервере в pino.
- [x] pino-логгер с `redact` (Authorization, cookie, password, refreshToken, totpCode);
      `subToken`/`verify`/`reset` сегменты URL маскируются перед записью в лог.
- [x] `cookie-parser` подключён (готовность к refresh-cookie в Этапе 3).
- [x] `BigInt → JSON` сериализатор настроен (Subscription.trafficUsedBytes — BigInt).
- [ ] `prisma.$queryRawUnsafe` запрещён код-ревью и линтером — добавим правило ESLint
      в Этап 3 (когда подключим линтер).
- [ ] `pnpm audit` в CI как блокирующая стадия — пока non-blocking; включим, когда стабилизируем
      боевые зависимости.

## Этап 3 — Auth

- [x] Пароли — argon2id (`memoryCost=65536` (64 MB), `timeCost=3`, `parallelism=1`).
      `apps/api/src/auth/auth.service.ts` (`ARGON2_OPTS`).
- [x] CAPTCHA на `register`, `login`, `forgot-password`, `resend-verification`.
      Провайдеры: Yandex SmartCaptcha (РФ), hCaptcha, `none` (только dev — фабрика бросит
      при `NODE_ENV=production`). `apps/api/src/captcha/`.
- [x] Honeypot-поле `website` в `RegisterDto` + silent fake-success при заполнении
      (бот получает 202 без создания юзера, не палим механизм). См. `auth.service.ts:register`.
- [x] Подтверждение email обязательно перед логином: `AuthService.login` бросает 403
      при `!emailVerified`. Verify-token — 32 байта `crypto.randomBytes` base64url.
- [x] Согласие на ПДн (152-ФЗ): `User.consentPdnAt` + `User.consentPdnVersion`,
      версия читается из `@proxels/shared::CONSENT_VERSIONS.privacy` (пока хардкод,
      на Этапе 9 переедет в `LegalDoc`).
- [x] Rate-limit на auth-эндпоинтах (`@Throttle` per-route поверх глобального):
      `register: 5/60s`, `login: 10/60s`, `refresh: 60/60s`, `forgot-password: 3/60s`,
      `resend-verification: 3/60s`, `reset-password: 10/60s`.
      Экспоненциальный backoff/блокировку по фейловым попыткам добавим, когда увидим реальный паттерн атак.
- [x] Refresh-токен — httpOnly + sameSite (`strict` в prod, `lax` в dev) + secure (prod),
      `path=/api/auth` (узкая поверхность). Cookie name из `@proxels/shared::REFRESH_COOKIE_NAME`.
- [x] Access-токен — JWT (HS256), TTL = `JWT_ACCESS_TTL` (по умолчанию 15m).
- [x] Refresh — rotation (новый jti на каждый refresh) + reuse-detection:
      при повторном использовании отозванного токена отзывается вся `family`
      (`RefreshToken.familyId`). См. `tokens.service.ts:validateRefreshAndRotate`.
- [x] Сброс пароля — одноразовый токен 32 байта, TTL = 60 минут (`PASSWORD_RESET_TTL_MIN`),
      после `reset-password` токен очищается и **все** refresh-токены пользователя отзываются
      (`reason='forced'`).
- [x] Email-инфраструктура — заглушка `MailService` (логирует payload в pino), будет
      заменена на реальный SMTP/nodemailer на сервере (см. `mail.service.ts`).
- [x] Тайминговая атака на login mitigated: при отсутствии юзера выполняется фиктивный
      `argon2.verify` против фиксированного хеша, чтобы выровнять время ответа.

## Этап 4 — Plans / Subscriptions / Payments

- [x] Public read `GET /api/plans`, `GET /api/plans/:id` — без auth, отдают только активные.
- [x] Admin CRUD `/api/admin/plans` — за `JwtAccessGuard + RolesGuard + @Roles('admin')`.
      Анонимный → 401, обычный user → 403, admin → 200.
- [x] `RolesGuard` (`apps/api/src/auth/guards/roles.guard.ts`) + декоратор `@Roles(...)`
      (`apps/api/src/auth/decorators/roles.decorator.ts`). Проверяет `req.user.role`
      против списка `ROLES_METADATA_KEY`.
- [x] `ValidationPipe(whitelist + forbidNonWhitelisted)` отсекает неизвестные поля
      на CRUD-тарифах (verified curl-ом — 400).
- [x] Soft-delete `DELETE /api/admin/plans/:id` (`isActive=false`) — не теряем историю
      и не ломаем активные подписки на этот план.
- [x] Audit-лог (`AuditService` в `apps/api/src/audit/`) пишет `plan.create`,
      `plan.update` (с дельтой полей), `plan.deactivate` с `actorId` + `ip`. В meta
      ТОЛЬКО идентификаторы и дельты — никаких ПДн или токенов.
- [x] `GET /api/subscriptions/me`, `GET /api/payments/me` — read-only под `JwtAccessGuard`,
      пользователь видит только своё (`where: { userId: req.user.id }`).
- [x] `PaymentsService.listForUser` использует `select` — отдаёт только безопасные поля
      (id, amountRub, status, receiptSent, createdAt), без сырых webhook payload.
- [x] BigInt-поля (`Subscription.trafficUsedBytes`) корректно сериализуются в JSON
      (глобальный override в `main.ts`).
- [x] Seed (`apps/api/prisma/seed.ts`) идемпотентный; admin создаётся только при
      явном задании `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` (для прода — отдельная
      CLI-команда на Этапе 12, не через seed).

## Этап 5 — ЮKassa

- [x] Webhook защищён `YookassaIpGuard` — CIDR-allowlist официальных подсетей YooKassa
      (185.71.76.0/27, 185.71.77.0/27, 77.75.153.0/25, 77.75.156.11/32, 77.75.156.35/32,
      77.75.154.128/25, 2.59.41.0/24) + опц. `YOOKASSA_EXTRA_WEBHOOK_IPS` (CSV из ENV).
      В dev дополнительно разрешён localhost (127.0.0.1 / ::1 / ::ffff:127.0.0.1).
      В production за nginx нужен `app.set('trust proxy', 1)` — отметка в DEPLOY.md (Этап 13).
- [x] Идемпотентность вебхука: `PaymentsService.processWebhookEvent` находит
      `Payment` по `yookassaId`, если уже в финальном статусе (`succeeded`/`canceled`) —
      выходит без действий. Повторный webhook не создаёт дубль подписки (verified).
- [x] Защита от подмены суммы в webhook: при `amount.value != Payment.amountRub` → 403
      и лог `error` (verified — wrong amount возвращает HTTP 403).
- [x] Подписка выпускается в Postgres-транзакции с обновлением `Payment`
      (`createOrExtendForPayment` + `Payment.update` в `$transaction`) — гарантия
      «либо обе записи, либо ни одной».
- [x] Повторная оплата того же активного плана продлевает `endAt` существующей
      подписки (не плодит дубли) — verified +30d от прежнего endAt.
- [x] Чек 54-ФЗ: при создании платежа в YooKassa передаём `receipt.customer.email`
      и `receipt.items[0]` с `vat_code` / `payment_mode` / `payment_subject` из ENV
      (дефолты для ИП на УСН/НПД: `1 / full_prepayment / service`).
- [x] `Payment.offerAcceptedVersion` сохраняется с версией оферты на момент платежа
      (см. `@proxels/shared::CONSENT_VERSIONS.offer`). Без `offerAccepted=true` в DTO
      платёж не создаётся (verified — 400).
- [x] `subToken` генерируется через `crypto.randomBytes(32).toString('base64url')`
      (43 символа, ≥256 бит энтропии). См. §4a.
- [x] `PaymentsController` под `JwtAccessGuard` со scope `where: { userId: req.user.id }` —
      пользователь не видит чужие платежи (verified — 404 при кросс-доступе).
- [x] Все важные действия записываются в `AuditLog`: `payment.create`,
      `payment.canceled`, `subscription.issue` (с ID, без ПДн).
- [x] Throttle: `payments/create` 10/60s, `payments/webhook` 600/60s
      (webhook может прилетать часто при ретраях YooKassa).
- [x] Dev-bypass: `YookassaService` не делает реальный HTTP-запрос, если в development
      `YOOKASSA_SHOP_ID` пуст/`test`. В production это автоматически выключено
      (`isProduction → return false`). Симуляция `payment.succeeded` для тестов —
      `POST /api/payments/dev/simulate-succeeded/:yookassaId` (403 в prod).

## Этап 11 — Health-check + failover

- [x] `HealthChecksModule` (Global) с BullMQ repeatable job: каждые
      `HEALTH_CHECK_INTERVAL_SECONDS` (default 30) пробит каждую active-ноду
      TCP-connect'ом на её `xrayApiAddr` с таймаутом `HEALTH_CHECK_TIMEOUT_MS`.
- [x] Анти-флаппинг: `HEALTH_FLAP_UP_THRESHOLD` подряд успехов → online,
      `HEALTH_FLAP_DOWN_THRESHOLD` подряд фейлов → offline. Промежуточное
      состояние → `degraded`. Счётчики consecutive succ/fail хранятся в Redis
      hash `proxels:nodes:health:<id>` (TTL 1ч на самоочистку, если нода
      исчезла из БД).
- [x] Redis-кэш списка online-ID нод: SET `proxels:nodes:online` (TTL 90s).
      Обновляется на каждой итерации probeAll. Используется в `SubService`
      (быстрый путь без JOIN с Node), фолбэк на БД если кэш пуст.
- [x] DB Node.status пишется ТОЛЬКО при смене статуса (минимизируем нагрузку).
      `lastCheckAt` дёргается выборочно (~20% циклов) — для отображения в админке.
- [x] Repeatable job регистрируется через `onModuleInit`. При старте API очищаем
      старые repeatable jobs под нашим jobId, чтобы не плодить призраков при
      смене интервала в dev. Первый прогон сразу при старте, не ждём интервал.
- [x] `GET /api/admin/nodes` + `GET /api/admin/nodes/health` под
      `JwtAccessGuard + RolesGuard + @Roles('admin')`. Throttle 60/60s.
      `/health` агрегирует БД-данные + Redis-counters + onlineCount.
- [x] BullMQ использует `prefix: 'proxels:bull'` чтобы не конфликтовать с
      throttler-storage-redis ключами и нашими собственными.
- [x] Verified end-to-end: 2 dev-ноды на закрытый порт `127.0.0.1:55555`
      ушли в `offline` после 2 неудачных проб (fail=5 после 5 циклов),
      1 нода на `127.0.0.1:5432` (postgres слушает) — `online`.
      `/api/sub/:token` теперь возвращает URI **только живой ноды**.
- [x] **Failover на уровне подписки**: упавшая нода не попадает в выдачу
      клиентского URI; клиент сам выбирает живую из списка. Это и есть
      требование §1 из CLAUDE.md.

## Этап 10 — Своя система выдачи + Xray-абстракция

- [x] `GET /api/sub/:subToken` под `Throttle(30/60s)`. На любые проблемы (sub
      не найдена/expired/cancelled, нет живых нод) → 404 без подсказок
      (не палим существование токена).
- [x] subToken проверяется на минимальную длину 16 (быстрый отказ
      перебора коротких токенов, даже до Throttler).
- [x] `Content-Type: text/plain; charset=utf-8` + `Cache-Control: no-store`
      (отключаем кэширование на прокси/CDN, чтобы failover отражался сразу).
- [x] `Subscription-Userinfo` header — клиенту видно остаток трафика/времени.
- [x] `XrayNodeClient` интерфейс минимальный: только AddUser, RemoveUser,
      опц. GetClientStats (агрегированные байты). НИ `getClientLog`, НИ
      `getClientDestinations` в контракте не предусмотрено.
- [x] Фабрика `XrayModule` запрещает `XRAY_CLIENT=noop` в production
      (бросает на старте — никаких «продаём подписки, которые никому
      не выписываются»).
- [x] `GrpcXrayNodeClient` — skeleton с явным `throw new Error('not implemented')`
      в каждом методе. Безопасно: при случайной попытке использовать в dev
      падает шумно.
- [x] `materializeForSubscription` — атомарно с Payment в одной Postgres-транзакции
      (вызывается из `PaymentsService.handleSucceeded`). Если конкретная нода
      падает на addUser — продолжаем с остальными.
- [x] Lazy materialization в `SubService.resolveBySubToken`: если на момент
      оплаты не было ни одной online-ноды, первый вызов `/api/sub/:token`
      попробует материализовать.
- [x] Pino redact + URL-masking для `/api/sub/<token>` (уже было, не сломано).
- [x] `infra/xray/node-config.example.json` — `log.access: none`,
      `log.error: none`, `sniffing.enabled: false`, ApiService whitelist
      (`HandlerService`, `StatsService`). Документировано в `infra/xray/README.md`.
- [x] `docs/PRIVACY-ARCHITECTURE.md` — полный документ-инвариант:
      что хранится / что НЕТ, как проверить ноду после установки,
      шаблон ответа на запрос «отчёт по активности юзера X».
- [x] Seed dev-нод (`prisma/seed-nodes.ts`) запускается только при
      `NODE_ENV !== 'production'` — никаких заглушечных нод в проде.

## Этап 9 — Юр.страницы + cookie-banner + Yandex.Metrika

- [x] `LegalDocsService` + `GET /api/legal/:slug` + `GET /api/legal`
      (последняя опубликованная версия по каждому slug). Распознаются slug:
      `privacy`, `offer`, `cookie`. Неизвестный slug → 400.
- [x] Seed (`prisma/seed-legal.ts`) идемпотентно публикует 3 документа
      с версией из `@proxels/shared::CONSENT_VERSIONS`. Контент — markdown,
      сразу с пометкой «документ — рабочий шаблон, перед запуском проверяется
      у юриста».
- [x] Frontend рендерит markdown через `react-markdown` + `remark-gfm`.
      **XSS-безопасно по дизайну**: react-markdown строит React-элементы,
      не использует `innerHTML`/`dangerouslySetInnerHTML`. Кастомные
      `components` дают tailwind-стилизацию без plugin'а typography.
- [x] `GET /api/config/public` — единая точка для бренда (имя/домен/Telegram),
      реквизитов ИП (ENV `OWNER_*`), `CONTACT_EMAIL`/`CONTACT_TELEGRAM`,
      `YANDEX_METRIKA_ID` и текущих версий согласий. **Никаких секретов**
      (ни ID нод, ни webhook-токенов).
- [x] Footer тянет реквизиты ИП из `/api/config/public` (приоритет) с
      фолбэком на i18n. Telegram-ссылка тоже из конфига → можно сменить
      ENV без редеплоя фронта.
- [x] **Cookie-баннер** (`apps/web/src/components/cookie-banner.tsx`):
      показывается только если согласие ещё не дано
      (`localStorage:proxels:cookie-consent`). Выбор хранится как
      `{ necessary, analytics, decidedAt }`. Закрытие крестиком =
      «только необходимые» (отказ от аналитики).
- [x] **Yandex.Metrika** (`apps/web/src/components/analytics/yandex-metrika.tsx`):
      грузится ТОЛЬКО когда выполнены все три условия — пользователь
      явно принял analytics-cookie, `analytics.yandexMetrikaId` пришёл
      непустой из `/api/config/public`, и не `import.meta.env.DEV`.
      Слушает `proxels:consent-changed` событие — если юзер сменил
      выбор без перезагрузки страницы, реагирует. `webvisor: false`
      по приватности (§4a — не пишем поведение пользователя на чужих страницах).
      Hit на каждый route change через `useLocation` watcher.
- [x] Backend `PublicConfigController` под `Throttle(120/60s)`.

## Этап 8 — ЛК

- [x] Auth-стора Zustand хранит access-токен **только в памяти** (никакого
      localStorage, см. §13 CLAUDE.md). На refresh refresh-cookie сама
      доезжает до /api/auth/refresh.
- [x] API-клиент с auto-refresh на 401: один in-flight refresh шарится между
      параллельными запросами (нет «гонок» рефреша). См. `apps/web/src/lib/api.ts`.
- [x] ProtectedRoute на /lk и /admin: loading → spinner, anon → редирект на
      /auth/login?return=..., role mismatch → /. См. `apps/web/src/components/auth/protected-route.tsx`.
- [x] Все формы — react-hook-form + zod, ошибки локализованы через i18n.
- [x] Honeypot-поле `website` в register (абсолютно позиционировано за экраном,
      tabIndex=-1, aria-hidden). При заполнении backend silently 202.
- [x] Согласие на ПДн (152-ФЗ) — обязательный checkbox в register, заблокирует
      submit; backend ещё раз проверит на DTO-уровне.
- [x] CAPTCHA-поле абстрагировано: в dev (`VITE_CAPTCHA_PROVIDER=none`) — noop,
      в prod — Yandex SmartCaptcha (TODO когда появится shopId).
- [x] **Smartphone-сценарии прошли e2e**: register → verify-email (auto-call) →
      login → /lk → dashboard с QR + subscription URL → rotate subToken (новый
      токен в БД, `subTokenRotatedAt` обновляется) → payments table → settings
      (change-password выкидывает все refresh, delete account анонимизирует ПДн).
- [x] Backend: новые эндпоинты: - `POST /api/subscriptions/me/:id/rotate-token` — scoped to userId,
      throttle 5/60s, audit `subscription.rotate-token`. Кросс-юзер → 404. - `POST /api/auth/change-password` — verify current via argon2,
      revoke all refresh tokens, clear refresh cookie, audit `auth.change-password`.
      Same-as-current → 400, wrong current → 401. - `DELETE /api/auth/me` — verify current password (защита от XSS-перехвата
      сессии: атакующему с access-токеном пароля нет), `UsersService.anonymize`
      в транзакции (email → `deleted-user-<id>@anon.proxels.invalid`, hash → 'invalid',
      revoke refresh, deletedAt=now), очистить cookie. Финансовые записи живы для
      отчётности, но обезличены. Audit `account.delete`.
- [x] Subscription URL формат `${origin}/api/sub/<token>` уже корректный — Phase 10
      поднимет серверный эндпоинт. QR работает сразу (QRCodeSVG из qrcode.react).
- [x] Toast'ы (sonner) сами подхватывают тему из ThemeProvider (light/dark).
- [x] Email-enumeration mitigations сохранены и в UI: forgot-password всегда
      показывает success-state, register не выдаёт «email already used».

## Этап 6 — Frontend каркас

- [x] React 18 + TS + Vite + Tailwind 3 + Radix UI + Framer Motion + i18next
      (ru/en) + React Router 6 — стек по §1/§3 CLAUDE.md.
- [x] Темы dark/light/system; класс `.dark` / `.light` на `<html>`, выбор
      хранится в `localStorage:proxels:theme`. FOUC-блокирующий inline-скрипт
      в `index.html` ставит тему ДО рендера React (нет вспышки светлой темы).
      Дефолт — `dark` (см. §3 CLAUDE.md).
- [x] i18n: ru-дефолт, en-альтернатива; `<html lang>` синхронизируется через
      `i18n.on('languageChanged')`; выбор сохраняется в `localStorage:proxels:locale`.
      Хардкода строк в компонентах нет — всё через `t(...)`.
- [x] Mobile-first layout с off-canvas бургер-меню (Radix Dialog), переключателями
      темы и языка, ссылкой на единственную соц-сеть Telegram `t.me/proxels`
      (см. §13 запрет на VK/Insta/...).
- [x] Реквизиты ИП в футере (имя, ОГРНИП, ИНН) — в i18n-ключах
      `footer.ip.{name,ogrnip,inn}`, источник для перевода — verified §11a данные.
      Явная отметка «Сервис не ведёт журналов посещаемых ресурсов» (§4a).
- [x] Vite-прокси `/api/* → backend:3000` в dev, чтобы не получить CORS-проблем.
      В prod nginx уже это делает (Этап 13).
- [x] API-клиент (`src/lib/api.ts`): `credentials: 'include'` по умолчанию (нужно
      для httpOnly refresh-cookie из Этапа 3), типизированный `ApiError`,
      без `axios` (минимизируем bundle).
- [x] `dangerouslySetInnerHTML` нигде не используется (только React-рендер user-input).
      Если когда-нибудь понадобится для markdown — пропускать через DOMPurify
      (в Этапе 9 при наполнении юр.документов).

### Открытые TODO для Этапа 7 (лендинг + SEO) и Этапа 13 (деплой)

- [ ] CSP-заголовки выставляет nginx (Этап 13): `default-src 'self'`,
      явный whitelist для шрифтов Google, домена YooKassa, Yandex SmartCaptcha,
      Yandex.Metrika. Включить только после согласия на cookie (см. §4c CLAUDE.md).
- [ ] Все формы будут использовать CAPTCHA-токен, валидируемый на сервере (Этап 8).
- [ ] User-content (юр.документы) — через DOMPurify в Этапе 9.
- [ ] SSR/pre-render лендинга для SEO — Этап 7 (`docs/SEO.md`).

## Этап 10 — Xray nodes (КРИТИЧНО для no-logs)

- [ ] В конфиге Xray на ноде: `"log": { "loglevel": "warning", "access": "none", "error": "none" }`
      (или `/dev/null`). Нет файла `access.log`.
- [ ] На ноде нет mitmproxy, dnsmasq с логированием, tcpdump в systemd, и т.п.
- [ ] DNS-резолвер ноды — без логов (DoH/DoT через upstream без логирования).
- [ ] Backend использует Xray API только для: AddUser, RemoveUser, GetStats (uplink/downlink
      per UUID). Никаких выборок per-destination.
- [ ] Канал backend↔node защищён (mTLS или shared secret через приватную сеть).
- [ ] Создан `docs/PRIVACY-ARCHITECTURE.md` с описанием, как именно обеспечен no-logs.

## Этап 12 — Гайды + Админка + 2FA TOTP

- [x] **2FA TOTP** (otplib, window=1):
      `POST /api/auth/2fa/setup` создаёт секрет и кладёт его в Redis
      (`proxels:2fa:pending:<userId>`, TTL 10m) — в БД секрет попадает
      ТОЛЬКО после успешного `confirm`. Это предотвращает self-lockout,
      если QR-код не отсканирован.
- [x] `POST /api/auth/2fa/disable` требует и пароль (argon2.verify), и
      текущий TOTP-код — мало просто украсть сессию.
- [x] **TOTP обязателен для admin-логина**: `AuthService.login` бросает 401
      `{ requiresTotp: true }` если у user.role==='admin' есть `totpSecret`
      и `loginDto.totpCode` отсутствует. Невалидный код → 401 `'Invalid TOTP code'`.
      Тайминг-safe сравнение через `otplib.authenticator.verify`.
- [x] Секрет 2FA **никогда** не возвращается из админ API — только флаг
      `twofaEnabled: u.totpSecret != null` в `GET /api/admin/users`.
- [x] Все эндпоинты `/api/admin/*` под `JwtAccessGuard + RolesGuard + @Roles('admin')`.
      Анонимный → 401, обычный user → 403 (verified для `/api/admin/users`
      и `/api/auth/2fa/status`).
- [x] Каждое write-действие админа пишется в `AuditLog` с `actorId + ip + meta`:
      `admin.user.revoke-sessions`, `admin.user.force-verify`, `admin.user.delete`,
      `admin.node.create/update/deactivate`, `admin.legal.*`, `admin.guide.*`.
      В meta — только идентификаторы и список изменённых полей, не значения.
- [x] **Self-delete protection**: admin не может удалить сам себя
      (`/admin/users/:id` сравнивает с `req.user.id` → 400).
- [x] Anonymize-user в админ API использует тот же `UsersService.anonymize`,
      что и self-delete — никакой второй привилегированный путь.
- [x] Markdown гайдов рендерится через `react-markdown` + `remark-gfm`,
      без `dangerouslySetInnerHTML` (тот же XSS-safe подход, что у legal).
- [x] Throttle на 2FA setup (1/60s — нельзя спамить), confirm (10/60s),
      disable (5/60s); admin endpoints — under `Throttle({ default: 60/60s })`
      или строже для create-операций (30/60s).
- [x] `GET /api/admin/users` использует Prisma `select` + редактирует
      `totpSecret` → boolean — секреты не утекают даже под `forbidNonWhitelisted`.
- [x] Frontend `/admin/*` под `<ProtectedRoute requireRole="admin">`.
      На `requireRole` mismatch → редирект на `/`.

**Открытые TODO (на Этап 13 / прод-запуск):**

- [ ] `ADMIN_IP_ALLOWLIST` middleware (опц.) — пока не реализован, кладём в Этап 13
      вместе с nginx allowlist (выше уровень — отсекаем до Node).
- [ ] CSV-экспорт AuditLog — UI-удобство, не блокер; добавим, когда юрист попросит
      выгрузку для проверок.
- [ ] Refund платежа через YooKassa API из админки — отдельный риск (нужны refund-creds);
      пока ручной через ЛК YooKassa, отмеченный audit-логом.

## Этап 12a — Промокоды

- [x] Валидация промокода — последовательная и закрытая по reasons:
      `not_found | inactive | not_yet_valid | expired | limit_reached |
plan_not_allowed | per_user_limit_reached`. Передаётся через
      `BadRequestException({ promoError })`, фильтр прокидывает в тело клиенту.
- [x] Формат кода проверяется regex `[A-Z0-9_-]{2,32}` ДО запроса в БД —
      кривые/слишком длинные строки получают сразу `not_found`, без I/O и без
      «подсказки» о реальной валидной длине.
- [x] **CAS на `maxUses`** при инкременте `usedCount` через `updateMany WHERE
usedCount < maxUses`. Защищает от over-redeem на гонках. Если CAS не
      сработал — warn в логе (платёж уже succeeded), бизнес-риск ≤ 1-2 лишние
      редемпции, приемлемо.
- [x] **Per-user limit** проверяется по `PromoRedemption.userId` (count
      запрошенный по userId). Не верим клиенту на слово.
- [x] Финальная сумма платежа **всегда ≥ 1 ₽** (clamp в `calcDiscount`).
      Запрет бесплатной выдачи подписки через промо — YooKassa-минимум + лишает
      смысла абуз сценария «100%-off».
- [x] `Payment.metadata` хранит `promoId + promoCode + discountRub + originalAmountRub` —
      история сохраняется на случай разбора инцидента, но `usedCount`
      инкрементируется только в `redeemAtomic` (на `payment.succeeded`).
- [x] **`usedCount` не редактируется через admin CRUD** — только `redeemAtomic`
      в payment-транзакции. Защита от ручной правки счётчика (фрод через
      админа).
- [x] **Soft-delete промокода** (isActive=false) — история редемций не теряется
      (для отчётности + 152-ФЗ no-erase финансовых записей).
- [x] Throttle: `/api/promos/validate` 30/60s, `/api/admin/promos` create
      30/60s. Перебор через массовую валидацию ограничен.
- [x] PromoRedemption связан с Payment через `paymentId @unique`, FK с
      `onDelete: Cascade` — при анонимизации пользователя (Phase 8) Payment'ы
      остаются (история), редемпции тоже; PromoCode видит, что юзер потратил.
- [x] AuditLog на всё: `admin.promo.create/update/deactivate` + `promo.redeem`
      (в meta — promoId + code + discountRub + paymentId). Гудвилл-extends
      будут таким же путём.
- [x] **Прокидываем безопасно**: `AllExceptionsFilter` копирует в ответ только
      примитивы и flat-string-массивы из тела `HttpException` — нельзя случайно
      утечь внутренние объекты с stacktrace или Prisma-meta.

## Этап 13 — Деплой

- [ ] HTTPS only, HSTS preload-ready, TLS 1.2+.
- [ ] nginx: `limit_req_zone` для `/auth/*` и `/api/sub/*`, `limit_conn_zone`.
- [ ] fail2ban настроен (см. `DEPLOY.md`).
- [ ] Postgres с ПДн — физически на сервере в РФ (152-ФЗ).
- [ ] Бэкапы Postgres шифруются; ключ хранится отдельно.
- [ ] SSH-доступ к серверу — только по ключам, отключён вход по паролю, нестандартный порт.
- [ ] Регулярный `pnpm audit` в CI; критичные CVE — стоп-флаг релиза.

---

## Threat model (короткая)

| Угроза                             | Контрмера                                                 |
| ---------------------------------- | --------------------------------------------------------- |
| Бот регистрирует тысячи аккаунтов  | CAPTCHA + honeypot + email-verify + rate-limit            |
| Брутфорс логина                    | rate-limit IP+email, экспоненциальный backoff, CAPTCHA    |
| Перебор `subToken`                 | токен >=32 байта, 404 без подсказок, rate-limit           |
| Подделка webhook ЮKassa            | проверка подписи + IP-whitelist + идемпотентность         |
| Утечка БД ⇒ восстановление паролей | argon2id                                                  |
| Утечка subscription-токена         | возможность ротации subToken из ЛК                        |
| Компрометация админ-аккаунта       | 2FA TOTP + IP-allowlist + аудит-лог                       |
| Запрос «покажи историю клиента»    | технически невозможно: ни в Xray, ни в backend            |
| DDoS на API                        | nginx limit_req/conn, fail2ban, опц. Cloudflare/StormWall |
| Утечка секретов через git          | `.gitignore` + git-secrets pre-commit (TODO)              |
