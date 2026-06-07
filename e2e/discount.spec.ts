import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@libsql/client";

// Read the seeded discounted order id straight from the test DB
async function seededOrderId(): Promise<number> {
  const db = createClient({ url: "file:./test.db" });
  const r = await db.execute(`SELECT id FROM "Order" WHERE orderName='เทสส่วนลด' ORDER BY id DESC LIMIT 1`);
  return Number(r.rows[0].id);
}

async function login(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("owner@test.local");
  await page.locator('input[type="password"]').fill("Password1234!");
  await page.locator('button[type="submit"]').click();
  // login pushes to "/"; wait until we're off the login page
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}

test("order queue card shows discount + net (฿60), not just gross ฿65", async ({ page }) => {
  await login(page);
  await page.goto("/admin");

  // the order card that contains both the item and the net line
  const card = page.locator("div").filter({ hasText: "คาราเมลทดสอบ" }).filter({ hasText: "สุทธิ" }).last();
  await expect(card).toBeVisible({ timeout: 30_000 });

  // These three did NOT exist before the fix (card only showed "รวม ฿65")
  await expect(card.getByText("ยอดรวม")).toBeVisible(); // gross subtotal label
  await expect(card.getByText("−฿5")).toBeVisible();    // discount line (unique to card)
  await expect(card.getByText("สุทธิ")).toBeVisible();  // net label
  await expect(card.getByText("฿60")).toBeVisible();    // net amount
});

test("receipt page shows subtotal ฿65, discount ฿5, net ฿60", async ({ page }) => {
  await login(page);
  const orderId = await seededOrderId();
  await page.goto(`/api/receipt/${orderId}`);

  const body = page.locator("body");
  await expect(body).toContainText("ส่วนลด");
  await expect(body).toContainText("฿65"); // subtotal
  await expect(body).toContainText("฿60"); // net total
});
