import fetchClient from '../../utils/fetchClient';
import type { Option } from './types';

export async function fetchOptions(url: string): Promise<Option[]> {
  try {
    const data = await fetchClient(url);
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        value: item.value ?? item.id ?? String(item),
        label: item.label ?? item.name ?? item.value ?? String(item),
      }));
    }
    return [];
  } catch {
    return [];
  }
}
