import { Controller, Get, Param } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import { LegalDocsService } from './legal.service.js';

/**
 * Публичный read-only API юр.документов.
 * Админ-CRUD появится на Этапе 12 (`/api/admin/legal`).
 *
 * Контент — markdown. Frontend рендерит через react-markdown (он использует
 * AST + React-элементы, не innerHTML — XSS-безопасно по дизайну).
 */
@Controller('legal')
export class LegalController {
  constructor(private readonly legal: LegalDocsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: seconds(60) } })
  list() {
    return this.legal.listPublishedLatest();
  }

  @Get(':slug')
  @Throttle({ default: { limit: 120, ttl: seconds(60) } })
  one(@Param('slug') slug: string) {
    return this.legal.getPublished(this.legal.parseSlug(slug));
  }
}
