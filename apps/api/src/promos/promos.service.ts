import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PromoKind, type Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Минимальный финальный платёж на YooKassa — 1 ₽.
 * Если процент/фикс-скидка обнулила сумму, оставляем 1 ₽ и режем скидку.
 * Без этого YooKassa отказывается принять платёж (см. §5 спека).
 */
const MIN_FINAL_RUB = 1;

export interface PromoValidationResult {
  ok: true;
  promoId: string;
  code: string;
  discountKind: PromoKind;
  discountValue: number;
  discountRub: number;
  finalAmountRub: number;
}

export type PromoValidationError =
  | 'not_found'
  | 'inactive'
  | 'not_yet_valid'
  | 'expired'
  | 'limit_reached'
  | 'plan_not_allowed'
  | 'per_user_limit_reached';

/**
 * Сервис применения промокодов.
 *
 * Контракт:
 *  - `validateForPurchase` — проверка + расчёт скидки. Бросает 400 с конкретным
 *    reason. Используется для live-валидации в покупочном диалоге и в момент
 *    создания платежа.
 *  - `redeemAtomic(tx, ...)` — записать redemption + увеличить usedCount в
 *    активной транзакции (вызывается из PaymentsService.handleSucceeded).
 *    Использует CAS на maxUses: если кто-то параллельно перерасходовал — лог-варн,
 *    без отказа (платёж уже прошёл, ломать его поздно).
 */
@Injectable()
export class PromosService {
  private readonly log = new Logger('Promos');

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------

  /**
   * Нормализуем код перед поиском. Принимаем lower/upper, режем пробелы.
   * Возвращаем `null` если входная строка пустая или содержит мусор —
   * это сразу `not_found`.
   */
  static normalize(input: string): string | null {
    const v = input.trim().toUpperCase();
    if (!v) return null;
    if (!/^[A-Z0-9_-]{2,32}$/.test(v)) return null;
    return v;
  }

  // -------------------------------------------------------------------------

  async validateForPurchase(args: {
    code: string;
    userId: string;
    planId: string;
    amountRub: number;
  }): Promise<PromoValidationResult> {
    const norm = PromosService.normalize(args.code);
    if (!norm) throw this.err('not_found');

    const promo = await this.prisma.promoCode.findUnique({ where: { code: norm } });
    if (!promo) throw this.err('not_found');
    if (!promo.isActive) throw this.err('inactive');

    const now = new Date();
    if (promo.validFrom && now < promo.validFrom) throw this.err('not_yet_valid');
    if (promo.validUntil && now > promo.validUntil) throw this.err('expired');
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) throw this.err('limit_reached');

    if (promo.appliesToPlanIds.length > 0 && !promo.appliesToPlanIds.includes(args.planId)) {
      throw this.err('plan_not_allowed');
    }

    if (promo.perUserLimit > 0) {
      const used = await this.prisma.promoRedemption.count({
        where: { promoCodeId: promo.id, userId: args.userId },
      });
      if (used >= promo.perUserLimit) throw this.err('per_user_limit_reached');
    }

    const { discountRub, finalAmountRub } = calcDiscount(
      args.amountRub,
      promo.discountKind,
      promo.discountValue,
    );

    return {
      ok: true,
      promoId: promo.id,
      code: promo.code,
      discountKind: promo.discountKind,
      discountValue: promo.discountValue,
      discountRub,
      finalAmountRub,
    };
  }

  // -------------------------------------------------------------------------

  /**
   * Записать редемпцию в активной транзакции. Атомарно увеличиваем usedCount
   * с CAS на maxUses (updateMany возвращает count); если CAS не сработал —
   * не блокируем платёж, но логируем warn.
   */
  async redeemAtomic(
    tx: Prisma.TransactionClient,
    args: {
      promoId: string;
      userId: string;
      paymentId: string;
      discountRub: number;
    },
  ): Promise<void> {
    await tx.promoRedemption.create({
      data: {
        promoCodeId: args.promoId,
        userId: args.userId,
        paymentId: args.paymentId,
        discountRub: args.discountRub,
      },
    });

    const promo = await tx.promoCode.findUnique({
      where: { id: args.promoId },
      select: { maxUses: true, usedCount: true },
    });
    if (!promo) return;

    // CAS: инкрементируем только если ещё не превысили лимит.
    const guardWhere =
      promo.maxUses === null
        ? { id: args.promoId }
        : { id: args.promoId, usedCount: { lt: promo.maxUses } };

    const res = await tx.promoCode.updateMany({
      where: guardWhere,
      data: { usedCount: { increment: 1 } },
    });

    if (res.count === 0 && promo.maxUses !== null) {
      // Гонка: кто-то другой добил maxUses между нашей проверкой и инкрементом.
      // Платёж уже succeeded — refund'ить или ломать не будем, фиксируем в логе.
      this.log.warn(
        { promoId: args.promoId, paymentId: args.paymentId },
        'Promo redemption recorded but usedCount CAS failed (limit reached concurrently)',
      );
    }
  }

  // -------------------------------------------------------------------------

  private err(reason: PromoValidationError): BadRequestException {
    return new BadRequestException({ promoError: reason });
  }
}

/**
 * Расчёт скидки и финальной суммы. Гарантия: finalAmountRub >= MIN_FINAL_RUB.
 * Возвращает фактически применённую скидку (может быть меньше номинальной, если
 * она зануляла сумму ниже минимума).
 */
export function calcDiscount(
  amountRub: number,
  kind: PromoKind,
  value: number,
): { discountRub: number; finalAmountRub: number } {
  let discount: number;
  if (kind === PromoKind.percent) {
    discount = Math.floor((amountRub * value) / 100);
  } else {
    discount = value;
  }
  discount = Math.max(0, Math.min(discount, amountRub - MIN_FINAL_RUB));
  const final = amountRub - discount;
  return { discountRub: discount, finalAmountRub: final };
}
