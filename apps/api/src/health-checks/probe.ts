import { connect } from 'node:net';

export interface ProbeResult {
  ok: boolean;
  /** TCP-handshake latency в мс. null если probe упал. */
  latencyMs: number | null;
}

/**
 * TCP-probe с измерением времени handshake. Открывает соединение к host:port,
 * фиксирует время до события `connect` (или возвращает ok=false на таймауте).
 *
 * Использование: backend проверяет доступность Xray gRPC API ноды по её
 * `xrayApiAddr` (например `203.0.113.10:10085`). `latencyMs` показывает
 * сетевую задержку RF→нода — идёт в админку как индикатор «скорости сети».
 *
 * Это **не** полный health-check Xray: мы не делаем gRPC-handshake (это
 * требует .proto и токена). TCP-connect — достаточно для базового failover.
 */
export async function tcpProbeWithLatency(addr: string, timeoutMs: number): Promise<ProbeResult> {
  const { host, port } = parseHostPort(addr);
  if (!host || !port) return { ok: false, latencyMs: null };

  return new Promise<ProbeResult>((resolve) => {
    let done = false;
    const startedAt = performance.now();
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      const latencyMs = ok ? Math.max(1, Math.round(performance.now() - startedAt)) : null;
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve({ ok, latencyMs });
    };

    const socket = connect({ host, port, timeout: timeoutMs }, () => finish(true));
    socket.on('error', () => finish(false));
    socket.on('timeout', () => finish(false));
    // Двойная страховка на случай зависшего сокета.
    const timer = setTimeout(() => finish(false), timeoutMs + 500);
    socket.on('close', () => clearTimeout(timer));
  });
}

/** Legacy-обёртка: возвращает только boolean. Сохранена для обратной совместимости. */
export async function tcpProbe(addr: string, timeoutMs: number): Promise<boolean> {
  const { ok } = await tcpProbeWithLatency(addr, timeoutMs);
  return ok;
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
