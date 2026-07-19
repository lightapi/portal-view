import type { LlmRecord, ResourceDefinition } from './types';

export function validateMutation(resource: ResourceDefinition, value: LlmRecord): string[] {
  const errors: string[] = [];
  if (!value.hostId) errors.push('hostId is required.');
  if (containsRawSecret(value)) {
    errors.push('Raw secrets are forbidden. Store only an external secretReference URI.');
  }
  if (resource.key === 'credentials') {
    if (typeof value.secretReference !== 'string' || !/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value.secretReference)) {
      errors.push('secretReference must be an external URI.');
    }
  }
  if (resource.key === 'deployments' && typeof value.baseUrl === 'string' && !value.baseUrl.startsWith('https://')) {
    errors.push('baseUrl must use HTTPS.');
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
    if (['secretreference','credentialref','credentialreference'].includes(normalized)) {
      return typeof nested !== 'string' || !/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(nested);
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
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function validatePublicationCandidate(value: unknown): string[] {
  if (!value || typeof value !== 'object') return ['Publication must be a JSON object.'];
  const candidate = value as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof candidate.environment !== 'string' || !candidate.environment) errors.push('environment is required.');
  if (typeof candidate.minimumGatewayVersion !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(candidate.minimumGatewayVersion)) {
    errors.push('minimumGatewayVersion must be semantic version syntax.');
  }
  if (!candidate.manifest || typeof candidate.manifest !== 'object') errors.push('manifest is required.');
  const resources = Array.isArray(candidate.resources) ? candidate.resources as Record<string, unknown>[] : [];
  if (!resources.length) errors.push('At least one full-root resource is required.');
  const types = new Set(['llm-deployment','llm-route','llm-policy','llm-pricing']);
  resources.forEach((resource,index) => {
    if (!types.has(String(resource.resourceType))) errors.push(`resources[${index}].resourceType is unsupported.`);
    if (!resource.resourceId || Number(resource.resourceVersion) < 1 || Number(resource.sequence) < 1 || Number(resource.schemaVersion) !== 1) {
      errors.push(`resources[${index}] has an invalid id/version/sequence/schemaVersion.`);
    }
    if (!resource.payload || typeof resource.payload !== 'object') errors.push(`resources[${index}].payload is required.`);
  });
  return errors;
}

export function gatewaySupports(candidate: Record<string, unknown>, evidence: Record<string, unknown> | null): string[] {
  if (!evidence || typeof evidence.compilerVersion !== 'string' || !Array.isArray(evidence.features)) {
    if (candidate.minimumGatewayVersion === '0.1.0'
      && (!Array.isArray(candidate.enabledRoutingFeatures) || candidate.enabledRoutingFeatures.length === 0)) return [];
    return ['Target gateway compiler/feature acknowledgement is unavailable.'];
  }
  const requestedVersion = String(candidate.minimumGatewayVersion ?? '');
  const compare = (value: string) => value.split(/[+-]/,1)[0].split('.').map(Number);
  const requested = compare(requestedVersion); const active = compare(evidence.compilerVersion);
  for (let index=0; index<3; index++) {
    if ((active[index] ?? 0) < (requested[index] ?? 0)) return [`Target compiler ${evidence.compilerVersion} is below ${requestedVersion}.`];
    if ((active[index] ?? 0) > (requested[index] ?? 0)) break;
  }
  const supported = new Set(evidence.features as string[]);
  const unsupported = (Array.isArray(candidate.enabledRoutingFeatures) ? candidate.enabledRoutingFeatures : [])
    .filter(feature => !supported.has(String(feature)));
  return unsupported.length ? [`Target gateway does not acknowledge features: ${unsupported.join(', ')}.`] : [];
}
