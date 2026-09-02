import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/operational-store-registration-v2.json';
import {
  OPERATIONAL_STORE_REGISTRATION_CONTRACT_VERSION,
  OPERATIONAL_STORE_SCOPE_KIND,
  OPERATIONAL_STORE_USER_FIELDS,
  operationalStoreBindingDigestV2,
  validateOperationalStoreRegistrationRequestV2,
} from './operationalStoreRegistrationContract';

describe('operational-store registration v2 contract', () => {
  it('freezes the Host-scoped fields and canonical digest', async () => {
    expect(OPERATIONAL_STORE_REGISTRATION_CONTRACT_VERSION).toBe(2);
    expect(OPERATIONAL_STORE_SCOPE_KIND).toBe('HOST');
    expect(OPERATIONAL_STORE_USER_FIELDS).not.toContain('environment');
    expect(validateOperationalStoreRegistrationRequestV2(fixture.registrationRequest)).toEqual([]);
    expect(await operationalStoreBindingDigestV2(fixture.registration))
      .toBe(fixture.registration.bindingDigest);
  });

  it('rejects environment, plaintext secrets, and an update without aggregateVersion', () => {
    const request: Record<string, unknown> = {
      ...fixture.registrationRequest,
      environment: 'dev',
      password: 'do-not-store',
      credentialSource: 'SECRET_REFERENCE',
      credentialReference: 'vault/acme/operations',
    };
    const violations = validateOperationalStoreRegistrationRequestV2(request, true);
    expect(violations).toContain('environment: field is not allowed');
    expect(violations).toContain('password: field is not allowed');
    expect(violations).toContain('aggregateVersion: positive safe integer is required');
    expect(violations).toContain('credentialSource: unsupported value');
    expect(violations).toContain('credentialReference: mounted file must be an absolute path');
  });

  it('freezes version-one replay as side-effect free and explicitly converted', () => {
    expect(fixture.compatibility).toEqual({
      version1ReplaySideEffects: false,
      automaticConversion: false,
      conversionRequiresExplicitCommand: true,
    });
  });
});
