-- Опциональный VLESS-over-WebSocket транспорт через Cloudflare.
-- Все три поля nullable: нода без CDN-канала работает по-прежнему (только Reality).
ALTER TABLE "Node" ADD COLUMN "cdnHost" TEXT;
ALTER TABLE "Node" ADD COLUMN "cdnPath" TEXT;
ALTER TABLE "Node" ADD COLUMN "wsInboundTag" TEXT;
