import { PrismaClient } from '@prisma/client';

/**
 * Standard Next.js dev-mode singleton: without it, every hot reload would open a
 * fresh Prisma connection pool and eventually exhaust Postgres's connection limit.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
