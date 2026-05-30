import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Payment, PaymentStatus, Prisma, SubscriptionStatus } from '@prisma/client';
import { CONSENT_VERSIONS } from '@proxels/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { YookassaService } from '../yookassa/yookassa.service.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import { EnvService } from '../config/env.service.js';
import type { YookassaWebhookNotification } from '../yookassa/yookassa.types.js';

/**
 * Публичная проекция платежа (без webhook-метаданных и сырых данных ЮKassa).
 */
export type PublicPayment = Pick<
  Payment,
  'id' | 'subscriptionId' | 'amountRub' | 'status' | 'receiptSent' | 'createdAt'
>;

const PUBLIC_SELECT = {
  id: true,
  subscriptionId: true,
  amountRub: true,
  status: true,
  receiptSent: true,
  createdAt: true,
} as const;

@Injectable()
export class PaymentsService {
  private readonly log = new Logger('Payments');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly yookassa: YookassaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly env: EnvService,
  ) {}

  // --- read API -------------------------------------------------------------

  async listForUser(userId: string): Promise<PublicPayment[]> {
    return this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: PUBLIC_SELECT,
    });
  }

  async findOneForUser(userId: string, id: string): Promise<PublicPayment> {
    const row = await this.prisma.payment.findFirst({
      where: { id, userId },
      select: PUBLIC_SELECT,
    });
    if (!row) throw new NotFoundException('Payment not found');
    return row;
  }

  // --- create payment -------------------------------------------------------

  /**
   * Создать платёж в YooKassa для (userId, planId).
   * Возвращает confirmation_url, на который надо перенаправить пользователя.
   *
   * Идемпотентность: на каждый POST /api/payments/create создаём НОВЫЙ Payment;
   * предыдущие незавершённые попытки оставляем как есть (status=pending) — Этап 8
   * (ЛК) добавит «отменить незавершённый» при необходимости.
   */
  async createForUser(args: {
    userId: string;
    userEmail: string;
    planId: string;
    offerAccepted: boolean;
    returnUrl?: string;
    ip?: string | null;
  }): Promise<{ paymentId: string; confirmationUrl: string; bypassed: boolean }> {
    if (!args.offerAccepted) {
      throw new BadRequestException('Public offer must be accepted to proceed (54-ФЗ + ГК ст.437)');
    }

    const plan = await this.prisma.plan.findFirst({
      where: { id: args.planId, isActive: true },
    });
    if (!plan) throw new NotFoundException('Plan not available');

    const returnUrl =
      args.returnUrl ??
      this.env.get('YOOKASSA_RETURN_URL') ??
      `${this.env.get('APP_URL')}/lk/payments`;

    const description = `Подписка Proxels: ${plan.name}`;

    // Создаём в БД pending-запись СНАЧАЛА (id ещё не известен) — после того,
    // как YooKassa вернёт id, проставим yookassaId. Альтернатива — двухфазная запись.
    // Здесь делаем последовательно для простоты:
    const issued = await this.yookassa.createPayment({
      amountRub: plan.priceRub,
      description,
      returnUrl,
      customerEmail: args.userEmail,
      metadata: { userId: args.userId, planId: plan.id },
      receipt: { itemDescription: description },
    });

    const payment = await this.prisma.payment.create({
      data: {
        userId: args.userId,
        yookassaId: issued.yookassaId,
        amountRub: plan.priceRub,
        status: mapStatus(issued.status),
        offerAcceptedVersion: CONSENT_VERSIONS.offer,
        // Связь с конкретным Subscription появится после успешной оплаты.
        // В metadata храним planId, чтобы webhook знал, какую подписку выпустить.
        metadata: { planId: plan.id, bypassed: issued.bypassed } as Prisma.InputJsonValue,
      },
    });

    await this.audit.record({
      action: 'payment.create',
      actorId: args.userId,
      ip: args.ip,
      meta: {
        paymentId: payment.id,
        planId: plan.id,
        amountRub: plan.priceRub,
        bypassed: issued.bypassed,
      },
    });

    return {
      paymentId: payment.id,
      confirmationUrl: issued.confirmationUrl,
      bypassed: issued.bypassed,
    };
  }

  // --- webhook processing ---------------------------------------------------

  /**
   * Обработчик webhook'а YooKassa. ВЫЗЫВАЕТСЯ ИЗ КОНТРОЛЛЕРА ПОД YookassaIpGuard
   * (источник IP уже валидирован).
   *
   * Идемпотентность: если Payment в финальном статусе (succeeded/canceled) —
   * возвращаем без действий. Иначе атомарно (transaction) обновляем платёж и
   * создаём/продлеваем подписку.
   */
  async processWebhookEvent(event: YookassaWebhookNotification, ip?: string | null): Promise<void> {
    if (event.type !== 'notification') {
      throw new BadRequestException('Unexpected webhook payload');
    }

    const obj = event.object;
    const payment = await this.prisma.payment.findUnique({ where: { yookassaId: obj.id } });
    if (!payment) {
      // Не палим существование платежа — отдаём 200 и просто молча игнорируем.
      this.log.warn({ yookassaId: obj.id, event: event.event }, 'Webhook for unknown payment');
      return;
    }

    const declaredStatus = mapStatus(obj.status);

    // Безопасность: webhook не должен менять сумму или владельца.
    if (obj.amount && Number(obj.amount.value) !== payment.amountRub) {
      this.log.error(
        { paymentId: payment.id, declared: obj.amount.value, expected: payment.amountRub },
        'Webhook amount mismatch — refusing to process',
      );
      throw new ForbiddenException('Amount mismatch');
    }

    // Идемпотентность по финальным статусам
    if (payment.status === PaymentStatus.succeeded || payment.status === PaymentStatus.canceled) {
      this.log.log(
        { paymentId: payment.id, current: payment.status, declared: declaredStatus },
        'Webhook: payment already in terminal state, skipping',
      );
      return;
    }

    if (event.event === 'payment.succeeded' && declaredStatus === PaymentStatus.succeeded) {
      await this.handleSucceeded(payment, ip);
      return;
    }

    if (event.event === 'payment.canceled' && declaredStatus === PaymentStatus.canceled) {
      await this.handleCanceled(payment, ip);
      return;
    }

    // Промежуточный статус (waiting_for_capture) или refund — пока просто обновим.
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: declaredStatus },
    });
  }

  private async handleSucceeded(payment: Payment, ip?: string | null): Promise<void> {
    const planId = extractPlanId(payment);
    if (!planId) {
      this.log.error(
        { paymentId: payment.id },
        'Payment metadata.planId missing — cannot issue sub',
      );
      throw new BadRequestException('Cannot issue subscription: planId missing');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const sub = await this.subscriptions.createOrExtendForPayment(tx, {
        userId: payment.userId,
        planId,
      });
      const refreshed = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.succeeded,
          subscriptionId: sub.id,
          // YooKassa сама отправит чек — receiptSent ставим true, когда успех.
          receiptSent: true,
        },
      });
      return { sub, payment: refreshed };
    });

    await this.audit.record({
      action: 'subscription.issue',
      actorId: payment.userId,
      ip,
      meta: {
        paymentId: payment.id,
        planId,
        subscriptionId: updated.sub.id,
        endAt: updated.sub.endAt?.toISOString() ?? null,
      },
    });
    this.log.log(
      { paymentId: payment.id, subscriptionId: updated.sub.id },
      'Payment succeeded → subscription issued/extended',
    );
  }

  private async handleCanceled(payment: Payment, ip?: string | null): Promise<void> {
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.canceled },
    });
    await this.audit.record({
      action: 'payment.canceled',
      actorId: payment.userId,
      ip,
      meta: { paymentId: payment.id },
    });
    this.log.log({ paymentId: payment.id }, 'Payment canceled');
  }

  // -------------------------------------------------------------------------
  // Внутренние эндпоинты для отладочного «завершить платёж» в dev (bypass).
  // НЕ должны быть доступны в production.
  // -------------------------------------------------------------------------

  async devSimulateSucceeded(yookassaId: string, ip?: string | null): Promise<void> {
    if (this.env.isProduction) {
      throw new ForbiddenException('dev-only endpoint');
    }
    const payment = await this.prisma.payment.findUnique({ where: { yookassaId } });
    if (!payment) throw new NotFoundException('Payment not found');
    await this.handleSucceeded(payment, ip);
  }
}

function mapStatus(status: string): PaymentStatus {
  switch (status) {
    case 'pending':
      return PaymentStatus.pending;
    case 'waiting_for_capture':
      return PaymentStatus.waiting_for_capture;
    case 'succeeded':
      return PaymentStatus.succeeded;
    case 'canceled':
      return PaymentStatus.canceled;
    default:
      return PaymentStatus.pending;
  }
}

function extractPlanId(payment: Payment): string | null {
  const meta = payment.metadata;
  if (meta && typeof meta === 'object' && !Array.isArray(meta) && 'planId' in meta) {
    const val = (meta as Record<string, unknown>).planId;
    if (typeof val === 'string') return val;
  }
  return null;
}
