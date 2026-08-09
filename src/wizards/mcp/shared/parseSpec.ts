import { parseOpenApiSpec } from '../../../components/openApiSpecFormat';

export interface SpecPreview {
  apiName?: string;
  apiDesc?: string;
  gitRepo?: string;
  apiTags?: string[];
  apiVersion?: string;
  apiType?: string;
  rawFileName: string;
  rawSize: number;
  rawText: string;
  parsedDoc: object;
}

/**
 * Parse a JSON or YAML spec string and extract API metadata.
 * Throws with a user-friendly message on parse failure.
 */
export function parseSpec(text: string, fileName: string): SpecPreview {
  const parsed = parseOpenApiSpec(text);
  if (parsed.error || !parsed.document) {
    throw new Error('Could not parse file — make sure it is valid JSON or YAML.');
  }
  const doc: any = parsed.document;

  const info = doc?.info ?? {};

  let apiType: string | undefined;
  if (doc?.['x-api-type']) {
    apiType = doc['x-api-type'];
  } else if (doc?.openapi || doc?.swagger) {
    apiType = 'openapi';
  }

  return {
    parsedDoc: doc,
    rawFileName: fileName,
    rawSize: text.length,
    rawText: text,
    apiName: info.title ?? undefined,
    apiDesc: info.description ?? undefined,
    apiVersion: info.version ?? undefined,
    apiType,
    gitRepo:
      doc?.['x-git-repo'] ??
      info?.['x-git-repo'] ??
      doc?.externalDocs?.url ??
      undefined,
    apiTags: Array.isArray(doc?.tags)
      ? doc.tags.map((t: any) => (typeof t === 'string' ? t : t?.name)).filter(Boolean)
      : undefined,
  };
}

/**
 * Silently try to parse a spec string (JSON then YAML).
 * Returns the parsed document or null if unparseable.
 */
export function tryParseDoc(text: unknown): object | null {
  return parseOpenApiSpec(text).document;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
