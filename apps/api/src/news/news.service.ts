import { Injectable, NotFoundException } from '@nestjs/common';
import type { NewsPost } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

const PUBLIC_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  contentMd: true,
  publishedAt: true,
} as const;

@Injectable()
export class NewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Публичный список — только опубликованные, новые сверху. */
  listPublished() {
    return this.prisma.newsPost.findMany({
      where: { publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      select: { ...PUBLIC_SELECT, contentMd: false },
    });
  }

  async getBySlug(slug: string) {
    const post = await this.prisma.newsPost.findFirst({
      where: { slug, publishedAt: { not: null } },
      select: PUBLIC_SELECT,
    });
    if (!post) throw new NotFoundException('News post not found');
    return post;
  }

  // --- admin helpers ---

  listAll() {
    return this.prisma.newsPost.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findById(id: string): Promise<NewsPost> {
    const post = await this.prisma.newsPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('News post not found');
    return post;
  }

  create(data: {
    slug: string;
    title: string;
    summary: string;
    contentMd: string;
    publish: boolean;
  }) {
    return this.prisma.newsPost.create({
      data: {
        slug: data.slug,
        title: data.title,
        summary: data.summary,
        contentMd: data.contentMd,
        publishedAt: data.publish ? new Date() : null,
      },
    });
  }

  async update(
    id: string,
    data: {
      title?: string;
      summary?: string;
      contentMd?: string;
      publish?: boolean;
    },
  ) {
    const existing = await this.findById(id);
    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.summary !== undefined) patch.summary = data.summary;
    if (data.contentMd !== undefined) patch.contentMd = data.contentMd;
    if (data.publish === true && existing.publishedAt === null) patch.publishedAt = new Date();
    if (data.publish === false) patch.publishedAt = null;
    return this.prisma.newsPost.update({ where: { id }, data: patch });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.newsPost.delete({ where: { id } });
  }
}
