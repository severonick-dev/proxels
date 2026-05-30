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

- [ ] Webhook проверяет подпись (если YooKassa её даёт) **и** IP-источник (whitelist).
- [ ] Идемпотентность вебхука: повторный вызов с тем же `yookassaId` не дублирует подписку.
- [ ] Чек 54-ФЗ формируется корректно (позиция, цена, НДС, email).

## Этап 6/7 — Frontend

- [ ] CSP-заголовки на nginx: `default-src 'self'`, явный whitelist для метрики/капчи.
- [ ] Все формы используют CAPTCHA-токен, валидируемый на сервере.
- [ ] User-content (если будет) — через DOMPurify; React не используется для опасных HTML.

## Этап 10 — Xray nodes (КРИТИЧНО для no-logs)

- [ ] В конфиге Xray на ноде: `"log": { "loglevel": "warning", "access": "none", "error": "none" }`
      (или `/dev/null`). Нет файла `access.log`.
- [ ] На ноде нет mitmproxy, dnsmasq с логированием, tcpdump в systemd, и т.п.
- [ ] DNS-резолвер ноды — без логов (DoH/DoT через upstream без логирования).
- [ ] Backend использует Xray API только для: AddUser, RemoveUser, GetStats (uplink/downlink
      per UUID). Никаких выборок per-destination.
- [ ] Канал backend↔node защищён (mTLS или shared secret через приватную сеть).
- [ ] Создан `docs/PRIVACY-ARCHITECTURE.md` с описанием, как именно обеспечен no-logs.

## Этап 12 — Админка

- [ ] Роль `admin` — отдельный логин с обязательной 2FA (TOTP).
- [ ] `ADMIN_IP_ALLOWLIST` поддерживается middleware'ом.
- [ ] Все админские действия логируются в `AuditLog` (actor, action, meta, IP, timestamp).
- [ ] В админке нет ни одного эндпоинта, возвращающего историю URL/доменов клиента.

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
