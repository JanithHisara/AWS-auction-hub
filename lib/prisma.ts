import { PrismaClient } from '@prisma/client';

const DEFAULT_DATABASE_URL =
  'postgresql://postgres:mLP8S_C20HRB1g-o.mU.q2I-Ic.mk-@auctionhubinfrastack-auroraserverlessv21dd3fd29-avazdjjicbxa.cluster-chww4quqi1bo.ap-south-1.rds.amazonaws.com:5432/postgres';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
