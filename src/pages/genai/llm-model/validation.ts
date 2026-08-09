import type { LlmRecord, ResourceDefinition } from './types';

export function validateMutation(resource: ResourceDefinition, value: LlmRecord): string[] {
  const errors: string[] = [];
  if (!value.hostId) errors.push('hostId is required.');
  if (containsRawSecret(value)) {
    errors.push('Raw secrets are forbidden. Store only an external secretReference URI.');
  }
  if (resource.key === 'credentials') {
    if (typeof value.secretReference !== 'string' || !/^(?:env:[A-Za-z_][A-Za-z0-9_]*$|[A-Za-z][A-Za-z0-9+.-]*:\/\/)/.test(value.secretReference)) {
      errors.push('secretReference must be env:VARIABLE_NAME or an external URI.');
    }
    if (value.credentialPurpose === 'ENDPOINT' && !value.providerEndpointId) {
      errors.push('ENDPOINT credentials require providerEndpointId.');
    }
    if (value.credentialPurpose === 'SIDECAR_RUNTIME' && !value.providerDeploymentId) {
      errors.push('SIDECAR_RUNTIME credentials require providerDeploymentId.');
    }
  }
  if (resource.key === 'deployments' && !value.providerEndpointId
    && typeof value.baseUrl === 'string' && !value.baseUrl.startsWith('https://')) {
    errors.push('baseUrl must use HTTPS.');
  }
  if (resource.key === 'providerEndpoints') {
    const mode = value.networkProfileMode;
    if (mode === 'PRIVATE_PLAINTEXT'
      && (!String(value.baseUrl ?? '').startsWith('http://') || value.endpointAuthMode !== 'NONE'
        || value.plaintextRiskAcknowledged !== true)) {
      errors.push('Private plaintext requires HTTP, no endpoint credential, and explicit risk acknowledgement.');
    }
    if ((mode === 'PRIVATE_TLS' || mode === 'PRIVATE_PLAINTEXT') && !value.networkZoneId) {
      errors.push('Private endpoints require a Network Zone.');
    }
  }
  if (resource.key === 'pricing' && value.pricingBasis === 'ZERO_MARGINAL'
    && (Number(value.inputMicrosPerMillion ?? 0) !== 0
      || Number(value.outputMicrosPerMillion ?? 0) !== 0)) {
    errors.push('ZERO_MARGINAL pricing requires zero input and output rates.');
  }
  if (resource.key === 'routes' && ((value.routeWeight ?? 1) !== 1 || Number(value.canaryPercent ?? 0) !== 0)) {
    errors.push('MVP routes require routeWeight=1 and canaryPercent=0.');
  }
  if (resource.key === 'aliases') {
    const visibility = value.aliasVisibility ?? 'PUBLIC';
    if (visibility !== 'PUBLIC' && visibility !== 'INTERNAL_LEGACY') {
      errors.push('aliasVisibility must be PUBLIC or INTERNAL_LEGACY.');
    } else if (visibility === 'PUBLIC' && value.boundAgentDefId != null) {
      errors.push('PUBLIC aliases cannot bind to an agent definition.');
    } else if (visibility === 'INTERNAL_LEGACY'
      && (typeof value.boundAgentDefId !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.boundAgentDefId))) {
      errors.push('INTERNAL_LEGACY aliases require a UUID boundAgentDefId.');
    }
  }
  return errors;
}

function containsRawSecret(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsRawSecret);
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' && (/^sk[-_]/i.test(value) || /^Bearer\s/i.test(value));
  }
  return Object.entries(value as Record<string, unknown>).some(([key,nested]) => {
    const normalized = key.replace(/[^A-Za-z0-9]/g,'').toLowerCase();
    if (normalized === 'apikeyheader') return false;
    if (['secretreference','credentialref','credentialreference'].includes(normalized)) {
      return typeof nested !== 'string' || !/^(?:env:[A-Za-z_][A-Za-z0-9_]*$|[A-Za-z][A-Za-z0-9+.-]*:\/\/)/.test(nested);
    }
    if (normalized.includes('secret') || normalized.includes('apikey') || normalized.includes('password')
      || normalized.includes('authorization') || ['token','accesstoken','refreshtoken','bearertoken','idtoken','credential','credentialvalue'].includes(normalized)) {
      return true;
    }
    return containsRawSecret(nested);
  });
}

export function display(value: unknown): string {
  if (value == null) return '—';
  const sanitized = sanitizeForDisplay(value);
  if (typeof sanitized === 'object') return JSON.stringify(sanitized);
  return String(sanitized);
}

export function sanitizeForDisplay(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeForDisplay);
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' && (/^sk[-_]/i.test(value) || /^Bearer\s/i.test(value))
      ? '[redacted]' : value;
  }
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => {
      const normalized = key.replace(/[^A-Za-z0-9]/g,'').toLowerCase();
      if (['secretreference','credentialref','credentialreference'].includes(normalized)) return true;
      if (normalized === 'apikeyheader') return true;
      return !(normalized.includes('secret') || normalized.includes('apikey')
        || normalized.includes('password') || normalized.includes('authorization')
        || ['token','accesstoken','refreshtoken','bearertoken','idtoken','credentialvalue'].includes(normalized));
    })
    .map(([key,nested]) => [key,sanitizeForDisplay(nested)]));
}

export function validatePublicationCandidate(value: unknown): string[] {
  if (!value || typeof value !== 'object') return ['Publication candidate must be an object.'];
  const candidate = value as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof candidate.environment !== 'string' || !candidate.environment) errors.push('environment is required.');
  if (typeof candidate.instanceId !== 'string' || !candidate.instanceId) errors.push('instanceId is required.');
  if (!/^sha256:[0-9a-f]{64}$/.test(String(candidate.sourceDigest ?? ''))) errors.push('sourceDigest is invalid.');
  if (!/^sha256:[0-9a-f]{64}$/.test(String(candidate.propertySetDigest ?? ''))) errors.push('propertySetDigest is invalid.');
  const properties = Array.isArray(candidate.configProperties) ? candidate.configProperties as Record<string, unknown>[] : [];
  const required = new Set(['enabled','developmentFixtures','providers','deployments','aliases','openaiExtensionAllowlist']);
  properties.forEach(property => required.delete(String(property.propertyName)));
  if (required.size) errors.push(`Generated configProperties are incomplete: ${[...required].join(', ')}.`);
  return errors;
}
