import fetchClient from "../utils/fetchClient";

const TOKEN_EXCHANGE_RETRY_ATTEMPTS = 10;
const TOKEN_EXCHANGE_RETRY_DELAY_MS = 500;
const NON_RETRYABLE_EXCHANGE_ERRORS = new Set([
  "ERR10000",
  "ERR10001",
  "ERR10036",
  "ERR10038",
  "ERR11000",
]);

const wait = (delayMs: number) =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

const exchangeErrorCode = (error: unknown) => {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : "";
  }
  return "";
};

const shouldRetryExchange = (error: unknown) => {
  const code = exchangeErrorCode(error);
  return !code || !NON_RETRYABLE_EXCHANGE_ERRORS.has(code);
};

const requestTokenExchange = (microsoftIdToken: string) =>
  fetchClient("/auth/ms/exchange", {
    headers: {
      Authorization: `Bearer ${microsoftIdToken}`,
    },
  });

export const exchangeToken = async (microsoftIdToken: string) => {
  if (!microsoftIdToken) {
    throw new Error("Missing Microsoft id token for exchange");
  }

  for (let attempt = 1; attempt <= TOKEN_EXCHANGE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await requestTokenExchange(microsoftIdToken);
    } catch (error) {
      if (
        attempt === TOKEN_EXCHANGE_RETRY_ATTEMPTS ||
        !shouldRetryExchange(error)
      ) {
        console.error("Token exchange error:", error);
        throw error;
      }

      await wait(TOKEN_EXCHANGE_RETRY_DELAY_MS);
    }
  }

  throw new Error("Token exchange retry loop exhausted");
};

export const logoutFromBackend = async () => {
  try {
    await fetchClient("/auth/ms/logout");
  } catch (error) {
    console.error("Backend logout error:", error);
    throw error;
  }
};
