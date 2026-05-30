# Proxels

VPN-сервис на базе собственной инфраструктуры Xray (VLESS / Reality). Лендинг, личный
кабинет, оплата ЮKassa, автоматическая выдача подписок.

- **Домен:** proxels.ru
- **Telegram:** https://t.me/proxels — единственный официальный канал.
- **Репозиторий:** https://github.com/severonick-dev/proxels
- **Юр. лицо:** ИП Коробейников Сергей Сергеевич (ОГРНИП 324253600103000)

> Полная спецификация и порядок работы — в [prompts/CLAUDE.md](prompts/CLAUDE.md).
> Это контекст-файл для Claude Code: читать целиком перед началом работы.

---

## Принципы (главное)

1. **Приватность пользователей превыше всего.** Сервис не ведёт журналов посещаемых
   ресурсов. Трафик клиентов шифруется через VLESS/Reality (TLS 1.3, X25519). Админ
   физически не имеет возможности увидеть, какие сайты посещает клиент — только
   агрегированный трафик в байтах и финансы. См. [docs/PRIVACY-ARCHITECTURE.md](docs/PRIVACY-ARCHITECTURE.md).
2. **Безопасность с первого коммита.** CAPTCHA, rate-limit, honeypot на формах,
   2FA в админке, проверка подписи вебхуков, аудит-лог. См. [docs/SECURITY.md](docs/SECURITY.md).
3. **Соответствие законодательству РФ.** 152-ФЗ (согласие на ПДн, право на забвение,
   хранение в РФ), публичная оферта, 54-ФЗ (фискальные чеки через ЮKassa), cookie-согласие.
   См. [docs/LEGAL.md](docs/LEGAL.md).
4. **SEO-оптимизированный лендинг.** SSR/pre-render публичных страниц, мета-теги,
   JSON-LD, sitemap, Lighthouse >= 90. См. [docs/SEO.md](docs/SEO.md) (создаётся на Этапе 7).

---

## Стек

- **Frontend:** React 18 + TypeScript + Vite, TailwindCSS, shadcn/ui, Zustand/TanStack Query,
  i18next (ru/en), Framer Motion, lucide-react.
- **Backend:** Node.js (LTS) + TypeScript, NestJS, Prisma + PostgreSQL, Redis, BullMQ,
  pino, JWT (httpOnly cookie для refresh), argon2id, helmet, class-validator,
  `@nestjs/throttler`.
- **Инфраструктура:** Docker + docker-compose, nginx (HSTS, CSP, rate-limit, gzip/brotli),
  certbot/Let's Encrypt.
- **Платежи:** ЮKassa (REST + вебхуки + 54-ФЗ чеки).

---

## Структура монорепо

```
proxels/
├── apps/
│   ├── web/            # React + Vite фронтенд
│   └── api/            # NestJS бэкенд
├── packages/
│   └── shared/         # Общие типы, DTO, enums, константы
├── infra/
│   ├── nginx/          # reverse-proxy конфиги (этап 13)
│   ├── xray/           # шаблоны конфигов Xray для нод (этап 10)
│   └── docker/         # Dockerfile'ы и docker-compose (этап 13)
├── docs/               # SECURITY, DEPLOY, LEGAL, SEO, PRIVACY-ARCHITECTURE
├── prompts/
│   └── CLAUDE.md       # Полное ТЗ для Claude Code (читать целиком)
├── .github/workflows/  # CI (lint + typecheck + build)
├── .env.example        # Шаблон переменных окружения
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## Локальная разработка (Windows / Linux / macOS)

Требования:

- Node.js 20+ (`.nvmrc` — `20`).
- pnpm 9+ (`corepack enable` или `npm i -g pnpm`).
- Docker + Docker Compose (для Postgres/Redis — поднимаются на Этапе 2).
- Git.

```bash
# Установка зависимостей
pnpm install

# Скопировать переменные окружения
cp .env.example .env
# (Windows PowerShell: Copy-Item .env.example .env)

# Линт и формат (работает уже на Этапе 1)
pnpm format:check
pnpm lint

# Разработка (на следующих этапах)
pnpm dev:api       # запуск backend (этап 2+)
pnpm dev:web       # запуск frontend (этап 6+)
pnpm dev           # параллельно api+web
```

---

## Деплой

Разработка ведётся локально, затем переносится на VPS (Ubuntu). Подробности — в
[docs/DEPLOY.md](docs/DEPLOY.md) (наполняется по мере готовности инфраструктуры,
финально на Этапе 13).

Базовая идея: `git clone` → заполнить `.env` → `docker compose up -d --build` →
выпустить TLS-сертификат через certbot.

---

## Лицензия

Внутренний проект. UNLICENSED.
