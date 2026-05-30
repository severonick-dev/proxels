import { Module } from '@nestjs/common';
import { SubController } from './sub.controller.js';
import { SubService } from './sub.service.js';

@Module({
  controllers: [SubController],
  providers: [SubService],
})
export class SubModule {}
