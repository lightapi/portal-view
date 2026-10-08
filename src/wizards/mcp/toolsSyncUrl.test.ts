import { beforeEach, describe, expect, it } from 'vitest';
import { buildToolsSyncUrl } from './toolsSyncUrl';
import { publishTestConfig } from '../../test/runtimeConfigFixture';
import { resetPortalConfigForTests } from '../../runtimeConfig/store';
import { apiUrl } from '../../utils/runtimePaths';

const relative = '/registry/apis/{apiId}/versions/{version}/tools';
const absolute = 'https://registry.example.test/apis/{apiId}/versions/{version}/tools';

describe('tools-sync URL substitution', () => {
  beforeEach(() => {
    resetPortalConfigForTests();
    publishTestConfig({ routing: { apiBasePath: '/namespace-dev/service' } });
  });

  it('substitutes safe segments into a root-relative template that apiUrl accepts', () => {
    for (const [apiId, version, path] of [
      ['petstore', '1.0.0', '/registry/apis/petstore/versions/1.0.0/tools'],
      ['a b#c', 'v1?x', '/registry/apis/a%20b%23c/versions/v1%3Fx/tools'],
      ['..x', 'v.', '/registry/apis/..x/versions/v./tools'],
    ]) {
      const url = buildToolsSyncUrl(relative, apiId, version);
      expect(url).toBe(path);
      expect(apiUrl(url)).toBe(`${window.location.origin}/namespace-dev/service${path}`);
    }
  });

  it.each([
    ['a/b', '1.0.0', "API ID 'a/b'"],
    ['a\\b', '1.0.0', "API ID 'a\\b'"],
    ['.', '1.0.0', "API ID '.'"],
    ['..', '1.0.0', "API ID '..'"],
    ['', '1.0.0', "API ID ''"],
    ['petstore', '1/0', "API version '1/0'"],
    ['petstore', '..', "API version '..'"],
  ])('rejects %j / %j in a root-relative template before dispatch', (apiId, version, label) => {
    expect(() => buildToolsSyncUrl(relative, apiId, version)).toThrow(label);
    expect(() => buildToolsSyncUrl(relative, apiId, version)).toThrow(/absolute HTTPS tools-sync URL template/);
  });

  it('keeps existing encodeURIComponent substitution for absolute HTTPS templates', () => {
    expect(buildToolsSyncUrl(absolute, 'a/b', '..')).toBe('https://registry.example.test/apis/a%2Fb/versions/../tools');
    expect(buildToolsSyncUrl(absolute, 'petstore', '1.0.0')).toBe('https://registry.example.test/apis/petstore/versions/1.0.0/tools');
  });

  it('validates only the values whose placeholder is present', () => {
    expect(buildToolsSyncUrl('/registry/tools?scope=all', 'a/b', '..')).toBe('/registry/tools?scope=all');
    expect(buildToolsSyncUrl('/registry/apis/{apiId}/tools', 'petstore', 'a/b')).toBe('/registry/apis/petstore/tools');
    const query = buildToolsSyncUrl('/registry/tools?api={apiId}&v={version}', 'a/b', '..');
    expect(query).toBe('/registry/tools?api=a%2Fb&v=..');
    expect(apiUrl(query)).toBe(`${window.location.origin}/namespace-dev/service/registry/tools?api=a%2Fb&v=..`);
    expect(buildToolsSyncUrl('https://registry.example.test/tools', 'a/b', '1')).toBe('https://registry.example.test/tools');
  });
});
