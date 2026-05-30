/* eslint-disable no-console */
import { Locale, PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { seedLegalDocs } from './seed-legal.js';

/**
 * Идемпотентный seed для dev/staging.
 *
 *  - Тарифы (Plan): 4 базовых периода (1/3/6/12 мес).
 *  - Юр.документы (LegalDoc): privacy / offer / cookie с версией CONSENT_VERSIONS.
 *  - Админ: создаётся только если заданы SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD.
 *
 * На прод-серверах админа лучше создавать отдельной CLI-командой (Этап 12).
 */

const prisma = new PrismaClient();

interface PlanSeed {
  name: string;
  priceRub: number;
  durationDays: number;
  trafficLimitGb: number | null;
  sortOrder: number;
}

const PLANS: PlanSeed[] = [
  { name: '1 месяц', priceRub: 150, durationDays: 30, trafficLimitGb: null, sortOrder: 0 },
  { name: '3 месяца', priceRub: 400, durationDays: 90, trafficLimitGb: null, sortOrder: 1 },
  { name: '6 месяцев', priceRub: 750, durationDays: 180, trafficLimitGb: null, sortOrder: 2 },
  { name: '12 месяцев', priceRub: 1400, durationDays: 365, trafficLimitGb: null, sortOrder: 3 },
];

async function seedPlans(): Promise<void> {
  for (const plan of PLANS) {
    const existing = await prisma.plan.findFirst({ where: { name: plan.name } });
    if (existing) {
      await prisma.plan.update({
        where: { id: existing.id },
        data: {
          priceRub: plan.priceRub,
          durationDays: plan.durationDays,
          trafficLimitGb: plan.trafficLimitGb,
          sortOrder: plan.sortOrder,
          isActive: true,
        },
      });
      console.log(`  ↻ plan "${plan.name}" updated`);
    } else {
      await prisma.plan.create({ data: { ...plan, isActive: true } });
      console.log(`  ✓ plan "${plan.name}" created`);
    }
  }
}

async function seedAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    console.log('  (skipped admin seed — set SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD to seed)');
    return;
  }
  if (password.length < 10) {
    throw new Error('SEED_ADMIN_PASSWORD must be >= 10 chars');
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  });

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: UserRole.admin,
        emailVerified: true,
        passwordHash,
        emailVerifyToken: null,
        deletedAt: null,
      },
    });
    console.log(`  ↻ admin "${email}" updated`);
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: UserRole.admin,
        locale: Locale.ru,
        emailVerified: true,
        consentPdnAt: new Date(),
        consentPdnVersion: '2026-05-30',
      },
    });
    console.log(`  ✓ admin "${email}" created`);
  }
}

async function main(): Promise<void> {
  console.log('Seeding plans:');
  await seedPlans();
  console.log('Seeding legal documents:');
  await seedLegalDocs(prisma);
  console.log('Seeding admin (optional):');
  await seedAdmin();
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
