# @proxels/api

Backend на NestJS. Будет реализован на Этапе 2 (см. [../../prompts/CLAUDE.md](../../prompts/CLAUDE.md) §12).

Ответственность:

- Auth (регистрация/логин/refresh/сброс пароля, согласие на ПДн с версией).
- Биллинг и интеграция с ЮKassa (вебхуки, чеки 54-ФЗ).
- Subscription endpoint `/api/sub/:subToken` (раздаёт base64-список VLESS/VMess URI).
- Xray-orchestration (gRPC `HandlerService.AddUser/RemoveUser`).
- Health-check нод, failover (BullMQ + Redis).
- Админка (роль admin + 2FA TOTP + IP-allowlist).

Особо важно (см. §4a, §4b CLAUDE.md):

- **No-logs**: не логировать URL/домены/IP-назначения трафика клиентов нигде.
- **Анти-бот**: rate-limit + CAPTCHA + honeypot на auth-эндпоинтах.
- **Webhooks ЮKassa**: проверка подписи + IP-whitelist.
