import pino from "pino";
import { describe, expect, it } from "vitest";
import { createDemoSourceAdapter } from "./demo-source";

describe("demo-source", () => {
  it("generates deterministic fallback records for local pipeline", async () => {
    const adapter = createDemoSourceAdapter({
      baseUrl: "https://demo-source.local",
      itemCount: 2
    });

    const records = await adapter.collect({
      runKey: "demo-run",
      collectedAt: "2026-04-01T00:00:00.000Z",
      requestTimeoutMs: 1000,
      logger: pino({ enabled: false })
    });

    expect(records).toHaveLength(2);
    expect(records[0]?.artifacts).toHaveLength(1);
    expect(records[1]?.artifacts).toBeUndefined();
    expect(records[0]?.url).toContain("https://demo-source.local/tenders/");
    expect(records[0]?.raw).toMatchObject({
      sourceType: "synthetic",
      stage: "demo",
      currency: "RUB"
    });
  });
});
