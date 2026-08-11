'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireSessionUser } from '@/lib/session';

const profileSchema = z.object({
  businessName: z.string().trim().optional(),
  abn: z.string().trim().optional(),
  acn: z.string().trim().optional(),
  gstRegistered: z.boolean(),
  hasHecsDebt: z.boolean(),
  phone: z.string().trim().optional(),
  addressLine1: z.string().trim().optional(),
  suburb: z.string().trim().optional(),
  state: z.string().trim().optional(),
  postcode: z.string().trim().optional(),
  bankBsb: z.string().trim().optional(),
  bankAccountNumber: z.string().trim().optional(),
  bankAccountName: z.string().trim().optional(),
});

export interface WorkerProfileState {
  error?: string;
  saved?: boolean;
}

/**
 * A worker's own invoicing details — separate from any single business, since it
 * follows them across every organisation they subcontract to. Everything an
 * Australian tax invoice needs from the issuer lives here: identity, ABN/ACN,
 * address, contact details, and where payment should land.
 */
export async function saveWorkerProfileAction(
  _prev: WorkerProfileState,
  formData: FormData,
): Promise<WorkerProfileState> {
  const user = await requireSessionUser();

  const parsed = profileSchema.safeParse({
    businessName: formData.get('businessName') || undefined,
    abn: formData.get('abn') || undefined,
    acn: formData.get('acn') || undefined,
    gstRegistered: formData.get('gstRegistered') === 'on',
    hasHecsDebt: formData.get('hasHecsDebt') === 'on',
    phone: formData.get('phone') || undefined,
    addressLine1: formData.get('addressLine1') || undefined,
    suburb: formData.get('suburb') || undefined,
    state: formData.get('state') || undefined,
    postcode: formData.get('postcode') || undefined,
    bankBsb: formData.get('bankBsb') || undefined,
    bankAccountNumber: formData.get('bankAccountNumber') || undefined,
    bankAccountName: formData.get('bankAccountName') || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  await db.workerProfile.upsert({
    where: { userId: user.id },
    update: parsed.data,
    create: { userId: user.id, ...parsed.data },
  });

  revalidatePath('/invoice');
  revalidatePath('/profile');
  return { saved: true };
}
