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

## 🔜 Этап 9 — Юр.страницы + cookie-banner

- `LegalDocService`: load by slug+version, public read.
- Реальные тексты privacy/offer/cookies — заглушки в БД с пометкой «проверить у юриста».
- Cookie-баннер (только необходимые / все), хранение выбора в localStorage.
- Yandex.Metrika — подключается ТОЛЬКО после согласия на cookie.
- Реквизиты ИП в футере подтягиваются из ENV (`OWNER_*`), не из i18n.
- Markdown-рендер юр.документов через DOMPurify.

## 🔜 Этап 10 — Своя система выдачи subscription-ссылок

- `GET /api/sub/:subToken` — отдаёт base64-список VLESS URI всех живых нод.
- `XrayNodeClient` (gRPC HandlerService.AddUser/RemoveUser) — добавление
  клиентов на ноды при выпуске подписки.
- Подключение нод через админку (`Node` модель уже есть).
- `docs/PRIVACY-ARCHITECTURE.md` — описать как именно обеспечен no-logs.

## 🔜 Этап 11 — Health-check + failover

- BullMQ repeatable job: TCP-probe каждой ноды каждые N секунд.
- Обновление `Node.status` (online/offline/degraded) с анти-флаппингом.
- Redis-кэш статуса для быстрого `/api/sub/:token`.
- Endpoint `/api/health/nodes` для админки.

## 🔜 Этап 12 — Гайды + АДМИНКА

**Гайды** (см. §9 спека):

- `/guides` + детальные страницы Nekobox/Hiddify/V2RayTun.
- Контент markdown в БД, редактируется из админки.

**Админка** (см. §10 спека + дополнения из этого этапа):

UI и эндпоинты для:

- **Пользователи**:
  - Список (email, role, emailVerified, createdAt, кол-во подписок, итого ₽).
  - Поиск, фильтр по статусу.
  - Просмотр конкретного — все его подписки, все платежи, AuditLog действий.
  - Force-actions: revoke all sessions, force-verify email, force-delete (с подтверждением).

- **Подписки**:
  - Список с фильтрами (status, plan, истекает скоро).
  - Просмотр конкретной — XrayClient'ы на нодах.
  - Force-actions: cancel, extend на N дней (по жалобе/гудвилл).

- **Платежи**:
  - Список с фильтрами (status, amount range, date range).
  - Просмотр — связанный subscription, raw YooKassa metadata (только для admin!).
  - Refund (через YooKassa API) — если технически возможно.

- **Тарифы** (Plan):
  - Уже есть CRUD в `/api/admin/plans` (Этап 4). UI добавить.

- **Промокоды** (Promo) — НОВОЕ, см. ниже:
  - CRUD.
  - Применение к цене при создании платежа.

- **Ноды** (Xray VPS):
  - Список с last health-check + текущим статусом.
  - Add/update/disable.
  - Reload config / re-sync clients.

- **Юр. документы** (LegalDoc):
  - Список с slug+version, текущая опубликованная отмечается.
  - Markdown-редактор. Bump version + publish.

- **AuditLog**:
  - Просмотр всех действий с фильтрами (actor, action, date range).
  - Экспорт CSV.

**Безопасность админки (§4b, обязательно):**

- Все эндпоинты `/api/admin/*` под `JwtAccessGuard + RolesGuard + @Roles('admin')`.
- 2FA TOTP обязательна для admin при логине.
- `ADMIN_IP_ALLOWLIST` middleware (опц.).
- AuditLog на КАЖДОЕ admin-действие.
- Frontend `/admin/*` под `<ProtectedRoute requireRole="admin">`.

## 🔜 Этап 12a — Промокоды (новое требование владельца)

Добавить в `prisma/schema.prisma`:

```
model PromoCode {
  id            String   @id @default(cuid())
  code          String   @unique          // "WELCOME20"
  discountKind  PromoKind                  // percent | fixedRub
  discountValue Int                        // 20 (percent) или 500 (рубли)
  validFrom     DateTime?
  validUntil    DateTime?
  maxUses       Int?                       // null = безлимит
  usedCount     Int      @default(0)
  perUserLimit  Int      @default(1)
  appliesToPlanIds String[] @default([])   // [] = ко всем тарифам
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  redemptions   PromoRedemption[]
}

enum PromoKind { percent fixedRub }

model PromoRedemption {
  id          String @id @default(cuid())
  promoCodeId String
  userId      String
  paymentId   String  @unique
  discountRub Int                          // сколько фактически скинули
  createdAt   DateTime @default(now())
  promoCode   PromoCode @relation(fields: [promoCodeId], references: [id])
  user        User      @relation(fields: [userId], references: [id])
  payment     Payment   @relation(fields: [paymentId], references: [id])
  @@index([promoCodeId])
  @@index([userId])
}
```

**API:**

- `POST /api/promos/validate` (auth) — проверить промо для (userId, planId), вернуть скидку или ошибку.
- `POST /api/payments/create` — расширить DTO полем `promoCode?`, применить скидку,
  записать PromoRedemption атомарно в той же транзакции, что и Payment.
- `GET/POST/PATCH/DELETE /api/admin/promos` (admin only) — CRUD + список редемций.

**Frontend:**

- Поле «промокод» на странице оплаты тарифа (Phase 8.5 или вместе с админкой).
- Live-валидация: typing → debounce → POST /validate → показать «-20% = 30 ₽».
- Админ-страница `/admin/promos` со списком, формой создания, статистикой.

**Audit:** `promo.create`, `promo.update`, `promo.deactivate`, `promo.redeem`.

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
