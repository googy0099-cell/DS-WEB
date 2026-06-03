import * as faceapi from "face-api.js";

let loaded = false;

export async function loadModels() {
  if (loaded) return;
  const MODEL_URL = "/models";
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);
  loaded = true;
}

export async function getDescriptor(video: HTMLVideoElement): Promise<Float32Array | null> {
  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks(true)
    .withFaceDescriptor();
  return detection?.descriptor ?? null;
}

export async function getAverageDescriptor(video: HTMLVideoElement, samples = 5): Promise<Float32Array | null> {
  const descriptors: Float32Array[] = [];
  for (let i = 0; i < samples; i++) {
    await new Promise((r) => setTimeout(r, 300));
    const d = await getDescriptor(video);
    if (d) descriptors.push(d);
  }
  if (descriptors.length === 0) return null;
  const avg = new Float32Array(128);
  for (const d of descriptors) d.forEach((v, i) => { avg[i] += v / descriptors.length; });
  return avg;
}

export function matchDescriptor(
  target: Float32Array,
  candidates: { id: number; descriptor: Float32Array }[],
  threshold = 0.5
): { id: number; distance: number } | null {
  let best: { id: number; distance: number } | null = null;
  for (const c of candidates) {
    const dist = faceapi.euclideanDistance(target, c.descriptor);
    if (dist < threshold && (!best || dist < best.distance)) {
      best = { id: c.id, distance: dist };
    }
  }
  return best;
}
