'use server';

import { DateTime } from 'luxon';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { buildInvoice, calendarDateToUtcMidnight, nextInvoiceNumber } from '@/lib/invoice';
import type { PricingResult } from '@/lib/pricing/types';
import { requireSessionUser } from '@/lib/session';

export interface GenerateInvoiceState {
  error?: string;
  invoiceId?: string;
}

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const schema = z.object({
  orgId: z.string().min(1),
  periodStart: z.union([dateString, z.literal('')]).optional(),
  periodEnd: z.union([dateString, z.literal('')]).optional(),
});

/**
 * Invoices shifts the worker has logged against this business that aren't
 * already on an invoice. Three ways to pick which ones:
 *  - Explicit shiftIds (from the /shifts checklist): invoices exactly those,
 *    ignoring any period — the period shown is just their own date range.
 *  - A period entered (no shiftIds): only shifts whose local date falls
 *    inside it are included (the rest stay pending for later), and the
 *    entered dates are used verbatim as the period — so a fixed pay cycle
 *    still reads correctly even if no shift lands exactly on its first or
 *    last day.
 *  - Neither: every outstanding shift is included.
 */
export async function generateInvoiceAction(
  _prev: GenerateInvoiceState,
  formData: FormData,
): Promise<GenerateInvoiceState> {
  const user = await requireSessionUser();
  const parsed = schema.safeParse({
    orgId: formData.get('orgId'),
    periodStart: formData.get('periodStart') || undefined,
    periodEnd: formData.get('periodEnd') || undefined,
  });
  if (!parsed.success) return { error: 'Choose which business to invoice.' };
  const { orgId } = parsed.data;
  const periodStart = parsed.data.periodStart || undefined;
  const periodEnd = parsed.data.periodEnd || undefined;
  if (periodStart && periodEnd && periodStart > periodEnd) {
    return { error: 'Period start must be on or before period end.' };
  }
  const selectedShiftIds = formData.getAll('shiftIds').map(String).filter(Boolean);

  const [org, workerProfile, allPendingShifts] = await Promise.all([
    db.organisation.findUnique({ where: { id: orgId } }),
    db.workerProfile.findUnique({ where: { userId: user.id } }),
    db.shift.findMany({ where: { orgId, userId: user.id, status: 'SUBMITTED' }, orderBy: { startUtc: 'asc' } }),
  ]);

  if (!org) return { error: 'That business could not be found.' };
  if (!workerProfile) return { error: 'Add your invoice details first.' };
  if (allPendingShifts.length === 0) return { error: 'No logged shifts are waiting to be invoiced.' };

  const pendingShifts =
    selectedShiftIds.length > 0
      ? allPendingShifts.filter((shift) => selectedShiftIds.includes(shift.id))
      : allPendingShifts
          .map((shift) => ({ shift, date: DateTime.fromJSDate(shift.startUtc).setZone(shift.timezone).toFormat('yyyy-MM-dd') }))
          .filter(({ date }) => (!periodStart || date >= periodStart) && (!periodEnd || date <= periodEnd))
          .map(({ shift }) => shift);

  if (pendingShifts.length === 0) {
    return {
      error:
        selectedShiftIds.length > 0
          ? 'Those shifts could not be found, or have already been invoiced.'
          : 'No logged shifts fall within that period.',
    };
  }

  const shiftsForInvoice = pendingShifts.map((shift) => ({
    date: DateTime.fromJSDate(shift.startUtc).setZone(shift.timezone).toFormat('yyyy-MM-dd'),
    result: shift.pricingResult as unknown as PricingResult,
    shiftId: shift.id,
  }));

  const number = nextInvoiceNumber(workerProfile.invoicePrefix, workerProfile.nextInvoiceNumber);
  const issueDate = DateTime.now().setZone(org.timezone).toFormat('yyyy-MM-dd');

  const addressLines = [
    workerProfile.addressLine1,
    [workerProfile.suburb, workerProfile.state, workerProfile.postcode].filter(Boolean).join(' '),
  ].filter((line): line is string => Boolean(line));

  const orgAddressLines = [
    org.addressLine1,
    org.addressLine2,
    [org.suburb, org.state, org.postcode].filter(Boolean).join(' '),
  ].filter((line): line is string => Boolean(line));

  const doc = buildInvoice({
    shifts: shiftsForInvoice,
    from: {
      name: user.name ?? workerProfile.businessName ?? 'Subcontractor',
      businessName: workerProfile.businessName ?? undefined,
      abn: workerProfile.abn ?? undefined,
      acn: workerProfile.acn ?? undefined,
      addressLines: addressLines.length > 0 ? addressLines : undefined,
      email: user.email ?? undefined,
      phone: workerProfile.phone ?? undefined,
    },
    to: {
      name: org.legalName ?? org.name,
      businessName: org.name,
      abn: org.abn ?? undefined,
      addressLines: orgAddressLines.length > 0 ? orgAddressLines : undefined,
      email: org.email ?? undefined,
      phone: org.phone ?? undefined,
    },
    number,
    issueDate,
    termsDays: org.invoiceTermsDays,
    timezone: org.timezone,
    periodStart,
    periodEnd,
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
        issueDate: calendarDateToUtcMidnight(doc.issueDate),
        dueDate: calendarDateToUtcMidnight(doc.dueDate),
        periodStart: calendarDateToUtcMidnight(doc.periodStart),
        periodEnd: calendarDateToUtcMidnight(doc.periodEnd),
        fromSnapshot: JSON.parse(JSON.stringify({ ...doc.from, bankDetails: doc.bankDetails })),
        toSnapshot: JSON.parse(JSON.stringify(doc.to)),
        subtotalCents: doc.subtotalCents,
        gstCents: doc.gstCents,
        totalCents: doc.totalCents,
        isTaxInvoice: doc.isTaxInvoice,
        notes: doc.notes,
        lines: {
          create: doc.lines.map((line, index) => ({
            sortOrder: index,
            serviceDate: calendarDateToUtcMidnight(line.serviceDate),
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

/**
 * Deletes an invoice the worker generated by mistake (wrong period, wrong
 * shifts, etc.) and frees up the shifts on it to be invoiced again. Once an
 * invoice is marked Paid it's treated as a real financial record and can no
 * longer be deleted.
 */
export async function deleteInvoiceAction(invoiceId: string) {
  const user = await requireSessionUser();
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: { select: { shiftId: true } } },
  });
  if (!invoice || invoice.userId !== user.id) return;
  if (invoice.status === 'PAID') return;

  const shiftIds = invoice.lines
    .map((line) => line.shiftId)
    .filter((id): id is string => Boolean(id));

  await db.$transaction([
    db.shift.updateMany({ where: { id: { in: shiftIds } }, data: { status: 'SUBMITTED' } }),
    db.invoice.delete({ where: { id: invoiceId } }),
  ]);

  revalidatePath('/invoice');
  redirect('/invoice');
}
