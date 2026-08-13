import type { RateCard, RateLine, ServiceType, SleepoverConfig, TravelConfig } from '@prisma/client';
import type { RateLineValue } from '@/components/rate-card-form';
import { DEFAULT_CAPS } from '@/lib/pricing/defaults';

export type ExistingRateCard = RateCard & {
  rates: RateLine[];
  sleepover: SleepoverConfig | null;
  travel: TravelConfig | null;
};

const DIMENSIONS: { dayType: 'WEEKDAY' | 'SATURDAY' | 'SUNDAY' | 'PUBLIC_HOLIDAY'; bandKey: 'DAY' | 'EVENING' | 'NIGHT' | null; capCents: number | null }[] = [
  { dayType: 'WEEKDAY', bandKey: 'DAY', capCents: DEFAULT_CAPS.weekdayDayCents },
  { dayType: 'WEEKDAY', bandKey: 'EVENING', capCents: DEFAULT_CAPS.weekdayEveningCents },
  { dayType: 'WEEKDAY', bandKey: 'NIGHT', capCents: DEFAULT_CAPS.weekdayNightCents },
  { dayType: 'SATURDAY', bandKey: null, capCents: DEFAULT_CAPS.saturdayCents },
  { dayType: 'SUNDAY', bandKey: null, capCents: DEFAULT_CAPS.sundayCents },
  { dayType: 'PUBLIC_HOLIDAY', bandKey: null, capCents: DEFAULT_CAPS.publicHolidayCents },
];

// One rate for the whole weekday instead of day/evening/night — same shape
// Saturday/Sunday/public holiday already use.
const DAILY_WEEKDAY_DIMENSION = { dayType: 'WEEKDAY' as const, bandKey: null, capCents: null };

/**
 * Builds the RateCardForm's rateLines/defaults props from a set of services and
 * (optionally) an existing rate card to prefill from — shared by the onboarding
 * wizard step and the business "add/edit a rate card" pages, so a new card and an
 * edited one build their initial rows identically.
 */
export function buildRateCardFormProps({
  defaultName,
  serviceTypes,
  existingCard,
  dailyRatesOnly,
}: {
  defaultName: string;
  serviceTypes: Pick<ServiceType, 'id' | 'name' | 'flatRate'>[];
  existingCard: ExistingRateCard | null;
  dailyRatesOnly: boolean;
}) {
  const weekdayDimensions = dailyRatesOnly ? [DAILY_WEEKDAY_DIMENSION] : DIMENSIONS.filter((d) => d.dayType === 'WEEKDAY');
  const dimensions = [...weekdayDimensions, ...DIMENSIONS.filter((d) => d.dayType !== 'WEEKDAY')];

  const existingLineFor = (serviceTypeId: string, dayType: string, bandKey: string | null) =>
    existingCard?.rates.find((r) => r.serviceTypeId === serviceTypeId && r.dayType === dayType && r.bandKey === bandKey);

  const rateLines: RateLineValue[] = serviceTypes.flatMap((service) =>
    dimensions.map((dim) => {
      const existing = existingLineFor(service.id, dim.dayType, dim.bandKey);
      // A flat-rate service (e.g. admin hours), or a daily-rate weekday row,
      // isn't an NDIS catalogue item — no published price cap, so it's
      // always a flat $/h entered directly.
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

  const defaults = {
    name: existingCard?.name ?? defaultName,
    dailyRatesOnly,
    classificationStrategy: existingCard?.classificationStrategy ?? ('SEGMENTED' as const),
    roundingIncrementMin: existingCard?.roundingIncrementMin ?? 1,
    roundingMode: existingCard?.roundingMode ?? ('NEAREST' as const),
    minimumEngagementMin: existingCard?.minimumEngagementMin ?? 120,
    sleepover: {
      enabled: existingCard?.sleepover?.enabled ?? true,
      spanHours: existingCard?.sleepover?.spanHours ?? 8,
      feeMethod: existingCard?.sleepover?.feeMethod ?? ('ABSOLUTE' as const),
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
  };

  return { rateLines, defaults };
}
