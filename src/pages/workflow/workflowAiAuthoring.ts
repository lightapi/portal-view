import YAML from 'yaml';

export type AuthoringProvenance = {
    generatorModel: string;
    promptTemplateVersion: string;
    sourceSchemaDigests: Record<string, string>;
    requestDigest: string;
    generatedDefinitionDigest: string;
    generatedAt: string;
};

function recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function attachAiAuthoringApproval(definition: string, provenance: AuthoringProvenance, reviewerUserId: string) {
    const parsed = recordValue(YAML.parse(definition));
    const document = recordValue(parsed.document);
    const metadata = recordValue(document.metadata);
    document.metadata = {
        ...metadata,
        aiAuthoring: {
            ...provenance,
            reviewerApproval: {
                approved: true,
                reviewerUserId,
                approvedAt: new Date().toISOString(),
                reviewMethod: 'portal-diff',
            },
        },
    };
    parsed.document = document;
    return `${YAML.stringify(parsed).trimEnd()}\n`;
}

export function buildDefinitionDiff(currentDefinition: string, proposedDefinition: string) {
    const current = currentDefinition.split('\n');
    const proposed = proposedDefinition.split('\n');
    let prefix = 0;
    while (prefix < current.length && prefix < proposed.length && current[prefix] === proposed[prefix]) prefix += 1;
    let suffix = 0;
    while (suffix < current.length - prefix && suffix < proposed.length - prefix
        && current[current.length - 1 - suffix] === proposed[proposed.length - 1 - suffix]) suffix += 1;
    const removed = current.slice(prefix, current.length - suffix);
    const added = proposed.slice(prefix, proposed.length - suffix);
    const lines = [
        ...removed.slice(0, 120).map(line => `- ${line}`),
        ...added.slice(0, 120).map(line => `+ ${line}`),
    ];
    if (removed.length > 120 || added.length > 120) lines.push('… diff truncated; inspect the proposed YAML before approval.');
    return { removed: removed.length, added: added.length, text: lines.join('\n') || 'No textual changes.' };
}
