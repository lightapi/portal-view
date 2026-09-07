/** API type codes only; the runtime product id `agt` is a different identifier.
 * Deploy the #890 backend reader/writer and replay normalization before this frontend.
 * Historical input remains accepted at the boundary, but new writes are canonical.
 */
export const AGENT_API_TYPE_OPTION = "agent";
export const AGENT_API_TYPE_STORED = "agent";
// Canonical-only database reads require the #890 writer/replay rollout and migration.
export const AGENT_API_TYPE_CODES: readonly string[] = ["agent"];
export function canonicalApiType(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
export function isAgentApiType(value: unknown): boolean {
  return ["agt", "agent"].includes(canonicalApiType(value));
}
export function apiTypeForDisplay(value: unknown): string {
  const normalized = canonicalApiType(value);
  return normalized === "agt" ? "agent" : normalized;
}
export function apiTypeForStorage(value: unknown): string {
  return apiTypeForDisplay(value);
}
