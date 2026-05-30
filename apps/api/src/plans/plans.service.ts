import { Injectable, NotFoundException } from '@nestjs/common';
import type { Plan, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { CreatePlanDto } from './dto/create-plan.dto.js';
import type { UpdatePlanDto } from './dto/update-plan.dto.js';

export interface AdminCtx {
  actorId: string;
  ip?: string | null;
}

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- public ---------------------------------------------------------------

  listActive(): Promise<Plan[]> {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { priceRub: 'asc' }],
    });
  }

  async findActiveById(id: string): Promise<Plan> {
    const plan = await this.prisma.plan.findFirst({ where: { id, isActive: true } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  // --- admin ----------------------------------------------------------------

  listAll(): Promise<Plan[]> {
    return this.prisma.plan.findMany({
      orderBy: [{ isActive: 'desc' }, { sortOrder: 'asc' }, { priceRub: 'asc' }],
    });
  }

  async findById(id: string): Promise<Plan> {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async create(dto: CreatePlanDto, ctx: AdminCtx): Promise<Plan> {
    const plan = await this.prisma.plan.create({
      data: {
        name: dto.name,
        priceRub: dto.priceRub,
        durationDays: dto.durationDays,
        trafficLimitGb: dto.trafficLimitGb ?? null,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.audit.record({
      action: 'plan.create',
      actorId: ctx.actorId,
      ip: ctx.ip,
      meta: { planId: plan.id, name: plan.name },
    });
    return plan;
  }

  async update(id: string, dto: UpdatePlanDto, ctx: AdminCtx): Promise<Plan> {
    const existing = await this.findById(id);
    const data: Prisma.PlanUpdateInput = {};
    type Diff = string | number | boolean | null;
    const changed: Record<string, [Diff, Diff]> = {};

    if (dto.name !== undefined && dto.name !== existing.name) {
      data.name = dto.name;
      changed.name = [existing.name, dto.name];
    }
    if (dto.priceRub !== undefined && dto.priceRub !== existing.priceRub) {
      data.priceRub = dto.priceRub;
      changed.priceRub = [existing.priceRub, dto.priceRub];
    }
    if (dto.durationDays !== undefined && dto.durationDays !== existing.durationDays) {
      data.durationDays = dto.durationDays;
      changed.durationDays = [existing.durationDays, dto.durationDays];
    }
    if (dto.trafficLimitGb !== undefined && dto.trafficLimitGb !== existing.trafficLimitGb) {
      data.trafficLimitGb = dto.trafficLimitGb;
      changed.trafficLimitGb = [existing.trafficLimitGb, dto.trafficLimitGb];
    }
    if (dto.isActive !== undefined && dto.isActive !== existing.isActive) {
      data.isActive = dto.isActive;
      changed.isActive = [existing.isActive, dto.isActive];
    }
    if (dto.sortOrder !== undefined && dto.sortOrder !== existing.sortOrder) {
      data.sortOrder = dto.sortOrder;
      changed.sortOrder = [existing.sortOrder, dto.sortOrder];
    }

    if (Object.keys(changed).length === 0) {
      return existing;
    }

    const updated = await this.prisma.plan.update({ where: { id }, data });
    await this.audit.record({
      action: 'plan.update',
      actorId: ctx.actorId,
      ip: ctx.ip,
      meta: { planId: id, changed } as Prisma.InputJsonValue,
    });
    return updated;
  }

  /**
   * Не удаляем физически (могут существовать активные подписки на план).
   * Деактивируем — план уходит из публичной выдачи. Действующие подписки доживают
   * свой срок и продлеваются уже на другом тарифе.
   */
  async deactivate(id: string, ctx: AdminCtx): Promise<Plan> {
    const existing = await this.findById(id);
    if (!existing.isActive) return existing;
    const updated = await this.prisma.plan.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.record({
      action: 'plan.deactivate',
      actorId: ctx.actorId,
      ip: ctx.ip,
      meta: { planId: id, name: existing.name },
    });
    return updated;
  }
}
