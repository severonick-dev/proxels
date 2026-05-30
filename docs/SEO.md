# SEO — Proxels

Полные требования — в [`../prompts/CLAUDE.md`](../prompts/CLAUDE.md) §4c. Этот
документ — живой чек-лист и инструкция по поддержке SEO-инвентаря.

---

## Что сейчас есть (Этап 7)

### Технический SEO

- ✅ `react-helmet-async` — per-page управление `<title>`, `<meta>`, `<link rel="canonical">`,
  Open Graph, Twitter Cards, `<html lang>`.
- ✅ Универсальный компонент [`<SEO />`](../apps/web/src/components/seo/seo.tsx) —
  единая точка для всех страниц. По умолчанию добавляет суффикс «— Proxels»
  к title; для лендинга используется как есть, для дочерних страниц — с суффиксом.
- ✅ `hreflang` для ru/en (на этом этапе оба указывают на тот же canonical, потому
  что переключатель языка работает в пределах одного URL; когда добавим `/en/...`
  префиксы — обновить SEO-компонент и sitemap).
- ✅ `robots.txt` ([`apps/web/public/robots.txt`](../apps/web/public/robots.txt))
  — разрешает индексацию `/`, `/pricing`, `/guides`, `/legal/*`; запрещает
  `/api/`, `/admin`, `/lk`, `/auth/verify-email`, `/auth/reset-password`, `/dev/`.
- ✅ `sitemap.xml` ([`apps/web/public/sitemap.xml`](../apps/web/public/sitemap.xml))
  — статический, 6 публичных URL. Обновлять руками при добавлении новых
  публичных маршрутов (или прикрутить генерацию при сборке на следующем этапе).
- ✅ `og-image.svg` ([`apps/web/public/og-image.svg`](../apps/web/public/og-image.svg))
  — 1200×630 брендовый OG. **TODO:** соцсети любят PNG/JPG лучше — экспортнуть
  PNG-вариант в Inkscape/Figma и поменять путь в `<SEO>`.
- ✅ Метатег `description` на каждой публичной странице.
- ✅ `noindex, nofollow` на закрытых маршрутах: `/lk`, `/admin`, `/auth/login`,
  `/auth/register`, `/auth/verify-email`, `/auth/reset-password`, `404`.

### JSON-LD (structured data)

- ✅ **Organization** — в `PublicLayout`, на всех страницах
  ([`organizationJsonLd`](../apps/web/src/components/seo/seo.tsx#L70)).
  Содержит `name`, `url`, `logo`, `sameAs: [t.me/proxels]`, `contactPoint`.
- ✅ **FAQPage** — на лендинге `/` ([`home.tsx`](../apps/web/src/pages/home.tsx)),
  собирается из i18n-ключей `pages.home.faq.items.*` (6 Q&A). Версия для ru/en
  переключается вместе с языком.
- ✅ **Product** — на `/pricing` ([`pricing.tsx`](../apps/web/src/pages/pricing.tsx)),
  с массивом `offers` по числу активных тарифов из API. Цены в RUB, длительность
  в днях.
- ✅ **BreadcrumbList** — на `/guides`. Расширить по мере появления реальных гайдов
  на Этапе 12.

### Контентный SEO

- ✅ H1 — один на страницу, дальше — H2 (eyebrow/section-heading) и H3 (карточки).
- ✅ Семантическая разметка: `<header>` / `<main>` / `<section>` / `<nav>` /
  `<footer>` / `<article>` / `<ol>` для шагов «Как это работает».
- ✅ `alt` на иконки — `aria-hidden` где декорация (lucide-иконки в карточках).
- ✅ Шрифты подключены preconnect'ом к Google Fonts (Inter + Space Grotesk).
- ✅ В тёмной теме — анимированные «облака» в hero на Framer Motion (декорация,
  `aria-hidden`, не блокирует LCP).

---

## Что ещё надо сделать (TODO)

### Контент

- [ ] **OG-image в PNG** (1200×630). SVG поддерживается не всеми соцсетями
      стабильно. Экспортнуть из `og-image.svg`, положить как `og-image.png`,
      обновить дефолт в `<SEO>`.
- [ ] **Apple touch icon** (180×180, PNG) + 192/512 PWA-иконки в манифесте.
- [ ] **Реальный текстовый контент** для гайдов на Этапе 12 и для юр.документов
      на Этапе 9. Каждый гайд = отдельный URL, каждый — BreadcrumbList + HowTo JSON-LD.
- [ ] **Доменные ключи** в тексте лендинга: «купить VPN в России», «VPN ЮKassa»,
      «VLESS Reality VPN», «VPN без логов». Сейчас текст — описательный,
      без переспама. Можно добавить тонко в подзаголовки и FAQ.

### Технический

- [ ] **SSR / pre-render** публичных страниц для гарантированной индексации
      поисковиками (Google рендерит JS, но Yandex — не всегда). Варианты:
      `vite-plugin-ssg`, `react-snap` на этапе билда, или миграция на Next.js
      (если решит). Рекомендуется минимально: pre-render `/`, `/pricing`, `/guides`,
      `/legal/*` через `vite-plugin-pages-sitemap` или ручной скрипт после `vite build`.
- [ ] **Динамический sitemap**: вместо статического файла генерировать при
      сборке (учитывая список гайдов из БД на Этапе 12).
- [ ] **404-страница возвращает HTTP 404**, а не 200 (нужно настроить на
      Этапе 13 в nginx — статичный SPA отдаёт `index.html` со статусом 200
      для несуществующих URL; добавить `try_files` логику или сделать SSR).
- [ ] **Yandex.Webmaster + Google Search Console** — после деплоя:
  - добавить `YANDEX_WEBMASTER_VERIFICATION` в `.env` (уже есть);
  - вшить `<meta name="yandex-verification" content="..." />` через тот же
    `<SEO>` (или отдельный `<Verification />` компонент);
  - то же для `GOOGLE_SEARCH_CONSOLE_VERIFICATION`.
- [ ] **Sitemap-ping** при обновлении контента — на Этапе 12.
- [ ] **Структурированные данные для отзывов** — когда появятся отзывы (Review,
      AggregateRating).
- [ ] **Lighthouse ≥ 90** на лендинге (Performance / Accessibility / Best
      Practices / SEO). После Этапа 13 (nginx + кэширующие заголовки + brotli)
      будет проще выйти на эти показатели.

### Аналитика и сторонние сервисы

- [ ] **Yandex.Metrika** — добавить тег в шапку, инициализировать ТОЛЬКО
      после согласия на cookie (Этап 9). ID берётся из
      `VITE_YANDEX_METRIKA_ID` (env уже зарезервирован).
- [ ] **Search Console** / **Webmaster** верификация после деплоя.
- [ ] **GTM** не используем — лишний слой и трекинг.

---

## Памятка владельцу (что сделать руками после деплоя)

1. Подтвердить владение доменом в Яндекс.Вебмастере и Google Search Console.
2. Загрузить sitemap.xml в обоих сервисах.
3. Заполнить раздел «Сведения о юр.лице» в Webmaster (уже подтянется из
   `<Organization>` JSON-LD, но дублирование не повредит).
4. Через 1-2 недели проверить, что страницы попали в индекс.
5. Если страницы НЕ индексируются Яндексом — поднимать вопрос SSR/pre-render
   (см. TODO выше).
