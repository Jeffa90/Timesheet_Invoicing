/**
 * Seeds a demo organisation, worker, rate card and public holiday calendar so the
 * app is explorable against a real database from the first `npm run db:seed`.
 *
 * Figures mirror src/lib/demo-data.ts. Two are explicitly placeholders (the weekday
 * night rate and the sleepover fee) — the setup wizard is where a real business
 * confirms these against the current NDIS Pricing Arrangements and Price Limits.
 */
import { PrismaClient } from '@prisma/client';
import { DEMO_HOLIDAYS, DEMO_ORG, DEMO_SERVICE_ID, DEMO_WORKER } from '../src/lib/demo-data';
import { DEFAULT_TIME_BANDS } from '../src/lib/pricing/defaults';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organisation.upsert({
    where: { id: 'demo-org' },
    update: {},
    create: {
      id: 'demo-org',
      name: DEMO_ORG.name,
      abn: DEMO_ORG.abn,
      gstRegistered: DEMO_ORG.gstRegistered,
      state: DEMO_ORG.state,
      timezone: DEMO_ORG.timezone,
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: 'admin@coastlinesupport.example' },
    update: {},
    create: {
      id: 'demo-admin',
      email: 'admin@coastlinesupport.example',
      name: 'Coastline Admin',
    },
  });

  await prisma.membership.upsert({
    where: { orgId_userId: { orgId: org.id, userId: owner.id } },
    update: {},
    create: { orgId: org.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' },
  });

  const worker = await prisma.user.upsert({
    where: { email: 'sam.rivera@example.com' },
    update: {},
    create: { id: 'demo-worker', email: 'sam.rivera@example.com', name: DEMO_WORKER.name },
  });

  await prisma.workerProfile.upsert({
    where: { userId: worker.id },
    update: {},
    create: {
      userId: worker.id,
      businessName: DEMO_WORKER.businessName,
      abn: DEMO_WORKER.abn,
      gstRegistered: DEMO_WORKER.gstRegistered,
    },
  });

  await prisma.membership.upsert({
    where: { orgId_userId: { orgId: org.id, userId: worker.id } },
    update: {},
    create: { orgId: org.id, userId: worker.id, role: 'WORKER', status: 'ACTIVE' },
  });

  const serviceType = await prisma.serviceType.upsert({
    where: { id: DEMO_SERVICE_ID },
    update: {},
    create: {
      id: DEMO_SERVICE_ID,
      orgId: org.id,
      name: 'Assistance With Self-Care Activities - Standard',
      ndisLineItemCode: '01_011_0107_1_1',
      unit: 'HOUR',
      gstApplicable: false,
    },
  });

  const rateCard = await prisma.rateCard.upsert({
    where: { id: 'demo-card' },
    update: {},
    create: {
      id: 'demo-card',
      orgId: org.id,
      name: 'Standard subcontractor rates — 80% of NDIS cap',
      status: 'ACTIVE',
      effectiveFrom: new Date('2025-07-01'),
      classificationStrategy: 'SEGMENTED',
      minimumEngagementMin: 120,
    },
  });

  for (const band of DEFAULT_TIME_BANDS) {
    await prisma.timeBand.upsert({
      where: { rateCardId_key: { rateCardId: rateCard.id, key: band.key } },
      update: {},
      create: {
        rateCardId: rateCard.id,
        key: band.key,
        startMinuteOfDay: band.startMinuteOfDay,
        endMinuteOfDay: band.endMinuteOfDay,
      },
    });
  }

  const rateLines: Array<{
    dayType: 'WEEKDAY' | 'SATURDAY' | 'SUNDAY' | 'PUBLIC_HOLIDAY';
    bandKey: 'DAY' | 'EVENING' | 'NIGHT' | null;
    method: 'ABSOLUTE' | 'PERCENT_OF_CAP';
    amountCents?: number;
    percentOfCap?: number;
    capCents?: number;
  }> = [
    { dayType: 'WEEKDAY', bandKey: 'DAY', method: 'PERCENT_OF_CAP', percentOfCap: 80, capCents: 7023 },
    { dayType: 'WEEKDAY', bandKey: 'EVENING', method: 'PERCENT_OF_CAP', percentOfCap: 80, capCents: 7738 },
    { dayType: 'WEEKDAY', bandKey: 'NIGHT', method: 'ABSOLUTE', amountCents: 6305 }, // placeholder, confirm in setup
    { dayType: 'SATURDAY', bandKey: null, method: 'PERCENT_OF_CAP', percentOfCap: 80, capCents: 9883 },
    { dayType: 'SUNDAY', bandKey: null, method: 'PERCENT_OF_CAP', percentOfCap: 80, capCents: 12743 },
    { dayType: 'PUBLIC_HOLIDAY', bandKey: null, method: 'PERCENT_OF_CAP', percentOfCap: 80, capCents: 15603 },
  ];

  // A plain findFirst + create/update rather than `upsert` on the composite unique key:
  // Prisma's compound-unique `where` input rejects `null` for a nullable field like
  // bandKey (SQL treats NULL as distinct in a unique index), so upsert can't target
  // the "applies all day" rate lines directly.
  for (const line of rateLines) {
    const existing = await prisma.rateLine.findFirst({
      where: {
        rateCardId: rateCard.id,
        serviceTypeId: serviceType.id,
        dayType: line.dayType,
        bandKey: line.bandKey,
      },
    });
    const data = {
      rateCardId: rateCard.id,
      serviceTypeId: serviceType.id,
      dayType: line.dayType,
      bandKey: line.bandKey,
      method: line.method,
      amountCents: line.amountCents,
      percentOfCap: line.percentOfCap,
      capCents: line.capCents,
    };
    if (existing) {
      await prisma.rateLine.update({ where: { id: existing.id }, data });
    } else {
      await prisma.rateLine.create({ data });
    }
  }

  await prisma.sleepoverConfig.upsert({
    where: { rateCardId: rateCard.id },
    update: {},
    create: {
      rateCardId: rateCard.id,
      enabled: true,
      spanHours: 8,
      feeMethod: 'ABSOLUTE',
      feeCents: 22000, // placeholder, confirm in setup
      includedActiveHours: 2,
      excessActiveDayType: 'SATURDAY',
      gstApplicable: false,
    },
  });

  await prisma.travelConfig.upsert({
    where: { rateCardId: rateCard.id },
    update: {},
    create: { rateCardId: rateCard.id, perKmCents: 100, maxKmPerShift: 50 },
  });

  await prisma.engagement.upsert({
    where: { id: 'demo-engagement' },
    update: {},
    create: {
      id: 'demo-engagement',
      orgId: org.id,
      userId: worker.id,
      rateCardId: rateCard.id,
      startDate: new Date('2025-07-01'),
    },
  });

  for (const holiday of DEMO_HOLIDAYS) {
    await prisma.publicHoliday.upsert({
      where: { date_state: { date: new Date(holiday.date), state: DEMO_ORG.state } },
      update: {},
      create: { date: new Date(holiday.date), name: holiday.name, state: DEMO_ORG.state },
    });
  }

  console.log(`Seeded ${org.name}, worker ${worker.name}, rate card "${rateCard.name}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
