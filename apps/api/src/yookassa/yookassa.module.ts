import { Global, Module } from '@nestjs/common';
import { YookassaService } from './yookassa.service.js';
import { YookassaIpGuard } from './yookassa-ip.guard.js';

@Global()
@Module({
  providers: [YookassaService, YookassaIpGuard],
  exports: [YookassaService, YookassaIpGuard],
})
export class YookassaModule {}
