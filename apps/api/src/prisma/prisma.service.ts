import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PrismaService.name);

  constructor() {
    super({
      // Не логируем 'query' в проде, чтобы случайно не оставить ПДн в логах.
      // Параметры запросов могут содержать email/токены. См. §4a.
      log: [
        { level: 'warn', emit: 'event' },
        { level: 'error', emit: 'event' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.log.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
