import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "ts-node --esm prisma/seed.ts",
  },
  datasource: {
    url: process.env.TURSO_DATABASE_URL!,
    // @ts-expect-error Prisma Turso adapter passes authToken separately
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
