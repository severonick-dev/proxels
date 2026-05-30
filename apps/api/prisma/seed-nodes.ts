/* eslint-disable no-console */
import { NodeStatus, type PrismaClient } from '@prisma/client';

/**
 * Seed development-нод. Запускается ТОЛЬКО при NODE_ENV !== 'production'
 * (вызывающий код проверяет). Создаёт две фейковые ноды Frankfurt-1/2,
 * на которых установлены статус online и заглушечные publicKey/shortId.
 *
 * Это нужно, чтобы `/api/sub/:subToken` мог отдать корректные VLESS URI и
 * можно было визуально проверить QR-код + подписочную ссылку в ЛК ещё ДО
 * того, как поднимется первая реальная нода (Этап 13).
 *
 * Эти ноды НЕ должны попасть в production. В prod-seed либо не запускаем
 * эту функцию вообще, либо помечаем isActive=false.
 */

interface NodeSeed {
  name: string;
  host: string;
  country: string;
  xrayApiAddr: string;
  publicKey: string;
  shortId: string;
  sni: string;
  port: number;
  weight: number;
}

const DEV_NODES: NodeSeed[] = [
  {
    name: 'dev-de-1',
    host: '203.0.113.10', // RFC 5737 documentation IP
    country: 'DE',
    xrayApiAddr: '203.0.113.10:10085',
    publicKey: 'DEV_REPLACE_WITH_REAL_REALITY_PUBKEY_44_CHARS_FAKE',
    shortId: 'a1b2c3d4',
    sni: 'www.microsoft.com',
    port: 443,
    weight: 100,
  },
  {
    name: 'dev-de-2',
    host: '203.0.113.20',
    country: 'DE',
    xrayApiAddr: '203.0.113.20:10085',
    publicKey: 'DEV_REPLACE_WITH_REAL_REALITY_PUBKEY_44_CHARS_FAKE',
    shortId: 'e5f6a7b8',
    sni: 'www.microsoft.com',
    port: 443,
    weight: 90,
  },
];

export async function seedDevNodes(prisma: PrismaClient): Promise<void> {
  for (const node of DEV_NODES) {
    const existing = await prisma.node.findUnique({ where: { name: node.name } });
    if (existing) {
      await prisma.node.update({
        where: { id: existing.id },
        data: {
          host: node.host,
          country: node.country,
          xrayApiAddr: node.xrayApiAddr,
          publicKey: node.publicKey,
          shortId: node.shortId,
          sni: node.sni,
          port: node.port,
          weight: node.weight,
          status: NodeStatus.online,
          isActive: true,
        },
      });
      console.log(`  ↻ node "${node.name}" updated`);
    } else {
      await prisma.node.create({
        data: { ...node, status: NodeStatus.online, isActive: true },
      });
      console.log(`  ✓ node "${node.name}" created`);
    }
  }
}
