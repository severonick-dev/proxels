import { Module } from '@nestjs/common';
import { PlansService } from './plans.service.js';
import { AdminPlansController, PlansController } from './plans.controller.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

@Module({
  controllers: [PlansController, AdminPlansController],
  providers: [PlansService, RolesGuard],
  exports: [PlansService],
})
export class PlansModule {}
