import { describe, expect, it } from 'vitest';
import {
    formatProblemLocation,
    interpretServerValidationResponse,
    normalizeServerProblems,
} from './workflowValidation';

describe('workflow editor server validation', () => {
    it('retains schema paths and keywords for actionable diagnostics', () => {
        const [problem] = normalizeServerProblems([{
            severity: 'error',
            message: 'document is required',
            instancePath: '$',
            schemaPath: '$.required',
            keyword: 'required',
        }]);

        expect(problem).toMatchObject({
            severity: 'error',
            instancePath: '$',
            schemaPath: '$.required',
            keyword: 'required',
        });
        expect(formatProblemLocation(problem)).toBe('Error at $ (required)');
    });

    it('accepts only an explicit valid result with pinned schema identity', () => {
        const result = interpretServerValidationResponse({
            valid: true,
            problems: [],
            schemaId: 'https://agentic-workflow.org/schemas/1.0.3/workflow.yaml',
            schemaVersion: '1.0.3',
            schemaDigest: 'a'.repeat(64),
        });

        expect(result.ok).toBe(true);
        expect(result.schema?.version).toBe('1.0.3');
    });

    it('fails closed when validity or schema identity is missing', () => {
        const missingValidity = interpretServerValidationResponse({
            problems: [],
            schemaId: 'schema-id',
            schemaVersion: '1.0.3',
            schemaDigest: 'a'.repeat(64),
        });
        const missingSchema = interpretServerValidationResponse({ valid: true, problems: [] });

        expect(missingValidity.ok).toBe(false);
        expect(missingValidity.blockingProblem?.message).toContain('did not confirm');
        expect(missingSchema.ok).toBe(false);
        expect(missingSchema.blockingProblem?.message).toContain('did not identify');
    });
});
