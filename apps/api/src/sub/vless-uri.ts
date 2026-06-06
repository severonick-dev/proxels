import type { Node, XrayClient } from '@prisma/client';

/**
 * Сгенерировать VLESS-URI на одну пару (нода, клиент).
 *
 * Если у ноды задана CDN-обёртка (cdnHost + cdnPath + wsInboundTag) — отдадим
 * ДВЕ ссылки: первая Reality (быстрая, прямой коннект на DE), вторая WS через
 * Cloudflare (медленнее, но fallback на случай блокировки IP в DE). Клиенты
 * Hiddify/Nekobox увидят их как два разных «сервера» в подписке и могут
 * переключаться вручную или автоматически по ping.
 *
 * Формат, который понимают Nekobox / Hiddify / V2RayTun / V2rayN:
 *   vless://<uuid>@<host>:<port>?<params>#<remark>
 */
export function buildVlessUris(client: XrayClient & { node: Node }): string[] {
  const uris = [buildRealityUri(client)];
  if (client.node.cdnHost && client.node.cdnPath && client.node.wsInboundTag) {
    uris.push(buildWsCdnUri(client));
  }
  return uris;
}

/**
 * VLESS Reality URI — прямой коннект на DE-ноду по TCP+Reality.
 *
 *   - encryption=none (для VLESS — обязательно)
 *   - type=tcp
 *   - security=reality
 *   - pbk=<reality publicKey>
 *   - sni=<маскируемый домен>
 *   - sid=<reality shortId>
 *   - fp=chrome (TLS fingerprint, дефолт)
 *   - flow=xtls-rprx-vision (рекомендуемый для Reality + TCP)
 */
function buildRealityUri(client: XrayClient & { node: Node }): string {
  const params = new URLSearchParams({
    encryption: 'none',
    type: 'tcp',
    security: 'reality',
    pbk: client.node.publicKey,
    sni: client.node.sni,
    sid: client.node.shortId,
    fp: 'chrome',
    flow: 'xtls-rprx-vision',
  });
  const remark = encodeRfc3986(`Proxels · ${client.node.name}`);
  return `vless://${client.uuid}@${client.node.host}:${client.node.port}?${params.toString()}#${remark}`;
}

/**
 * VLESS WS-over-CF URI — коннект через Cloudflare-фронт.
 *
 *   - encryption=none
 *   - type=ws
 *   - security=tls
 *   - sni=<cdnHost>             — Cloudflare-edge видит этот SNI
 *   - host=<cdnHost>            — WS Host header
 *   - path=<cdnPath>            — WS path (origin Xray слушает этот path)
 *   - fp=chrome
 *
 * Порт всегда 443 (CF принимает только стандартные HTTPS-порты на free-плане).
 * flow в WS-режиме не используется (xtls-rprx-vision требует TCP).
 */
function buildWsCdnUri(client: XrayClient & { node: Node }): string {
  const params = new URLSearchParams({
    encryption: 'none',
    type: 'ws',
    security: 'tls',
    sni: client.node.cdnHost!,
    host: client.node.cdnHost!,
    path: client.node.cdnPath!,
    fp: 'chrome',
  });
  const remark = encodeRfc3986(`Proxels · ${client.node.name} · CDN`);
  return `vless://${client.uuid}@${client.node.cdnHost!}:443?${params.toString()}#${remark}`;
}

/**
 * Старое имя оставлено как алиас на случай внешних импортов. Новый код пишет
 * через `buildVlessUris`, который возвращает массив (учитывает CDN).
 */
export function buildVlessRealityUri(client: XrayClient & { node: Node }): string {
  return buildRealityUri(client);
}

/**
 * URLSearchParams не кодирует все символы по RFC 3986. Для remark (после #)
 * нужен encodeURIComponent + ручная замена `'` и `()`.
 */
function encodeRfc3986(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}
