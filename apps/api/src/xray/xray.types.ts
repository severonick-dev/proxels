import type { Node } from '@prisma/client';

/**
 * Контракт работы с Xray-нодой. Реализации:
 *   - `NoopXrayNodeClient` — для dev/тестов, ничего не делает, просто логирует.
 *   - `GrpcXrayNodeClient` — реальный gRPC к Xray API (HandlerService).
 *
 * Выбор реализации — через ENV `XRAY_CLIENT=noop|grpc`. См. XrayModule.factory.
 *
 * Важно (§4a CLAUDE.md): через этот интерфейс мы НЕ запрашиваем ничего из
 * того, что выглядело бы как «история активности» клиента. Только AddUser,
 * RemoveUser и (опц.) GetClientStats — для биллинга агрегированного трафика.
 */
export interface XrayNodeClient {
  /**
   * Добавить клиента в инбаунд `inboundTag` ноды.
   * `identifier` — то, что Xray сохранит в поле `email`. Используем `subscription.id`,
   *  чтобы по идентификатору можно было найти клиента, но он не содержит ПДн.
   */
  addUser(node: Node, uuid: string, identifier: string): Promise<void>;

  /** Удалить клиента из инбаунда ноды. */
  removeUser(node: Node, identifier: string): Promise<void>;

  /**
   * Получить агрегированный трафик клиента (uplink + downlink в байтах).
   * Реализация может ничего не вернуть (нет API/нет данных) — это OK.
   */
  getClientStats?(
    node: Node,
    identifier: string,
  ): Promise<{ uplink: bigint; downlink: bigint } | null>;
}

export const XRAY_NODE_CLIENT = Symbol('XRAY_NODE_CLIENT');
