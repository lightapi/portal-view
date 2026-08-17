export type InvokableTool = {
    hostId: string;
    toolId: string;
    name: string;
    apiId?: string;
    apiName?: string;
    apiVersion?: string;
    apiMethod?: string;
    apiEndpoint?: string;
    capabilityRef?: string;
    lightapiDocument?: string;
};

export type PropertySchema = {
    type?: string;
    title?: string;
    description?: string;
    default?: unknown;
    example?: unknown;
    enum?: unknown[];
};

type InputSchema = {
    properties: Record<string, PropertySchema>;
    required: string[];
};

export type InvocationModel = {
    method: string;
    endpoint: string;
    requiresConfirmation: boolean;
    inputSchema: InputSchema;
};

function objectValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown> : {};
}

export function invocationModel(tool: InvokableTool): InvocationModel {
    const document = typeof tool.lightapiDocument === 'string'
        ? objectValue(JSON.parse(tool.lightapiDocument)) : objectValue(tool.lightapiDocument);
    const operations = objectValue(document.operations);
    const operation = Object.values(operations).map(objectValue).find(candidate =>
        candidate.endpointId === tool.capabilityRef
    );
    if (!operation) throw new Error('The LightAPI operation for this Tool is unavailable.');
    const method = String(operation.method || tool.apiMethod || '').toUpperCase();
    const safety = objectValue(operation.safety);
    const input = objectValue(operation.input);
    const schema = objectValue(input.schema);
    const properties = Object.fromEntries(Object.entries(objectValue(schema.properties)).map(
        ([name, value]) => [name, objectValue(value) as PropertySchema],
    ));
    return {
        method,
        endpoint: String(operation.endpoint || tool.apiEndpoint || ''),
        requiresConfirmation: !['GET', 'HEAD'].includes(method)
            || safety.destructive === true || safety.requiresConfirmation === true,
        inputSchema: {
            properties,
            required: Array.isArray(schema.required) ? schema.required.map(String) : [],
        },
    };
}

export function argumentValue(name: string, schema: PropertySchema, raw: string): unknown {
    if (raw === '') return undefined;
    switch (schema.type) {
        case 'integer': {
            const value = Number(raw);
            if (!Number.isInteger(value)) throw new Error(`${name} must be an integer.`);
            return value;
        }
        case 'number': {
            const value = Number(raw);
            if (!Number.isFinite(value)) throw new Error(`${name} must be a number.`);
            return value;
        }
        case 'boolean':
            if (!['true', 'false'].includes(raw)) throw new Error(`${name} must be true or false.`);
            return raw === 'true';
        case 'object':
        case 'array': {
            try {
                const value = JSON.parse(raw);
                if (schema.type === 'array' ? !Array.isArray(value) : !value || typeof value !== 'object' || Array.isArray(value)) {
                    throw new Error();
                }
                return value;
            } catch {
                throw new Error(`${name} must be valid JSON ${schema.type}.`);
            }
        }
        default:
            return raw;
    }
}
