import { RekognitionClient, CompareFacesCommand } from "@aws-sdk/client-rekognition";

const client = new RekognitionClient({
  region: process.env.AWS_REGION ?? "ap-southeast-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

const SIMILARITY_PASS = 90;

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
