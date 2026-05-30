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

- [ ] Helmet включён глобально.
- [ ] CORS — только `proxels.ru` (в dev — настраиваемый whitelist через ENV).
- [ ] `class-validator` для всех DTO; `whitelist: true`, `forbidNonWhitelisted: true`.
- [ ] Глобальный `@nestjs/throttler` с Redis-store.
- [ ] Все ENV — валидируются на старте (Joi/Zod) — сервис не стартует без обязательных.
- [ ] `prisma.$queryRawUnsafe` запрещён код-ревью и линтером.

## Этап 3 — Auth

- [ ] Пароли — argon2id (память >= 64 MB, итерации по рекомендациям OWASP).
- [ ] CAPTCHA (Yandex SmartCaptcha) на `register`, `login`, `forgot-password`.
- [ ] Honeypot-поля в формах регистрации.
- [ ] Подтверждение email обязательно перед оплатой и выдачей подписки.
- [ ] Согласие на ПДн (152-ФЗ): хранится `consentPdnAt` + `consentPdnVersion`.
- [ ] Rate-limit на auth: IP + email, экспоненциальный backoff.
- [ ] Refresh-токен — только в httpOnly + secure (prod) + sameSite cookie.
- [ ] Access-токен — короткий TTL (15 мин), refresh — rotation + reuse-detection.
- [ ] Сброс пароля — одноразовая ссылка с TTL <= 1 час, инвалидируется после использования.

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
