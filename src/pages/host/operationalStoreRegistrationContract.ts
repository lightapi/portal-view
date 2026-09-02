export const OPERATIONAL_STORE_REGISTRATION_CONTRACT_VERSION = 2 as const;
export const OPERATIONAL_STORE_SCOPE_KIND = 'HOST' as const;

export const OPERATIONAL_STORE_DIGEST_FIELDS = [
  'bindingId', 'contractVersion', 'credentialGeneration', 'credentialReference',
  'credentialSource', 'engine', 'expectedDatabase', 'hostId',
  'minimumSchemaGeneration', 'port', 'serverHost', 'tlsMode',
] as const;

export const OPERATIONAL_STORE_USER_FIELDS = [
  'targetHostId', 'engine', 'serverHost', 'port', 'expectedDatabase', 'tlsMode',
  'credentialSource', 'credentialReference',
  'minimumSchemaGeneration', 'credentialGeneration',
] as const;

export type OperationalStoreTlsMode =
  | 'DISABLE' | 'PREFER' | 'REQUIRE' | 'VERIFY_CA' | 'VERIFY_FULL';
export type OperationalStoreCredentialSource = 'MOUNTED_FILE';
export type OperationalStoreRegistrationState =
  | 'REGISTERED' | 'DEACTIVATED' | 'UNREGISTERED';

export type OperationalStoreRegistrationRequestV2 = {
  targetHostId: string;
  engine: 'POSTGRESQL';
  serverHost: string;
  port: number;
  expectedDatabase: string;
  tlsMode: OperationalStoreTlsMode;
  credentialSource: OperationalStoreCredentialSource;
  credentialReference: string;
  minimumSchemaGeneration: number;
  credentialGeneration: number;
  aggregateVersion?: number;
};

export type OperationalStoreRegistrationV2 = {
  contractVersion: 2;
  bindingId: string;
  bindingDigest: string;
  hostId: string;
  scopeKind: 'HOST';
  engine: 'POSTGRESQL';
  serverHost: string;
  port: number;
  expectedDatabase: string;
  tlsMode: OperationalStoreTlsMode;
  credentialSource: OperationalStoreCredentialSource;
  credentialReference: string;
  minimumSchemaGeneration: number;
  credentialGeneration: number;
  lifecycleState: OperationalStoreRegistrationState;
  aggregateVersion: number;
  active: boolean;
  published: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATABASE_IDENTIFIER = /^[a-z][a-z0-9_]{0,62}$/;
const SERVER_HOST = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,251}[A-Za-z0-9])?$/;
const CREDENTIAL_MATERIAL = /(postgres(?:ql)?:\/\/|(?:^|[?;&])(?:password|pwd)=)/i;
const TLS_MODES = new Set<OperationalStoreTlsMode>([
  'DISABLE', 'PREFER', 'REQUIRE', 'VERIFY_CA', 'VERIFY_FULL',
]);
const CREDENTIAL_SOURCES = new Set<OperationalStoreCredentialSource>([
  'MOUNTED_FILE',
]);

export function validateOperationalStoreRegistrationRequestV2(
  request: Record<string, unknown>,
  update = false,
): string[] {
  const allowed = new Set<string>(OPERATIONAL_STORE_USER_FIELDS);
  if (update) allowed.add('aggregateVersion');
  const violations = Object.keys(request)
    .filter(key => !allowed.has(key))
    .sort()
    .map(key => `${key}: field is not allowed`);

  if (typeof request.targetHostId !== 'string' || !UUID.test(request.targetHostId)) {
    violations.push('targetHostId: UUID is required');
  }
  if (request.engine !== 'POSTGRESQL') violations.push('engine: unsupported value');
  if (typeof request.serverHost !== 'string' || !SERVER_HOST.test(request.serverHost)) {
    violations.push('serverHost: invalid value');
  }
  if (!Number.isInteger(request.port) || Number(request.port) < 1 || Number(request.port) > 65535) {
    violations.push('port: integer in range 1..65535 is required');
  }
  for (const field of ['expectedDatabase'] as const) {
    if (typeof request[field] !== 'string' || !DATABASE_IDENTIFIER.test(request[field])) {
      violations.push(`${field}: invalid value`);
    }
  }
  if (!TLS_MODES.has(request.tlsMode as OperationalStoreTlsMode)) {
    violations.push('tlsMode: unsupported value');
  }
  if (!CREDENTIAL_SOURCES.has(request.credentialSource as OperationalStoreCredentialSource)) {
    violations.push('credentialSource: unsupported value');
  }
  if (typeof request.credentialReference !== 'string'
      || request.credentialReference.length === 0
      || request.credentialReference.length > 512) {
    violations.push('credentialReference: non-blank string of at most 512 characters is required');
  } else if (!request.credentialReference.startsWith('/')) {
    violations.push('credentialReference: mounted file must be an absolute path');
  }
  if (typeof request.credentialReference === 'string'
      && CREDENTIAL_MATERIAL.test(request.credentialReference)) {
    violations.push('credentialReference: credential material is not allowed');
  }
  for (const field of ['minimumSchemaGeneration', 'credentialGeneration'] as const) {
    if (!Number.isSafeInteger(request[field]) || Number(request[field]) < 1) {
      violations.push(`${field}: positive safe integer is required`);
    }
  }
  if (update && (!Number.isSafeInteger(request.aggregateVersion)
      || Number(request.aggregateVersion) < 1)) {
    violations.push('aggregateVersion: positive safe integer is required');
  }
  return violations;
}

export function operationalStoreDigestPayloadV2(
  registration: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(OPERATIONAL_STORE_DIGEST_FIELDS.map(field => {
    if (!(field in registration)) throw new Error(`missing digest field: ${field}`);
    return [field, registration[field]];
  }));
}

export async function operationalStoreBindingDigestV2(
  registration: Record<string, unknown>,
): Promise<string> {
  const canonical = JSON.stringify(canonicalize(operationalStoreDigestPayloadV2(registration)));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return 'sha256:' + Array.from(new Uint8Array(digest))
    .map(value => value.toString(16).padStart(2, '0')).join('');
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, canonicalize(child)]));
  }
  return value;
}
