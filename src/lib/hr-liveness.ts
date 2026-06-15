// MediaPipe FaceLandmarker wrapper for the kiosk check-in liveness challenge.
// The native browser FaceDetector didn't return landmarks on the shop tablet,
// so head-pose (turn / nod) couldn't be measured. MediaPipe gives dense, stable
// landmarks on every device; from them we derive a yaw (turn) and a pitch (nod)
// proxy in plain image space — no left/right mirror ambiguity for the vertical
// nod, and yaw is used direction-agnostically by the caller.

import type { FaceLandmarker } from "@mediapipe/tasks-vision";

const VER = "0.10.35";
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm`;
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export type Pose = {
  cx: number; cy: number; fw: number; fh: number; // face box, fractions of frame
  yaw: number;   // horizontal turn proxy: 0 frontal, magnitude grows when turned
  pitch: number; // vertical nod ratio: ~0.5 frontal, smaller looking down, larger up
};

export interface PoseReader {
  read(video: HTMLVideoElement, tMs: number): Pose | null;
  close(): void;
}

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
      });
    })().catch((e) => { landmarkerPromise = null; throw e; });
  }
  return landmarkerPromise;
}

// MediaPipe FaceMesh landmark indices
const NOSE = 1, EYE_L = 33, EYE_R = 263, CHIN = 152;

export async function createPoseReader(): Promise<PoseReader | null> {
  let landmarker: FaceLandmarker;
  try { landmarker = await getLandmarker(); }
  catch { return null; }

  return {
    read(video, tMs) {
      let res;
      try { res = landmarker.detectForVideo(video, tMs); }
      catch { return null; }
      const faces = res.faceLandmarks;
      if (!faces || faces.length === 0) return null;
      const lm = faces[0];

      let minX = 1, minY = 1, maxX = 0, maxY = 0;
      for (const p of lm) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      }
      const fw = maxX - minX, fh = maxY - minY;
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;

      const eyeMidX = (lm[EYE_L].x + lm[EYE_R].x) / 2;
      const eyeMidY = (lm[EYE_L].y + lm[EYE_R].y) / 2;
      const eyeDist = Math.abs(lm[EYE_R].x - lm[EYE_L].x) || 1e-3;
      const chinSpan = (lm[CHIN].y - eyeMidY) || 1e-3;

      const yaw = (lm[NOSE].x - eyeMidX) / eyeDist;       // ~0 frontal
      const pitch = (lm[NOSE].y - eyeMidY) / chinSpan;    // ~0.5 frontal

      return { cx, cy, fw, fh, yaw, pitch };
    },
    close() { /* keep the singleton warm for the next check-in */ },
  };
}
