import type { SourceAdapter } from "./adapter";
import { createDemoSourceAdapter } from "./demo-source";
import { createFindTenderAdapter } from "./find-tender-source";

type AppConfig = (typeof import("../config"))["config"];
type SourceResolverConfig = Pick<
  AppConfig,
  "DEMO_SOURCE_BASE_URL" | "DEMO_SOURCE_ITEM_COUNT" | "ENABLED_SOURCES" | "FIND_TENDER_API_URL"
>;

type SourceFactory = () => SourceAdapter;

export type EnabledSourcesResolution = {
  requestedCodes: string[];
  loadedCodes: string[];
  unknownCodes: string[];
  fallbackApplied: boolean;
  adapters: SourceAdapter[];
};

export function resolveEnabledSources(config: SourceResolverConfig): EnabledSourcesResolution {
  const factories = createSourceFactories(config);
  const requestedCodes = config.ENABLED_SOURCES;
  const knownCodes = requestedCodes.filter((code) => code in factories);
  const unknownCodes = requestedCodes.filter((code) => !(code in factories));
  const fallbackApplied = knownCodes.length === 0;
  const loadedCodes = fallbackApplied ? ["demo-source"] : knownCodes;

  return {
    requestedCodes,
    loadedCodes,
    unknownCodes,
    fallbackApplied,
    adapters: loadedCodes.map((code) => factories[code]())
  };
}

function createSourceFactories(config: SourceResolverConfig): Record<string, SourceFactory> {
  return {
    "demo-source": () =>
      createDemoSourceAdapter({
        baseUrl: config.DEMO_SOURCE_BASE_URL,
        itemCount: config.DEMO_SOURCE_ITEM_COUNT
      }),
    "find-tender": () =>
      createFindTenderAdapter({
        apiUrl: config.FIND_TENDER_API_URL
      })
  };
}
