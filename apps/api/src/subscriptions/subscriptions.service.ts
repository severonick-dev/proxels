import { Injectable, NotFoundException } from '@nestjs/common';
import type { Plan, Subscription } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export type SubscriptionWithPlan = Subscription & { plan: Plan };

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string): Promise<SubscriptionWithPlan[]> {
    return this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForUser(userId: string, id: string): Promise<SubscriptionWithPlan> {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, userId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }
}
