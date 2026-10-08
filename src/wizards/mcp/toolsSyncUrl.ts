/**
 * Substitute `{apiId}`/`{version}` into the configured tools-sync template.
 * Absolute HTTPS templates keep plain `encodeURIComponent` substitution. A
 * root-relative template becomes a same-origin BFF path, so each value must be
 * one safe path segment; an encoded `/` or a dot segment would change the
 * endpoint and is rejected before anything is sent.
 */
export function buildToolsSyncUrl(template: string, apiId: string, version: string): string {
  if (template.startsWith('/')) {
    // Query values are not path segments; apiUrl leaves the query untouched.
    const path = template.split('?', 1)[0];
    for (const [placeholder, label, value] of [['{apiId}', 'API ID', apiId], ['{version}', 'API version', version]] as const) {
      if (path.includes(placeholder) && (!value || value === '.' || value === '..' || /[/\\]/.test(value))) {
        throw new Error(`${label} '${value}' cannot be used in the root-relative tools-sync URL because it is not a single path segment. `
          + 'Configure an absolute HTTPS tools-sync URL template for this registry instead.');
      }
    }
  }
  return template
    .replace('{apiId}', encodeURIComponent(apiId))
    .replace('{version}', encodeURIComponent(version));
}
