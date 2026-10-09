import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadEnv } from 'vite';
import { assertMemberPath, cacheClass, sha256 } from './verify-release.mjs';

export function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeysDeep(value[key])]));
  return value;
}

export function collectMembers(directory) {
  const files = [];
  const directories = [];
  function walk(relative) {
    const absolute = path.join(directory, relative);
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error('Symlink in build output');
    if (relative) assertMemberPath(relative);
    if (stat.isDirectory()) {
      directories.push(absolute);
      for (const name of readdirSync(absolute)) walk(relative ? `${relative}/${name}` : name);
    } else if (stat.isFile()) files.push(relative);
    else throw new Error('Non-regular file in build output');
  }
  walk('');
  files.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  return { files, directories };
}

export function assertPortableOutput(directory, markers = []) {
  const { files } = collectMembers(directory);
  if (!files.includes('index.html') || !files.includes('portal-config.schema.json')) throw new Error('Missing portable index or runtime schema');
  if (files.includes('portal-config.json')) throw new Error('Portable output contains portal-config.json');
  const html = readFileSync(path.join(directory, 'index.html'), 'utf8');
  if (html.split('__PORTAL_BASE_HREF__').length !== 2) throw new Error('Expected exactly one base placeholder');
  if (/\b(?:src|href)\s*=\s*["']\//i.test(html)) throw new Error('Root-absolute HTML asset reference');
  for (const name of files) {
    const bytes = readFileSync(path.join(directory, name));
    if (name.endsWith('.map') || bytes.includes('sourceMappingURL')) throw new Error('Source maps are forbidden');
    if (/mcp-schema-qualification/i.test(name)) throw new Error('Qualification output is forbidden');
    if (['signin.localhost', 'dev.lightapi.net', 'f7d42348', ...markers].some(marker => bytes.includes(marker))) throw new Error(`Deployment marker in output member: ${name}`);
  }
}

// Release mode disables Vite's client dotenv exposure via envDir: false, and the
// child build drops VITE_* inputs. Explicit loadEnv calls still load dotenv files
// for build configuration and validation; no build-time browser value may appear
// in emitted bytes. Never log the values.
export function deploymentMarkers(env) {
  return Object.entries(env)
    .filter(([key, value]) => key.startsWith('VITE_') && value.length >= 8)
    .map(([, value]) => value);
}

export function buildRelease() {
  if (process.argv.length !== 2) throw new Error('Usage: build-release.mjs (inputs come from environment)');
  const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const version = process.env.PORTAL_VIEW_RELEASE_VERSION;
  const epochInput = process.env.SOURCE_DATE_EPOCH;
  const keyId = process.env.PORTAL_VIEW_SIGNING_KEY_ID;
  if (!version || !/^[0-9]{8}-[0-9a-f]{12}$/.test(version) || /\s/.test(version)) throw new Error('PORTAL_VIEW_RELEASE_VERSION must be YYYYMMDD-12-character lowercase SHA');
  if (!epochInput || !/^-?[0-9]+$/.test(epochInput)) throw new Error('SOURCE_DATE_EPOCH must be an integer timestamp');
  const epoch = Number(epochInput);
  if (!Number.isSafeInteger(epoch) || !Number.isFinite(new Date(epoch * 1000).getTime())) throw new Error('SOURCE_DATE_EPOCH is not a usable timestamp');
  const buildTimestamp = new Date(epoch * 1000).toISOString();
  // Date objects preserve pre-epoch timestamps; negative numeric utimes inputs
  // are interpreted by Node as "now", which would break determinism.
  const mtime = new Date(epoch * 1000);
  if (!keyId || !/^portal-view-release-[0-9]{4}-[0-9]{2}$/.test(keyId) || /\s/.test(keyId)) throw new Error('PORTAL_VIEW_SIGNING_KEY_ID must match portal-view-release-YYYY-MM');
  const effective = loadEnv('release', root, 'VITE_');
  if (effective.VITE_MCP_SCHEMA_QUALIFICATION === 'true') throw new Error('Qualification mode is forbidden');
  if (effective.VITE_BUILD_SOURCEMAP !== undefined && effective.VITE_BUILD_SOURCEMAP !== 'false') throw new Error('VITE_BUILD_SOURCEMAP must be absent or false');
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  if (git(['status', '--porcelain', '--untracked-files=all']).trim()) throw new Error('Release build requires a clean Git working tree');
  const buildCommit = git(['rev-parse', 'HEAD']).trim();
  const spaRoutes = JSON.parse(readFileSync(path.join(root, 'src/spaRoutes.json'), 'utf8'));
  const dist = path.join(root, 'dist');
  const releases = path.join(root, 'release');
  const output = path.join(releases, version);
  for (const directory of [dist, releases, output]) {
    if (existsSync(directory) && (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink())) throw new Error('Output path must be a real directory');
  }
  const env = { ...process.env, SOURCE_DATE_EPOCH: epochInput, TZ: 'UTC' };
  for (const name of Object.keys(env)) if (name.startsWith('VITE_') && name !== 'VITE_BUILD_SOURCEMAP') delete env[name];
  delete env.ZIPOPT;
  // Check actual emitted bytes against values from both process and dotenv inputs.
  const markers = deploymentMarkers({ ...effective, ...process.env });
  rmSync(dist, { recursive: true, force: true });
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  execFileSync('npx', ['--no-install', 'vite', 'build', '--mode', 'release'], { cwd: root, env, stdio: 'inherit' });
  assertPortableOutput(dist, markers);
  writeFileSync(path.join(dist, 'VERSION'), `${version}\n`);
  const { files, directories } = collectMembers(dist);
  const members = files.map(member => {
    const file = path.join(dist, member);
    const bytes = readFileSync(file);
    chmodSync(file, 0o644);
    utimesSync(file, mtime, mtime);
    return { path: member, sha256: sha256(bytes), size: bytes.length, cacheClass: cacheClass(member) };
  });
  for (const directory of directories) {
    chmodSync(directory, 0o755);
    utimesSync(directory, mtime, mtime);
  }
  const archiveName = `portal-view-${version}.zip`;
  const archive = path.join(output, archiveName);
  execFileSync('zip', ['-X', '-D', '-q', '-@', path.relative(dist, archive)], { cwd: dist, env, input: `${files.join('\n')}\n` });
  const manifest = {
    artifact: 'portal-view', archive: { name: archiveName, sha256: sha256(readFileSync(archive)) },
    buildCommit, buildTimestamp, manifestVersion: 1, members,
    minimumGatewayCapability: 1, runtimeConfigSchemaVersions: [1],
    signature: { algorithm: 'Ed25519', keyId }, spaRoutes, version,
  };
  writeFileSync(path.join(output, 'release-manifest.json'), `${JSON.stringify(sortKeysDeep(manifest), null, 2)}\n`);
  console.log(output);
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { buildRelease(); } catch (error) {
    console.error(`Release build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
