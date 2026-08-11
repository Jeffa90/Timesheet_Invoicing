'use server';

import { DateTime } from 'luxon';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { buildInvoice, nextInvoiceNumber } from '@/lib/invoice';
import type { PricingResult } from '@/lib/pricing/types';
import { requireSessionUser } from '@/lib/session';

export interface GenerateInvoiceState {
  error?: string;
  invoiceId?: string;
}

const schema = z.object({ orgId: z.string().min(1) });

/**
 * Invoices every shift the worker has logged against this business that isn't
 * already on an invoice. There's no date-range picker: log shifts, then invoice
 * whatever's outstanding — splitting into custom periods is a later refinement.
 */
export async function generateInvoiceAction(
  _prev: GenerateInvoiceState,
  formData: FormData,
): Promise<GenerateInvoiceState> {
  const user = await requireSessionUser();
  const parsed = schema.safeParse({ orgId: formData.get('orgId') });
  if (!parsed.success) return { error: 'Choose which business to invoice.' };
  const { orgId } = parsed.data;

  const [org, workerProfile, pendingShifts] = await Promise.all([
    db.organisation.findUnique({ where: { id: orgId } }),
    db.workerProfile.findUnique({ where: { userId: user.id } }),
    db.shift.findMany({ where: { orgId, userId: user.id, status: 'SUBMITTED' }, orderBy: { startUtc: 'asc' } }),
  ]);

  if (!org) return { error: 'That business could not be found.' };
  if (!workerProfile) return { error: 'Add your invoice details first.' };
  if (pendingShifts.length === 0) return { error: 'No logged shifts are waiting to be invoiced.' };

  const shiftsForInvoice = pendingShifts.map((shift) => ({
    date: DateTime.fromJSDate(shift.startUtc).setZone(shift.timezone).toFormat('yyyy-MM-dd'),
    result: shift.pricingResult as unknown as PricingResult,
    shiftId: shift.id,
  }));

  const number = nextInvoiceNumber(workerProfile.invoicePrefix, workerProfile.nextInvoiceNumber);
  const issueDate = DateTime.now().setZone(org.timezone).toFormat('yyyy-MM-dd');

  const doc = buildInvoice({
    shifts: shiftsForInvoice,
    from: {
      name: user.name ?? workerProfile.businessName ?? 'Subcontractor',
      businessName: workerProfile.businessName ?? undefined,
      abn: workerProfile.abn ?? undefined,
    },
    to: { name: org.name, abn: org.abn ?? undefined },
    number,
    issueDate,
    termsDays: org.invoiceTermsDays,
    timezone: org.timezone,
    bankDetails:
      workerProfile.bankBsb && workerProfile.bankAccountNumber && workerProfile.bankAccountName
        ? {
            bsb: workerProfile.bankBsb,
            accountNumber: workerProfile.bankAccountNumber,
            accountName: workerProfile.bankAccountName,
          }
        : undefined,
  });

  const invoice = await db.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        orgId,
        userId: user.id,
        number: doc.number,
        status: 'DRAFT',
        issueDate: DateTime.fromISO(doc.issueDate, { zone: org.timezone }).toJSDate(),
        dueDate: DateTime.fromISO(doc.dueDate, { zone: org.timezone }).toJSDate(),
        periodStart: DateTime.fromISO(doc.periodStart, { zone: org.timezone }).toJSDate(),
        periodEnd: DateTime.fromISO(doc.periodEnd, { zone: org.timezone }).toJSDate(),
        fromSnapshot: JSON.parse(JSON.stringify(doc.from)),
        toSnapshot: JSON.parse(JSON.stringify(doc.to)),
        subtotalCents: doc.subtotalCents,
        gstCents: doc.gstCents,
        totalCents: doc.totalCents,
        isTaxInvoice: doc.isTaxInvoice,
        lines: {
          create: doc.lines.map((line, index) => ({
            sortOrder: index,
            serviceDate: DateTime.fromISO(line.serviceDate, { zone: org.timezone }).toJSDate(),
            description: line.description,
            ndisLineItemCode: line.ndisLineItemCode,
            quantity: line.quantity,
            unit: line.unit,
            unitRateCents: line.unitRateCents,
            amountCents: line.amountCents,
            gstCents: line.gstCents,
            shiftId: line.shiftId,
          })),
        },
      },
    });

    await tx.shift.updateMany({
      where: { id: { in: pendingShifts.map((s) => s.id) } },
      data: { status: 'INVOICED' },
    });
    await tx.workerProfile.update({ where: { userId: user.id }, data: { nextInvoiceNumber: { increment: 1 } } });

    return created;
  });

  redirect(`/invoice/${invoice.id}`);
}

/**
 * Marks an invoice as sent. Actually emailing it is a fast-follow once transactional
 * email is wired up (see README) — for now this records the decision so the invoice
 * list reflects reality even though delivery is manual.
 */
export async function markInvoiceSentAction(invoiceId: string) {
  const user = await requireSessionUser();
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.userId !== user.id) return;

  await db.invoice.update({ where: { id: invoiceId }, data: { status: 'SENT', sentAt: new Date() } });
  revalidatePath(`/invoice/${invoiceId}`);
}
