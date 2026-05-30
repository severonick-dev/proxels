import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Guide } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class GuidesService {
  constructor(private readonly prisma: PrismaService) {}

  listPublished(): Promise<Guide[]> {
    return this.prisma.guide.findMany({
      where: { isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
  }

  async getBySlug(slug: string): Promise<Guide> {
    if (!slug || slug.length > 64) throw new BadRequestException('Invalid slug');
    const g = await this.prisma.guide.findUnique({ where: { slug } });
    if (!g || !g.isPublished) throw new NotFoundException('Guide not found');
    return g;
  }

  // --- admin ---
  listAll(): Promise<Guide[]> {
    return this.prisma.guide.findMany({
      orderBy: [{ isPublished: 'desc' }, { sortOrder: 'asc' }],
    });
  }

  async findById(id: string): Promise<Guide> {
    const g = await this.prisma.guide.findUnique({ where: { id } });
    if (!g) throw new NotFoundException('Guide not found');
    return g;
  }

  create(data: {
    slug: string;
    title: string;
    platforms: string;
    contentMd: string;
    sortOrder?: number;
    isPublished?: boolean;
  }): Promise<Guide> {
    return this.prisma.guide.create({ data });
  }

  update(
    id: string,
    data: Partial<{
      slug: string;
      title: string;
      platforms: string;
      contentMd: string;
      sortOrder: number;
      isPublished: boolean;
    }>,
  ): Promise<Guide> {
    return this.prisma.guide.update({ where: { id }, data });
  }

  remove(id: string): Promise<Guide> {
    return this.prisma.guide.delete({ where: { id } });
  }
}
