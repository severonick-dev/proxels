import { Controller, Get, UseGuards } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NodesHealthService, type NodeHealthEntry } from './nodes-health.service.js';
import type { Node } from '@prisma/client';

/**
 * Admin-эндпоинты по нодам. Полноценный CRUD (add/edit/disable) — Этап 12.
 * Здесь — только read-only обзор для health-картинки.
 */
@Controller('admin/nodes')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('admin')
export class AdminNodesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nodesHealth: NodesHealthService,
  ) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: seconds(60) } })
  list(): Promise<Node[]> {
    return this.prisma.node.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  @Get('health')
  @Throttle({ default: { limit: 60, ttl: seconds(60) } })
  async health(): Promise<{
    nodes: (Node & { health: NodeHealthEntry | null })[];
    onlineCount: number;
  }> {
    const [nodes, entries, onlineIds] = await Promise.all([
      this.prisma.node.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
      this.nodesHealth.getHealthEntries(),
      this.nodesHealth.getOnlineNodeIds(),
    ]);
    const byNode = new Map(entries.map((e) => [e.nodeId, e]));
    return {
      onlineCount: onlineIds.length,
      nodes: nodes.map((n) => ({ ...n, health: byNode.get(n.id) ?? null })),
    };
  }
}
