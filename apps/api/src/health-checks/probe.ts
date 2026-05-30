import { connect } from 'node:net';

/**
 * Простой TCP-probe: открыть соединение к host:port, дождаться `connect` или
 * упасть на таймауте.
 *
 * Использование: backend проверяет доступность Xray gRPC API ноды по её
 * `xrayApiAddr` (например `203.0.113.10:10085`). Если порт открыт — нода
 * считается потенциально живой.
 *
 * Это **не** полный health-check Xray: мы не делаем gRPC-handshake (это
 * требует .proto и токена). TCP-connect — достаточно для базового failover.
 * Полноценный gRPC ping добавим, когда дожмём `GrpcXrayNodeClient` на Этапе 13.
 */
export async function tcpProbe(addr: string, timeoutMs: number): Promise<boolean> {
  const { host, port } = parseHostPort(addr);
  if (!host || !port) return false;

  return new Promise<boolean>((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(ok);
    };

    const socket = connect({ host, port, timeout: timeoutMs }, () => finish(true));
    socket.on('error', () => finish(false));
    socket.on('timeout', () => finish(false));
    // Двойная страховка на случай зависшего сокета.
    const timer = setTimeout(() => finish(false), timeoutMs + 500);
    socket.on('close', () => clearTimeout(timer));
  });
}

function parseHostPort(addr: string): { host: string; port: number } {
  const lastColon = addr.lastIndexOf(':');
  if (lastColon <= 0) return { host: '', port: 0 };
  const host = addr.slice(0, lastColon).trim();
  const port = Number(addr.slice(lastColon + 1));
  if (!host || !Number.isInteger(port) || port < 1 || port > 65_535) {
    return { host: '', port: 0 };
  }
  return { host, port };
}
