import { describe, expect, it } from 'vitest';
import { environmentOptions, selectEnvironmentId } from './environmentOptions';

describe('environmentOptions', () => {
    it('normalizes labels and ids from the environment data endpoint', () => {
        expect(environmentOptions({ data: [
            { id: 'loc', label: 'Local' },
            { value: 'demo', name: 'Demo' },
            'prod',
        ] })).toEqual([
            { id: 'loc', label: 'Local' },
            { id: 'demo', label: 'Demo' },
            { id: 'prod', label: 'prod' },
        ]);
    });

    it('maps the legacy local default to the matching option label', () => {
        expect(selectEnvironmentId([
            { id: 'dev', label: 'Development' },
            { id: 'loc', label: 'Local' },
        ], 'local')).toBe('loc');
    });
});
