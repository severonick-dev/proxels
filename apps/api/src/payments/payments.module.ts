import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsWebhookController } from './webhook/webhook.controller.js';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.js';
import { PromosModule } from '../promos/promos.module.js';

@Module({
  imports: [SubscriptionsModule, PromosModule],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
