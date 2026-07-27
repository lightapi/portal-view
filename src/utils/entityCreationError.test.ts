import {describe, expect, it} from 'vitest';
import {entityCreationFeedback, isTerminalEntityCreationError} from './entityCreationError';

describe('entityCreationFeedback', () => {
  it('reads nested gateway status shapes', () => {
    expect(entityCreationFeedback({status: {code: 'ENTITY_RETIRED'}})).toEqual({
      code: 'ENTITY_RETIRED',
      message: 'This name belongs to a retired entity. Restore it or choose a different name.',
    });
  });

  it('does not surface raw backend text for an unmapped code', () => {
    const feedback = entityCreationFeedback({
      code: 'ERR10010',
      description: 'Unique index or primary key violation: "PUBLIC.PRIMARY_KEY_6 ON PUBLIC.CATEGORY_T"',
    });
    expect(feedback.code).toBe('ERR10010');
    expect(feedback.message).not.toContain('PUBLIC.CATEGORY_T');
    expect(feedback.message).toBe('The create request could not be completed. Please try again.');
  });

  it('distinguishes terminal conflicts from an uncertain outcome', () => {
    expect(isTerminalEntityCreationError('ENTITY_ALREADY_EXISTS')).toBe(true);
    expect(isTerminalEntityCreationError('NETWORK_OUTCOME_UNKNOWN')).toBe(false);
  });
});
