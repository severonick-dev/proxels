import { Module } from '@nestjs/common';
import { PromosService } from './promos.service.js';
import { PromosController } from './promos.controller.js';

@Module({
  providers: [PromosService],
  controllers: [PromosController],
  exports: [PromosService],
})
export class PromosModule {}
