import { createHmac } from "crypto";

function secret() {
  return process.env.NEXTAUTH_SECRET ?? "fallback-dev-secret";
}

export function signCheckoutToken(orderId: number): string {
  const payload = String(orderId);
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyCheckoutToken(token: string): number | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const encodedId = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const payload = Buffer.from(encodedId, "base64url").toString();
    const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
    if (sig !== expected) return null;
    const id = Number(payload);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}
