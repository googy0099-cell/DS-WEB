import * as faceapi from "face-api.js";

let loaded = false;

export async function loadModels() {
  if (loaded) return;
  const MODEL_URL = "/models";
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
  ]);
  loaded = true;
}

type Point = { x: number; y: number };

function euclidean(a: Point, b: Point) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function eyeAR(pts: Point[]): number {
  const A = euclidean(pts[1], pts[5]);
  const B = euclidean(pts[2], pts[4]);
  const C = euclidean(pts[0], pts[3]);
  return (A + B) / (2.0 * C);
}

export type LivenessMetrics = {
  ear: number;          // average of both eyes; <0.20 closed, >0.28 open
  mouthOpen: number;    // 0=closed, ~0.5+=wide open
  yaw: number;          // -0.3..+0.3 (negative = head turned to right from camera, positive = head turned to left)
};

export async function detectMetrics(video: HTMLVideoElement): Promise<LivenessMetrics | null> {
  const det = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks(true);
  if (!det) return null;
  const p = det.landmarks.positions;

  // EAR
  const leftEye = p.slice(36, 42);
  const rightEye = p.slice(42, 48);
  const ear = (eyeAR(leftEye) + eyeAR(rightEye)) / 2;

  // Mouth open: vertical distance between outer top (51) and outer bottom (57)
  // normalized by mouth width (48 to 54)
  const topLip = p[51];
  const bottomLip = p[57];
  const mouthLeft = p[48];
  const mouthRight = p[54];
  const mouthWidth = euclidean(mouthLeft, mouthRight);
  const mouthHeight = euclidean(topLip, bottomLip);
  const mouthOpen = mouthWidth > 0 ? mouthHeight / mouthWidth : 0;

  // Yaw: nose tip (30) offset from face center, normalized by face width
  const noseTip = p[30];
  const jawLeft = p[0];
  const jawRight = p[16];
  const faceCenter = (jawLeft.x + jawRight.x) / 2;
  const faceWidth = jawRight.x - jawLeft.x;
  const yaw = faceWidth > 0 ? (noseTip.x - faceCenter) / faceWidth : 0;

  return { ear, mouthOpen, yaw };
}

// Blink counter state machine: pass-in the metric history, count valid blinks
// (transition from open → closed → open within reasonable frames)

export type BlinkState = {
  eyesOpen: boolean;
  blinkCount: number;
};

export function updateBlinkState(state: BlinkState, ear: number): BlinkState {
  const EAR_CLOSE = 0.20;
  const EAR_OPEN = 0.28;
  if (state.eyesOpen && ear < EAR_CLOSE) {
    return { eyesOpen: false, blinkCount: state.blinkCount };
  }
  if (!state.eyesOpen && ear > EAR_OPEN) {
    return { eyesOpen: true, blinkCount: state.blinkCount + 1 };
  }
  return state;
}
