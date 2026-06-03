const ENDPOINT = process.env.AZURE_FACE_ENDPOINT?.replace(/\/$/, "") ?? "";
const KEY = process.env.AZURE_FACE_KEY ?? "";

async function postJson(path: string, body: unknown) {
  const res = await fetch(`${ENDPOINT}/face/v1.0${path}`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function postImage(path: string, imageBase64: string) {
  const binary = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
  const res = await fetch(`${ENDPOINT}/face/v1.0${path}`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": KEY, "Content-Type": "application/octet-stream" },
    body: binary,
  });
  return res.json();
}

// ── detect: returns faceId (expires in 24h) ────────────────────────────────

export async function detectFace(imageBase64: string): Promise<string | null> {
  const data = await postImage("/detect", imageBase64);
  if (data.error) throw new Error(data.error.message);
  if (!Array.isArray(data) || data.length === 0) return null;
  return data[0].faceId as string;
}

// ── verify: compare two faceIds → confidence 0-1 ──────────────────────────

export async function verifyFaces(faceId1: string, faceId2: string): Promise<number> {
  const data = await postJson("/verify", { faceId1, faceId2 });
  if (data.error) throw new Error(data.error.message);
  return (data.confidence ?? 0) as number;
}
