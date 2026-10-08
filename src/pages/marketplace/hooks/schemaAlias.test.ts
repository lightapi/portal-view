import { describe, expect, it } from 'vitest';
import { SCHEMA_ALIAS_PATTERN, schemaAliasUrlProblem, schemaExternalPath } from './useSchemaCatalog';

describe('schema alias URL contract', () => {
  it('mirrors the schema command rule ^[a-z0-9_-]+$', () => {
    expect(SCHEMA_ALIAS_PATTERN.source).toBe('^[a-z0-9_-]+$');
    for (const alias of ['petstore', 'pet-store_v1', '0']) {
      expect(schemaAliasUrlProblem({ schemaAlias: alias })).toBeNull();
      expect(schemaExternalPath({ schemaAlias: alias })).toBe(`/r/schema/${alias}`);
    }
  });

  it('flags non-compliant aliases and encodes them so apiUrl can still reject separators', () => {
    for (const alias of ['Pet', 'a b', 'a/b', '..', 'a#b', 'é']) {
      expect(schemaAliasUrlProblem({ schemaAlias: alias })).toContain(`'${alias}' is not URL-friendly`);
    }
    expect(schemaExternalPath({ schemaAlias: 'a/b' })).toBe('/r/schema/a%2Fb');
    expect(schemaExternalPath({ schemaAlias: 'a#b' })).toBe('/r/schema/a%23b');
  });

  it('treats a missing alias as no URL rather than an alias problem', () => {
    expect(schemaAliasUrlProblem({ schemaAlias: null })).toBeNull();
    expect(schemaExternalPath({ schemaAlias: null })).toBe('');
  });
});
