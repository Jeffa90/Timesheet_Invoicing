'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { AU_STATES, AU_TIMEZONES } from '@/lib/pricing/defaults';
import { db } from '@/lib/db';
import { getPrimaryAdminOrg, requireSessionUser } from '@/lib/session';
import { markOnboardingStepComplete } from '@/lib/actions/onboarding';

const orgSchema = z.object({
  name: z.string().trim().min(1, 'Enter the business name.'),
  legalName: z.string().trim().optional(),
  abn: z.string().trim().min(1, 'Enter the ABN.'),
  gstRegistered: z.boolean(),
  addressLine1: z.string().trim().optional(),
  suburb: z.string().trim().optional(),
  state: z.enum(AU_STATES),
  postcode: z.string().trim().optional(),
  invoiceTermsDays: z.coerce.number().int().min(0).max(90),
});

export interface OrgActionState {
  error?: string;
}

export async function saveOrganisationAction(_prev: OrgActionState, formData: FormData): Promise<OrgActionState> {
  const user = await requireSessionUser();

  const parsed = orgSchema.safeParse({
    name: formData.get('name'),
    legalName: formData.get('legalName') || undefined,
    abn: formData.get('abn'),
    gstRegistered: formData.get('gstRegistered') === 'on',
    addressLine1: formData.get('addressLine1') || undefined,
    suburb: formData.get('suburb') || undefined,
    state: formData.get('state'),
    postcode: formData.get('postcode') || undefined,
    invoiceTermsDays: formData.get('invoiceTermsDays'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }
  const data = parsed.data;
  const timezone = AU_TIMEZONES[data.state];

  const existing = await getPrimaryAdminOrg(user.id);

  const org = existing
    ? await db.organisation.update({ where: { id: existing.id }, data: { ...data, timezone } })
    : await db.organisation.create({ data: { ...data, timezone } });

  if (!existing) {
    await db.membership.create({
      data: { orgId: org.id, userId: user.id, role: 'OWNER', status: 'ACTIVE', acceptedAt: new Date() },
    });
  }

  await markOnboardingStepComplete(user.id, org.id, 'business');

  redirect('/onboarding/services');
}
