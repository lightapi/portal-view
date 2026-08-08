import fetchClient from '../../utils/fetchClient';

export const HINDSIGHT_API = {
    host: 'lightapi.net',
    service: 'genai',
    version: '0.1.0',
} as const;

export type HindsightRow = Record<string, any> & {
    hostId: string;
    bankId: string;
    aggregateVersion?: number;
};

export type HindsightListRequest = {
    hostId: string;
    bankId?: string;
    offset: number;
    limit: number;
    filters: Array<{ id: string; value: unknown }>;
    globalFilter: string;
    sorting: Array<{ id: string; desc?: boolean }>;
    active?: boolean;
    includeRuntimeManaged?: boolean;
};

export function hindsightQueryCommand(action: string, data: Record<string, unknown>) {
    return { ...HINDSIGHT_API, action, data };
}

export function hindsightQueryUrl(action: string, data: Record<string, unknown>) {
    const command = hindsightQueryCommand(action, data);
    return '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(command));
}

export async function runHindsightQuery<T>(action: string, data: Record<string, unknown>): Promise<T> {
    return fetchClient(hindsightQueryUrl(action, data)) as Promise<T>;
}

export async function runHindsightCommand(action: string, data: Record<string, unknown>) {
    return fetchClient('/portal/command', {
        method: 'POST',
        body: hindsightQueryCommand(action, data),
    });
}

function errorCode(error: unknown) {
    if (!error || typeof error !== 'object') return '';
    const source = error as Record<string, any>;
    return String(source.code ?? source.data?.code ?? '').toUpperCase();
}

export function hindsightErrorMessage(error: unknown) {
    const code = errorCode(error);
    if (code === 'ERR11645') return 'The read model is still catching up. Refresh and try again.';
    if (code === 'ERR11637') return 'This memory record no longer exists.';
    if (code === 'ERR11000') return 'The Hindsight memory request was invalid.';
    if (code === 'HINDSIGHT_MEMORY_BANK_NOT_EMPTY') {
        return 'The bank cannot be deactivated while it has active children, linked associations, or bound interactive sessions.';
    }
    if (code === '401' || code === '403') return 'You are not authorized to administer this memory bank.';
    return 'The Hindsight memory operation failed. Please refresh and try again.';
}

export function optimisticRemove<T>(rows: T[], rowCount: number, predicate: (row: T) => boolean) {
    const nextRows = rows.filter(row => !predicate(row));
    const removed = rows.length - nextRows.length;
    return {
        nextRows,
        nextRowCount: Math.max(0, rowCount - removed),
        rollback: { rows, rowCount },
    };
}

export function compactContent(value: unknown, maximum = 160) {
    if (value == null) return '';
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text.length > maximum ? `${text.slice(0, maximum)}…` : text;
}
