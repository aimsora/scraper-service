import type { SourceAdapter } from "./adapter";

type FindTenderConfig = {
  apiUrl: string;
};

export function createFindTenderAdapter(config: FindTenderConfig): SourceAdapter {
  return {
    code: "find-tender",
    name: "Find a Tender (UK)",
    async collect(context) {
      const response = await fetch(config.apiUrl, {
        signal: AbortSignal.timeout(context.requestTimeoutMs),
        headers: {
          accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Find a Tender returned ${response.status}`);
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const releases = extractReleases(payload).slice(0, 5);

      return releases
        .map((release) => normalizeRelease(release))
        .filter(isNormalizedRelease)
        .map((release) => ({
          url: release.url,
          raw: release.raw,
          metadata: {
            adapter: "find-tender",
            apiUrl: config.apiUrl
          },
          artifacts: [
            {
              kind: "RAW_JSON",
              fileName: `${release.externalId}.json`,
              contentType: "application/json",
              body: JSON.stringify(release.raw, null, 2),
              metadata: {
                externalId: release.externalId
              }
            }
          ]
        }));
    }
  };
}

function isNormalizedRelease(
  value: ReturnType<typeof normalizeRelease>
): value is NonNullable<ReturnType<typeof normalizeRelease>> {
  return value !== null;
}

function extractReleases(payload: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(payload.releases)) {
    return payload.releases.filter(isRecord);
  }

  if (Array.isArray(payload.records)) {
    return payload.records
      .filter(isRecord)
      .flatMap((record) => {
        if (Array.isArray(record.releases)) {
          return record.releases.filter(isRecord);
        }
        return isRecord(record.compiledRelease) ? [record.compiledRelease] : [];
      });
  }

  return [];
}

function normalizeRelease(release: Record<string, unknown>) {
  const tender = isRecord(release.tender) ? release.tender : {};
  const awards = Array.isArray(release.awards) ? release.awards.filter(isRecord) : [];
  const firstAward = awards[0] ?? {};
  const parties = Array.isArray(release.parties) ? release.parties.filter(isRecord) : [];
  const buyerParty =
    parties.find((party) => Array.isArray(party.roles) && party.roles.includes("buyer")) ?? {};
  const suppliers = Array.isArray(firstAward.suppliers)
    ? firstAward.suppliers.filter(isRecord)
    : [];
  const value = isRecord(firstAward.value)
    ? firstAward.value
    : isRecord(tender.value)
      ? tender.value
      : {};
  const noticeId = asString(release.id);
  const ocid = asString(release.ocid);
  const title = asString(tender.title);

  if (!ocid || !title) {
    return null;
  }

  return {
    externalId: ocid,
    url: noticeId
      ? `https://www.find-tender.service.gov.uk/Notice/${encodeURIComponent(noticeId)}`
      : "https://www.find-tender.service.gov.uk",
    raw: {
      ocid,
      noticeId,
      title,
      buyer: asString((buyerParty as Record<string, unknown>).name),
      supplier: asString((suppliers[0] ?? {})["name"]),
      amount: asNumber(value.amount),
      currency: asString(value.currency),
      publishedAt: asString(release.date),
      deadlineAt: asString(isRecord(tender.tenderPeriod) ? tender.tenderPeriod.endDate : undefined),
      description: asString(tender.description),
      stage: Array.isArray(release.tag) ? release.tag.join(",") : undefined
    } as Record<string, unknown>
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
