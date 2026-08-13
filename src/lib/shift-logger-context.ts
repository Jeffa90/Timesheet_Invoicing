import { db } from '@/lib/db';
import { toRateCardSnapshot } from '@/lib/rate-card-mapper';
import { getWorkerEngagements } from '@/lib/session';

/**
 * Everything the ShiftLogger component needs, built the same way for both the
 * home page (logging a new shift) and the edit-shift page — so a shift edited
 * from a different business than the one that happens to load first still
 * gets priced against the right rate card, service list and holiday calendar.
 */
export async function loadShiftLoggerProps(userId: string, preferredOrgId?: string) {
  const engagements = await getWorkerEngagements(userId);
  if (engagements.length === 0) return { kind: 'no-engagements' as const };

  const workerProfile = await db.workerProfile.findUnique({ where: { userId } });
  if (!workerProfile) return { kind: 'no-profile' as const };

  const activeEngagement = engagements.find((e) => e.orgId === preferredOrgId) ?? engagements[0];

  const [serviceTypes, allServiceTypes, holidays] = await Promise.all([
    db.serviceType.findMany({ where: { orgId: activeEngagement.orgId, active: true }, orderBy: { name: 'asc' } }),
    db.serviceType.findMany({ where: { orgId: activeEngagement.orgId } }),
    db.publicHoliday.findMany({ where: { state: activeEngagement.org.state ?? undefined } }),
  ]);
  const serviceTypeGst = Object.fromEntries(allServiceTypes.map((s) => [s.id, s.gstApplicable]));

  return {
    kind: 'ready' as const,
    props: {
      engagements: engagements.map((e) => ({ orgId: e.orgId, orgName: e.org.name, timezone: e.org.timezone })),
      activeOrgId: activeEngagement.orgId,
      timezone: activeEngagement.org.timezone,
      serviceTypes: serviceTypes.map((s) => ({ id: s.id, name: s.name, flatRate: s.flatRate })),
      rateCard: toRateCardSnapshot(activeEngagement.rateCard, serviceTypeGst),
      holidays: holidays.map((h) => ({ date: h.date.toISOString().slice(0, 10), name: h.name })),
      gstRegistered: workerProfile.gstRegistered,
    },
  };
}
