export function OnboardingProgress({
  steps,
  completed,
}: {
  steps: { key: string; label: string }[];
  completed: string[];
}) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-3" aria-label="Setup progress">
      {steps.map((step, index) => {
        const done = completed.includes(step.key);
        return (
          <li key={step.key} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                done ? 'bg-good text-white' : 'bg-surface-line text-ink-soft'
              }`}
              aria-hidden
            >
              {done ? '✓' : index + 1}
            </span>
            <span className={`text-sm ${done ? 'text-ink' : 'text-ink-soft'}`}>{step.label}</span>
            {index < steps.length - 1 && (
              <span aria-hidden className="mx-1 h-px w-6 bg-surface-line sm:w-10" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
