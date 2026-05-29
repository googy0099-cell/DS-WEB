import "dotenv/config";
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  await client.execute(`ALTER TABLE "Order" ADD COLUMN "billId" INTEGER REFERENCES "Bill"("id")`);
  console.log("✅ Order.billId added");
}

main().catch(console.error).finally(() => process.exit(0));
