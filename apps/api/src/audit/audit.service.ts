import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

interface AuditRecord {
  action: string;
  actorId?: string | null;
  ip?: string | null;
  meta?: Prisma.InputJsonValue;
}

/**
 * Запись административных действий в AuditLog (§4b).
 * Используется любыми admin-эндпоинтами: plan.*, node.*, user.*, и т.д.
 *
 * Что НЕ писать в meta: пароли, токены, тела запросов с ПДн. Только идентификаторы
 * (planId, userId), дельты изменённых полей.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditRecord): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: entry.action,
        actorId: entry.actorId ?? null,
        ip: entry.ip ?? null,
        meta: entry.meta,
      },
    });
  }
}
