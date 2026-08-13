import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { shiftToFormValues } from '@/lib/shift-form';
import { loadShiftLoggerProps } from '@/lib/shift-logger-context';
import { requireSessionUser } from '@/lib/session';
import { ShiftLogger } from '../../../shift-logger';

export default async function EditShiftPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSessionUser();
  const { id } = await params;

  const shift = await db.shift.findUnique({ where: { id } });
  if (!shift || shift.userId !== user.id) notFound();

  if (shift.status !== 'SUBMITTED') {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-bold tracking-tight">This shift can&apos;t be edited</h1>
        <p className="mt-3 text-sm text-ink-soft">
          It&apos;s already on an invoice — delete that invoice first if it needs to change, which
          will bring this shift back to editable.
        </p>
        <Link href="/shifts" className="btn-primary mt-4 inline-flex">
          Back to my shifts
        </Link>
      </div>
    );
  }

  const context = await loadShiftLoggerProps(user.id, shift.orgId);
  if (context.kind !== 'ready') notFound();

  return (
    <ShiftLogger
      {...context.props}
      editingShift={{
        id: shift.id,
        initialForm: shiftToFormValues(shift),
        initialServiceTypeId: shift.serviceTypeId,
      }}
    />
  );
}
