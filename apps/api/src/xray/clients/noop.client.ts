import { Logger } from '@nestjs/common';
import type { Node } from '@prisma/client';
import type { XrayNodeClient } from '../xray.types.js';

/**
 * Заглушка для dev. Ничего не отправляет в реальный Xray, просто пишет лог.
 * Используется, когда нет настроенных нод (например, локальная разработка)
 * или для unit-тестов.
 */
export class NoopXrayNodeClient implements XrayNodeClient {
  private readonly log = new Logger('NoopXray');

  async addUser(node: Node, uuid: string, identifier: string): Promise<void> {
    this.log.debug(
      { nodeName: node.name, host: node.host, identifier, uuidTail: uuid.slice(-6) },
      'NOOP addUser (XRAY_CLIENT=noop)',
    );
  }

  async removeUser(node: Node, identifier: string): Promise<void> {
    this.log.debug({ nodeName: node.name, identifier }, 'NOOP removeUser (XRAY_CLIENT=noop)');
  }

  async getClientStats(): Promise<null> {
    return null;
  }
}
