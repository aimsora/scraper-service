import { randomUUID } from "node:crypto";
import type { SourceAdapter } from "./adapter";

export const demoSourceAdapter: SourceAdapter = {
  code: "demo-source",
  name: "Demo Source",
  async collect(context) {
  const sourceUrl = "https://example.org";
    const response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(context.requestTimeoutMs)
    });
    const html = await response.text();

    return [
      {
        url: sourceUrl,
        raw: {
          externalId: `demo-${randomUUID()}`,
          title: "Поставка элементов трубопровода",
          customer: "АО Демонстрационная АЭС",
          supplier: "ООО Учебный Поставщик",
          amount: 3200000,
          currency: "RUB",
          publishedAt: context.collectedAt,
          description: "Демонстрационный источник для локального end-to-end сценария.",
          pageTitle: html.match(/<title>(.*?)<\/title>/i)?.[1] ?? "Example Domain"
        },
        metadata: {
          adapter: "demo-source"
        },
        artifacts: [
          {
            kind: "RAW_HTML",
            fileName: "page.html",
            contentType: "text/html; charset=utf-8",
            body: html
          }
        ]
      }
    ];
  }
};
