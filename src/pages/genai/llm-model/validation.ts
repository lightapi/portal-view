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
      return !(normalized.includes('secret') || normalized.includes('apikey')
        || normalized.includes('password') || normalized.includes('authorization')
        || ['token','accesstoken','refreshtoken','bearertoken','idtoken','credentialvalue'].includes(normalized));
    })
    .map(([key,nested]) => [key,sanitizeForDisplay(nested)]));
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
    if (resource.resourceType === 'llm-deployment' && resource.payload && typeof resource.payload === 'object') {
      errors.push(...validateDeploymentEvidence(resource.payload as Record<string, unknown>, index));
    }
  });
  return errors;
}

function validateDeploymentEvidence(payload: Record<string, unknown>, index: number): string[] {
  const prefix = `resources[${index}].payload`;
  if (!payload.conformanceResult || typeof payload.conformanceResult !== 'object') {
    return [`${prefix}.conformanceResult is required.`];
  }
  const result = payload.conformanceResult as Record<string, unknown>;
  const errors: string[] = [];
  if (!/^[0-9a-f]{64}$/i.test(String(payload.conformanceDigest ?? ''))
    || payload.conformanceDigest !== result.digest) errors.push(`${prefix} conformance digest is invalid or detached.`);
  if (result.schemaVersion !== '1' || result.state !== 'pass') errors.push(`${prefix} conformance result must be schema 1 and passing.`);
  if (payload.format !== result.provider || payload.model !== result.physicalModel) errors.push(`${prefix} conformance identity does not match deployment.`);
  const validUntil = Date.parse(String(result.validUntil ?? ''));
  if (!Number.isFinite(validUntil) || validUntil <= Date.now()) errors.push(`${prefix} conformance result is expired.`);
  const capabilities = result.capabilities && typeof result.capabilities === 'object'
    ? result.capabilities as Record<string, unknown> : null;
  const content = capabilities?.content && typeof capabilities.content === 'object'
    ? capabilities.content as Record<string, unknown> : {};
  const evidence = result.capabilityEvidence && typeof result.capabilityEvidence === 'object'
    ? result.capabilityEvidence as Record<string, unknown> : null;
  if (!capabilities || !evidence || !Array.isArray(capabilities.operations)
    || !capabilities.operations.includes('chat_completions')) {
    errors.push(`${prefix} conformance capabilities/evidence are incomplete.`);
    return errors;
  }
  const required = ['chat_completions'];
  if (content.text === true) required.push('text');
  if (content.images === true) required.push('images');
  if (content.tools === true) required.push('tools');
  if (content.parallelTools === true) required.push('parallel_tools');
  if (content.structuredJson === true) required.push('structured_json');
  if (capabilities.streaming === true) required.push('streaming');
  for (const capability of required) {
    const item = evidence[capability] && typeof evidence[capability] === 'object'
      ? evidence[capability] as Record<string, unknown> : null;
    if (!item || !Array.isArray(item.fixtureIds) || !item.fixtureIds.length
      || !Array.isArray(item.provenances) || !item.provenances.includes('captured_sanitized')) {
      errors.push(`${prefix} capability ${capability} lacks captured_sanitized evidence.`);
    }
  }
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
