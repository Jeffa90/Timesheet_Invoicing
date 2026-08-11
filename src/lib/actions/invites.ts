'use server';

import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { AuthError } from 'next-auth';
import { signIn } from '@/lib/auth';
import { db } from '@/lib/db';
import { getPrimaryAdminOrg, requireSessionUser, getSessionUser } from '@/lib/session';
import { markOnboardingStepComplete } from '@/lib/actions/onboarding';

export interface InviteActionState {
  error?: string;
  invitedEmail?: string;
  inviteUrl?: string;
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  name: z.string().trim().optional(),
  rateCardId: z.string().min(1, 'Choose a rate card for this worker.'),
});

/**
 * Creates the worker's account if they don't have one yet (email-only, no
 * password — they claim it via the invite link), and an Engagement against the
 * chosen rate card straight away. Membership stays INVITED until they accept.
 */
export async function inviteWorkerAction(_prev: InviteActionState, formData: FormData): Promise<InviteActionState> {
  const user = await requireSessionUser();
  const org = await getPrimaryAdminOrg(user.id);
  if (!org) redirect('/onboarding/business');

  const parsed = inviteSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name') || undefined,
    rateCardId: formData.get('rateCardId'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }
  const { email, name, rateCardId } = parsed.data;

  const rateCard = await db.rateCard.findFirst({ where: { id: rateCardId, orgId: org.id } });
  if (!rateCard) return { error: 'Choose a valid rate card.' };

  let invitedUser = await db.user.findUnique({ where: { email } });
  if (!invitedUser) {
    invitedUser = await db.user.create({ data: { email, name: name || email } });
  }

  const existingMembership = await db.membership.findUnique({
    where: { orgId_userId: { orgId: org.id, userId: invitedUser.id } },
  });
  if (existingMembership?.status === 'ACTIVE') {
    return { error: 'That person is already part of your team.' };
  }

  const inviteToken = randomBytes(24).toString('base64url');

  await db.membership.upsert({
    where: { orgId_userId: { orgId: org.id, userId: invitedUser.id } },
    update: { inviteToken, status: 'INVITED', role: 'WORKER' },
    create: { orgId: org.id, userId: invitedUser.id, role: 'WORKER', status: 'INVITED', inviteToken },
  });

  await db.engagement.upsert({
    where: { orgId_userId: { orgId: org.id, userId: invitedUser.id } },
    update: { rateCardId: rateCard.id, active: true },
    create: { orgId: org.id, userId: invitedUser.id, rateCardId: rateCard.id, startDate: new Date() },
  });

  return {
    invitedEmail: email,
    inviteUrl: `/invite/${inviteToken}`,
  };
}

export async function finishInviteStepAction() {
  const user = await requireSessionUser();
  const org = await getPrimaryAdminOrg(user.id);
  if (org) await markOnboardingStepComplete(user.id, org.id, 'invite');
  redirect('/');
}

// --------------------------------------------------------------- accepting an invite

export interface AcceptInviteState {
  error?: string;
}

const claimSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
});

/** For an invitee who doesn't have a password yet — sets one and signs them in. */
export async function acceptInviteClaimAction(
  token: string,
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const membership = await db.membership.findUnique({ where: { inviteToken: token }, include: { user: true } });
  if (!membership || membership.status === 'ACTIVE') {
    return { error: 'This invite link is no longer valid.' };
  }
  if (membership.user.passwordHash) {
    return { error: 'This account already has a password — log in instead.' };
  }

  const parsed = claimSchema.safeParse({ name: formData.get('name'), password: formData.get('password') });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.user.update({ where: { id: membership.userId }, data: { name: parsed.data.name, passwordHash } });
  await db.membership.update({ where: { id: membership.id }, data: { status: 'ACTIVE', acceptedAt: new Date() } });

  try {
    await signIn('credentials', {
      email: membership.user.email,
      password: parsed.data.password,
      redirectTo: '/',
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) return { error: 'Invite accepted, but sign-in failed. Try logging in.' };
    throw error;
  }
}

/** For an invitee who already has an account — just flips the membership on. */
export async function acceptInviteExistingAction(token: string): Promise<AcceptInviteState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { error: 'Log in first, then open this invite link again.' };

  const membership = await db.membership.findUnique({ where: { inviteToken: token }, include: { user: true } });
  if (!membership || membership.status === 'ACTIVE') {
    return { error: 'This invite link is no longer valid.' };
  }
  if (membership.userId !== sessionUser.id) {
    return { error: `This invite was sent to ${membership.user.email}. Log in as that user to accept it.` };
  }

  await db.membership.update({ where: { id: membership.id }, data: { status: 'ACTIVE', acceptedAt: new Date() } });
  redirect('/');
}
