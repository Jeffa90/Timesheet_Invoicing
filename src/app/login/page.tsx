'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActionState } from 'react';
import { signInAction } from '@/lib/actions/auth';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signInAction, {});
  const redirectTo = useSearchParams().get('redirectTo') ?? '/onboarding';

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold tracking-tight">Log in</h1>
      <p className="mt-1 text-sm text-ink-soft">Welcome back.</p>

      <form action={formAction} className="card mt-6 space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="field"
          />
        </div>

        {state.error && (
          <p className="rounded-lg bg-warnbg px-3 py-2 text-sm text-warn" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-soft">
        No account yet?{' '}
        <Link href="/signup" className="font-medium text-brand-600">
          Sign up
        </Link>
      </p>
    </div>
  );
}
