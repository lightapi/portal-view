import { describe, expect, it } from 'vitest';
import { argumentValue, invocationModel, type InvokableTool } from './toolInvocationModel';

const tool = (method = 'GET'): InvokableTool => ({
    hostId: '10000000-0000-0000-0000-000000000001',
    toolId: '20000000-0000-0000-0000-000000000001',
    name: 'getCustomerProfile',
    apiId: 'API0004',
    apiVersion: '1.0.0',
    capabilityRef: 'API0004/getCustomerProfile',
    lightapiDocument: JSON.stringify({
        operations: {
            getCustomerProfile: {
                endpointId: 'API0004/getCustomerProfile',
                protocol: 'http',
                method,
                endpoint: '/customers/{customerId}',
                authentication: { type: 'none' },
                safety: { destructive: false, requiresConfirmation: false },
                input: {
                    schema: {
                        type: 'object',
                        properties: {
                            customerId: { type: 'string', description: 'Customer identifier.' },
                            channel: { type: 'string', default: 'portal' },
                        },
                        required: ['customerId'],
                    },
                },
            },
        },
    }),
});

describe('ToolInvokeDialog model', () => {
    it('extracts the selected capability operation and input schema', () => {
        const model = invocationModel(tool());

        expect(model.method).toBe('GET');
        expect(model.endpoint).toBe('/customers/{customerId}');
        expect(model.requiresConfirmation).toBe(false);
        expect(model.inputSchema.required).toEqual(['customerId']);
        expect(model.inputSchema.properties.channel.default).toBe('portal');
    });

    it('requires confirmation for write methods', () => {
        expect(invocationModel(tool('POST')).requiresConfirmation).toBe(true);
    });

    it('converts typed input values', () => {
        expect(argumentValue('count', { type: 'integer' }, '2')).toBe(2);
        expect(argumentValue('enabled', { type: 'boolean' }, 'true')).toBe(true);
        expect(argumentValue('filters', { type: 'object' }, '{"state":"ON"}')).toEqual({ state: 'ON' });
        expect(() => argumentValue('count', { type: 'integer' }, '2.5')).toThrow('integer');
    });
});
