export type EntityCreationFeedback = {
  code: string;
  message: string;
};

const GENERIC_MESSAGE = "The create request could not be completed. Please try again.";

const messages: Record<string, string> = {
  ENTITY_ALREADY_EXISTS: "This entity already exists in the selected scope.",
  ENTITY_RETIRED: "This name belongs to a retired entity. Restore it or choose a different name.",
  IDEMPOTENCY_KEY_REUSED: "This retry key was already used for a different request. Submit again to start a new create attempt.",
};
const terminalCodes = new Set(Object.keys(messages));

function candidateObjects(error: unknown): any[] {
  if (!error || typeof error !== "object") return [];
  const source = error as any;
  return [source, source.error, source.status, source.response, source.response?.data]
    .filter((candidate) => candidate && typeof candidate === "object");
}

export function entityCreationFeedback(error: unknown): EntityCreationFeedback {
  const candidates = candidateObjects(error);
  const code = candidates
    .map((candidate) => candidate.code ?? candidate.statusCode)
    .find((candidate) => typeof candidate === "string") ?? "ENTITY_CREATE_FAILED";
  const mapped = messages[code];
  if (mapped) return {code, message: mapped};
  // Unmapped codes may carry raw backend text such as constraint or schema
  // names. Surface a generic message and keep the detail in developer logging
  // only.
  const detail = candidates
    .map((candidate) => candidate.message ?? candidate.description)
    .find((candidate) => typeof candidate === "string")
    ?? (error instanceof Error ? error.message : String(error));
  if (import.meta.env?.DEV) console.warn("Unmapped entity-creation error", code, detail);
  return {code, message: GENERIC_MESSAGE};
}

export function isTerminalEntityCreationError(code: string): boolean {
  return terminalCodes.has(code);
}
