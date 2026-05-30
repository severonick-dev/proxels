# PHASES — журнал реализации Proxels

Полный план: [`../prompts/CLAUDE.md`](../prompts/CLAUDE.md) §12.
GitHub: https://github.com/severonick-dev/proxels

При смене сессии (обнулении контекста) Claude должен прочитать этот файл —
здесь есть полное состояние проекта по этапам.

---

## ✅ Этап 1 — Скелет монорепо · commit `10f27d6`

- pnpm workspaces, TypeScript strict, Prettier, EditorConfig, .gitattributes (LF).
- `apps/web` (placeholder), `apps/api` (placeholder), `packages/shared`,
  `infra/{docker,nginx,xray}`, `docs/`, `.github/workflows/ci.yml`.
- Полный `.env.example`, README.md, docs/{SECURITY,DEPLOY,LEGAL}.md скелеты.
- Git remote → github.com/severonick-dev/proxels.git.

## ✅ Этап 2 — Backend NestJS · commit `3433185`

- NestJS 11 + TypeScript + nest-cli, источники в `apps/api/src/`.
- `AppConfigModule` с zod-валидацией ENV — сервис падает на старте при невалидных переменных.
- `PrismaModule` (Postgres 16), `RedisModule` (ioredis 5, graceful shutdown).
- Глобальные: `helmet`, строгий CORS, `ValidationPipe(whitelist+forbidNonWhitelisted)`,
  `ThrottlerGuard` с Redis-store (`@nest-lab/throttler-storage-redis`),
  `AllExceptionsFilter`, nestjs-pino с redact (Authorization/cookie/password/refreshToken).
- `cookie-parser`, BigInt→JSON сериализатор.
- Prisma schema по §5 (User, Plan, Subscription, Payment, Node, XrayClient,
  AuditLog, LegalDoc) + initial migration.
- `GET /api/health` (Terminus: DB + Redis), `GET /api/health/live`.
- `infra/docker/docker-compose.dev.yml`: postgres:16-alpine + redis:7-alpine
  с healthchecks и persistent volumes.
- `dotenv-cli` для `prisma:*` скриптов (читают корневой .env).

## ✅ Этап 3 — Auth · commit `54a2160`

- argon2id (memoryCost=64MB), JWT access (15m) + refresh (30d).
- Refresh-токен = JWT с jti+fam, sha256 хранится в `RefreshToken` таблице.
  Rotation на каждый refresh + **reuse-detection**: при повторе старого токена
  отзывается вся family.
- Refresh-cookie: httpOnly + secure(prod) + sameSite (strict prod / lax dev),
  path=/api/auth (узкая поверхность), name `proxels_rt`.
- Endpoints: register / verify-email / resend-verification / login / refresh /
  logout / forgot-password / reset-password / me. Каждый со своим `@Throttle`.
- `CaptchaModule` (Yandex SmartCaptcha / hCaptcha / Noop) — factory бросает в prod при `none`.
- `MailModule` — stub (логирует payload в pino); реальный SMTP на сервере (Этап 13).
- Honeypot `website` в RegisterDto: backend возвращает silent fake-202.
- Согласие на ПДн (152-ФЗ): `consentPdnAt` + `consentPdnVersion` (из @proxels/shared).
- Timing-safe login (dummy argon2.verify при отсутствии юзера).
- Email enumeration mitigations везде.
- Новая модель `RefreshToken` (+ миграция).

## ✅ Этап 4 — Plans CRUD · commit `0492b5b`

- `RolesGuard` + `@Roles('admin')` декоратор.
- `AuditModule`/`AuditService` (записи в AuditLog с actorId+ip+meta).
- Public: `GET /api/plans`, `GET /api/plans/:id` (только активные).
- Admin: `GET/POST/PATCH/DELETE /api/admin/plans` под JwtAccessGuard+RolesGuard.
  Soft-delete (`isActive=false`). update() пишет per-field diff в audit.
- `GET /api/subscriptions/me`, `GET /api/payments/me` — read-only с scope `userId`.
- PaymentsService.listForUser использует Prisma `select` — никаких сырых webhook payload.
- `prisma/seed.ts`: 4 тарифа (1/3/6/12 мес) + optional admin из ENV.

## ✅ Этап 5 — ЮKassa · commit `517b0f2`

- `YookassaService` (REST, Basic auth, Idempotence-Key, abort 10s).
- 54-ФЗ receipt в payment-request (customer.email + items[0] с vat_code,
  payment_mode, payment_subject — дефолты для ИП на УСН/НПД).
- **Dev-bypass**: при пустом YOOKASSA_SHOP_ID в development — синтетический
  payment без реального API-вызова. Жёстко отключено в prod.
- `YookassaIpGuard`: CIDR-allowlist 7 официальных подсетей + localhost в dev.
- `POST /api/payments/create` (JwtAccessGuard, требует `offerAccepted: true`).
- `POST /api/payments/webhook` (YookassaIpGuard):
  - Идемпотентность (skip terminal states)
  - Проверка amount mismatch → 403
  - Транзакция Postgres: createOrExtend Subscription + update Payment
- `SubscriptionsService.createOrExtendForPayment`: продлевает существующую активную
  подписку того же плана либо создаёт новую с subToken=32 байта base64url.
- Dev-helper `POST /api/payments/dev/simulate-succeeded/:yookassaId` (403 в prod).

## ✅ Этап 6 — Frontend каркас · commit `52adab0`

- Vite 5 + React 18 + TS strict + Tailwind 3.4 + Radix UI + Framer Motion +
  i18next 23 + React Router 6.
- Темы dark/light/system, FOUC-блокер в index.html (тема ставится ДО React).
- i18n ru (default) / en, переключатель в шапке.
- Layout: Header (Logo, nav, Telegram link, LangSwitcher, ThemeToggle, auth-CTA),
  Footer (бренд, nav, legal, реквизиты ИП), MobileNav (off-canvas Radix Dialog).
- UI primitives: Button (CVA, 5 variants), Sheet, DropdownMenu.
- Page-stubs для всех маршрутов + 404.
- Vite-прокси `/api/* → backend:3000` в dev. `commonjsOptions` для @proxels/shared.
- API-клиент с credentials:include + типизированный ApiError.

## ✅ Этап 7 — Лендинг + SEO · commit `9d288f3`

- 6 секций лендинга (apps/web/src/components/sections/):
  Hero (Framer Motion анимированный фон), Benefits (4 карточки),
  HowItWorks (3 шага), PricingPreview (live API + onLoad для JSON-LD),
  SupportedApps (3 клиента), Faq (Radix Accordion).
- `<SEO />` компонент (react-helmet-async): title/desc/canonical/hreflang/OG/Twitter,
  опц. noindex, опц. jsonLd.
- JSON-LD helpers: Organization (в PublicLayout), FAQPage (home),
  Product (pricing, с offers из API), BreadcrumbList (guides).
- robots.txt, sitemap.xml, og-image.svg в public/.
- noindex,nofollow на /lk, /admin, /auth/\*, 404.
- docs/SEO.md — полный чек-лист + TODO для SSR/PNG OG/Yandex.Webmaster.

## ✅ Этап 7.5 — Cleanup · commit `a3a7236`

- Удалены ВСЕ упоминания `lithops.group` из кода/доков/env/памяти
  (это сторонняя компания владельца, не Proxels).
- CONTACT_EMAIL дефолт → `noreply@proxels.ru`, реальный задаст владелец.
- Добавлена feedback-память «никогда не упоминать сторонний домен работодателя».

## ✅ Этап 8 — ЛК · commit `8519612`

**Backend:**

- `POST /api/subscriptions/me/:id/rotate-token` (scope, audit, 5/60s throttle).
- `POST /api/auth/change-password` (verify current, refuse same, revoke all refresh, audit).
- `DELETE /api/auth/me` (verify password, anonymize ПДн через `UsersService.anonymize`,
  revoke refresh, clear cookie, audit). Право на забвение по 152-ФЗ.

**Web foundation:**

- Zustand `auth-store` — access-токен **только в памяти** (§13 запрет localStorage).
- API-клиент с **auto-refresh на 401** + singleton in-flight refresh.
- `tryBootstrapAuth()` на App mount пробует /auth/refresh для восстановления сессии.
- `ProtectedRoute` на /lk и /admin.
- `LkLayout` со sidebar и logout.
- UI primitives: Input, Label, Checkbox (Radix), FormField.
- `CaptchaField` (dev noop, prod-TODO Yandex SmartCaptcha widget).
- `sonner` toaster (с темой из ThemeProvider).

**Формы (react-hook-form + zod):**

- /auth/login, /auth/register (+ honeypot + consent + captcha),
  /auth/forgot-password, /auth/reset-password (читает `?token` из URL),
  /auth/verify-email (auto-call на mount).

**ЛК страницы:**

- /lk — карточка активной подписки: stats grid, subscription URL + Copy + QR
  (qrcode.react) + Rotate (TanStack mutation), no-sub state.
- /lk/payments — таблица истории с цветными статусами.
- /lk/settings — change password (logs out), delete account (требует пароль + слово DELETE).

**i18n массивно расширен:** forms._, auth._, lk.\* для ru+en.

## ✅ Этап 8.5 — Hotfixes · commit `<this commit>`

- **Cookie bug**: Chrome молча отбрасывает cookie с `Domain=localhost`
  (RFC 6265 — Domain должен содержать точку). Из-за этого refresh-cookie
  не сохранялась → юзера выкидывало после F5. Fix: не выставлять `domain`
  если он `localhost` или начинается с `localhost:` (apps/api/src/auth/auth.controller.ts:cookieOptions).
- **Header auth-aware**: вместо Login/Register показывается UserMenu
  (аватар-инициал + email + dropdown «Личный кабинет / Админка / Выйти»).
  MobileNav тоже знает про isAuthed.
- Новый компонент `apps/web/src/components/auth/user-menu.tsx`.

---

## ✅ Этап 9 — Юр.страницы + cookie-banner + публичный конфиг

**Backend:**

- `LegalDocsService` + `GET /api/legal[/:slug]` (public read-only).
  Возвращает последнюю опубликованную версию (`publishedAt != null`,
  `orderBy publishedAt desc`).
- `prisma/seed-legal.ts` — идемпотентный seed 3 документов (privacy/offer/cookie)
  с markdown-контентом и пометкой «шаблон, проверяется у юриста».
  Версия = `CONSENT_VERSIONS.*` из `@proxels/shared`.
- `PublicConfigController` — `GET /api/config/public`: brand + реквизиты ИП
  (из ENV), Yandex.Metrika ID, версии согласий. **Никаких секретов**
  (ни ID нод, ни webhook-токенов).

**Frontend:**

- `<LegalDocPage />` (`apps/web/src/components/legal/`) рендерит markdown
  через `react-markdown` + `remark-gfm` — **XSS-безопасно по дизайну**
  (React-элементы, не innerHTML). Кастомные `components` дают tailwind-стили
  без plugin'а typography.
- 3 страницы `/legal/{privacy,offer,cookies}` теперь тянут контент из API.
  Сверху — версия, дата публикации, disclaimer.
- `lib/cookie-consent.ts` + `<CookieBanner />`: баннер появляется если
  согласие ещё не дано. Сохраняет `{ necessary, analytics, decidedAt }` в
  `localStorage:proxels:cookie-consent`. Закрытие крестиком =
  «только необходимые». Animated через Framer Motion.
- `<YandexMetrika />`: грузит метрику ТОЛЬКО при выполнении ВСЕХ трёх условий —
  согласие на analytics + `analytics.yandexMetrikaId` не null +
  `!import.meta.env.DEV`. Hit на каждый route change. Реагирует на
  смену согласия без перезагрузки страницы (`proxels:consent-changed` event).
  `webvisor: false` по приватности (§4a).
- Footer тянет реквизиты ИП из `/api/config/public` (приоритет) с
  фолбэком на i18n. Telegram-ссылка/handle тоже из конфига.
- `OWNER_*` явно добавлены в `.env` (Windows-Node иногда читает .ts-defaults
  с системной кодировкой — лучше держать в .env UTF-8).

**i18n:** `cookieBanner.*`, `legal.{version,publishedAt,disclaimer}` — ru+en.

**Smoke (6/6):**

- `/api/legal` → 3 документа
- `/api/legal/privacy` → 200 с корректным markdown (UTF-8)
- `/api/legal/unknown` → 400
- `/api/config/public` → brand+owner+contact+analytics+consentVersions
- Web `/legal/privacy` → SPA 200
- Vite proxy `/api/legal/privacy` → 200

## ✅ Этап 10 — Своя система выдачи subscription-ссылок

**Prisma:**

- `Node` расширен полями `port: Int @default(443)` и `sni: String` (по
  умолчанию `www.microsoft.com`). Миграция `20260530114539_add_node_port_sni`.

**Backend (`apps/api/src/`):**

- `xray/` — модуль клиента к Xray:
  - `xray.types.ts` — интерфейс `XrayNodeClient { addUser, removeUser, getClientStats? }`.
    Контракт жёстко whitelist'нут: ничего, что выглядело бы как «история активности».
  - `clients/noop.client.ts` — для dev, просто логирует.
  - `clients/grpc.client.ts` — skeleton с явным `throw new Error('not implemented')`.
    Будет дописан, когда поднимется первая боевая нода (Этап 13).
  - `xray.module.ts` — Global, фабрика выбирает реализацию по ENV `XRAY_CLIENT=noop|grpc`.
    В production `noop` запрещён.
  - `xray.service.ts` — `materializeForSubscription(subId, tx?)`: создаёт
    XrayClient'ы на каждой online+active ноде, вызывает `XrayNodeClient.addUser`.
    Если конкретная нода падает — продолжаем с остальными (failover на этапе выпуска).
- `sub/` — публичный подписочный эндпоинт:
  - `vless-uri.ts` — генератор VLESS Reality URI с правильными параметрами
    (encryption=none, type=tcp, security=reality, pbk/sni/sid/fp=chrome/flow=xtls-rprx-vision).
  - `sub.service.ts` — `resolveBySubToken`: проверяет валидность подписки,
    lazy materialization XrayClient'ов если их ещё нет, собирает URI'и,
    возвращает base64-payload + Subscription-Userinfo header.
    На любые проблемы → 404 без подсказок.
  - `sub.controller.ts` — `GET /api/sub/:subToken` с
    `Content-Type: text/plain; charset=utf-8`, `Profile-Update-Interval: 24`,
    `Profile-Title: Proxels`, `Cache-Control: no-store`. Throttle 30/60s.

**PaymentsService.handleSucceeded:**

- В той же Postgres-транзакции, что создаёт Subscription, теперь вызывается
  `xray.materializeForSubscription(sub.id, tx)`. Атомарно: либо обе записи
  (Subscription + XrayClient'ы), либо ни одной.

**Seed:**

- `prisma/seed-nodes.ts` — 2 dev-ноды (`dev-de-1`, `dev-de-2`) с заглушечными
  publicKey/shortId. Запускаются только при `NODE_ENV !== 'production'`.
  Это позволяет тестировать `/api/sub/:token` локально, не имея реальных нод.

**Infra & docs:**

- `infra/xray/README.md` — инструкция установки Xray на ноде (Reality keys,
  config, проверки безопасности), как настроить gRPC API inbound, как
  зарегистрировать ноду в БД, что НЕЛЬЗЯ делать (access-логи!).
- `infra/xray/node-config.example.json` — рабочий шаблон Xray config с
  `log.access=none`, `sniffing.enabled=false`, ApiService whitelist.
- `docs/PRIVACY-ARCHITECTURE.md` — полное описание архитектуры приватности:
  что хранится / что НЕ хранится, как обеспечено на нодах и в backend,
  что хранят сторонние сервисы, юр.следствия (152-ФЗ / 376-ФЗ Яровая),
  чек-лист владельца перед прод-запуском, шаблон ответа на запрос
  «отчёт по активности юзера X».

**ENV:**

- `XRAY_CLIENT=noop|grpc` (default noop в dev). В production `noop` → ошибка.

**Smoke (7/7):**

- Регистрация → verify → login
- Payment succeeded → Subscription + **2 XrayClient'а на 2 dev-нодах**
- `GET /api/sub/:subToken` → 200 + base64-блоб + Subscription-Userinfo header,
  декодируется в 2 валидных VLESS Reality URI с правильными параметрами
- Bad token (40 нулей) → 404
- Short token → 404
- `Node` таблица содержит port/sni/status
- AuditLog: `subscription.issue` (4)

## ✅ Этап 11 — Health-check + failover

**Backend (`apps/api/src/health-checks/`):**

- `probe.ts` — `tcpProbe(addr, timeoutMs)`: открыть TCP-соединение,
  на success → true, на error/timeout → false. Двойная страховка таймером.
- `nodes-health.service.ts` — `probeAll()`: проходит по каждой active-ноде,
  делает TCP-probe её `xrayApiAddr`, применяет анти-флаппинг (счётчики в
  Redis hash `proxels:nodes:health:<id>`), обновляет БД `Node.status`
  ТОЛЬКО при смене. Поддерживает SET `proxels:nodes:online` (TTL 90s) —
  быстрый кэш для `/api/sub/:token`.
- `nodes-health.processor.ts` — BullMQ `WorkerHost` + `@Processor`.
  В `onModuleInit` чистит старые repeatable-jobs и регистрирует новый с
  интервалом `HEALTH_CHECK_INTERVAL_SECONDS`. Сразу один прогон, чтобы
  сократить «холодное окно» после рестарта.
- `health-checks.module.ts` (Global): `BullModule.forRootAsync` парсит
  REDIS_URL, prefix `proxels:bull` (не конфликтует с throttler-storage).
- `admin-nodes.controller.ts` — `GET /api/admin/nodes` (list) +
  `GET /api/admin/nodes/health` (агрегированно: nodes + health-counters
  - onlineCount). Под JwtAccessGuard + RolesGuard + Roles('admin').

**Анти-флаппинг логика:**

- `consecutiveSuccess >= HEALTH_FLAP_UP_THRESHOLD` → online
- `consecutiveFailure >= HEALTH_FLAP_DOWN_THRESHOLD` → offline
- иначе если online→fail или offline→succ — degraded (промежуточное)

**Оптимизация `SubService`:**

- Теперь читает онлайн-ноды из Redis SET одним SMEMBERS вместо JOIN с БД.
  Если кэш пуст (воркер ещё не отработал) — фолбэк к БД.

**ENV:**

- `HEALTH_CHECK_INTERVAL_SECONDS` (default 30, min 5, max 600)
- `HEALTH_CHECK_TIMEOUT_MS` (default 3000)
- `HEALTH_FLAP_UP_THRESHOLD` (default 2)
- `HEALTH_FLAP_DOWN_THRESHOLD` (default 3)

**Verified end-to-end:**

- Изменили dev-ноды на закрытый порт `127.0.0.1:55555` → через 2 цикла
  health-check'а перешли в `offline` (fail=5, succ=0).
- Добавили `dev-online-1` → `127.0.0.1:5432` (открытый postgres) →
  через 1 цикл `online` (succ=5).
- `/api/sub/:token` теперь возвращает URI **только живой ноды**
  (`dev-online-1`), мёртвые исключены — failover работает.
- `/api/admin/nodes/health` показывает onlineCount=1, детали со счётчиками.

## ✅ Этап 12 — Гайды + Админка + 2FA TOTP

**Prisma:**

- Новая модель `Guide(id, slug @unique, title, platforms, contentMd, sortOrder,
isPublished, createdAt, updatedAt)` + миграция `add_guide`.
- `prisma/seed-guides.ts` — идемпотентный seed 3 гайдов с реальным markdown:
  Nekobox (Android), Hiddify (iOS), V2RayTun (Windows/macOS).
- `prisma/seed.ts` вызывает `seedGuides()` после legal-docs.

**Backend — Гайды:**

- `apps/api/src/guides/`:
  - `GuidesService`: `listPublished()` сорт по sortOrder, `getBySlug()` 404 для
    неопубликованных, плюс admin-helpers (listAll, findById, create, update, remove).
  - `GuidesController`: public `GET /api/guides`, `GET /api/guides/:slug`,
    throttle 60/60s. **Без аутентификации** — гайды нужны и анонимам.
  - `GuidesModule` экспортирует сервис → используется AdminModule.

**Backend — 2FA TOTP:**

- `apps/api/src/auth/twofa/`:
  - `TwoFactorService` поверх `otplib` (window=1, RFC-совместимо). API:
    `beginSetup(userId, email)` → `{ secret, otpauthUrl }`, секрет лежит в
    Redis (`proxels:2fa:pending:<userId>`, TTL 10m) и **не сохраняется в БД до подтверждения**.
    `confirmSetup(userId, code)` — verify первого кода, копирует секрет в `User.totpSecret`.
    `disable(userId)` — clear `totpSecret`. `verifyCode(secret, code)`.
  - `TwoFactorController` под `JwtAccessGuard`:
    - `GET /api/auth/2fa/status`
    - `POST /api/auth/2fa/setup` (1/60s)
    - `POST /api/auth/2fa/confirm` (10/60s) — DTO с code 6 цифр
    - `POST /api/auth/2fa/disable` (5/60s) — требует пароль + код (argon2.verify).
- `AuthService.login` — при `user.totpSecret && user.role === 'admin'` требует
  `totpCode` в DTO; на отсутствие → `401 { requiresTotp: true }`, на неверный → 401.
- `LoginDto` расширен optional `totpCode` (6 цифр).
- `AuthModule` — экспорт `TokensService` (нужен AdminModule для revoke-sessions).

**Backend — Админ-эндпоинты:**

- `apps/api/src/admin/`:
  - `admin-users.controller.ts`:
    - `GET /api/admin/users?q&take&skip` — список + total с email-поиском.
      `twofaEnabled = totpSecret != null` (сам секрет НИКОГДА не возвращаем).
    - `GET /api/admin/users/:id` — детали (subs, payments, recent audit).
    - `POST /:id/revoke-sessions` — отзыв всех refresh-токенов через TokensService.
    - `POST /:id/force-verify` — выставить emailVerifiedAt.
    - `DELETE /:id` — анонимизация (152-ФЗ право на забвение). Self-delete блокирован.
  - `admin-audit.controller.ts` — `GET /api/admin/audit?action&actorId&take&skip`.
  - `admin-legal.controller.ts` — `GET/POST/PATCH /api/admin/legal[/:id]`,
    публикация через `publishedAt` toggle.
  - `admin-nodes-crud.controller.ts` — write-операции нод (read в health-checks/).
    POST/PATCH/DELETE с DTO + throttle на создание. Soft-delete (isActive=false).
  - `admin-guides.controller.ts` — full CRUD гайдов, slug-валидация kebab-case.
- Все контроллеры под `@UseGuards(JwtAccessGuard, RolesGuard) @Roles('admin')`,
  каждое write-действие пишет AuditLog с `actorId + ip + meta`.

**Frontend — Публичные гайды:**

- `components/markdown.tsx` — общий react-markdown renderer (унификация с legal).
- `pages/guides/index.tsx` — grid карточек, `Link to="/guides/:slug"`.
- `pages/guides/detail.tsx` — markdown + breadcrumb JSON-LD + back-link.

**Frontend — 2FA UI:**

- `pages/lk/security.tsx` — пошаговый wizard:
  - Статус (enabled/disabled) из `/api/auth/2fa/status`.
  - Setup → показывает QR (`qrcode.react`) + раскрываемый secret для ручного ввода.
  - Confirm с 6-значным кодом.
  - Disable — требует password + код.
- `pages/auth/login.tsx` — state `needsTotp`. Если backend вернул
  `requiresTotp: true`, форма показывает поле TOTP-кода без сброса полей.

**Frontend — Админка:**

- `components/layout/admin-layout.tsx` — sidebar с навигацией (Overview, Users,
  Payments, Nodes, Guides, Legal, Audit).
- `pages/admin/`:
  - `overview.tsx` — 3 stat cards + recent audit list. 15s refetch для nodes-health.
  - `users.tsx` — таблица с email-поиском, role/verified/2FA badges,
    действия (revoke sessions, force-verify, delete confirm).
  - `audit.tsx` — таблица с фильтром по action, JSON-meta превью.
  - `nodes.tsx` — read-only health view, 10s refetch.
  - `payments.tsx` — выборка audit log с action=payment.\*.
  - `guides.tsx`, `legal.tsx` — list-таблицы с editor-note (full inline editor → 13).
- `components/layout/lk-layout.tsx` — добавлен nav-item `/lk/security`.
- `router.tsx` переписан: `<ProtectedRoute requireRole="admin"><AdminLayout/></ProtectedRoute>`
  оборачивает все `/admin/*` маршруты.

**i18n:** добавлены `lk.nav.security`, `lk.security.*`, `auth.totp.*`, `admin.*`
(panelLabel, nav, overview, users, payments, nodes, guides, legal, audit), `pages.guides.*`
для ru+en. Удалён `lk.dashboard.link.phase10Note` (был stale).

**Безопасность:**

- Секрет 2FA не возвращается из admin API (только флаг `twofaEnabled`).
- Pending secret в Redis TTL 10m — нельзя залочиться, если QR не отсканировался.
- Login для admin без TOTP → 401 (не показывает «есть ли 2FA» прямым ответом —
  фронт обрабатывает `requiresTotp: true`, но это после успешной верификации пароля).
- Anonymize-user в админке — тот же путь что у self-delete (consistent privacy).

**Smoke:**

- API bootstrap: все Phase-12 контроллеры подняты (Guides, 2FA, AdminUsers,
  AdminAudit, AdminLegal, AdminNodesCrud, AdminGuides).
- `GET /api/guides` → 3 гайда из БД.
- `GET /api/guides/nekobox` → 200.
- `GET /api/admin/users` без auth → 401.
- `GET /api/auth/2fa/status` без auth → 401.

## ✅ Этап 12a — Промокоды (новое требование владельца)

**Prisma:**

- Новые модели `PromoCode(id, code @unique, discountKind: percent|fixedRub,
discountValue, validFrom/Until, maxUses, usedCount, perUserLimit,
appliesToPlanIds: String[], isActive)` и `PromoRedemption(promoCodeId, userId,
paymentId @unique, discountRub)`. Plus enum `PromoKind`. Миграция `add_promo`.
- `Payment.promoRedemption` — обратная ссылка для join'ов.

**Backend — Валидация:**

- `apps/api/src/promos/promos.service.ts`:
  - `normalize(input)` — trim + uppercase + regex `[A-Z0-9_-]{2,32}`.
    Невалидный формат — мгновенный `not_found` (не палим, что код просто кривой).
  - `validateForPurchase({code, userId, planId, amountRub})` — последовательная
    проверка: existence → isActive → validFrom/validUntil окно → `maxUses` →
    `appliesToPlanIds` → `perUserLimit` (count redemptions). На любом fail —
    `BadRequestException({ promoError: '<reason>' })`.
  - `calcDiscount`: для `percent` — floor(amount\*v/100), для `fixedRub` — value;
    клампится так, чтобы финальная сумма ≥ 1 ₽ (минимум YooKassa).
  - `redeemAtomic(tx, args)` — записать `PromoRedemption` + CAS-инкремент
    `usedCount` через `updateMany WHERE usedCount < maxUses`. Если CAS не
    сработал (race на лимите) — логируется warn без отказа: платёж уже succeeded,
    отказывать поздно.
- `PromosController` — `POST /api/promos/validate` под `JwtAccessGuard`,
  throttle 30/60s.

**Backend — Интеграция в payments:**

- `CreatePaymentDto` — optional `promoCode`.
- `PaymentsService.createForUser`:
  - Если `promoCode` есть — `PromosService.validateForPurchase`. Финальная сумма
    идёт в YooKassa и в `Payment.amountRub`. Метаданные: `promoId`, `promoCode`,
    `discountRub`, `originalAmountRub`.
  - Возвращает `{ amountRub, discountRub }` для UI.
- `handleSucceeded`: в той же `$transaction`, что создаёт Subscription,
  вызывается `PromosService.redeemAtomic`. AuditLog: `payment.create`
  (с `promoCode + discountRub`), `promo.redeem`.

**Backend — Админ-CRUD:**

- `AdminPromosController` (`/api/admin/promos`):
  - `GET /` — список (фильтр `?active=true`).
  - `GET /:id`, `GET /:id/redemptions?take&skip`.
  - `POST /` — create с DTO-валидацией (`code` через тот же normalize,
    `discountValue` диапазоны для percent/fixedRub).
  - `PATCH /:id` — частичное обновление; `usedCount` НЕ редактируется через CRUD
    (только через redeemAtomic).
  - `DELETE /:id` — soft (isActive=false). История редемций сохраняется.
- Audit: `admin.promo.create`, `admin.promo.update`, `admin.promo.deactivate`.

**Backend — Exception-фильтр:**

- `AllExceptionsFilter` теперь прокидывает дополнительные поля тела
  `HttpException.getResponse()` в ответ клиенту (например, `promoError`,
  `requiresTotp`). Копируются только примитивы и flat-массивы строк —
  чтобы случайно не утечь объекты со stacktrace или внутренним state.

**Frontend — Покупочный диалог:**

- `components/lk/purchase-dialog.tsx`:
  - Поле «Промокод» с debounce 350мс → `POST /promos/validate`.
  - Состояния: `idle | checking | ok(data) | error(reason)`. Loader/checkmark в
    inline-индикаторе. На `ok` — рендерится «применён промокод X — скидка Y ₽»
    - перечёркнутая старая цена. Поле автоматически делает uppercase visual,
      backend всё равно нормализует.
  - При оплате передаёт `promoCode` только если состояние `ok`.

**Frontend — Админка:**

- `pages/admin/promos.tsx`:
  - Таблица: код, скидка, usage (used/max), perUser limit, validUntil, active.
  - Inline-форма создания (toggle Plus): код, тип (percent/fixedRub), значение,
    лимиты, дата истечения.
  - Деактивация через DELETE с confirm.
- AdminLayout — добавлен nav-item «Промокоды» (Tag icon).
- Router — маршрут `/admin/promos`.

**i18n:** `purchase.promo.*` (label, placeholder, applied, errors с reason-keys),
`admin.nav.promos`, `admin.promos.*` (fields, kinds, cols, actions, toast),
ru+en.

**Smoke (end-to-end):**

- Создан промо `WELCOME20` (−20%, maxUses=100, perUserLimit=1).
- Валидация lowercase `welcome20` → `{ ok, discountRub: 30, finalAmountRub: 120 }`
  на тарифе 150₽.
- Невалидный код → `400 { promoError: 'not_found' }`.
- Создание платежа с `promoCode` → `Payment.amountRub=120, discountRub=30`,
  meta содержит `promoId + promoCode + originalAmountRub`.
- `dev/simulate-succeeded` → `PromoRedemption(discountRub=30)` создалась,
  `PromoCode.usedCount=1` атомарно в той же транзакции.
- Повторная попытка тем же юзером → `400 { promoError: 'per_user_limit_reached' }`.
- Admin redemptions list → видит редемпцию.
- Admin deactivate → `isActive=false`.

## ✅ Этап 12b — Product polish (3 тарифа · News · Platform-first · Admin plans)

**Pricing:**

- Три тарифа вместо четырёх временных периодов: **Free** (0 ₽ / 2 GB / 30 дн),
  **Medium** (100 ₽ / 50 GB / 30 дн), **High** (450 ₽ / unlimited / 30 дн).
  `prisma/seed.ts` идемпотентно обновляет три актуальных + деактивирует все
  остальные (`isActive=false`, FK сохраняется на исторических Subscription'ах).
- `CreatePlanDto.priceRub` теперь `>= 0` (чтобы Free можно было создать через
  admin UI). YooKassa дальше не вызывается для Free — отдельный путь.

**Free-tier flow:**

- `POST /api/subscriptions/activate-free` под `JwtAccessGuard` + throttle 3/60s.
  Валидация: `plan.priceRub === 0`, `plan.isActive`, у юзера НЕТ активной
  подписки (любого плана — Free не служит «продлить халявно»).
- В `SubscriptionsService.activateFreeForUser`: Subscription + `XrayService.materializeForSubscription`
  в одной Postgres-транзакции. Audit `subscription.activate-free`.
- `PurchaseDialog` определяет `isFree = plan.priceRub === 0` и:
  - Скрывает поле промокода (Free не комбинируется со скидками).
  - Меняет CTA `Оплатить` → `Активировать`.
  - При сабмите идёт в `/subscriptions/activate-free`, не в `/payments/create`.
  - Toast `purchase.toast.freeActivated`.

**News:**

- `NewsPost(id, slug @unique, title, summary, contentMd, publishedAt, ...)`
  - миграция `add_news`. Public list возвращает только `publishedAt != null`,
    сорт по дате убыв.
- `NewsModule` — public `GET /api/news`, `GET /api/news/:slug`.
- `AdminNewsController` — full CRUD под `JwtAccessGuard + RolesGuard + Roles('admin')`,
  kebab-case slug-валидация. Audit на каждое write-действие.
- Frontend: `/news` (cards-лента), `/news/:slug` (markdown через общий `<Markdown />`).
- **Авторизованных редиректим с `/` на `/news`** — `HomePage` смотрит
  `useAuthStore().status === 'auth'` → `<Navigate to="/news" replace />`.
- Admin: `/admin/news` со списком + inline-формой создания/редактирования
  (markdown в textarea; полноценный WYSIWYG-редактор — позже, если понадобится).

**Platform-first онбординг:**

- Новый компонент `PlatformPicker` на главной (после Hero, перед Benefits):
  3 крупные карточки Windows / Android / iOS. Каждая ведёт в
  `/auth/register?platform=<key>&guide=<slug>`.
- Маппинг: Windows → `v2raytun`, Android → `nekobox`, iOS → `hiddify`.
- `RegisterPage` пробрасывает `?guide=...` в `/auth/login`.
- `LoginPage` редирект-приоритеты: `?return` → `?guide` (→ `/guides/<slug>`)
  → `/news`.

**Per-guide footer:**

- В конце каждого `/guides/:slug` две карточки-CTA:
  - **«Не помогло? Другое приложение»** → ведёт на `/guides` со списком.
  - **«Связаться с поддержкой»** → внешняя ссылка на `brand.telegramUrl` из
    `/api/config/public`.

**Admin /admin/plans:**

- Полноценный CRUD UI на существующих эндпоинтах `/api/admin/plans`.
  Inline-форма создания + edit-диалог. Soft-delete (`isActive=false`).
- AdminLayout: добавлены пункты `Тарифы` (Layers icon) и `Новости` (Newspaper icon).

**Cleanup (убрал dev/lawyer фразы):**

- Удалена плашка `legal.disclaimer` («документ — рабочий шаблон, проверяется
  у юриста») со страниц `/legal/*` и сам i18n-ключ.
- Удалены строки `**⚠️ Документ является шаблоном**` из `seed-legal.ts`
  (privacy/offer/cookie).
- `CaptchaField` в dev больше не рендерит плашку «CAPTCHA: dev noop · DEV
  mode...» — возвращает `null` и тихо эмитит токен для NoopProvider. Ключ
  `forms.captcha.devNote` удалён.
- Удалены устаревшие `stubNote` placeholders и `editorNote` плашки в админке
  (фичи реализованы — placeholder'ы нерелевантны).

**i18n:** новые ru/en ключи — `pages.home.platform.*`, `pages.home.pricingPreview.{freeNote,activate}`,
`pages.guides.{didntHelp,support}`, `pages.news.*`, `purchase.actions.activate`,
`purchase.toast.freeActivated`, `admin.nav.{plans,news}`, `admin.plans.*`,
`admin.news.*`.

**Smoke (verified):**

- `GET /api/plans` → 3 тарифа (Free/Medium/High) с корректными `priceRub`/`trafficLimitGb`.
- `GET /api/news` → `[]` (постов ещё нет).
- `POST /api/admin/news` и `POST /api/subscriptions/activate-free` без auth → `401`.
- Web build clean.
- Seed pre-existing 4 тарифа деактивировал (`deactivated 4 obsolete plan(s)`).

## 🟡 Этап 13a — Self-update из админки

**Backend:**

- `DeployService` (`apps/api/src/deploy/`):
  - `getStatus()` — git rev-parse HEAD + branch + commit date + describe-tag,
    `git config remote.origin.url`. Параллельно ходит в `fetchRemoteTags()`.
  - `fetchRemoteTags()` — `git ls-remote --tags --refs origin`, парсит
    semver-теги, сортирует по версии, возвращает `{ latestTag, latestSha, tags[] }`.
  - `triggerDeploy({ ref })` — валидирует ref regex'ом `^(?:main|v?\d+\.\d+\.\d+(?:-.*)?)$`,
    проверяет `DEPLOY_ENABLED`, отсутствие параллельного запуска, наличие
    `DEPLOY_SCRIPT` на диске. Затем `spawn(scriptPath, [ref], { detached, stdio: out.fd })`.
    Стрим stdout/stderr идёт в `${DEPLOY_LOG_DIR}/deploy-<runId>.log`, плюс
    `current.log` (symlink на Linux, обычный файл с путём на Windows).
  - `tailLog(N)` — читает последние N строк из current.log, возвращает
    `{ running, exitCode, lines[] }`.
- `AdminDeployController` (`apps/api/src/admin/admin-deploy.controller.ts`):
  - `GET /api/admin/deploy/status` — текущее состояние.
  - `POST /api/admin/deploy/refresh` — форс-проверка тегов на origin.
  - `POST /api/admin/deploy/run { ref, totpCode }` — **требует TOTP-код**.
    Без 2FA → 403 `{ requires2faSetup: true }`. Неверный код → 400 `{ totpInvalid: true }`.
  - `GET /api/admin/deploy/log?lines=N` — последние N строк.
  - Все под `JwtAccessGuard + RolesGuard + Roles('admin')`.
- ENV: `DEPLOY_ENABLED` (default false), `DEPLOY_SCRIPT` (default
  `/opt/proxels/infra/deploy/deploy.sh`), `DEPLOY_LOG_DIR` (default
  `/var/log/proxels-deploy`), `DEPLOY_REPO_DIR` (autodetect от cwd).

**Infra:**

- `infra/deploy/deploy.sh` — основной скрипт self-update. Принимает 1 аргумент
  (ref), делает `git fetch && checkout && pnpm install && prisma migrate && build
&& rsync && sudo systemctl restart proxels-api && sudo nginx -s reload`.
  `set -euo pipefail` + trap на ERR с логированием строки фейла.
- `infra/deploy/proxels-api.service` — systemd unit для API. Запускает
  `node dist/main.js` от user=proxels, hardening через NoNewPrivileges,
  ProtectSystem=full, узкий ReadWritePaths.
- `infra/deploy/proxels.sudoers` — `proxels ALL=(root) NOPASSWD: /bin/systemctl
restart proxels-api` + `nginx reload`. **Ни одного `ALL`-правила** — только
  два конкретных сервиса.
- `infra/deploy/README.md` — cheat-sheet по установке.

**Frontend:**

- `/admin/deploy` (`apps/web/src/pages/admin/deploy.tsx`):
  - Карточка «Сейчас установлено»: tag/sha + branch + date + origin URL.
  - Карточка «Последний релиз на git»: latestTag + sha. Если `hasUpdate` —
    плашка «Доступна v1.2.3» + кнопка «Обновить».
  - Список последних 12 тегов — клик → диалог выбора того, что деплоим.
  - Диалог подтверждения: показывает ref, поле для 6-значного TOTP-кода,
    кнопка Run. На submit → POST `/api/admin/deploy/run`.
  - Live-тейл лога: query с `refetchInterval: 2000` пока tailing=true.
    Авто-скролл вниз, окраска строк (FAILED/ERROR — красный, OK — зелёный).
  - Если `deployEnabled === false` — кнопки задисейблены, плашка про
    «доступно только на проде».
- AdminLayout: nav-item «Деплой» (GitBranch icon).
- Router: маршрут `/admin/deploy`.
- i18n ru+en: `admin.nav.deploy`, `admin.deploy.*` (current, remote, tags, log,
  confirm, toast).

**docs/DEPLOY.md** переписан с полным flow первичной установки + раздел про
self-update (что происходит при клике, безопасность, релизный цикл).

**Smoke:**

- Все 4 деплой-эндпоинта без auth → 401.
- API bootstrap: AdminDeployController зарегистрирован, 4 маршрута мапнуты.
- Web build clean.
- Локально (Windows, DEPLOY_ENABLED=false): UI показывает текущий статус,
  кнопка «Обновить» disabled с подсказкой про прод-only.

**TODO для боевого запуска (Этап 13b):**

- Dockerfile'ы для api/web (multi-stage).
- nginx config + certbot автоматизация.
- fail2ban правила.
- pg_dump backup script + ротация.
- Chunk-split фронта (rollupOptions.manualChunks) — bundle сейчас 1.4 MB.
- SSR/pre-render публичных страниц для Яндекса.
- Yandex.Webmaster + Search Console verification.

## 🔜 Этап 13 — Деплой

- Dockerfile'ы для api и web (multi-stage builds).
- Финальный `docker-compose.yml` (api + web-nginx + postgres + redis).
- nginx: HSTS, CSP (whitelist для шрифтов, YooKassa, метрики, капчи),
  `limit_req_zone`, gzip/brotli, кэширующие заголовки на статику,
  `try_files` для SPA, `trust proxy` для Express.
- certbot Let's Encrypt автоматизированный.
- fail2ban на сервере (см. docs/DEPLOY.md).
- Postgres backup script + retention.
- Chunk-splitting фронта (rollupOptions.output.manualChunks) — сейчас 1MB монолит.
- SSR/pre-render публичных страниц (для Яндекса) — `vite-plugin-ssg` или `react-snap`.
- PNG-экспорт OG-image.
- Yandex.Webmaster + Search Console verification (мета-теги из ENV).
