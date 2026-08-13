interface OrgDetails {
  name: string;
  legalName: string | null;
  abn: string | null;
  gstRegistered: boolean;
  addressLine1: string | null;
  addressLine2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  email: string | null;
  phone: string | null;
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-ink-soft">{label}</span>
      <span className={value ? 'text-ink' : 'italic text-ink-soft'}>{value ?? 'Not set'}</span>
    </div>
  );
}

export function EmployerDetailsCard({ org }: { org: OrgDetails }) {
  const addressLines = [org.addressLine1, org.addressLine2, [org.suburb, org.state, org.postcode].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="card">
      <p className="font-semibold text-ink">{org.name}</p>
      {org.legalName && org.legalName !== org.name && (
        <p className="text-sm text-ink-soft">Trading as / legal name: {org.legalName}</p>
      )}
      <div className="mt-2 divide-y divide-surface-line">
        <Row label="ABN" value={org.abn} />
        <Row label="GST registered" value={org.gstRegistered ? 'Yes' : 'No'} />
        <Row label="Address" value={addressLines || null} />
        <Row label="Email" value={org.email} />
        <Row label="Phone" value={org.phone} />
      </div>
    </div>
  );
}
