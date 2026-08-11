'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signUpAction } from '@/lib/actions/auth';

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(signUpAction, {});

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-ink-soft">
        For setting up a business, or accepting an invite from one.
      </p>

      <form action={formAction} className="card mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="name">
            Your name
          </label>
          <input id="name" name="name" type="text" autoComplete="name" required className="field" />
        </div>
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
            autoComplete="new-password"
            minLength={8}
            required
            className="field"
          />
          <p className="mt-1 text-xs text-ink-faint">At least 8 characters.</p>
        </div>

        {state.error && (
          <p className="rounded-lg bg-warnbg px-3 py-2 text-sm text-warn" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-ink-soft">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-600">
          Log in
        </Link>
      </p>
    </div>
  );
}
