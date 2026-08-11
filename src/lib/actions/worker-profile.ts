'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireSessionUser } from '@/lib/session';

const profileSchema = z.object({
  businessName: z.string().trim().optional(),
  abn: z.string().trim().optional(),
  gstRegistered: z.boolean(),
  bankBsb: z.string().trim().optional(),
  bankAccountNumber: z.string().trim().optional(),
  bankAccountName: z.string().trim().optional(),
});

export interface WorkerProfileState {
  error?: string;
}

/**
 * A worker's own invoicing details — separate from any single business, since it
 * follows them across every organisation they subcontract to.
 */
export async function saveWorkerProfileAction(
  _prev: WorkerProfileState,
  formData: FormData,
): Promise<WorkerProfileState> {
  const user = await requireSessionUser();

  const parsed = profileSchema.safeParse({
    businessName: formData.get('businessName') || undefined,
    abn: formData.get('abn') || undefined,
    gstRegistered: formData.get('gstRegistered') === 'on',
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
  return {};
}
