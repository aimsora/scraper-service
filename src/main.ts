import cron from "node-cron";
import { randomUUID } from "node:crypto";
import { config } from "./config";
import { logger } from "./logger";
import { S3ArtifactStore } from "./artifacts/s3-artifact-store";
import { createRawEventValidator } from "./contracts/raw-event-validator";
import { RawPublisher } from "./messaging/raw-publisher";
import { demoSourceAdapter } from "./sources/demo-source";
import { createFindTenderAdapter } from "./sources/find-tender-source";
import type { SourceAdapter } from "./sources/adapter";
import type { RawSourceEvent } from "./types";
import { withRetries } from "./utils/retry";

const publisher = new RawPublisher(config.RABBITMQ_URL, config.QUEUE_RAW_EVENT);
const validateRaw = createRawEventValidator(config.SHARED_CONTRACTS_DIR);
const artifactStore = new S3ArtifactStore(
  config.S3_BUCKET,
  config.S3_ENDPOINT,
  config.S3_REGION,
  config.S3_ACCESS_KEY,
  config.S3_SECRET_KEY,
  config.S3_FORCE_PATH_STYLE
);
const adapters: SourceAdapter[] = [
  demoSourceAdapter,
  createFindTenderAdapter({ apiUrl: config.FIND_TENDER_API_URL })
].filter((adapter) =>
  config.ENABLED_SOURCES.split(",")
    .map((item) => item.trim())
    .includes(adapter.code)
);

const circuitState = new Map<string, { failures: number; openUntil?: number }>();
let running = false;

async function runAdapter(adapter: SourceAdapter): Promise<void> {
  const state = circuitState.get(adapter.code);
  if (state?.openUntil && state.openUntil > Date.now()) {
    logger.warn({ source: adapter.code, openUntil: state.openUntil }, "circuit breaker is open");
    return;
  }

  const collectedAt = new Date().toISOString();
  const runKey = `${adapter.code}-${collectedAt}`;
  const childLogger = logger.child({ source: adapter.code, runKey });

  try {
    const records = await withRetries(
      () =>
        adapter.collect({
          runKey,
          collectedAt,
          requestTimeoutMs: config.REQUEST_TIMEOUT_MS,
          logger: childLogger
        }),
      config.RETRY_ATTEMPTS,
      config.RETRY_BASE_DELAY_MS
    );

    for (const record of records) {
      const eventId = randomUUID();
      const artifacts = [];
      for (const artifact of record.artifacts ?? []) {
        artifacts.push(await artifactStore.upload(adapter.code, runKey, eventId, artifact));
      }

      const event: RawSourceEvent = {
        eventId,
        runKey,
        source: adapter.code,
        collectedAt,
        url: record.url,
        payloadVersion: "v1",
        artifacts,
        metadata: record.metadata,
        raw: record.raw
      };

      try {
        validateRaw(event);
        await publisher.publish(event);
        childLogger.info({ eventId }, "raw event published");
      } catch (error) {
        await publisher.publishTo(config.QUEUE_QUARANTINE_EVENT, {
          reason: error instanceof Error ? error.message : "Unknown validation error",
          event
        });
        childLogger.error({ err: error, eventId }, "raw event moved to quarantine");
      }
    }

    circuitState.set(adapter.code, { failures: 0 });
  } catch (error) {
    const failures = (circuitState.get(adapter.code)?.failures ?? 0) + 1;
    circuitState.set(adapter.code, {
      failures,
      openUntil: failures >= 3 ? Date.now() + 10 * 60 * 1000 : undefined
    });
    childLogger.error({ err: error, failures }, "source run failed");
  }
}

async function bootstrap(): Promise<void> {
  await publisher.init();

  logger.info({
    queueRaw: config.QUEUE_RAW_EVENT,
    queueQuarantine: config.QUEUE_QUARANTINE_EVENT,
    schedule: config.SCRAPE_SCHEDULE,
    enabledSources: adapters.map((adapter) => adapter.code)
  }, "scraper-service starting");

  const runAll = async (): Promise<void> => {
    if (running) {
      logger.warn("scheduled run skipped because previous run is still executing");
      return;
    }
    running = true;
    try {
      await Promise.allSettled(adapters.map((adapter) => runAdapter(adapter)));
    } finally {
      running = false;
    }
  };

  await runAll();

  cron.schedule(config.SCRAPE_SCHEDULE, () => {
    void runAll();
  });
}

void bootstrap().catch((error) => {
  logger.error({ err: error }, "scraper-service crashed");
  process.exit(1);
});
