import { Logger } from '@nestjs/common';
import type { Node } from '@prisma/client';
import type { XrayNodeClient } from '../xray.types.js';

/**
 * Реальный gRPC-клиент к Xray HandlerService.
 *
 * СТАТУС: SKELETON. Полная реализация будет добавлена при подключении первой
 * боевой ноды (Этап 13 — deploy). Сейчас:
 *
 *  - В dev (`XRAY_CLIENT=noop` по умолчанию) этот класс не инстанцируется.
 *  - В prod с `XRAY_CLIENT=grpc` фабрика даст этот класс — он бросит явную ошибку,
 *    чтобы не молча проглотить запросы.
 *
 * Что нужно добавить, когда поднимется первая нода:
 *  1. Положить proto-файлы Xray в `infra/xray/proto/` (взять из XTLS/Xray-core,
 *     минимум: `app/proxyman/command/command.proto` + транзитивные зависимости).
 *  2. Подключить `@grpc/grpc-js` + `@grpc/proto-loader`.
 *  3. Реализовать `addUser` через `HandlerService.AlterInbound(AddUserOperation)`.
 *  4. Аутентификация — через metadata `Authorization: Bearer ${XRAY_NODE_API_TOKEN}`
 *     ИЛИ через mTLS (предпочтительнее). См. `docs/PRIVACY-ARCHITECTURE.md`.
 *
 * НИКОГДА не использовать API вне whitelist (AddUser/RemoveUser/GetClientStats).
 * Любые попытки получить per-destination/access-log данные на API-уровне — нарушение §4a.
 */
export class GrpcXrayNodeClient implements XrayNodeClient {
  private readonly log = new Logger('GrpcXray');

  constructor(private readonly apiToken: string) {
    if (!apiToken) {
      throw new Error('GrpcXrayNodeClient requires XRAY_NODE_API_TOKEN');
    }
  }

  async addUser(node: Node, _uuid: string, _identifier: string): Promise<void> {
    this.log.error(
      { nodeName: node.name, xrayApiAddr: node.xrayApiAddr },
      'GrpcXrayNodeClient.addUser is not implemented yet — wire .proto files (see infra/xray/README.md)',
    );
    throw new Error(
      'GrpcXrayNodeClient not implemented. Use XRAY_CLIENT=noop in dev or finish proto wiring before going prod.',
    );
  }

  async removeUser(node: Node, _identifier: string): Promise<void> {
    this.log.error({ nodeName: node.name }, 'GrpcXrayNodeClient.removeUser is not implemented yet');
    throw new Error('GrpcXrayNodeClient.removeUser not implemented');
  }

  async getClientStats(): Promise<null> {
    // Безопасный фолбэк: пока нет реализации — null (биллинг трафика будет 0).
    return null;
  }
}
