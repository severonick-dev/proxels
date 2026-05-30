import { Injectable, Logger } from '@nestjs/common';
import { EnvService } from '../config/env.service.js';

interface MailPayload {
  to: string;
  subject: string;
  text: string;
}

/**
 * Mail-сервис.
 *
 * ЭТАП 3: ЗАГЛУШКА — пишет письма в pino-лог (можно скопировать ссылку из логов).
 * Реальный SMTP (nodemailer) подключим на сервере на Этапе 13 или раньше, когда
 * заведём SMTP-провайдер. Интерфейс публичных методов уже стабильный — миграция
 * с заглушки на реальную отправку = только замена этого файла.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger('Mail');

  constructor(private readonly env: EnvService) {}

  async sendEmailVerification(to: string, token: string): Promise<void> {
    const url = `${this.env.get('APP_URL')}/auth/verify-email?token=${encodeURIComponent(token)}`;
    await this.send({
      to,
      subject: 'Подтвердите email — Proxels',
      text: `Привет!\n\nПодтвердите email, перейдя по ссылке (действительна 24 часа):\n${url}\n\nЕсли вы не регистрировались на proxels.ru — просто проигнорируйте это письмо.`,
    });
  }

  async sendPasswordReset(to: string, token: string, ttlMinutes: number): Promise<void> {
    const url = `${this.env.get('APP_URL')}/auth/reset-password?token=${encodeURIComponent(token)}`;
    await this.send({
      to,
      subject: 'Сброс пароля — Proxels',
      text: `Запрошен сброс пароля.\n\nЕсли это были вы — перейдите по ссылке (действительна ${ttlMinutes} мин):\n${url}\n\nЕсли вы не запрашивали сброс — проигнорируйте это письмо и убедитесь, что ваш пароль никому не известен.`,
    });
  }

  private async send(payload: MailPayload): Promise<void> {
    // На Этапе 3 — заглушка: логируем письмо. На сервере заменим на nodemailer.
    this.log.warn(
      {
        stubEmail: true,
        to: payload.to,
        subject: payload.subject,
        textPreview: payload.text.slice(0, 200),
      },
      'STUB: email not actually sent (configure SMTP on server)',
    );
  }
}
