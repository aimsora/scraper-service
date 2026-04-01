import type { SourceAdapter } from "./adapter";

type DemoSourceConfig = {
  baseUrl: string;
  itemCount: number;
};

const demoSeeds = [
  {
    slug: "pipeline-fallback",
    title: "Поставка элементов трубопровода",
    customer: "АО Демонстрационная АЭС",
    supplier: "ООО Учебный Поставщик",
    amount: 3200000,
    description: "Демонстрационный тендер для локального end-to-end сценария."
  },
  {
    slug: "artifact-optional",
    title: "Поставка насосного оборудования",
    customer: "ГБУ Тестовый Заказчик",
    supplier: "ООО Надежный Интегратор",
    amount: 1850000,
    description: "Запись без артефактов, чтобы локально проверить optional artifact flow."
  },
  {
    slug: "retry-observability",
    title: "Техническое обслуживание лабораторного стенда",
    customer: "ФГБУ Учебный центр закупок",
    supplier: "ООО Поставщик Данных",
    amount: 760000,
    description: "Демонстрационная запись для проверки логов и устойчивости pipeline."
  }
] as const;

export function createDemoSourceAdapter(config: DemoSourceConfig): SourceAdapter {
  return {
    code: "demo-source",
    name: "Demo Source",
    async collect(context) {
      const records = Array.from({ length: config.itemCount }, (_, index) => {
        const seed = demoSeeds[index % demoSeeds.length];
        const externalId = `demo-${new Date(context.collectedAt).getTime()}-${index + 1}`;
        const url = `${config.baseUrl.replace(/\/$/, "")}/tenders/${seed.slug}-${index + 1}`;
        const html = renderDemoHtml({
          externalId,
          collectedAt: context.collectedAt,
          title: seed.title,
          customer: seed.customer,
          supplier: seed.supplier,
          amount: seed.amount,
          description: seed.description,
          url
        });

        return {
          url,
          raw: {
            externalId,
            title: seed.title,
            customer: seed.customer,
            supplier: seed.supplier,
            amount: seed.amount,
            currency: "RUB",
            publishedAt: context.collectedAt,
            description: seed.description,
            stage: "demo",
            sourceType: "synthetic"
          },
          metadata: {
            adapter: "demo-source",
            demo: true,
            demoItemIndex: index + 1
          },
          artifacts:
            index === 0
              ? [
                  {
                    kind: "RAW_HTML" as const,
                    fileName: `demo-source-${index + 1}.html`,
                    contentType: "text/html; charset=utf-8",
                    body: html
                  }
                ]
              : undefined
        };
      });

      context.logger.info(
        { generatedItems: records.length, baseUrl: config.baseUrl },
        "demo-source generated fallback records"
      );

      return records;
    }
  };
}

function renderDemoHtml(input: {
  externalId: string;
  collectedAt: string;
  title: string;
  customer: string;
  supplier: string;
  amount: number;
  description: string;
  url: string;
}): string {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>${input.title}</title>
  </head>
  <body>
    <main>
      <h1>${input.title}</h1>
      <p>${input.description}</p>
      <dl>
        <dt>External ID</dt>
        <dd>${input.externalId}</dd>
        <dt>Customer</dt>
        <dd>${input.customer}</dd>
        <dt>Supplier</dt>
        <dd>${input.supplier}</dd>
        <dt>Amount</dt>
        <dd>${input.amount} RUB</dd>
        <dt>Collected At</dt>
        <dd>${input.collectedAt}</dd>
        <dt>Source URL</dt>
        <dd>${input.url}</dd>
      </dl>
    </main>
  </body>
</html>`;
}
