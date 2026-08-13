import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { ClaimAccountForm } from './claim-form';
import { AcceptExisting } from './accept-existing';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const membership = await db.membership.findUnique({
    where: { inviteToken: token },
    include: { user: true, org: true },
  });

  if (!membership) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <h1 className="text-xl font-bold text-ink">Invite not found</h1>
        <p className="mt-2 text-sm text-ink-soft">This link isn&apos;t valid. Ask the business to send a new one.</p>
      </div>
    );
  }

  if (membership.status === 'ACTIVE') {
    return (
      <div className="mx-auto max-w-sm text-center">
        <h1 className="text-xl font-bold text-ink">Already accepted</h1>
        <p className="mt-2 text-sm text-ink-soft">
          This invite to {membership.org.name} has already been accepted.
        </p>
      </div>
    );
  }

  const sessionUser = await getSessionUser();
  const hasPassword = Boolean(membership.user.passwordHash);

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold tracking-tight">Join {membership.org.name}</h1>
      <p className="mt-1 text-sm text-ink-soft">
        You&apos;ve been invited as a subcontractor. Set up your login to start logging shifts.
      </p>

      <div className="card mt-6">
        {hasPassword ? (
          <AcceptExisting token={token} invitedEmail={membership.user.email} sessionEmail={sessionUser?.email ?? null} />
        ) : (
          <ClaimAccountForm token={token} email={membership.user.email} />
        )}
      </div>
    </div>
  );
}
