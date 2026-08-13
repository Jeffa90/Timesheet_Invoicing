'use server';

import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';
import { z } from 'zod';
import { signIn, signOut } from '@/lib/auth';
import { db } from '@/lib/db';

export async function signOutAction() {
  await signOut({ redirectTo: '/login' });
}

const signUpSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
});

export interface AuthActionState {
  error?: string;
}

export async function signUpAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }
  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { error: 'An account with that email already exists. Try logging in instead.' };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.user.create({ data: { name, email, passwordHash } });

  return signInAfterSignUp(email, password);
}

async function signInAfterSignUp(email: string, password: string): Promise<AuthActionState> {
  try {
    await signIn('credentials', { email, password, redirectTo: '/onboarding' });
    return {};
  } catch (error) {
    if (error instanceof AuthError) return { error: 'Account created, but sign-in failed. Try logging in.' };
    throw error;
  }
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export async function signInAction(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      // '/' rather than '/onboarding': that bare route assumes "no admin org yet"
      // means "you haven't started your business" and sends you to create one —
      // true right after signup, but wrong for a worker, who never has one. '/'
      // already does the right thing for every account type: it only detours a
      // business owner into onboarding if they genuinely have one left unfinished.
      redirectTo: (formData.get('redirectTo') as string) || '/',
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: error.type === 'CredentialsSignin' ? 'Wrong email or password.' : 'Something went wrong.' };
    }
    throw error;
  }
}
