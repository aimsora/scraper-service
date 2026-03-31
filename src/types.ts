export type ArtifactKind = "RAW_JSON" | "RAW_HTML" | "REPORT_FILE" | "OTHER";

export type ArtifactDraft = {
  kind: ArtifactKind;
  fileName: string;
  contentType: string;
  body: string | Buffer;
  objectKey?: string;
  metadata?: Record<string, unknown>;
};

export type ArtifactRef = {
  kind: ArtifactKind;
  bucket: string;
  objectKey: string;
  mimeType?: string;
  checksum?: string;
  sizeBytes?: number;
  metadata?: Record<string, unknown>;
};

export type RawSourceEvent = {
  eventId: string;
  runKey: string;
  source: string;
  collectedAt: string;
  url: string;
  payloadVersion: "v1";
  artifacts: ArtifactRef[];
  metadata?: Record<string, unknown>;
  raw: Record<string, unknown>;
};
