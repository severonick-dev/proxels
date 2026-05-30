import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { GuidesModule } from '../guides/guides.module.js';
import { AdminUsersController } from './admin-users.controller.js';
import { AdminAuditController } from './admin-audit.controller.js';
import { AdminLegalController } from './admin-legal.controller.js';
import { AdminNodesCrudController } from './admin-nodes-crud.controller.js';
import { AdminGuidesController } from './admin-guides.controller.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

/**
 * Все админ-эндпоинты под одной модулькой. AuthModule даёт TokensService,
 * UsersModule даёт UsersService.anonymize, GuidesModule даёт GuidesService.
 */
@Module({
  imports: [UsersModule, AuthModule, GuidesModule],
  controllers: [
    AdminUsersController,
    AdminAuditController,
    AdminLegalController,
    AdminNodesCrudController,
    AdminGuidesController,
  ],
  providers: [RolesGuard],
})
export class AdminModule {}
