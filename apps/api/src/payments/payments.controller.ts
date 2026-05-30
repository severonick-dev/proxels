import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy.js';
import { PaymentsService, type PublicPayment } from './payments.service.js';

@Controller('payments')
@UseGuards(JwtAccessGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('me')
  myList(@CurrentUser() user: AuthenticatedUser): Promise<PublicPayment[]> {
    return this.payments.listForUser(user.id);
  }

  @Get('me/:id')
  myOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<PublicPayment> {
    return this.payments.findOneForUser(user.id, id);
  }
}
