import { z } from 'zod';

// Полный список переменных описан в .env.example.
// Здесь — runtime-валидация. Сервис не стартует, если что-то обязательное
// не задано или имеет неверный формат. См. CLAUDE.md §4b.

const portSchema = z.coerce.number().int().positive().max(65_535);

const csv = z
  .string()
  .optional()
  .transform((value) =>
    value
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );

export const envSchema = z.object({
  // окружение
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_URL: z.string().url(),
  API_URL: z.string().url(),
  API_PORT: portSchema.default(3000),
  WEB_PORT: portSchema.default(5173),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  DEFAULT_LOCALE: z.enum(['ru', 'en']).default('ru'),

  // postgres
  DATABASE_URL: z.string().url(),

  // redis
  REDIS_URL: z.string().url(),

  // jwt / auth (понадобится с Этапа 3; обязательны уже сейчас, чтобы случайно не выйти в прод без них)
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be >= 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be >= 32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z
    .union([z.boolean(), z.string()])
    .default(false)
    .transform((v) => (typeof v === 'string' ? v.toLowerCase() === 'true' : v)),

  // smtp (опционально на Этапе 2; станет обязательным на Этапе 3 — оставляем optional пока)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: portSchema.optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  // юkassa: при пустом YOOKASSA_SHOP_ID — dev-bypass (не вызывает API, создаёт
  // локальный платёж и фейковый confirmation_url для отладки). В production пустые
  // shopId/secretKey приведут к ошибке при попытке создать платёж.
  YOOKASSA_SHOP_ID: z.string().optional(),
  YOOKASSA_SECRET_KEY: z.string().optional(),
  YOOKASSA_WEBHOOK_SECRET: z.string().optional(),
  YOOKASSA_RETURN_URL: z.string().url().optional(),
  // Параметры фискального чека (54-ФЗ). Дефолты — для ИП на УСН/НПД.
  // 1=без НДС, 2=0%, 3=10%, 4=20%, 5=10/110, 6=20/120.
  YOOKASSA_VAT_CODE: z.coerce.number().int().min(1).max(6).default(1),
  // full_prepayment | partial_prepayment | advance | full_payment | partial_payment | credit | credit_payment
  YOOKASSA_PAYMENT_MODE: z.string().default('full_prepayment'),
  // commodity | service | work | payment | composite | another | ...
  YOOKASSA_PAYMENT_SUBJECT: z.string().default('service'),
  // CSV-список IP/CIDR, дополнительно разрешённых для webhook поверх захардкоженного
  // официального списка YooKassa (см. yookassa-ip.guard.ts).
  YOOKASSA_EXTRA_WEBHOOK_IPS: csv,

  // captcha
  CAPTCHA_PROVIDER: z.enum(['yandex', 'hcaptcha', 'none']).default('none'),
  CAPTCHA_SITE_KEY: z.string().optional(),
  CAPTCHA_SERVER_KEY: z.string().optional(),

  // реквизиты владельца (§11a)
  OWNER_FIO: z.string().default('Коробейников Сергей Сергеевич'),
  OWNER_OGRNIP: z.string().default('324253600103000'),
  OWNER_INN: z.string().default('250501904935'),
  OWNER_ADDRESS: z.string().default('Приморский край, г. Дальнегорск, с. Краснореченский'),
  CONTACT_EMAIL: z.string().email().default('noreply@proxels.ru'),
  CONTACT_TELEGRAM: z.string().url().default('https://t.me/proxels'),

  // админка
  ADMIN_IP_ALLOWLIST: csv,

  // seo / analytics (необязательно)
  YANDEX_METRIKA_ID: z.string().optional(),
  YANDEX_WEBMASTER_VERIFICATION: z.string().optional(),
  GOOGLE_SEARCH_CONSOLE_VERIFICATION: z.string().optional(),

  // xray
  XRAY_NODE_API_TOKEN: z.string().min(16, 'XRAY_NODE_API_TOKEN must be >= 16 chars'),
  /** Реализация клиента к нодам Xray. В dev — noop (ничего не делает). */
  XRAY_CLIENT: z.enum(['noop', 'grpc']).default('noop'),

  // --- Health-check нод (Этап 11) ------------------------------------------
  /** Период TCP-проб каждой ноды в секундах (Repeatable job BullMQ). */
  HEALTH_CHECK_INTERVAL_SECONDS: z.coerce.number().int().min(5).max(600).default(30),
  /** Таймаут одной TCP-пробы в миллисекундах. */
  HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(3_000),
  /** Сколько успешных подряд проб должно быть для перехода offline → online (анти-флаппинг). */
  HEALTH_FLAP_UP_THRESHOLD: z.coerce.number().int().min(1).max(20).default(2),
  /** Сколько неудачных подряд для перехода online → offline. */
  HEALTH_FLAP_DOWN_THRESHOLD: z.coerce.number().int().min(1).max(20).default(3),

  // --- Деплой через админку (Этап 13) ---------------------------------------
  /**
   * true — кнопка «Обновить» в `/admin/deploy` активна. Включается ТОЛЬКО на
   * прод-сервере, где есть `DEPLOY_SCRIPT` и sudoers-правило на systemctl
   * restart. В dev — false, status-эндпоинты работают (для проверки UI),
   * `run` отвечает 403.
   */
  DEPLOY_ENABLED: z
    .union([z.boolean(), z.string()])
    .default(false)
    .transform((v) => (typeof v === 'string' ? v.toLowerCase() === 'true' : v)),
  /** Абсолютный путь до deploy-скрипта на сервере. */
  DEPLOY_SCRIPT: z.string().default('/opt/proxels/infra/deploy/deploy.sh'),
  /** Куда писать логи деплоя (по одному файлу на запуск + symlink current.log). */
  DEPLOY_LOG_DIR: z.string().default('/var/log/proxels-deploy'),
  /**
   * Корень git-репозитория на сервере. По умолчанию — родительская папка от
   * `apps/api` (то есть «снизу вверх» от cwd процесса).
   */
  DEPLOY_REPO_DIR: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${formatted}`);
  }
  return parsed.data;
}
