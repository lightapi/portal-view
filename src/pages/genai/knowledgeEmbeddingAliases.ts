export type EmbeddingSpace = {
    spaceId: string; revision: number; dimension: number; normalization: string;
    distanceMetric: string; documentInputTransformVersion: string;
};

export type QualifiedEmbeddingAliasRow = {
    aliasOwnerHostId: string; publicAliasId: string; aliasName: string;
    embeddingSpace: EmbeddingSpace; eligibleRouteCount: number;
};

export function qualifiedAliasKey(alias: QualifiedEmbeddingAliasRow) {
    return `${alias.aliasOwnerHostId}:${alias.publicAliasId}`;
}

export function normalizeQualifiedEmbeddingAliases(response: unknown): QualifiedEmbeddingAliasRow[] {
    if (!Array.isArray(response)) return [];
    return response.flatMap(value => {
        if (!value || typeof value !== 'object') return [];
        const row = value as Record<string, unknown>;
        const rawSpace = row.embeddingSpace ?? row.embedding_space;
        let space: Record<string, unknown> | null = null;
        if (rawSpace && typeof rawSpace === 'object') {
            space = rawSpace as Record<string, unknown>;
        } else if (typeof rawSpace === 'string') {
            try {
                const parsed = JSON.parse(rawSpace);
                if (parsed && typeof parsed === 'object') space = parsed as Record<string, unknown>;
            } catch {
                return [];
            }
        }
        const aliasOwnerHostId = String(row.aliasOwnerHostId ?? row.alias_owner_host_id ?? '');
        const publicAliasId = String(row.publicAliasId ?? row.public_alias_id ?? '');
        const aliasName = String(row.aliasName ?? row.alias_name ?? '');
        const spaceId = String(space?.spaceId ?? space?.space_id ?? '');
        const revision = Number(space?.revision);
        const dimension = Number(space?.dimension);
        const normalization = String(space?.normalization ?? '');
        const distanceMetric = String(space?.distanceMetric ?? space?.distance_metric ?? '');
        const documentInputTransformVersion = String(
            space?.documentInputTransformVersion ?? space?.document_input_transform_version ?? '');
        if (!aliasOwnerHostId || !publicAliasId || !aliasName || !spaceId
            || !Number.isInteger(revision) || revision <= 0
            || !Number.isInteger(dimension) || dimension <= 0
            || !normalization || !distanceMetric || !documentInputTransformVersion) return [];
        return [{
            aliasOwnerHostId, publicAliasId, aliasName,
            embeddingSpace: {
                spaceId, revision, dimension, normalization, distanceMetric,
                documentInputTransformVersion,
            },
            eligibleRouteCount: Number(row.eligibleRouteCount ?? row.eligible_route_count ?? 0),
        }];
    });
}
