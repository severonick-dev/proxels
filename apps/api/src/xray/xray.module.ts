import { Global, Logger, Module, Provider } from '@nestjs/common';
import { EnvService } from '../config/env.service.js';
import { XRAY_NODE_CLIENT, type XrayNodeClient } from './xray.types.js';
import { NoopXrayNodeClient } from './clients/noop.client.js';
import { GrpcXrayNodeClient } from './clients/grpc.client.js';
import { XrayService } from './xray.service.js';

const xrayClientProvider: Provider = {
  provide: XRAY_NODE_CLIENT,
  inject: [EnvService],
  useFactory: (env: EnvService): XrayNodeClient => {
    const kind = env.get('XRAY_CLIENT');
    const log = new Logger('XrayFactory');

    if (kind === 'grpc') {
      log.log('Using GrpcXrayNodeClient');
      return new GrpcXrayNodeClient(env.get('XRAY_NODE_API_TOKEN'));
    }

    if (env.isProduction) {
      // Жёсткая защита: в production noop = вы продаёте подписки, которые
      // на самом деле никому не выписываются на нодах. Бьём по рукам сразу.
      throw new Error(
        'XRAY_CLIENT=noop is not allowed in production. Set XRAY_CLIENT=grpc and finish proto wiring.',
      );
    }

    log.warn('Using NoopXrayNodeClient (DEV ONLY). No real Xray calls will be made.');
    return new NoopXrayNodeClient();
  },
};

@Global()
@Module({
  providers: [xrayClientProvider, XrayService],
  exports: [xrayClientProvider, XrayService],
})
export class XrayModule {}
