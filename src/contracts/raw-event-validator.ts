import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { RawSourceEvent } from "../types";

export function createRawEventValidator(sharedContractsDir: string) {
  const schemaPath = join(sharedContractsDir, "events", "source-raw.v1.json");
  const schema = JSON.parse(readFileSync(schemaPath, "utf-8"));
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile<RawSourceEvent>(schema);

  return (event: RawSourceEvent): void => {
    const isValid = validate(event);
    if (isValid) {
      return;
    }

    const details = (validate.errors ?? [])
      .map((err) => `${err.instancePath || "/"} ${err.message}`)
      .join("; ");
    throw new Error(`Raw event не прошел валидацию: ${details}`);
  };
}
