import { Module } from '@nestjs/common';
import { GuidesService } from './guides.service.js';
import { GuidesController } from './guides.controller.js';

@Module({
  controllers: [GuidesController],
  providers: [GuidesService],
  exports: [GuidesService],
})
export class GuidesModule {}
