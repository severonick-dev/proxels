import { Injectable, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { EnvService } from '../config/env.service.js';

const execFileAsync = promisify(execFile);

const GIT_TIMEOUT_MS = 15_000;

/** Разрешённые цели деплоя: semver-тег `vX.Y.Z`/`X.Y.Z` или ветка `main`. */
const REF_REGEX = /^(?:main|v?\d{1,3}\.\d{1,3}\.\d{1,3}(?:-[a-z0-9.-]+)?)$/i;

export interface GitStatus {
  sha: string;
  shortSha: string;
  tag: string | null;
  branch: string;
  date: string;
}

export interface RemoteStatus {
  /** Самый «свежий» semver-тег на origin (по версионному порядку). */
  latestTag: string | null;
  latestSha: string | null;
  /** Все semver-теги на origin, отсортированные по убыванию. */
  tags: { tag: string; sha: string }[];
}

export interface DeployStatus {
  current: GitStatus;
  remote: RemoteStatus;
  hasUpdate: boolean;
  remoteUrl: string;
  deployEnabled: boolean;
  /** Информация о последнем/текущем запуске (если есть). */
  lastRun: LastRunInfo | null;
}

export interface LastRunInfo {
  runId: string;
  ref: string;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  running: boolean;
}

export interface DeployLogTail {
  running: boolean;
  exitCode: number | null;
  lines: string[];
}

@Injectable()
export class DeployService {
  private readonly log = new Logger('Deploy');
  private currentRun: LastRunInfo | null = null;

  constructor(private readonly env: EnvService) {}

  // --------------------------------------------------------------- утилиты

  private get repoDir(): string {
    const fromEnv = this.env.get('DEPLOY_REPO_DIR');
    if (fromEnv) return fromEnv;
    // По умолчанию repo-корень — `<cwd>/../..` (cwd обычно `apps/api`).
    return path.resolve(process.cwd(), '..', '..');
  }

  private get logDir(): string {
    return this.env.get('DEPLOY_LOG_DIR');
  }

  private async git(args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', ['-C', this.repoDir, ...args], {
        timeout: GIT_TIMEOUT_MS,
        maxBuffer: 4 * 1024 * 1024,
      });
      return stdout.trim();
    } catch (err) {
      const e = err as { stderr?: string; message?: string };
      throw new Error(`git ${args.join(' ')} failed: ${e.stderr ?? e.message ?? err}`);
    }
  }

  // --------------------------------------------------------------- статус

  async getStatus(): Promise<DeployStatus> {
    const [sha, branch, date, remoteUrl] = await Promise.all([
      this.git(['rev-parse', 'HEAD']),
      this.git(['rev-parse', '--abbrev-ref', 'HEAD']),
      this.git(['log', '-1', '--format=%cI']),
      this.git(['config', '--get', 'remote.origin.url']).catch(() => ''),
    ]);

    let tag: string | null = null;
    try {
      tag = await this.git(['describe', '--tags', '--exact-match', 'HEAD']);
    } catch {
      tag = null;
    }

    const current: GitStatus = {
      sha,
      shortSha: sha.slice(0, 7),
      tag,
      branch,
      date,
    };

    const remote = await this.fetchRemoteTags().catch((e) => {
      this.log.warn(
        { err: (e as Error).message },
        'Failed to query remote tags — returning empty remote',
      );
      return { latestTag: null, latestSha: null, tags: [] } satisfies RemoteStatus;
    });

    const hasUpdate =
      remote.latestTag !== null &&
      current.tag !== remote.latestTag &&
      current.sha !== remote.latestSha;

    return {
      current,
      remote,
      hasUpdate,
      remoteUrl: sanitizeRemoteUrl(remoteUrl),
      deployEnabled: this.env.get('DEPLOY_ENABLED'),
      lastRun: this.currentRun,
    };
  }

  async fetchRemoteTags(): Promise<RemoteStatus> {
    const raw = await this.git(['ls-remote', '--tags', '--refs', 'origin']);
    const parsed: { tag: string; sha: string }[] = [];
    for (const line of raw.split('\n')) {
      const m = line.match(/^([0-9a-f]{40})\s+refs\/tags\/(\S+)$/);
      if (!m) continue;
      const sha = m[1];
      const tag = m[2];
      if (!sha || !tag) continue;
      if (!isSemverTag(tag)) continue;
      parsed.push({ tag, sha });
    }
    parsed.sort((a, b) => compareSemverTag(b.tag, a.tag));
    return {
      latestTag: parsed[0]?.tag ?? null,
      latestSha: parsed[0]?.sha ?? null,
      tags: parsed,
    };
  }

  // --------------------------------------------------------------- run

  /**
   * Триггер деплоя: запускает `deploy.sh <ref>` в detached-режиме, направляет
   * stdout/stderr в файл лога, возвращает runId. UI потом тейлит логи.
   *
   * Гарантии:
   *  - DEPLOY_ENABLED обязателен (в dev → 403).
   *  - Параллельные запуски запрещены — пока `currentRun.running`, второй
   *    запуск → 400.
   *  - Ref валидируется regex'ом (semver-тег или `main`).
   */
  async triggerDeploy(args: { ref: string }): Promise<LastRunInfo> {
    if (!this.env.get('DEPLOY_ENABLED')) {
      throw new ForbiddenException('Deploy is disabled (DEPLOY_ENABLED=false)');
    }
    if (!REF_REGEX.test(args.ref)) {
      throw new BadRequestException('Invalid ref (expected semver tag or "main")');
    }
    if (this.currentRun?.running) {
      throw new BadRequestException('A deploy is already in progress');
    }

    const scriptPath = this.env.get('DEPLOY_SCRIPT');
    try {
      await fs.access(scriptPath);
    } catch {
      throw new ForbiddenException(`Deploy script not found at ${scriptPath}`);
    }

    await fs.mkdir(this.logDir, { recursive: true });

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const logFile = path.join(this.logDir, `deploy-${runId}.log`);
    const currentLink = path.join(this.logDir, 'current.log');

    const out = await fs.open(logFile, 'a');
    const header = `[${new Date().toISOString()}] run=${runId} ref=${args.ref} script=${scriptPath}\n`;
    await out.write(header);

    const child = spawn(scriptPath, [args.ref], {
      cwd: this.repoDir,
      detached: true,
      stdio: ['ignore', out.fd, out.fd],
      env: { ...process.env, PROXELS_DEPLOY_RUN_ID: runId },
    });

    const run: LastRunInfo = {
      runId,
      ref: args.ref,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      exitCode: null,
      running: true,
    };
    this.currentRun = run;

    // current.log — всегда указывает на самый свежий запуск.
    try {
      await fs.rm(currentLink, { force: true });
      await fs.symlink(logFile, currentLink);
    } catch (err) {
      // На Windows symlink требует прав. Откатываемся на копию пути в файл.
      this.log.warn({ err: (err as Error).message }, 'symlink failed — using marker file');
      await fs.writeFile(currentLink, logFile);
    }

    child.on('exit', (code) => {
      run.exitCode = code;
      run.finishedAt = new Date().toISOString();
      run.running = false;
      out.close().catch(() => undefined);
      this.log.log(`deploy ${runId} exited with ${code}`);
    });
    child.unref();

    return run;
  }

  // --------------------------------------------------------------- лог

  async tailLog(lines = 200): Promise<DeployLogTail> {
    const currentLink = path.join(this.logDir, 'current.log');
    let target: string | null = null;
    try {
      const st = await fs.lstat(currentLink);
      if (st.isSymbolicLink()) {
        target = await fs.readlink(currentLink);
        // Если symlink относительный — резолвим к logDir
        if (!path.isAbsolute(target)) target = path.join(this.logDir, target);
      } else {
        // На Windows у нас обычный файл с путём внутри.
        target = (await fs.readFile(currentLink, 'utf-8')).trim();
      }
    } catch {
      return { running: false, exitCode: null, lines: [] };
    }

    let content = '';
    try {
      content = await fs.readFile(target, 'utf-8');
    } catch {
      return { running: false, exitCode: null, lines: [] };
    }

    const all = content.split(/\r?\n/);
    return {
      running: this.currentRun?.running ?? false,
      exitCode: this.currentRun?.exitCode ?? null,
      lines: all.slice(-lines),
    };
  }
}

// ---------------------------------------------------------------------------

function isSemverTag(tag: string): boolean {
  return /^v?\d{1,3}\.\d{1,3}\.\d{1,3}(?:-[a-z0-9.-]+)?$/i.test(tag);
}

/** Возвращает >0 если a новее b. */
function compareSemverTag(a: string, b: string): number {
  const pa = parseSemverTag(a);
  const pb = parseSemverTag(b);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  // pre-release: его наличие делает версию старше (1.0.0-rc < 1.0.0)
  const sa = a.split('-').slice(1).join('-');
  const sb = b.split('-').slice(1).join('-');
  if (sa && !sb) return -1;
  if (!sa && sb) return 1;
  return sa.localeCompare(sb);
}

function parseSemverTag(tag: string): [number, number, number] {
  const cleaned = tag.replace(/^v/i, '').split('-')[0] ?? '';
  const parts = cleaned.split('.').map((n) => parseInt(n, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/** Скрываем токен в HTTPS-URL, если он там есть. */
function sanitizeRemoteUrl(url: string): string {
  return url.replace(/https?:\/\/[^/@]*@/, 'https://***@');
}
