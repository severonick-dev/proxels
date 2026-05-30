import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

export const ROLES_METADATA_KEY = 'proxels:roles';

/**
 * Указать, какие роли допускаются на эндпоинт. Применять ВМЕСТЕ с JwtAccessGuard:
 *
 *   @UseGuards(JwtAccessGuard, RolesGuard)
 *   @Roles('admin')
 *   adminOnly() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_METADATA_KEY, roles);
