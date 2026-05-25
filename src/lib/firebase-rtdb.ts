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
};

// Full write — used when session is created or fully replaced
export async function setWerewolfFb(code: string, state: WerewolfSessionFb) {
  try {
    await rtdb()
      .ref(`werewolf/sessions/${code}`)
      .set({ ...state, _ts: Date.now() });
  } catch (e) {
    console.error("[Firebase] set error", e);
  }
}

// Partial update — used for phase/step transitions
export async function patchWerewolfFb(
  code: string,
  update: Partial<WerewolfSessionFb>
) {
  try {
    await rtdb()
      .ref(`werewolf/sessions/${code}`)
      .update({ ...update, _ts: Date.now() });
  } catch (e) {
    console.error("[Firebase] patch error", e);
  }
}

// Update a single player's fields (action/vote submitted)
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
    await rtdb().ref(`werewolf/sessions/${code}`).update(flat);
  } catch (e) {
    console.error("[Firebase] player patch error", e);
  }
}
