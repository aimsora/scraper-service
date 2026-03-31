import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "node:crypto";
import type { ArtifactDraft, ArtifactRef } from "../types";

export class S3ArtifactStore {
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    endpoint: string,
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
    forcePathStyle: boolean
  ) {
    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
  }

  async upload(
    source: string,
    runKey: string,
    eventId: string,
    artifact: ArtifactDraft
  ): Promise<ArtifactRef> {
    const body = typeof artifact.body === "string" ? Buffer.from(artifact.body, "utf-8") : artifact.body;
    const checksum = createHash("sha256").update(body).digest("hex");
    const objectKey =
      artifact.objectKey ??
      `${source}/${runKey}/${eventId}/${randomUUID()}-${artifact.fileName}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: body,
        ContentType: artifact.contentType,
        Metadata: artifact.metadata
          ? Object.fromEntries(
              Object.entries(artifact.metadata).map(([key, value]) => [key, String(value)])
            )
          : undefined
      })
    );

    return {
      kind: artifact.kind,
      bucket: this.bucket,
      objectKey,
      mimeType: artifact.contentType,
      checksum,
      sizeBytes: body.byteLength,
      metadata: artifact.metadata
    };
  }
}
