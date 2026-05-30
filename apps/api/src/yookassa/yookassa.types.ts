/**
 * Подмножество публичного API YooKassa (v3), которое мы реально используем.
 * Полный справочник: https://yookassa.ru/developers/api
 */

export type YookassaPaymentStatus = 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';

export interface YookassaAmount {
  value: string; // "150.00"
  currency: 'RUB';
}

export interface YookassaConfirmationRedirect {
  type: 'redirect';
  return_url: string;
  confirmation_url?: string;
}

export interface YookassaReceiptItem {
  description: string;
  quantity: string;
  amount: YookassaAmount;
  vat_code: number; // 1..6
  payment_mode: string;
  payment_subject: string;
}

export interface YookassaReceipt {
  customer: { email: string };
  items: YookassaReceiptItem[];
}

export interface YookassaCreatePaymentRequest {
  amount: YookassaAmount;
  capture: boolean;
  description?: string;
  confirmation: YookassaConfirmationRedirect;
  metadata?: Record<string, string>;
  receipt?: YookassaReceipt;
}

export interface YookassaPaymentObject {
  id: string;
  status: YookassaPaymentStatus;
  amount: YookassaAmount;
  description?: string;
  recipient?: { account_id: string; gateway_id: string };
  payment_method?: { type: string; id: string; saved: boolean; title?: string };
  created_at: string;
  expires_at?: string;
  confirmation?: YookassaConfirmationRedirect;
  test?: boolean;
  paid?: boolean;
  refundable?: boolean;
  metadata?: Record<string, string>;
}

export type YookassaWebhookEvent =
  | 'payment.succeeded'
  | 'payment.waiting_for_capture'
  | 'payment.canceled'
  | 'refund.succeeded';

export interface YookassaWebhookNotification {
  type: 'notification';
  event: YookassaWebhookEvent;
  object: YookassaPaymentObject;
}

export interface IssuedPayment {
  /** id из YooKassa (или dev-<uuid> в bypass-режиме). */
  yookassaId: string;
  status: YookassaPaymentStatus;
  /** URL, на который надо отправить пользователя. В bypass-режиме — синтетический. */
  confirmationUrl: string;
  /** true если использовался dev-bypass (YooKassa не вызывалась). */
  bypassed: boolean;
}
