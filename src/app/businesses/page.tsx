import { EmployerDetailsCard } from './employer-details-card';
import { getWorkerEngagements, requireSessionUser } from '@/lib/session';

export default async function BusinessesPage() {
  const user = await requireSessionUser();
  const engagements = await getWorkerEngagements(user.id);

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Businesses</h1>
        <p className="mt-1 text-sm text-ink-soft">
          The businesses you&apos;re engaged with, and what each currently has on file — this is
          what a new invoice to them would use today. If something here looks wrong, ask them to
          update it on their end; you can&apos;t edit it here. Note it won&apos;t match an invoice
          you&apos;ve already generated if they changed something afterward — each invoice keeps
          whatever was true on the day it was issued.
        </p>
      </div>

      {engagements.length === 0 ? (
        <p className="text-sm text-ink-soft">
          You&apos;re not currently engaged by a business on this app. Ask them for an invite link
          to get set up.
        </p>
      ) : (
        <div className="space-y-3">
          {engagements.map((e) => (
            <EmployerDetailsCard key={e.id} org={e.org} />
          ))}
        </div>
      )}
    </div>
  );
}
