import { Controller, Get, Param } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import { GuidesService } from './guides.service.js';

/** Публичный read-only API гайдов. Контент — markdown, рендерится фронтом через react-markdown. */
@Controller('guides')
export class GuidesController {
  constructor(private readonly guides: GuidesService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: seconds(60) } })
  list() {
    return this.guides.listPublished();
  }

  @Get(':slug')
  @Throttle({ default: { limit: 120, ttl: seconds(60) } })
  one(@Param('slug') slug: string) {
    return this.guides.getBySlug(slug);
  }
}
