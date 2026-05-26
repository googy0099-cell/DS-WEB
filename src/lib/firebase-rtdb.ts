import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";

function getApp() {
  if (getApps().length > 0) return getApps()[0];
  const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    ?? `https://${sa.project_id}-default-rtdb.firebaseio.com`;
  return initializeApp({ credential: cert(sa), databaseURL });
}

function rtdb() {
  return getDatabase(getApp());
}

// Wrap any Firebase promise with a 5-second timeout so a broken/slow
// Firebase connection never blocks the API response for minutes.
function withTimeout<T>(p: Promise<T>, ms = 5000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Firebase timeout")), ms)
    ),
  ]);
}

export type WerewolfPlayerFb = {
  status: string;
  hasActed: boolean;
  hasVoted: boolean;
  voteCount: number;
};

export type WerewolfSessionFb = {
  phase: string;
  currentStep: string | null;
  nightNumber: number;
  dayNumber: number;
  winTeam: string | null;
  playerNames: Record<string, string>;
  players: Record<string, WerewolfPlayerFb>;
  announcement?: string | null;
  identify?: { userId: number; at: number } | null;
  voteDecision?: { yes: number; no: number; voters: Record<string, boolean> } | null;
};

export async function setWerewolfFb(code: string, state: WerewolfSessionFb) {
  try {
    await withTimeout(
      rtdb().ref(`werewolf/sessions/${code}`).set({ ...state, _ts: Date.now() })
    );
  } catch (e) {
    console.error("[Firebase] set error", e);
  }
}

export async function patchWerewolfFb(
  code: string,
  update: Partial<WerewolfSessionFb>
) {
  try {
    await withTimeout(
      rtdb().ref(`werewolf/sessions/${code}`).update({ ...update, _ts: Date.now() })
    );
  } catch (e) {
    console.error("[Firebase] patch error", e);
  }
}

export async function patchWerewolfPlayerFb(
  code: string,
  userId: number,
  data: Partial<WerewolfPlayerFb>
) {
  try {
    const flat: Record<string, unknown> = { _ts: Date.now() };
    for (const [k, v] of Object.entries(data)) {
      flat[`players/${userId}/${k}`] = v;
    }
    await withTimeout(rtdb().ref(`werewolf/sessions/${code}`).update(flat));
  } catch (e) {
    console.error("[Firebase] player patch error", e);
  }
}

// Canvas layout stored at room level so it survives session resets and is shared across devices.
export async function saveRoomCanvasLayout(code: string, layout: Record<string, unknown>) {
  try {
    await withTimeout(
      rtdb().ref(`werewolf/rooms/${code}/canvasLayout`).set({ ...layout, _ts: Date.now() })
    );
  } catch (e) {
    console.error("[Firebase] canvas layout save error", e);
  }
}

export async function clearRoomCanvasLayout(code: string) {
  try {
    await withTimeout(rtdb().ref(`werewolf/rooms/${code}/canvasLayout`).remove());
  } catch (e) {
    console.error("[Firebase] canvas layout clear error", e);
  }
}

// Updates multiple players using flat paths so offline (virtual) player entries are not overwritten.
export async function patchWerewolfPlayersFb(
  code: string,
  updates: Record<string, Partial<WerewolfPlayerFb>>
) {
  try {
    const flat: Record<string, unknown> = { _ts: Date.now() };
    for (const [userId, data] of Object.entries(updates)) {
      for (const [k, v] of Object.entries(data)) {
        flat[`players/${userId}/${k}`] = v;
      }
    }
    await withTimeout(rtdb().ref(`werewolf/sessions/${code}`).update(flat));
  } catch (e) {
    console.error("[Firebase] players patch error", e);
  }
}
