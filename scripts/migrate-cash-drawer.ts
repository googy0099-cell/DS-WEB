import "dotenv/config";
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function main() {
  await client.executeMultiple(`
    ALTER TABLE Payment ADD COLUMN receivedAmount INTEGER;
    ALTER TABLE Payment ADD COLUMN changeAmount INTEGER;
  `);
  console.log("✅ Payment columns added");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS CashDrawerSession (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      date         TEXT NOT NULL,
      openingFloat INTEGER NOT NULL DEFAULT 0,
      expectedCash INTEGER NOT NULL DEFAULT 0,
      totalTransfer INTEGER NOT NULL DEFAULT 0,
      countedCash  INTEGER NOT NULL DEFAULT 0,
      difference   INTEGER NOT NULL DEFAULT 0,
      note         TEXT,
      closedById   INTEGER REFERENCES User(id),
      createdAt    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ CashDrawerSession table created");
}

main().catch(console.error).finally(() => process.exit(0));
