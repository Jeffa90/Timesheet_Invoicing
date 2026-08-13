import Link from 'next/link';
import { DateTime } from 'luxon';
import { db } from '@/lib/db';
import { formatRange } from '@/lib/pricing/time';
import { formatInvoiceDate } from '@/lib/invoice';
import { getWorkerEngagements, requireSessionUser } from '@/lib/session';
import { ShiftsList } from './shifts-list';

export default async function ShiftsPage() {
  const user = await requireSessionUser();
  const engagements = await getWorkerEngagements(user.id);

  if (engagements.length === 0) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-bold tracking-tight">No shifts yet</h1>
        <p className="mt-3 text-sm text-ink-soft">
          You&apos;ll see everything you&apos;ve logged here once you have an active engagement.
        </p>
      </div>
    );
  }

  const activeEngagement = engagements[0];
  const shifts = await db.shift.findMany({
    where: { orgId: activeEngagement.orgId, userId: user.id },
    include: { serviceType: true },
    orderBy: { startUtc: 'desc' },
  });

  if (shifts.length === 0) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-bold tracking-tight">No shifts logged yet</h1>
        <p className="mt-3 text-sm text-ink-soft">Shifts you log for {activeEngagement.org.name} will show up here.</p>
        <Link href="/" className="btn-primary mt-4 inline-flex">
          Log a shift
        </Link>
      </div>
    );
  }

  const timezone = activeEngagement.org.timezone;
  const shiftSummaries = shifts.map((shift) => {
    const start = DateTime.fromJSDate(shift.startUtc).setZone(timezone);
    const end = DateTime.fromJSDate(shift.endUtc).setZone(timezone);
    return {
      id: shift.id,
      date: formatInvoiceDate(start.toISODate()!, timezone),
      timeRange: formatRange(start, end),
      serviceTypeName: shift.serviceType.name,
      totalCents: shift.totalCents,
      status: shift.status as 'SUBMITTED' | 'INVOICED' | 'DRAFT' | 'APPROVED' | 'REJECTED',
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My shifts</h1>
        <p className="mt-1 text-sm text-ink-soft">
          For {activeEngagement.org.name}. Tick the shifts you want on your next invoice — anything
          not yet invoiced can still be edited or deleted.
        </p>
      </div>

      <ShiftsList orgId={activeEngagement.orgId} shifts={shiftSummaries} />
    </div>
  );
}
