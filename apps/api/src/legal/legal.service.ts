import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LegalDoc, LegalDocSlug } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class LegalDocsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Последняя опубликованная версия документа по slug.
   * Если ни одной опубликованной версии нет — 404 (значит документ ещё не залит).
   */
  async getPublished(slug: LegalDocSlug): Promise<LegalDoc> {
    const doc = await this.prisma.legalDoc.findFirst({
      where: { slug, publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
    });
    if (!doc) throw new NotFoundException('Legal document is not published yet');
    return doc;
  }

  /** Список всех текущих (последних опубликованных) версий по каждому slug. */
  async listPublishedLatest(): Promise<LegalDoc[]> {
    // Postgres-friendly: одна выборка с distinct on slug + порядок по publishedAt desc.
    return this.prisma.legalDoc.findMany({
      where: { publishedAt: { not: null } },
      orderBy: [{ slug: 'asc' }, { publishedAt: 'desc' }],
      distinct: ['slug'],
    });
  }

  /** Утилита для admin-CRUD (Этап 12): валидировать slug из URL. */
  parseSlug(raw: string): LegalDocSlug {
    if (raw === 'privacy' || raw === 'offer' || raw === 'cookie') return raw;
    throw new BadRequestException('Unknown legal doc slug');
  }
}
