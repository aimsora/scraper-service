import type { Logger } from "pino";
import type { ArtifactDraft } from "../types";

export type CollectedRawRecord = {
  url: string;
  raw: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  artifacts?: ArtifactDraft[];
};

export type SourceRunContext = {
  runKey: string;
  collectedAt: string;
  requestTimeoutMs: number;
  logger: Logger;
};

export interface SourceAdapter {
  code: string;
  name: string;
  collect(context: SourceRunContext): Promise<CollectedRawRecord[]>;
}
