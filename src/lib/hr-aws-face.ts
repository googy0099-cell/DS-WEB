import { RekognitionClient, CompareFacesCommand } from "@aws-sdk/client-rekognition";

const client = new RekognitionClient({
  region: process.env.AWS_REGION ?? "ap-southeast-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

const SIMILARITY_PASS = 90;
// Two casual shots of the same person seconds apart (QR moment vs face scan) can
// differ in angle/lighting, so the self-consistency bar is a bit lower than the
// identity bar.
export const CONSISTENCY_PASS = 80;

function strip(b64: string) {
  return b64.replace(/^data:image\/\w+;base64,/, "");
}

export async function compareFaces(
  sourceB64: string,
  targetB64: string
): Promise<{ similarity: number; matched: boolean }> {
  const cmd = new CompareFacesCommand({
    SourceImage: { Bytes: Buffer.from(strip(sourceB64), "base64") },
    TargetImage: { Bytes: Buffer.from(strip(targetB64), "base64") },
    SimilarityThreshold: 50,
  });
  const res = await client.send(cmd);
  const best = res.FaceMatches?.[0]?.Similarity ?? 0;
  return { similarity: best, matched: best >= SIMILARITY_PASS };
}

// Like compareFaces but returns null when AWS can't use the source (e.g. no
// detectable face in it) — lets callers skip the check instead of failing.
// A real "different person" still returns { similarity: 0 } (face found, no match).
export async function compareFacesSafe(
  sourceB64: string,
  targetB64: string
): Promise<{ similarity: number } | null> {
  try {
    const cmd = new CompareFacesCommand({
      SourceImage: { Bytes: Buffer.from(strip(sourceB64), "base64") },
      TargetImage: { Bytes: Buffer.from(strip(targetB64), "base64") },
      SimilarityThreshold: 1,
    });
    const res = await client.send(cmd);
    const matched = res.FaceMatches?.[0]?.Similarity ?? 0;
    const unmatched = (res.UnmatchedFaces?.length ?? 0) > 0;
    // No matched and no unmatched face in the target → target had no face: unusable.
    if (matched === 0 && !unmatched) return null;
    return { similarity: matched };
  } catch {
    return null; // source had no detectable face, or a transient AWS error
  }
}
