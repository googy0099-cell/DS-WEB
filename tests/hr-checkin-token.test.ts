import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signToken,
  verifyToken,
  distanceMeters,
} from "../src/lib/hr-checkin-token.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Token sign / verify
// ─────────────────────────────────────────────────────────────────────────────
test("a freshly signed token verifies back to its staffId", () => {
  const { token } = signToken(42);
  assert.equal(verifyToken(token), 42);
});

test("an expired token is rejected", () => {
  const { token } = signToken(7);
  const original = Date.now;
  // Jump 31s into the future (TTL is 30s)
  Date.now = () => original() + 31_000;
  try {
    assert.equal(verifyToken(token), null);
  } finally {
    Date.now = original;
  }
});

test("a tampered staffId (re-encoded payload, old signature) is rejected", () => {
  const { token } = signToken(1);
  const [, sig] = token.split(".");
  const forgedPayload = Buffer.from(
    JSON.stringify({ s: 999, e: Date.now() + 30_000 })
  ).toString("base64url");
  assert.equal(verifyToken(`${forgedPayload}.${sig}`), null);
});

test("garbage / malformed tokens are rejected, not thrown", () => {
  assert.equal(verifyToken(""), null);
  assert.equal(verifyToken("nodot"), null);
  assert.equal(verifyToken("a.b"), null);
  // @ts-expect-error intentionally wrong type
  assert.equal(verifyToken(null), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Geofence distance (haversine)
// ─────────────────────────────────────────────────────────────────────────────
test("distance to the same point is ~0", () => {
  assert.ok(distanceMeters(13.7563, 100.5018, 13.7563, 100.5018) < 1);
});

test("~150m apart reads as roughly 150m", () => {
  // 0.00135 deg latitude ≈ 150m
  const d = distanceMeters(13.7563, 100.5018, 13.7563 + 0.00135, 100.5018);
  assert.ok(d > 140 && d < 160, `expected ~150m, got ${d.toFixed(1)}`);
});

test("a point clearly outside the radius is far", () => {
  // ~1km north
  const d = distanceMeters(13.7563, 100.5018, 13.7653, 100.5018);
  assert.ok(d > 900, `expected >900m, got ${d.toFixed(1)}`);
});
