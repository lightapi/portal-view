import fetchClient from './fetchClient';

/** Read a stable, server-filtered relationship collection without the first-page cap.
 * Fail rather than return an incomplete collection if a server ignores pagination.
 */
export async function fetchAllQueryRows<T extends Record<string, unknown>>(
  service: string, action: string, data: Record<string, unknown>, collection: string,
): Promise<T[]> {
  const limit = 1000;
  const rows: T[] = [];
  const pages = new Set<string>();
  for (let offset = 0; ; offset += limit) {
    const cmd = { host: 'lightapi.net', service, action, version: '0.1.0', data: { ...data, offset, limit } };
    const payload = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
    const page = payload?.[collection];
    if (!Array.isArray(page)) throw new Error(`Invalid ${action} collection`);
    if (page.length === 0) return rows;
    const fingerprint = JSON.stringify(page);
    if (pages.has(fingerprint)) throw new Error(`${action} did not advance its page`);
    pages.add(fingerprint);
    rows.push(...page as T[]);
    if (page.length < limit) return rows;
  }
}
