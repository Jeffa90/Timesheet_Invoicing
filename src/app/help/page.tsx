const TOPICS = [
  {
    title: 'How overnight sleepover billing works',
    body:
      'Hourly billing stops at the time you set as "hourly billing stops" and a single flat fee ' +
      'covers the sleepover window. Hourly billing starts again automatically at "hourly billing ' +
      'resumes" — even if that crosses into a Saturday, Sunday or public holiday, in which case the ' +
      'higher rate applies from midnight.',
  },
  {
    title: 'Being woken during a sleepover ("active support")',
    body:
      'The flat sleepover fee already includes up to 2 hours of being woken to help. If you were ' +
      'woken for longer, add each period under "Woken to provide support?" and the extra time bills ' +
      'on top, automatically.',
  },
  {
    title: 'Why some invoices say "Invoice" and others say "Tax Invoice"',
    body:
      'GST only appears when both you are GST-registered and the support you delivered is a taxable ' +
      'one. Most core NDIS supports are GST-free, so most invoices in this app will simply say ' +
      '"Invoice" with no GST line — that is expected, not a mistake.',
  },
  {
    title: 'Rates set as a percentage of the NDIS cap',
    body:
      'Some businesses set your rate as a percentage of the current NDIS price limit rather than a ' +
      'flat dollar figure. When the price guide changes on 1 July, this rate updates automatically ' +
      'the next time the business re-imports the guide — you do not need to do anything.',
  },
  {
    title: 'Submitting and approving timesheets',
    body:
      'Group your shifts into a timesheet and submit it for approval. Once the business approves it, ' +
      'the numbers are locked — editing a rate card afterwards can never change an amount you have ' +
      'already been paid for.',
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Help &amp; guides</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Everything here is also reachable from the help icon wherever you&apos;re working — you never
          need to leave the page you&apos;re on to look something up.
        </p>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">First time here?</p>
          <p className="text-sm text-ink-soft">Replay the guided tour of setup, shift logging and invoicing.</p>
        </div>
        <button type="button" className="btn-primary">
          Restart the tour
        </button>
      </div>

      <div className="space-y-3">
        {TOPICS.map((topic) => (
          <details key={topic.title} className="card group">
            <summary className="cursor-pointer list-none font-semibold text-ink marker:content-none">
              <span className="flex items-center justify-between gap-3">
                {topic.title}
                <span aria-hidden className="text-ink-faint transition-transform group-open:rotate-180">
                  ⌄
                </span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{topic.body}</p>
          </details>
        ))}
      </div>

      <div className="card">
        <p className="font-semibold text-ink">Still stuck?</p>
        <p className="mt-1 text-sm text-ink-soft">
          Ask your coordinator, or contact the business that set up your account — they configure the
          rates and can correct a shift if something looks wrong.
        </p>
      </div>
    </div>
  );
}
