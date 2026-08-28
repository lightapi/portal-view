export function loadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (!error || typeof error !== 'object') {
    return 'The request failed without an error response.';
  }

  const root = error as Record<string, unknown>;
  const nested = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const nestedError = nested(root.error);
  const data = nested(root.data);
  const errorData = nested(nestedError.data);
  const candidates = [
    errorData.description,
    data.description,
    nestedError.description,
    root.description,
    errorData.message,
    data.message,
    nestedError.message,
    root.message,
  ];
  const details = [...new Set(candidates
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    .map((value) => value.trim()))];
  if (details.length) return details.join(' — ');

  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== '{}') return serialized;
  } catch {
    // Fall through to the stable fallback below.
  }
  return 'The request failed without an error message.';
}
