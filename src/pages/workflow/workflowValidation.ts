export type ValidationProblem = {
    severity: 'error' | 'warning';
    message: string;
    from?: number;
    to?: number;
    line?: number;
    column?: number;
    instancePath?: string;
    schemaPath?: string;
    keyword?: string;
};

export type WorkflowSchemaIdentity = {
    id: string;
    version: string;
    digest: string;
};

export type ServerValidationResult = {
    ok: boolean;
    unavailable?: boolean;
    problems: ValidationProblem[];
    blockingProblem?: ValidationProblem;
    schema?: WorkflowSchemaIdentity;
};

function toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textValue(value: unknown) {
    return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
}

export function formatProblemLocation(problem: ValidationProblem) {
    const prefix = problem.severity === 'error' ? 'Error' : 'Warning';
    if (problem.line && problem.column) {
        return `${prefix} at line ${problem.line}, column ${problem.column}`;
    }
    if (problem.instancePath) {
        return `${prefix} at ${problem.instancePath}${problem.keyword ? ` (${problem.keyword})` : ''}`;
    }
    return prefix;
}

export function normalizeServerProblems(value: unknown): ValidationProblem[] {
    return Array.isArray(value)
        ? value.map(toRecord).map(problem => ({
            severity: problem.severity === 'error' ? 'error' : 'warning',
            message: textValue(problem.message) || 'Server validation problem.',
            instancePath: textValue(problem.instancePath) || undefined,
            schemaPath: textValue(problem.schemaPath) || undefined,
            keyword: textValue(problem.keyword) || undefined,
        }))
        : [];
}

export function interpretServerValidationResponse(value: unknown): ServerValidationResult {
    const response = toRecord(value);
    const problems = normalizeServerProblems(response.problems);
    const schema = {
        id: textValue(response.schemaId),
        version: textValue(response.schemaVersion),
        digest: textValue(response.schemaDigest),
    };
    const hasSchemaIdentity = Boolean(schema.id && schema.version && /^[0-9a-f]{64}$/.test(schema.digest));
    if (!hasSchemaIdentity) {
        problems.push({ severity: 'error', message: 'Server validation did not identify the bundled workflow schema.' });
    }
    if (response.valid !== true && !problems.some(problem => problem.severity === 'error')) {
        problems.push({ severity: 'error', message: 'Server validation did not confirm that the workflow is valid.' });
    }
    const blockingProblem = problems.find(problem => problem.severity === 'error');
    return {
        ok: response.valid === true && !blockingProblem,
        problems,
        blockingProblem,
        schema: hasSchemaIdentity ? schema : undefined,
    };
}
