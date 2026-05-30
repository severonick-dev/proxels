import { Controller, Get, Param } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import { NewsService } from './news.service.js';

@Controller('news')
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: seconds(60) } })
  list() {
    return this.news.listPublished();
  }

  @Get(':slug')
  one(@Param('slug') slug: string) {
    return this.news.getBySlug(slug);
  }
}
