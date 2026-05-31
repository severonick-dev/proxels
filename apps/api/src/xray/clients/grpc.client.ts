import { Logger } from '@nestjs/common';
import { loadPackageDefinition, credentials, type Client } from '@grpc/grpc-js';
import { loadSync, type PackageDefinition } from '@grpc/proto-loader';
import * as path from 'node:path';
import type { Node } from '@prisma/client';
import type { XrayNodeClient } from '../xray.types.js';

// Корень с .proto-файлами относительно скомпилированного JS (dist/xray/clients).
// proto-loader умеет резолвить `import "common/..."` по includeDirs.
const PROTO_INCLUDE = path.resolve(__dirname, '..', 'protos');

const PROTO_FILES = [
  'app/proxyman/command/command.proto',
  'app/stats/command/command.proto',
  'common/protocol/user.proto',
  'common/serial/typed_message.proto',
  'proxy/vless/account.proto',
];

const PROTO_OPTS = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [PROTO_INCLUDE],
};

// Кэшируем загруженные protobuf-типы и собранные gRPC-клиенты — оба
// независимы от Node и переиспользуются между addUser/removeUser-вызовами.
let pkg: ReturnType<typeof loadGrpcPackages> | null = null;

interface HandlerServiceClient extends Client {
  AlterInbound(req: AlterInboundRequest, cb: (err: Error | null, res: unknown) => void): void;
}

interface StatsServiceClient extends Client {
  GetStats(
    req: { name: string; reset: boolean },
    cb: (err: Error | null, res: GetStatsResponse) => void,
  ): void;
}

interface TypedMessage {
  type: string;
  value: Buffer;
}

interface AlterInboundRequest {
  tag: string;
  operation: TypedMessage;
}

interface GetStatsResponse {
  stat?: { name: string; value: string };
}

interface UserMessage {
  level: number;
  email: string;
  account: TypedMessage;
}

interface VlessAccountMessage {
  id: string;
  encryption: string;
  flow: string;
}

interface AddUserOperationMessage {
  user: UserMessage;
}

interface RemoveUserOperationMessage {
  email: string;
}

interface ProtoType {
  encode(message: unknown): { finish(): Uint8Array };
  decode(buffer: Uint8Array): unknown;
}

interface LoadedPackages {
  HandlerServiceCtor: new (
    addr: string,
    creds: ReturnType<typeof credentials.createInsecure>,
  ) => HandlerServiceClient;
  StatsServiceCtor: new (
    addr: string,
    creds: ReturnType<typeof credentials.createInsecure>,
  ) => StatsServiceClient;
  AddUserOperationType: ProtoType;
  RemoveUserOperationType: ProtoType;
  VlessAccountType: ProtoType;
}

function navigate(root: unknown, dottedPath: string): unknown {
  return dottedPath.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, root);
}

function loadGrpcPackages(): LoadedPackages {
  const def: PackageDefinition = loadSync(PROTO_FILES, PROTO_OPTS);
  const loaded = loadPackageDefinition(def);

  const HandlerServiceCtor = navigate(loaded, 'xray.app.proxyman.command.HandlerService') as
    | LoadedPackages['HandlerServiceCtor']
    | undefined;
  const StatsServiceCtor = navigate(loaded, 'xray.app.stats.command.StatsService') as
    | LoadedPackages['StatsServiceCtor']
    | undefined;
  const AddUserOperationType = navigate(loaded, 'xray.app.proxyman.command.AddUserOperation') as
    | ProtoType
    | undefined;
  const RemoveUserOperationType = navigate(
    loaded,
    'xray.app.proxyman.command.RemoveUserOperation',
  ) as ProtoType | undefined;
  const VlessAccountType = navigate(loaded, 'xray.proxy.vless.Account') as ProtoType | undefined;

  if (
    !HandlerServiceCtor ||
    !StatsServiceCtor ||
    !AddUserOperationType ||
    !RemoveUserOperationType ||
    !VlessAccountType
  ) {
    throw new Error('Failed to load Xray protos: required services/types not found');
  }

  return {
    HandlerServiceCtor,
    StatsServiceCtor,
    AddUserOperationType,
    RemoveUserOperationType,
    VlessAccountType,
  };
}

function pkgs(): LoadedPackages {
  if (!pkg) pkg = loadGrpcPackages();
  return pkg;
}

// Кэш клиентов: один gRPC-канал на `xrayApiAddr`. gRPC сам делает keepalive.
const handlerCache = new Map<string, HandlerServiceClient>();
const statsCache = new Map<string, StatsServiceClient>();

function handlerFor(addr: string): HandlerServiceClient {
  const cached = handlerCache.get(addr);
  if (cached) return cached;
  const client = new (pkgs().HandlerServiceCtor)(addr, credentials.createInsecure());
  handlerCache.set(addr, client);
  return client;
}

function statsFor(addr: string): StatsServiceClient {
  const cached = statsCache.get(addr);
  if (cached) return cached;
  const client = new (pkgs().StatsServiceCtor)(addr, credentials.createInsecure());
  statsCache.set(addr, client);
  return client;
}

const CALL_DEADLINE_MS = 10_000;

/**
 * Реальный gRPC-клиент к Xray HandlerService + StatsService.
 *
 * Контракт API Xray:
 *   - AlterInbound(tag, operation=TypedMessage{type, value}) — где `type` это
 *     полное имя protobuf-сообщения, а `value` — байты этого сообщения.
 *   - Для добавления юзера в VLESS-инбаунд: operation = AddUserOperation{
 *     user = User{ email=subscriptionId, account=TypedMessage{
 *       type='xray.proxy.vless.Account', value=Account{id, flow, encryption} } } }
 *   - Для удаления: operation = RemoveUserOperation{ email=subscriptionId }.
 *
 * Безопасность канала RF↔DE: Xray gRPC API НЕ имеет встроенной auth.
 * На сервере DE открываем порт 10085 в firewall ТОЛЬКО для IP backend'а (см.
 * `docs/LAUNCH-MVP.md`). Это даёт «защиту по сети». mTLS — TODO.
 *
 * §4a (no-logs): мы НИКОГДА не дёргаем что-либо за пределами
 *   - AlterInbound (AddUserOperation/RemoveUserOperation)
 *   - StatsService.GetStats (только uplink/downlink байты per user)
 * Никаких per-destination, per-target, access-log запросов.
 */
export class GrpcXrayNodeClient implements XrayNodeClient {
  private readonly log = new Logger('GrpcXray');

  constructor(private readonly _apiToken: string) {
    // Токен передаётся через metadata Authorization, если на стороне ноды
    // стоит auth-proxy перед Xray API. Сейчас полагаемся на firewall — токен
    // используется как «маркер защиты» только если будет настроена доп. защита.
    if (!_apiToken) {
      throw new Error('GrpcXrayNodeClient requires XRAY_NODE_API_TOKEN');
    }
  }

  // -----------------------------------------------------------------

  async addUser(node: Node, uuid: string, identifier: string): Promise<void> {
    const { AddUserOperationType, VlessAccountType } = pkgs();

    // 1. Сериализуем VLESS Account
    const accountMsg: VlessAccountMessage = {
      id: uuid,
      encryption: 'none',
      flow: 'xtls-rprx-vision',
    };
    const accountBytes = Buffer.from(VlessAccountType.encode(accountMsg).finish());

    // 2. Сериализуем AddUserOperation с вложенным User
    const userMsg: UserMessage = {
      level: 0,
      email: identifier,
      account: {
        type: 'xray.proxy.vless.Account',
        value: accountBytes,
      },
    };
    const opMsg: AddUserOperationMessage = { user: userMsg };
    const opBytes = Buffer.from(AddUserOperationType.encode(opMsg).finish());

    // 3. Завернуть operation в TypedMessage и дёрнуть AlterInbound
    await this.callAlterInbound(node, {
      type: 'xray.app.proxyman.command.AddUserOperation',
      value: opBytes,
    });

    this.log.log({ nodeName: node.name, identifier, uuidPrefix: uuid.slice(0, 8) }, 'AddUser ok');
  }

  async removeUser(node: Node, identifier: string): Promise<void> {
    const { RemoveUserOperationType } = pkgs();

    const opMsg: RemoveUserOperationMessage = { email: identifier };
    const opBytes = Buffer.from(RemoveUserOperationType.encode(opMsg).finish());

    await this.callAlterInbound(node, {
      type: 'xray.app.proxyman.command.RemoveUserOperation',
      value: opBytes,
    });

    this.log.log({ nodeName: node.name, identifier }, 'RemoveUser ok');
  }

  // -----------------------------------------------------------------

  async getClientStats(
    node: Node,
    identifier: string,
  ): Promise<{ uplink: bigint; downlink: bigint } | null> {
    const client = statsFor(node.xrayApiAddr);

    const [uplink, downlink] = await Promise.all([
      this.getStat(client, `user>>>${identifier}>>>traffic>>>uplink`),
      this.getStat(client, `user>>>${identifier}>>>traffic>>>downlink`),
    ]);

    // Если Xray не знает такого юзера (никогда не подключался) — он вернёт
    // ошибку. Мы перехватываем и возвращаем null.
    if (uplink === null && downlink === null) return null;
    return {
      uplink: BigInt(uplink ?? 0),
      downlink: BigInt(downlink ?? 0),
    };
  }

  // -----------------------------------------------------------------

  private callAlterInbound(node: Node, operation: TypedMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = handlerFor(node.xrayApiAddr);
      const req: AlterInboundRequest = { tag: node.inboundTag, operation };

      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`Xray AlterInbound timeout @ ${node.xrayApiAddr}`));
      }, CALL_DEADLINE_MS);
      timer.unref();

      client.AlterInbound(req, (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private getStat(client: StatsServiceClient, name: string): Promise<number | null> {
    return new Promise((resolve) => {
      client.GetStats({ name, reset: false }, (err, res) => {
        if (err) {
          // Любая ошибка → null. Не ломаем флоу stats.
          resolve(null);
          return;
        }
        const v = res?.stat?.value;
        resolve(v ? Number(v) : 0);
      });
    });
  }
}
