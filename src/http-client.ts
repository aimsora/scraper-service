import type { Logger } from "pino";
import { Agent, EnvHttpProxyAgent, fetch as undiciFetch, setGlobalDispatcher } from "undici";
import { config } from "./config";

const DEFAULT_NO_PROXY = "localhost,127.0.0.1,backend-api,postgres,redis,rabbitmq,minio";
const connectTimeoutMs = Math.max(config.REQUEST_TIMEOUT_MS, 15_000);

let configured = false;

export const fetch = undiciFetch;

export function configureHttpTransport(logger: Logger) {
  if (configured) {
    return;
  }

  const proxyConfigured = Boolean(config.HTTP_PROXY || config.HTTPS_PROXY);
  const dispatcher = proxyConfigured
    ? new EnvHttpProxyAgent({
        connect: { timeout: connectTimeoutMs },
        httpProxy: config.HTTP_PROXY,
        httpsProxy: config.HTTPS_PROXY,
        noProxy: config.NO_PROXY ?? DEFAULT_NO_PROXY
      })
    : new Agent({
        connect: { timeout: connectTimeoutMs }
      });

  setGlobalDispatcher(dispatcher);
  configured = true;

  logger.info(
    {
      proxyConfigured,
      httpProxyConfigured: Boolean(config.HTTP_PROXY),
      httpsProxyConfigured: Boolean(config.HTTPS_PROXY),
      noProxy: proxyConfigured ? config.NO_PROXY ?? DEFAULT_NO_PROXY : undefined,
      connectTimeoutMs,
      requestTimeoutMs: config.REQUEST_TIMEOUT_MS
    },
    "outbound http transport configured"
  );
}

export function describeOutboundHttpError(error: unknown, url: string): Error {
  if (!(error instanceof Error)) {
    return new Error(`Request to ${url} failed`);
  }

  const cause = error.cause as { code?: string; message?: string } | undefined;
  const errorCode = (error as { code?: string }).code ?? cause?.code;
  const errorName = error.name;
  const message = error.message || cause?.message || "Request failed";

  if (
    errorCode === "UND_ERR_CONNECT_TIMEOUT" ||
    /connect timeout/i.test(message) ||
    errorName === "TimeoutError" ||
    /aborted due to timeout/i.test(message)
  ) {
    const host = safeGetHost(url);
    const proxyHint =
      config.HTTP_PROXY || config.HTTPS_PROXY
        ? "Проверьте доступность настроенного proxy и его маршрут до целевого сайта."
        : "Настройте HTTPS_PROXY/HTTP_PROXY для выхода к ограниченным внешним площадкам.";

    return new Error(
      `Запрос к ${host} не получил ответа в пределах ${config.REQUEST_TIMEOUT_MS} мс. ${proxyHint} Исходная ошибка: ${message}`
    );
  }

  return error;
}

function safeGetHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
