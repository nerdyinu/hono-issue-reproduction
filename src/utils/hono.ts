import { PrismaClient } from "@prisma/client";

export type Context = { Variables: { prisma: PrismaClient } }
