import { Module } from '@nestjs/common';
import { DeployService } from './deploy.service.js';

@Module({
  providers: [DeployService],
  exports: [DeployService],
})
export class DeployModule {}
