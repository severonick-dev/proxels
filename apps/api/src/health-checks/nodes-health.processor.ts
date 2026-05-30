import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { EnvService } from '../config/env.service.js';
import { NodesHealthService } from './nodes-health.service.js';

export const HEALTH_QUEUE = 'nodes-health';
export const HEALTH_JOB = 'probe-all';
const REPEAT_KEY = 'proxels-nodes-health-repeat';

@Processor(HEALTH_QUEUE)
export class NodesHealthProcessor extends WorkerHost implements OnModuleInit {
  private readonly log = new Logger('NodesHealthWorker');

  constructor(
    @InjectQueue(HEALTH_QUEUE) private readonly queue: Queue,
    private readonly env: EnvService,
    private readonly nodesHealth: NodesHealthService,
  ) {
    super();
  }

  /**
   * При старте — устанавливаем (или подтверждаем) repeatable job.
   * Если такой ключ уже есть в Redis (после перезапуска), BullMQ его не дублирует.
   */
  async onModuleInit(): Promise<void> {
    const intervalMs = this.env.get('HEALTH_CHECK_INTERVAL_SECONDS') * 1000;
    // Снимаем все старые repeatable-задачи под нашим ключом — на случай если
    // в dev был другой интервал, чтобы не плодить призраков.
    const existing = await this.queue.getRepeatableJobs();
    for (const j of existing) {
      if (j.id === REPEAT_KEY || j.name === HEALTH_JOB) {
        await this.queue.removeRepeatableByKey(j.key);
      }
    }
    await this.queue.add(
      HEALTH_JOB,
      {},
      {
        repeat: { every: intervalMs },
        jobId: REPEAT_KEY,
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    );
    this.log.log(`Scheduled health-check every ${intervalMs}ms`);

    // Сразу один прогон, чтобы сократить «холодное окно» после рестарта.
    await this.nodesHealth.probeAll().catch((err) => {
      this.log.warn(`Initial probeAll failed: ${(err as Error).message}`);
    });
  }

  async process(_job: Job): Promise<void> {
    await this.nodesHealth.probeAll();
  }
}
