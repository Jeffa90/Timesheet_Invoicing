'use client';

/**
 * A worker can be engaged by more than one business — this lets them switch
 * which one a page (log a shift / my shifts / my invoices) is showing, via a
 * plain GET form so the page re-renders from the server with fresh data for
 * the chosen business rather than juggling client-side state. Hidden entirely
 * when there's only one business, since there's nothing to switch between.
 */
export function OrgSwitcher({
  engagements,
  activeOrgId,
}: {
  engagements: { orgId: string; orgName: string }[];
  activeOrgId: string;
}) {
  if (engagements.length < 2) return null;

  return (
    <form method="get" className="max-w-xs">
      <label className="label" htmlFor="org">
        Business
      </label>
      <select
        id="org"
        name="org"
        defaultValue={activeOrgId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="field"
      >
        {engagements.map((e) => (
          <option key={e.orgId} value={e.orgId}>
            {e.orgName}
          </option>
        ))}
      </select>
    </form>
  );
}
