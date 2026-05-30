import { Controller, Get } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import { BRAND, CONSENT_VERSIONS } from '@proxels/shared';
import { EnvService } from '../config/env.service.js';

/**
 * Публичный конфиг для фронта. Здесь — только то, что в принципе можно отдать
 * без авторизации и не открывает поверхность атаки:
 *  - бренд (имя/домен/Telegram)
 *  - реквизиты ИП (footer / юр.страницы)
 *  - ID Yandex.Metrika (грузится фронтом ТОЛЬКО после согласия на cookie)
 *  - актуальные версии юр.документов (нужно фронту, чтобы решить, надо ли
 *    переспрашивать согласие)
 *
 * НЕТ: секретов, ID/host VPS нод, webhook-секретов и т.п.
 */
@Controller('config/public')
export class PublicConfigController {
  constructor(private readonly env: EnvService) {}

  @Get()
  @Throttle({ default: { limit: 120, ttl: seconds(60) } })
  get() {
    return {
      brand: {
        name: BRAND.name,
        domain: BRAND.domain,
        telegramUrl: BRAND.telegramUrl,
        telegramHandle: BRAND.telegramHandle,
      },
      owner: {
        fio: this.env.get('OWNER_FIO'),
        ogrnip: this.env.get('OWNER_OGRNIP'),
        inn: this.env.get('OWNER_INN'),
        address: this.env.get('OWNER_ADDRESS'),
      },
      contact: {
        email: this.env.get('CONTACT_EMAIL'),
        telegram: this.env.get('CONTACT_TELEGRAM'),
      },
      analytics: {
        yandexMetrikaId: this.env.get('YANDEX_METRIKA_ID') ?? null,
      },
      consentVersions: CONSENT_VERSIONS,
    };
  }
}
