import { describe, expect, it } from "vitest";
import { resolveEnabledSources } from "./index";

describe("resolveEnabledSources", () => {
  it("keeps known sources from ENABLED_SOURCES", () => {
    const resolution = resolveEnabledSources({
      ENABLED_SOURCES: ["demo-source", "find-tender"],
      DEMO_SOURCE_BASE_URL: "https://demo-source.local",
      DEMO_SOURCE_ITEM_COUNT: 2,
      FIND_TENDER_API_URL: "https://example.test/api"
    });

    expect(resolution.loadedCodes).toEqual(["demo-source", "find-tender"]);
    expect(resolution.unknownCodes).toEqual([]);
    expect(resolution.fallbackApplied).toBe(false);
  });

  it("falls back to demo-source when env contains only unknown values", () => {
    const resolution = resolveEnabledSources({
      ENABLED_SOURCES: ["unknown-source"],
      DEMO_SOURCE_BASE_URL: "https://demo-source.local",
      DEMO_SOURCE_ITEM_COUNT: 2,
      FIND_TENDER_API_URL: "https://example.test/api"
    });

    expect(resolution.loadedCodes).toEqual(["demo-source"]);
    expect(resolution.unknownCodes).toEqual(["unknown-source"]);
    expect(resolution.fallbackApplied).toBe(true);
  });
});
