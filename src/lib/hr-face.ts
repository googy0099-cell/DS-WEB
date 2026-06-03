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

// ── Liveness: Eye Aspect Ratio (EAR) ──────────────────────────────────────

type Point = { x: number; y: number };

function euclidean(a: Point, b: Point) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function eyeAR(pts: Point[]): number {
  // pts = 6 landmark points of one eye
  const A = euclidean(pts[1], pts[5]);
  const B = euclidean(pts[2], pts[4]);
  const C = euclidean(pts[0], pts[3]);
  return (A + B) / (2.0 * C);
}

export async function getEAR(video: HTMLVideoElement): Promise<number | null> {
  const det = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks(true);
  if (!det) return null;
  const p = det.landmarks.positions;
  const left  = p.slice(36, 42);
  const right = p.slice(42, 48);
  return (eyeAR(left) + eyeAR(right)) / 2;
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
  threshold = 0.35
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
