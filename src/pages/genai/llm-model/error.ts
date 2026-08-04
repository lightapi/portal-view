export function llmErrorMessage(reason: unknown): string {
  if (reason instanceof Error && reason.message.trim()) return reason.message;
  if (typeof reason === 'string' && reason.trim()) return reason;
  if (!reason || typeof reason !== 'object') return 'The LLM operation failed without an error response.';

  const root = reason as Record<string, unknown>;
  const nested = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const error = nested(root.error);
  const data = nested(root.data);
  const errorData = nested(error.data);
  const candidates = [
    errorData.description, data.description, root.description,
    errorData.message, data.message, error.message, root.message,
  ];
  const details = [...new Set(candidates
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .map(value => value.trim()))];
  if (details.length) return details.join(' — ');
  try {
    const serialized = JSON.stringify(reason);
    if (serialized && serialized !== '{}') return serialized;
  } catch {
    // Fall through to a stable message when the response cannot be serialized.
  }
  return 'The LLM operation failed without an error message.';
}
