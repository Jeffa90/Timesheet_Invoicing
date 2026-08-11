import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getOnboardingContext } from '@/lib/actions/onboarding-context';
import { DEFAULT_CAPS } from '@/lib/pricing/defaults';
import { RateCardForm, type RateLineValue } from './form';

const DIMENSIONS: { dayType: 'WEEKDAY' | 'SATURDAY' | 'SUNDAY' | 'PUBLIC_HOLIDAY'; bandKey: 'DAY' | 'EVENING' | 'NIGHT' | null; capCents: number | null }[] = [
  { dayType: 'WEEKDAY', bandKey: 'DAY', capCents: DEFAULT_CAPS.weekdayDayCents },
  { dayType: 'WEEKDAY', bandKey: 'EVENING', capCents: DEFAULT_CAPS.weekdayEveningCents },
  { dayType: 'WEEKDAY', bandKey: 'NIGHT', capCents: DEFAULT_CAPS.weekdayNightCents },
  { dayType: 'SATURDAY', bandKey: null, capCents: DEFAULT_CAPS.saturdayCents },
  { dayType: 'SUNDAY', bandKey: null, capCents: DEFAULT_CAPS.sundayCents },
  { dayType: 'PUBLIC_HOLIDAY', bandKey: null, capCents: DEFAULT_CAPS.publicHolidayCents },
];

export default async function RatesStepPage() {
  const { org } = await getOnboardingContext();
  if (!org) redirect('/onboarding/business');

  const serviceTypes = await db.serviceType.findMany({ where: { orgId: org.id, active: true }, orderBy: { name: 'asc' } });
  if (serviceTypes.length === 0) redirect('/onboarding/services');

  const existingCard = await db.rateCard.findFirst({
    where: { orgId: org.id, status: 'ACTIVE' },
    include: { rates: true, sleepover: true, travel: true },
  });

  const existingLineFor = (serviceTypeId: string, dayType: string, bandKey: string | null) =>
    existingCard?.rates.find((r) => r.serviceTypeId === serviceTypeId && r.dayType === dayType && r.bandKey === bandKey);

  const rateLines: RateLineValue[] = serviceTypes.flatMap((service) =>
    DIMENSIONS.map((dim) => {
      const existing = existingLineFor(service.id, dim.dayType, dim.bandKey);
      // A flat-rate service (e.g. admin hours) isn't an NDIS catalogue item — no
      // published price cap, so it's always a flat $/h entered directly.
      const capCents = service.flatRate ? null : dim.capCents;
      return {
        serviceTypeId: service.id,
        serviceTypeName: service.name,
        dayType: dim.dayType,
        bandKey: dim.bandKey,
        flatRate: service.flatRate,
        method: existing?.method ?? (capCents ? 'PERCENT_OF_CAP' : 'ABSOLUTE'),
        amountCents: existing?.amountCents ?? (capCents ? null : 0),
        percentOfCap: existing?.percentOfCap ?? (capCents ? 100 : null),
        capCents: existing?.capCents ?? capCents,
      };
    }),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Set your rates</h1>
        <p className="mt-1 text-sm text-ink-soft">
          What you pay your subcontractors for each support, time of day and day type. Rates set
          as a percentage follow the NDIS price limit automatically; flat rates stay fixed until
          you change them here.
        </p>
      </div>

      <RateCardForm
        rateLines={rateLines}
        defaults={{
          name: existingCard?.name ?? `${org.name} — subcontractor rates`,
          classificationStrategy: existingCard?.classificationStrategy ?? 'SEGMENTED',
          roundingIncrementMin: existingCard?.roundingIncrementMin ?? 1,
          roundingMode: existingCard?.roundingMode ?? 'NEAREST',
          minimumEngagementMin: existingCard?.minimumEngagementMin ?? 120,
          sleepover: {
            enabled: existingCard?.sleepover?.enabled ?? true,
            spanHours: existingCard?.sleepover?.spanHours ?? 8,
            feeMethod: existingCard?.sleepover?.feeMethod ?? 'ABSOLUTE',
            feeCents: existingCard?.sleepover?.feeCents ?? null,
            feePercentOfCap: existingCard?.sleepover?.feePercentOfCap ?? null,
            feeCapCents: existingCard?.sleepover?.feeCapCents ?? DEFAULT_CAPS.sleepoverCents,
            includedActiveHours: existingCard?.sleepover?.includedActiveHours ?? 2,
            excessActiveDayType: (existingCard?.sleepover?.excessActiveDayType as
              | 'WEEKDAY'
              | 'SATURDAY'
              | 'SUNDAY'
              | 'PUBLIC_HOLIDAY'
              | 'PREVAILING') ?? 'SATURDAY',
            gstApplicable: existingCard?.sleepover?.gstApplicable ?? false,
          },
          travel: {
            perKmCents: existingCard?.travel?.perKmCents ?? 0,
            maxKmPerShift: existingCard?.travel?.maxKmPerShift ?? null,
            travelTimeMode: (existingCard?.travel?.travelTimeMode as 'NONE' | 'PREVAILING' | 'FLAT') ?? 'NONE',
            travelTimeFlatCentsPerHr: existingCard?.travel?.travelTimeFlatCentsPerHr ?? null,
            gstApplicable: existingCard?.travel?.gstApplicable ?? false,
          },
        }}
      />
    </div>
  );
}
