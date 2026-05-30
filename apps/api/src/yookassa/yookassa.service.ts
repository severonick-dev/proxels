import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EnvService } from '../config/env.service.js';
import type {
  IssuedPayment,
  YookassaCreatePaymentRequest,
  YookassaPaymentObject,
} from './yookassa.types.js';

const API_BASE = 'https://api.yookassa.ru/v3';

export interface CreatePaymentArgs {
  amountRub: number;
  description: string;
  returnUrl: string;
  customerEmail: string;
  /** Плоский dict, попадёт в metadata платежа и придёт обратно в webhook. */
  metadata?: Record<string, string>;
  receipt: {
    itemDescription: string;
    quantity?: number;
  };
}

@Injectable()
export class YookassaService {
  private readonly log = new Logger('Yookassa');

  constructor(private readonly env: EnvService) {}

  /**
   * Создать платёж в YooKassa.
   * Если shopId/secretKey не заданы И NODE_ENV=development — bypass: возвращаем
   * фиктивный confirmationUrl и id, чтобы можно было дальше прогонять webhook руками.
   */
  async createPayment(args: CreatePaymentArgs): Promise<IssuedPayment> {
    if (this.isDevBypass()) {
      const fakeId = `dev-${randomUUID()}`;
      this.log.warn(
        { fakeId, amount: args.amountRub },
        'Dev bypass: skipping real YooKassa call, returning synthetic payment',
      );
      return {
        yookassaId: fakeId,
        status: 'pending',
        confirmationUrl: `${this.env.get('APP_URL')}/dev/yookassa/${fakeId}`,
        bypassed: true,
      };
    }

    const shopId = this.env.get('YOOKASSA_SHOP_ID');
    const secretKey = this.env.get('YOOKASSA_SECRET_KEY');
    if (!shopId || !secretKey) {
      throw new InternalServerErrorException(
        'YooKassa is not configured (set YOOKASSA_SHOP_ID + YOOKASSA_SECRET_KEY)',
      );
    }

    const body: YookassaCreatePaymentRequest = {
      amount: { value: formatRubles(args.amountRub), currency: 'RUB' },
      capture: true,
      description: args.description.slice(0, 128),
      confirmation: { type: 'redirect', return_url: args.returnUrl },
      metadata: args.metadata,
      receipt: {
        customer: { email: args.customerEmail },
        items: [
          {
            description: args.receipt.itemDescription.slice(0, 128),
            quantity: (args.receipt.quantity ?? 1).toFixed(2),
            amount: { value: formatRubles(args.amountRub), currency: 'RUB' },
            vat_code: this.env.get('YOOKASSA_VAT_CODE'),
            payment_mode: this.env.get('YOOKASSA_PAYMENT_MODE'),
            payment_subject: this.env.get('YOOKASSA_PAYMENT_SUBJECT'),
          },
        ],
      },
    };

    const idempotenceKey = randomUUID();
    const authHeader = `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`;

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotence-Key': idempotenceKey,
          Authorization: authHeader,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      this.log.error(`YooKassa network error: ${err instanceof Error ? err.message : String(err)}`);
      throw new InternalServerErrorException('Payment gateway unavailable');
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.log.error({ status: res.status, body: text.slice(0, 500) }, 'YooKassa returned error');
      throw new InternalServerErrorException('Payment gateway error');
    }

    const payment = (await res.json()) as YookassaPaymentObject;
    const confirmationUrl = payment.confirmation?.confirmation_url;
    if (!confirmationUrl) {
      this.log.error({ paymentId: payment.id }, 'YooKassa response missing confirmation_url');
      throw new InternalServerErrorException('Invalid payment gateway response');
    }
    return {
      yookassaId: payment.id,
      status: payment.status,
      confirmationUrl,
      bypassed: false,
    };
  }

  /** Включён ли dev-bypass (нет реального вызова YooKassa). */
  isDevBypass(): boolean {
    if (this.env.isProduction) return false;
    const shopId = this.env.get('YOOKASSA_SHOP_ID');
    const secretKey = this.env.get('YOOKASSA_SECRET_KEY');
    return !shopId || !secretKey || shopId === 'test';
  }
}

/**
 * 150 → "150.00". YooKassa требует строку с двумя знаками после точки.
 * Plan.priceRub у нас — целые рубли, копейки не используем.
 */
function formatRubles(rub: number): string {
  return rub.toFixed(2);
}
