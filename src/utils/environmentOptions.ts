export type EnvironmentOption = { id: string; label: string };

export function environmentOptions(value: unknown): EnvironmentOption[] {
    const source = Array.isArray(value)
        ? value
        : value && typeof value === 'object'
            ? (value as { data?: unknown; options?: unknown; values?: unknown; items?: unknown }).data
                ?? (value as { options?: unknown }).options
                ?? (value as { values?: unknown }).values
                ?? (value as { items?: unknown }).items
            : [];
    if (!Array.isArray(source)) return [];

    const seen = new Set<string>();
    return source.flatMap(item => {
        if (typeof item === 'string') {
            if (seen.has(item)) return [];
            seen.add(item);
            return [{ id: item, label: item }];
        }
        if (!item || typeof item !== 'object') return [];
        const option = item as Record<string, unknown>;
        const rawId = option.id ?? option.value ?? option.code ?? option.key ?? option.name;
        if (rawId == null) return [];
        const id = String(rawId);
        if (seen.has(id)) return [];
        seen.add(id);
        return [{
            id,
            label: String(option.label ?? option.name ?? option.displayName ?? option.value ?? option.description ?? id),
        }];
    });
}

export function selectEnvironmentId(options: EnvironmentOption[], preferred: string) {
    if (!options.length) return '';
    const normalized = preferred.trim().toLocaleLowerCase();
    return options.find(option => option.id === preferred)?.id
        ?? options.find(option => option.id.toLocaleLowerCase() === normalized)?.id
        ?? options.find(option => option.label.toLocaleLowerCase() === normalized)?.id
        ?? options[0].id;
}
