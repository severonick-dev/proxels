import { Injectable, NotFoundException } from '@nestjs/common';
import type { Payment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Read-only сервис платежей.
 * Создание/обработка платежей — через ЮKassa webhook на Этапе 5.
 *
 * НЕЛЬЗЯ возвращать сырые webhook payloads из YooKassa (могут содержать данные плательщика).
 * Отдаём только агрегированные поля: id, amountRub, status, createdAt, receiptSent.
 */
export type PublicPayment = Pick<
  Payment,
  'id' | 'subscriptionId' | 'amountRub' | 'status' | 'receiptSent' | 'createdAt'
>;

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string): Promise<PublicPayment[]> {
    const rows = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        subscriptionId: true,
        amountRub: true,
        status: true,
        receiptSent: true,
        createdAt: true,
      },
    });
    return rows;
  }

  async findOneForUser(userId: string, id: string): Promise<PublicPayment> {
    const row = await this.prisma.payment.findFirst({
      where: { id, userId },
      select: {
        id: true,
        subscriptionId: true,
        amountRub: true,
        status: true,
        receiptSent: true,
        createdAt: true,
      },
    });
    if (!row) throw new NotFoundException('Payment not found');
    return row;
  }
}
