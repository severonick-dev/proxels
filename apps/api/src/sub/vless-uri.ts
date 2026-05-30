import type { Node, XrayClient } from '@prisma/client';

/**
 * Сгенерировать VLESS Reality URI для одной пары (нода, клиент).
 *
 * Формат, который понимают Nekobox / Hiddify / V2RayTun / V2rayN:
 *   vless://<uuid>@<host>:<port>?<params>#<remark>
 *
 * Параметры под Reality:
 *   - encryption=none (для VLESS — обязательно)
 *   - type=tcp (транспорт; можно расширить до ws/grpc позже)
 *   - security=reality
 *   - pbk=<reality publicKey>
 *   - sni=<маскируемый домен>
 *   - sid=<reality shortId>
 *   - fp=chrome (TLS fingerprint, дефолт)
 *   - flow=xtls-rprx-vision (рекомендуемый для Reality + TCP)
 */
export function buildVlessRealityUri(client: XrayClient & { node: Node }): string {
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
 * URLSearchParams не кодирует все символы по RFC 3986. Для remark (после #)
 * нужен encodeURIComponent + ручная замена `'` и `()`.
 */
function encodeRfc3986(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}
