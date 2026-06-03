const ENDPOINT = process.env.AZURE_FACE_ENDPOINT?.replace(/\/$/, "") ?? "";
const KEY = process.env.AZURE_FACE_KEY ?? "";
const GROUP_ID = "dice-shop-hr";

const headers = () => ({
  "Ocp-Apim-Subscription-Key": KEY,
  "Content-Type": "application/json",
});

async function azureJson(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${ENDPOINT}/face/v1.0${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204 || res.headers.get("content-length") === "0") return null;
  return res.json();
}

async function azureOctetStream(path: string, imageBase64: string) {
  const binary = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
  const res = await fetch(`${ENDPOINT}/face/v1.0${path}`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": KEY,
      "Content-Type": "application/octet-stream",
    },
    body: binary,
  });
  return res.json();
}

// ── PersonGroup ────────────────────────────────────────────────────────────

export async function ensurePersonGroup() {
  const check = await fetch(`${ENDPOINT}/face/v1.0/persongroups/${GROUP_ID}`, {
    headers: headers(),
  });
  if (check.status === 404) {
    await azureJson(`/persongroups/${GROUP_ID}`, "PUT", { name: "Dice Shop HR" });
  }
}

export async function trainPersonGroup() {
  await azureJson(`/persongroups/${GROUP_ID}/train`, "POST");
}

// ── Person ─────────────────────────────────────────────────────────────────

export async function createPerson(name: string): Promise<string> {
  const data = await azureJson(`/persongroups/${GROUP_ID}/persons`, "POST", { name });
  return data.personId as string;
}

export async function addFaceToPerson(personId: string, imageBase64: string): Promise<string> {
  const data = await azureOctetStream(
    `/persongroups/${GROUP_ID}/persons/${personId}/persistedFaces`,
    imageBase64
  );
  if (data.error) throw new Error(data.error.message);
  return data.persistedFaceId as string;
}

// ── Detect + Identify ──────────────────────────────────────────────────────

export async function detectFace(imageBase64: string): Promise<string | null> {
  const data = await azureOctetStream("/detect", imageBase64);
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0].faceId as string;
}

export type IdentifyResult = { personId: string; confidence: number } | null;

export async function identifyFace(faceId: string): Promise<IdentifyResult> {
  const data = await azureJson("/identify", "POST", {
    personGroupId: GROUP_ID,
    faceIds: [faceId],
    maxNumOfCandidatesReturned: 1,
    confidenceThreshold: 0.5,
  });
  if (!Array.isArray(data) || data.length === 0) return null;
  const candidates = data[0].candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  return { personId: candidates[0].personId, confidence: candidates[0].confidence };
}
