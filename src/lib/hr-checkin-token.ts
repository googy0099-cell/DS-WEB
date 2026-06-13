import crypto from "node:crypto";

// Rotating check-in token: a short-lived HMAC-signed blob that identifies a
// staff member. The staff phone (logged in) fetches it; the cashier kiosk scans
// it. It expires fast so a screenshot can't be reused, and the signature means a
// client can't forge a staffId.

const TTL_MS = 30_000;

function secret(): string {
  return (
    process.env.HR_CHECKIN_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "dev-checkin-secret"
  );
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function hmac(payload: string): string {
  return b64url(crypto.createHmac("sha256", secret()).update(payload).digest());
}

/** Sign a token for `staffId` valid for the next 30s. Returns { token, expiresAt }. */
export function signToken(staffId: number): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + TTL_MS;
  const payload = b64url(Buffer.from(JSON.stringify({ s: staffId, e: expiresAt })));
  const sig = hmac(payload);
  return { token: `${payload}.${sig}`, expiresAt };
}

/** Verify a scanned token. Returns the staffId if valid & unexpired, else null. */
export function verifyToken(token: string): number | null {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = hmac(payload);
  // Constant-time compare; lengths must match first to avoid throwing.
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }

  try {
    const { s, e } = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      s: number;
      e: number;
    };
    if (typeof s !== "number" || typeof e !== "number") return null;
    if (Date.now() > e) return null;
    return s;
  } catch {
    return null;
  }
}

/** Distance in metres between two lat/lng points (haversine). */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Shop location config from env. `null` lat/lng means GPS gating is disabled. */
export function shopGeofence(): { lat: number; lng: number; radiusM: number } | null {
  const lat = parseFloat(process.env.SHOP_LAT ?? "");
  const lng = parseFloat(process.env.SHOP_LNG ?? "");
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  const radiusM = parseInt(process.env.SHOP_RADIUS_M ?? "150", 10) || 150;
  return { lat, lng, radiusM };
}
