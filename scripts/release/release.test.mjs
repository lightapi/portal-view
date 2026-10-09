import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, closeSync, copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sign } from 'node:crypto';
import { assertPortableOutput, collectMembers, deploymentMarkers, sortKeysDeep } from './build-release.mjs';
import { cacheClass, sha256, verifyRelease } from './verify-release.mjs';

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const temporary = mkdtempSync(path.join(tmpdir(), 'portal-view-wp7-tests-'));
after(() => rmSync(temporary, { recursive: true, force: true }));
const key = path.join(temporary, 'throwaway-private.pem');
const trusted = path.join(temporary, 'trusted');
mkdirSync(trusted);
execFileSync('openssl', ['genpkey', '-algorithm', 'ed25519', '-out', key]);
chmodSync(key, 0o600);
const keyId = 'portal-view-release-2026-01';
execFileSync('openssl', ['pkey', '-in', key, '-pubout', '-out', path.join(trusted, `${keyId}.pem`)]);
const privateBytes = readFileSync(key);
const version = '20261007-0123456789ab';
const env = { ...process.env, PORTAL_VIEW_RELEASE_VERSION: version, SOURCE_DATE_EPOCH: '1791417600', PORTAL_VIEW_SIGNING_KEY_ID: keyId };
for (const name of Object.keys(env)) if (name.startsWith('VITE_')) delete env[name];
const signer = path.join(root, 'scripts/release/sign-release.sh');
const verifier = path.join(root, 'scripts/release/verify-release.mjs');
let sequence = 0;

function signedManifest(directory, manifest) {
  const bytes = Buffer.from(`${JSON.stringify(sortKeysDeep(manifest), null, 2)}\n`);
  writeFileSync(path.join(directory, 'release-manifest.json'), bytes);
  writeFileSync(path.join(directory, 'release-manifest.sig'), sign(null, bytes, privateBytes));
}

// Python's standard library can deliberately create duplicate and unsafe names;
// no untrusted member is ever extracted, even in negative tests.
function archive(directory, entries) {
  const file = path.join(directory, 'fixture.zip');
  execFileSync('python3', ['-c', `import json,sys,zipfile,stat,warnings
warnings.simplefilter('ignore', UserWarning)
with zipfile.ZipFile(sys.argv[1], 'w') as z:
 for entry in json.load(sys.stdin):
  i=zipfile.ZipInfo(entry['path'], (2026,10,7,0,0,0))
  i.create_system=3
  i.external_attr=((stat.S_IFLNK if entry.get('symlink') else stat.S_IFREG) | 0o644)<<16
  z.writestr(i, entry['data'].encode())
`, file], { input: JSON.stringify(entries) });
  return sha256(readFileSync(file));
}

function fixture() {
  const directory = path.join(temporary, `fixture-${sequence++}`);
  mkdirSync(directory);
  const entries = [
    { path: 'VERSION', data: `${version}\n` },
    { path: 'assets/app-aB_09-xZ.js', data: 'portable app' },
    { path: 'index.html', data: '<base href="__PORTAL_BASE_HREF__">' },
    { path: 'portal-config.schema.json', data: '{}' },
  ];
  const manifest = {
    artifact: 'portal-view', archive: { name: 'fixture.zip', sha256: archive(directory, entries) },
    buildCommit: '0'.repeat(40), buildTimestamp: '2026-10-08T00:00:00.000Z', manifestVersion: 1,
    minimumGatewayCapability: 1, runtimeConfigSchemaVersions: [1], signature: { algorithm: 'Ed25519', keyId },
    spaRoutes: JSON.parse(readFileSync(path.join(root, 'src/spaRoutes.json'))), version,
    members: entries.map(e => ({ path: e.path, sha256: sha256(e.data), size: Buffer.byteLength(e.data), cacheClass: cacheClass(e.path) })),
  };
  signedManifest(directory, manifest);
  return { directory, entries, manifest };
}

test('OpenSSL signing and CLI verification succeed using a throwaway Ed25519 key', () => {
  const { directory } = fixture();
  execFileSync(signer, [directory, key]);
  assert.equal(lstatSync(path.join(directory, 'release-manifest.sig')).mode & 0o777, 0o600);
  assert.match(execFileSync(process.execPath, [verifier, directory, trusted], { encoding: 'utf8' }), /verified/);
});

test('a modified original manifest byte fails signature verification before archive access', () => {
  const { directory } = fixture();
  const file = path.join(directory, 'release-manifest.json');
  writeFileSync(file, readFileSync(file, 'utf8').replace('"portal-view"', '"portal-viex"'));
  rmSync(path.join(directory, 'fixture.zip'));
  assert.throws(() => verifyRelease(directory, trusted), /signature verification failed/);
  assert.notEqual(spawnSync(process.execPath, [verifier, directory, trusted]).status, 0);
});

test('archive digest mismatch', () => {
  const { directory } = fixture();
  writeFileSync(path.join(directory, 'fixture.zip'), 'tampered');
  assert.throws(() => verifyRelease(directory, trusted), /Archive SHA-256/);
});

for (const [name, mutate, error] of [
  ['modified member', f => { f.entries[0].data = 'x'.repeat(Buffer.byteLength(f.entries[0].data)); }, /Member SHA-256/],
  ['extra member', f => f.entries.push({ path: 'extra.txt', data: 'extra' }), /Extra archive member/],
  ['missing member', f => f.entries.pop(), /Missing archive member/],
  ['duplicate entry', f => f.entries.push(f.entries[0]), /Duplicate archive entry/],
  ['symlink entry', f => { f.entries[0].symlink = true; }, /Symlink archive entry/],
  ['wrong size', f => { f.manifest.members[0].size++; }, /Member size mismatch/],
  ['wrong cache class', f => { f.manifest.members[0].cacheClass = 'immutable'; }, /cache classification/],
  ['duplicate manifest member', f => f.manifest.members.push(f.manifest.members[0]), /Duplicate manifest/],
  ['negative size', f => { f.manifest.members[0].size = -1; }, /Invalid member size/],
]) {
  test(`correctly signed fixture rejects ${name} after matching archive digest`, () => {
    const f = fixture();
    mutate(f);
    f.manifest.archive.sha256 = archive(f.directory, f.entries);
    signedManifest(f.directory, f.manifest);
    assert.throws(() => verifyRelease(f.directory, trusted), error);
  });
}

for (const unsafe of ['../escape', '/absolute', 'a/../escape', 'a\\escape', '.hidden', 'a/.hidden', 'a//b', 'a\nname', 'a*', 'a?']) {
  test(`rejects unsafe archive path ${JSON.stringify(unsafe)} with valid signature and digest`, () => {
    const f = fixture();
    f.entries[0].path = unsafe;
    f.manifest.archive.sha256 = archive(f.directory, f.entries);
    signedManifest(f.directory, f.manifest);
    // unzip -Z1 may render embedded controls as separate/escaped names; either
    // way they must fail the literal safe-path and exact-membership contract.
    assert.throws(() => verifyRelease(f.directory, trusted), /Unsafe member path|Extra archive member/);
  });
}

for (const [field, value, error] of [
  ['keyId', 'portal-view-release-2099-01', /Unknown/],
  ['keyId', '../escape', /Invalid keyId/],
  ['keyId', 'key\n', /Invalid keyId/],
  ['algorithm', 'RSA', /algorithm/],
]) {
  test(`rejects signature ${field}: ${JSON.stringify(value)}`, () => {
    const f = fixture();
    f.manifest.signature[field] = value;
    signedManifest(f.directory, f.manifest);
    assert.throws(() => verifyRelease(f.directory, trusted), error);
  });
}

test('archive and public key resolution cannot escape intended directories', () => {
  const f = fixture();
  f.manifest.archive.name = '../fixture.zip';
  signedManifest(f.directory, f.manifest);
  assert.throws(() => verifyRelease(f.directory, trusted), /Unsafe file name/);
  f.manifest.archive.name = 'linked.zip';
  symlinkSync(path.join(f.directory, 'fixture.zip'), path.join(f.directory, 'linked.zip'));
  signedManifest(f.directory, f.manifest);
  assert.throws(() => verifyRelease(f.directory, trusted), /regular file/);
  const keys = path.join(temporary, 'linked-trust');
  mkdirSync(keys);
  symlinkSync(path.join(trusted, `${keyId}.pem`), path.join(keys, `${keyId}.pem`));
  assert.throws(() => verifyRelease(f.directory, keys), /Unknown or invalid/);
});

test('signer refuses all group/world permission bits and non-Ed25519 keys', () => {
  const { directory } = fixture();
  const copy = path.join(temporary, 'permission-test.pem');
  copyFileSync(key, copy);
  for (const permission of [0o640, 0o620, 0o610, 0o604, 0o602, 0o601]) {
    chmodSync(copy, permission);
    const result = spawnSync(signer, [directory, copy], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /group\/world/);
  }
  const ec = path.join(temporary, 'throwaway-ec.pem');
  execFileSync('openssl', ['genpkey', '-algorithm', 'EC', '-pkeyopt', 'ec_paramgen_curve:P-256', '-out', ec]);
  chmodSync(ec, 0o600);
  assert.match(spawnSync(signer, [directory, ec], { encoding: 'utf8' }).stderr, /must be Ed25519/);
});

test('D11 cache classes use the assets prefix and exact 8+ base64url filename suffix', () => {
  for (const member of ['assets/app-aB_09-xZ.js', 'assets/sub/app-abcdefgh.css', 'assets/-12345678.svg']) assert.equal(cacheClass(member), 'immutable');
  for (const member of ['app-12345678.js', 'assets/app-1234567.js', 'assets/app-12345678.js.map', 'assets/app-12345678.tar.gz', 'assets/app-1234567+.js', 'assetsX/app-12345678.js', 'index.html', 'VERSION', 'portal-config.schema.json']) assert.equal(cacheClass(member), 'revalidate');
});

test('portable output refuses symlinks, dot paths, backslashes, maps, deployment and qualification output', () => {
  for (const kind of ['symlink', 'dotfile', 'dotdir', 'backslash', 'map', 'map-reference', 'deployment', 'config', 'qualification', 'base', 'schema']) {
    const directory = path.join(temporary, `output-${kind}`);
    mkdirSync(directory);
    writeFileSync(path.join(directory, 'index.html'), '<base href="__PORTAL_BASE_HREF__">');
    writeFileSync(path.join(directory, 'portal-config.schema.json'), '{}');
    if (kind === 'symlink') symlinkSync('index.html', path.join(directory, 'link'));
    if (kind === 'dotfile') writeFileSync(path.join(directory, '.hidden'), 'x');
    if (kind === 'dotdir') mkdirSync(path.join(directory, '.hidden'));
    if (kind === 'backslash') writeFileSync(path.join(directory, 'a\\b'), 'x');
    if (kind === 'map') writeFileSync(path.join(directory, 'x.map'), '{}');
    if (kind === 'map-reference') writeFileSync(path.join(directory, 'x.js'), '//# sourceMappingURL=x');
    if (kind === 'deployment') writeFileSync(path.join(directory, 'x.js'), 'https://signin.localhost');
    if (kind === 'config') writeFileSync(path.join(directory, 'portal-config.json'), '{}');
    if (kind === 'qualification') writeFileSync(path.join(directory, 'mcp-schema-qualification.html'), 'x');
    if (kind === 'base') writeFileSync(path.join(directory, 'index.html'), 'no base');
    if (kind === 'schema') rmSync(path.join(directory, 'portal-config.schema.json'));
    assert.throws(() => assertPortableOutput(directory));
  }
});

test('every identifying build-time browser value is a deployment marker', () => {
  assert.deepEqual(deploymentMarkers({
    VITE_APP_MAPBOX_TOKEN: 'pk.synthetic-map-token', VITE_BASE_PATH: '/deployment-prefix',
    VITE_PORT: '3000', VITE_BUILD_SOURCEMAP: 'false', REACT_APP_OTHER: 'not-a-vite-value',
  }), ['pk.synthetic-map-token', '/deployment-prefix']);
});

test('release mode loads no dotenv files into client env', async () => {
  const { resolveConfig } = await import('vite');
  const config = await resolveConfig({ root, mode: 'release', logLevel: 'silent' }, 'build');
  assert.equal(config.envDir, false);
  assert.deepEqual(Object.keys(config.env).filter(key => key.startsWith('VITE_') && !(key in process.env)), []);
});

test('full Vite builds reproduce archive and manifest bytes in one clean isolated source commit', { timeout: 300000 }, () => {
  const snapshot = path.join(temporary, 'source');
  mkdirSync(snapshot);
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const added = ['scripts/release/build-release.mjs', 'scripts/release/sign-release.sh', 'scripts/release/verify-release.mjs', 'scripts/release/release.test.mjs', 'src/spaRoutes.json', 'src/spaRoutes.test.ts'];
  for (const file of new Set([...files, ...added])) {
    mkdirSync(path.dirname(path.join(snapshot, file)), { recursive: true });
    cpSync(path.join(root, file), path.join(snapshot, file), { preserveTimestamps: true });
  }
  symlinkSync(path.join(root, 'node_modules'), path.join(snapshot, 'node_modules'), 'dir');
  const git = args => execFileSync('git', args, { cwd: snapshot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  git(['init', '-q']);
  git(['add', '.']);
  // Commit the release tooling explicitly in case the fixture runs before it is tracked.
  git(['add', '-f', ...added]);
  git(['-c', 'user.name=WP7 fixture', '-c', 'user.email=wp7@example.invalid', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Temporary WP7 test snapshot']);
  const commit = git(['rev-parse', 'HEAD']).trim();
  const builder = path.join(snapshot, 'scripts/release/build-release.mjs');
  const output = path.join(snapshot, 'release', version);
  const run = overrides => {
    // Existing dependency warnings include very long minified source lines.
    // File-backed capture avoids terminating a successful build at maxBuffer.
    const log = path.join(temporary, `build-${sequence++}.log`);
    const fd = openSync(log, 'w', 0o600);
    let result;
    try {
      result = spawnSync(process.execPath, [builder], { cwd: snapshot, env: { ...env, ...overrides }, stdio: ['ignore', fd, fd], timeout: 140000 });
    } finally { closeSync(fd); }
    return { ...result, stderr: readFileSync(log, 'utf8').slice(-4000), stdout: '' };
  };
  // Refusals must preserve pre-existing output, including dirty tracked/untracked trees.
  mkdirSync(path.join(snapshot, 'dist'));
  writeFileSync(path.join(snapshot, 'dist/sentinel'), 'preserve');
  for (const overrides of [
    { PORTAL_VIEW_RELEASE_VERSION: '' }, { PORTAL_VIEW_RELEASE_VERSION: '../bad' }, { PORTAL_VIEW_RELEASE_VERSION: `${version}\n` },
    { SOURCE_DATE_EPOCH: '' }, { SOURCE_DATE_EPOCH: '1.5' }, { SOURCE_DATE_EPOCH: '99999999999999999999' },
    { PORTAL_VIEW_SIGNING_KEY_ID: '' }, { PORTAL_VIEW_SIGNING_KEY_ID: '../key' },
    { VITE_MCP_SCHEMA_QUALIFICATION: 'true' }, { VITE_BUILD_SOURCEMAP: 'true' }, { VITE_BUILD_SOURCEMAP: 'yes' },
  ]) {
    const result = run(overrides);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Release build failed:/);
    assert.equal(readFileSync(path.join(snapshot, 'dist/sentinel'), 'utf8'), 'preserve');
  }
  for (const file of ['dirty-untracked', 'src/spaRoutes.json']) {
    const target = path.join(snapshot, file);
    const before = existsSync(target) ? readFileSync(target) : null;
    writeFileSync(target, 'dirty');
    assert.match(run({}).stderr, /clean Git working tree/);
    assert.equal(readFileSync(path.join(snapshot, 'dist/sentinel'), 'utf8'), 'preserve');
    if (before) writeFileSync(target, before); else rmSync(target);
  }
  // Ignored dotenv files keep the tree clean; a client-referenced value must still not ship.
  const ignoredToken = 'wp7-ignored-dotenv-token';
  writeFileSync(path.join(snapshot, '.env.release.local'), `VITE_APP_MAPBOX_TOKEN=${ignoredToken}\n`);
  const first = run({ TZ: 'Pacific/Honolulu', VITE_API_BASE_URL: 'https://wp7-api.example.invalid', VITE_BASE_PATH: '/wp7-deployment-marker' });
  assert.equal(first.status, 0, `${first.error ?? ''}\n${first.stderr.slice(-2000)}\n${first.stdout.slice(-1000)}`);
  for (const member of collectMembers(path.join(snapshot, 'dist')).files) {
    assert.equal(readFileSync(path.join(snapshot, 'dist', member)).includes(ignoredToken), false, member);
  }
  const archivePath = path.join(output, `portal-view-${version}.zip`);
  const firstZip = readFileSync(archivePath);
  const firstManifest = readFileSync(path.join(output, 'release-manifest.json'));
  const second = run({ TZ: 'Asia/Tokyo', VITE_API_BASE_URL: 'https://wp7-api.example.invalid', VITE_BASE_PATH: '/wp7-deployment-marker' });
  assert.equal(second.status, 0, `${second.error ?? ''}\n${second.stderr.slice(-2000)}\n${second.stdout.slice(-1000)}`);
  assert.deepEqual(readFileSync(archivePath), firstZip);
  assert.deepEqual(readFileSync(path.join(output, 'release-manifest.json')), firstManifest);
  const manifest = JSON.parse(firstManifest);
  assert.equal(manifest.buildCommit, commit);
  assert.equal(manifest.buildTimestamp, new Date(Number(env.SOURCE_DATE_EPOCH) * 1000).toISOString());
  assert.deepEqual(manifest.spaRoutes, JSON.parse(readFileSync(path.join(root, 'src/spaRoutes.json'))));
  assert.equal(firstManifest.toString(), `${JSON.stringify(sortKeysDeep(manifest), null, 2)}\n`);
  assert.deepEqual(manifest.members.map(m => m.path), collectMembers(path.join(snapshot, 'dist')).files);
  assert.equal(readFileSync(path.join(snapshot, 'dist/VERSION'), 'utf8'), `${version}\n`);
  for (const member of manifest.members) {
    const stat = lstatSync(path.join(snapshot, 'dist', member.path));
    assert.equal(stat.mtimeMs, Number(env.SOURCE_DATE_EPOCH) * 1000);
    assert.equal(stat.mode & 0o777, 0o644);
  }
  for (const directory of collectMembers(path.join(snapshot, 'dist')).directories) {
    assert.equal(lstatSync(directory).mtimeMs, Number(env.SOURCE_DATE_EPOCH) * 1000);
    assert.equal(lstatSync(directory).mode & 0o777, 0o755);
  }
  execFileSync(signer, [output, key]);
  verifyRelease(output, trusted);
  assert.equal(git(['status', '--porcelain']).trim(), '');
  console.log(`FULL VITE REPRODUCIBILITY: commit=${commit} archive=${sha256(firstZip)} manifest=${sha256(firstManifest)} bytes=${firstZip.length}; both byte comparisons equal`);
});
