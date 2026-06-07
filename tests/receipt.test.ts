import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReceiptHtml, type ReceiptHtmlSettings } from "../src/lib/receipt-html.ts";
import { buildReceiptEscPos, type ReceiptEscPosSettings } from "../src/lib/thermal-print.ts";

const htmlSettings: ReceiptHtmlSettings = {
  shopName: "Test", shopInfo: "info", paperWidth: "80", footer: "thanks",
  showOrderId: true, showDate: true, showCustomer: true, showNote: true,
  showItemPrice: true, showTotal: true,
};
const escSettings: ReceiptEscPosSettings = {
  shopName: "Test", shopInfo: "info", footer: "thanks",
  showOrderId: true, showDate: true, showCustomer: true, showNote: true,
  showItemPrice: true, showTotal: true,
};
const items = [{ nameTh: "กาแฟ", quantity: 1, unitPriceTHB: 65 }];

test("HTML receipt with discount shows subtotal, discount and net", () => {
  const html = buildReceiptHtml(
    { orderId: 1, orderName: "x", totalTHB: 60, discountAmount: 5, dateStr: "d", items },
    htmlSettings
  );
  assert.match(html, /ส่วนลด/);
  assert.match(html, /฿65/);   // subtotal (net 60 + discount 5)
  assert.match(html, /฿5/);    // discount
  assert.match(html, /฿60/);   // net total
});

test("HTML receipt without discount shows a single total, no discount line", () => {
  const html = buildReceiptHtml(
    { orderId: 1, orderName: "x", totalTHB: 65, dateStr: "d", items },
    htmlSettings
  );
  assert.ok(!html.includes("ส่วนลด"), "should not render a discount line");
  assert.match(html, /รวมทั้งหมด/);
  assert.match(html, /฿65/);
});

test("ESC/POS receipt with discount prints subtotal, discount and net", () => {
  const bytes = buildReceiptEscPos(
    { id: 1, orderName: "x", totalTHB: 60, discountAmount: 5, createdAt: new Date(), items },
    escSettings
  );
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /ส่วนลด/);
  assert.match(text, /ยอดรวม ฿65/);
  assert.match(text, /รวม ฿60/);
});
