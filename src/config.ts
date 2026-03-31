import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  RABBITMQ_URL: z.string().default("amqp://app:app@localhost:5672"),
  QUEUE_RAW_EVENT: z.string().default("source.raw.v1"),
  QUEUE_QUARANTINE_EVENT: z.string().default("source.raw.quarantine.v1"),
  SCRAPE_SCHEDULE: z.string().default("*/30 * * * *"),
  SHARED_CONTRACTS_DIR: z.string().default("../shared-contracts"),
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("ru-central-1"),
  S3_ACCESS_KEY: z.string().default("minio"),
  S3_SECRET_KEY: z.string().default("minio123"),
  S3_BUCKET: z.string().default("scraper-artifacts"),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  ENABLED_SOURCES: z.string().default("demo-source"),
  FIND_TENDER_API_URL: z
    .string()
    .default("https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages?limit=5"),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  RETRY_ATTEMPTS: z.coerce.number().int().positive().default(3),
  RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(1000)
});

export const config = envSchema.parse(process.env);
