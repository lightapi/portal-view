import forms from '../../../data/Forms.json';
import type { ReplayFailure } from './types';

export type ReplayRepairFormDefinition = {
  formId: string;
  eventType: string;
  eventSchemaVersion: string;
  repairSchemaVersion: string;
  schema: Record<string, unknown>;
  form: unknown[];
};

export type ReplayRepairFormSelection = {
  definition: ReplayRepairFormDefinition;
  eventIds: string[];
  changeShape: 'SINGLE_EVENT_FIELDS' | 'PER_EVENT_FIELDS';
};

const definitions = Object.values(forms).filter((value): value is ReplayRepairFormDefinition => {
  const candidate = value as Partial<ReplayRepairFormDefinition>;
  return typeof candidate.repairSchemaVersion === 'string'
    && typeof candidate.eventType === 'string'
    && typeof candidate.eventSchemaVersion === 'string'
    && !!candidate.schema && Array.isArray(candidate.form);
});

export function repairFormFor(failure: ReplayFailure): ReplayRepairFormSelection | null {
  const matches = definitions.map((definition) => ({
    definition,
    events: failure.events.filter((event) => event.eventType === definition.eventType
      && event.schemaVersion === definition.eventSchemaVersion),
  })).filter((match) => match.events.length);
  // One repair binds one repairSchemaVersion. Fail closed instead of selecting
  // by Forms.json insertion order when a mixed transaction or duplicate
  // definition produces more than one possible form.
  if (matches.length !== 1) return null;
  const match = matches[0];
  return {
    definition: match.definition,
    eventIds: match.events.map((event) => event.eventId),
    changeShape: match.events.length === 1 ? 'SINGLE_EVENT_FIELDS' : 'PER_EVENT_FIELDS',
  };
}
