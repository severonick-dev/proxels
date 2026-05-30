import { Module } from '@nestjs/common';
import { LegalDocsService } from './legal.service.js';
import { LegalController } from './legal.controller.js';

@Module({
  controllers: [LegalController],
  providers: [LegalDocsService],
  exports: [LegalDocsService],
})
export class LegalModule {}
