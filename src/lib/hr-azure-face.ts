const ENDPOINT = process.env.AZURE_FACE_ENDPOINT?.replace(/\/$/, "") ?? "";
const KEY = process.env.AZURE_FACE_KEY ?? "";

async function postJson(path: string, body: unknown) {
  const res = await fetch(`${ENDPOINT}/face/v1.0${path}`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function postImage(path: string, imageBase64: string) {
  const binary = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
  const res = await fetch(`${ENDPOINT}/face/v1.0${path}`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": KEY, "Content-Type": "application/octet-stream" },
    body: binary,
  });
  return { status: res.status, body: await res.json() };
}

// ── detect: returns faceId (expires in 24h) ────────────────────────────────
// Azure requires returnFaceId=true explicitly + detection_03 + recognition_04
// for /verify to work. faceId access requires Limited Access approval for
// new customers (since June 2024).

export async function detectFace(imageBase64: string): Promise<string> {
  const path = "/detect?returnFaceId=true&detectionModel=detection_03&recognitionModel=recognition_04&returnFaceLandmarks=false";
  const { status, body } = await postImage(path, imageBase64);

  if (body?.error) {
    throw new Error(`Azure ${status}: ${body.error.code ?? ""} — ${body.error.message ?? JSON.stringify(body.error)}`);
  }
  if (!Array.isArray(body)) {
    throw new Error(`Azure ${status}: unexpected response — ${JSON.stringify(body).slice(0, 200)}`);
  }
  if (body.length === 0) {
    throw new Error("NO_FACE");
  }
  if (!body[0].faceId) {
    throw new Error(
      `Azure ตรวจจับหน้าได้แต่ไม่ส่ง faceId กลับ — ต้องสมัคร Limited Access ที่ aka.ms/facerecognition (ปกติใช้เวลา 1-2 สัปดาห์). Response: ${JSON.stringify(body[0]).slice(0, 200)}`
    );
  }
  return body[0].faceId as string;
}

// ── verify: compare two faceIds → confidence 0-1 ──────────────────────────

export async function verifyFaces(faceId1: string, faceId2: string): Promise<number> {
  const { status, body } = await postJson("/verify", { faceId1, faceId2 });
  if (body?.error) {
    throw new Error(`Azure verify ${status}: ${body.error.code ?? ""} — ${body.error.message ?? JSON.stringify(body.error)}`);
  }
  return (body.confidence ?? 0) as number;
}
