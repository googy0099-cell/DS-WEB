import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { isTaggedModel, isTestModeActive } from "./test-mode";

function createPrismaClient() {
  const adapter = new PrismaLibSql({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const base = new PrismaClient({ adapter });

  // Sandbox / test-mode isolation, centralized so no call-site can forget it:
  //  • creates/upserts in test mode are tagged isTest=true
  //  • list & aggregate reads are scoped to the current mode (test vs live)
  //  • bulk update/delete are scoped to the current mode
  // Callers can still override by passing isTest explicitly (the cleanup route
  // does this to delete test rows regardless of the current mode).
  return base.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        if (!isTaggedModel(model)) return query(args);
        const test = await isTestModeActive();
        const a = args as Record<string, unknown>;

        switch (operation) {
          case "create": {
            a.data = { isTest: test, ...(a.data as object) };
            break;
          }
          case "createMany": {
            const d = a.data;
            if (Array.isArray(d)) a.data = d.map((row) => ({ isTest: test, ...row }));
            else if (d) a.data = { isTest: test, ...(d as object) };
            break;
          }
          case "upsert": {
            a.create = { isTest: test, ...(a.create as object) };
            break;
          }
          case "findMany":
          case "findFirst":
          case "findFirstOrThrow":
          case "count":
          case "aggregate":
          case "groupBy":
          case "updateMany":
          case "deleteMany": {
            a.where = { isTest: test, ...((a.where as object) ?? {}) };
            break;
          }
          // findUnique / update / delete / etc. operate by a unique id the caller
          // already resolved from a mode-scoped list — left untouched on purpose.
        }
        return query(args);
      },
    },
  });
}

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: ReturnType<typeof createPrismaClient> | undefined;
}

const db = globalThis.prismaGlobal ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = db;
}

export default db;
