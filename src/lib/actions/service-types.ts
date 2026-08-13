'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getPrimaryAdminOrg, requireSessionUser } from '@/lib/session';
import { markOnboardingStepComplete } from '@/lib/actions/onboarding';

const serviceTypeSchema = z.object({
  id: z.string().optional(), // present when editing an existing row
  name: z.string().trim().min(1),
  ndisLineItemCode: z.string().trim().optional(),
  gstApplicable: z.boolean(),
  flatRate: z.boolean(),
});

const formSchema = z.object({ serviceTypes: z.array(serviceTypeSchema).min(1) });
const modeSchema = z.enum(['onboarding', 'manage']);

export interface ServiceTypesActionState {
  error?: string;
}

/**
 * The wizard submits the whole list as one JSON blob (a hidden field built up by the
 * client) rather than N separate named fields, since the number of rows is dynamic.
 *
 * mode 'onboarding' (default): the setup wizard's original behaviour — continue on
 * to the rates step. mode 'manage': a business adding/editing services after setup
 * is already complete (e.g. adding an Admin Hours support later) — stays on the
 * services page instead of re-entering the wizard.
 */
export async function saveServiceTypesAction(
  _prev: ServiceTypesActionState,
  formData: FormData,
): Promise<ServiceTypesActionState> {
  const user = await requireSessionUser();
  const org = await getPrimaryAdminOrg(user.id);
  if (!org) redirect('/onboarding/business');

  const mode = modeSchema.catch('onboarding').parse(formData.get('mode'));

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get('serviceTypes') ?? '[]'));
  } catch {
    return { error: 'Something went wrong reading the form. Try again.' };
  }

  const parsed = formSchema.safeParse({ serviceTypes: raw });
  if (!parsed.success) {
    return { error: 'Every service needs at least a name.' };
  }

  const keepIds: string[] = [];
  for (const st of parsed.data.serviceTypes) {
    if (st.id) {
      await db.serviceType.update({
        where: { id: st.id },
        data: {
          name: st.name,
          ndisLineItemCode: st.ndisLineItemCode || null,
          gstApplicable: st.gstApplicable,
          flatRate: st.flatRate,
        },
      });
      keepIds.push(st.id);
    } else {
      const created = await db.serviceType.create({
        data: {
          orgId: org.id,
          name: st.name,
          ndisLineItemCode: st.ndisLineItemCode || null,
          gstApplicable: st.gstApplicable,
          flatRate: st.flatRate,
          unit: 'HOUR',
        },
      });
      keepIds.push(created.id);
    }
  }
  // Anything removed in the wizard is deactivated rather than deleted, so it can't
  // orphan rate lines or historical shifts that already reference it.
  await db.serviceType.updateMany({
    where: { orgId: org.id, id: { notIn: keepIds } },
    data: { active: false },
  });

  if (mode === 'onboarding') {
    await markOnboardingStepComplete(user.id, org.id, 'services');
    redirect('/onboarding/rates');
  }
  redirect('/business/services');
}
