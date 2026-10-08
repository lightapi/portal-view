import { createHash, createPublicKey, verify } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const cacheClass = member => member.startsWith('assets/') && /-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(path.posix.basename(member)) ? 'immutable' : 'revalidate';
const hasControls = value => Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);

export function assertMemberPath(member) {
  // Also exclude controls and unzip pattern metacharacters: every -p argument
  // must select exactly one literal regular-file member.
  if (typeof member !== 'string' || !member || hasControls(member) || /[\\:*?]/.test(member) || member.includes('[') || member.includes(']') || member.startsWith('-') || member.split('/').some(part => !part || part.startsWith('.'))) {
    throw new Error('Unsafe member path');
  }
}

function containedFile(directory, name) {
  if (typeof name !== 'string' || !name || path.basename(name) !== name || name.includes('\\') || hasControls(name) || name.startsWith('.')) throw new Error('Unsafe file name');
  const root = realpathSync(directory);
  const file = path.join(root, name);
  if (!lstatSync(file).isFile() || path.dirname(realpathSync(file)) !== root) throw new Error('Expected regular file within intended directory');
  return file;
}

export function verifyRelease(directory, trustedKeys) {
  const bytes = readFileSync(containedFile(directory, 'release-manifest.json'));
  const manifest = JSON.parse(bytes);
  const { keyId, algorithm } = manifest.signature ?? {};
  if (typeof keyId !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(keyId) || /[\r\n]/.test(keyId)) throw new Error('Invalid keyId');
  if (algorithm !== 'Ed25519') throw new Error('Signature algorithm must be Ed25519');
  let key;
  try {
    key = createPublicKey(readFileSync(containedFile(trustedKeys, `${keyId}.pem`)));
  } catch {
    throw new Error('Unknown or invalid trusted keyId');
  }
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Trusted key must be Ed25519');
  if (!verify(null, bytes, key, readFileSync(containedFile(directory, 'release-manifest.sig')))) throw new Error('Manifest signature verification failed');

  // No archive access or member trust before signature verification above.
  const archive = containedFile(directory, manifest.archive?.name);
  if (sha256(readFileSync(archive)) !== manifest.archive.sha256) throw new Error('Archive SHA-256 mismatch');
  if (!Array.isArray(manifest.members) || !manifest.members.length) throw new Error('Invalid manifest members');
  const expected = new Map();
  for (const member of manifest.members) {
    assertMemberPath(member.path);
    if (expected.has(member.path)) throw new Error('Duplicate manifest member');
    if (!Number.isSafeInteger(member.size) || member.size < 0 || !/^[0-9a-f]{64}$/.test(member.sha256)) throw new Error('Invalid member size or SHA-256');
    if (member.cacheClass !== cacheClass(member.path)) throw new Error('Member cache classification mismatch');
    expected.set(member.path, member);
  }
  const env = { ...process.env, LC_ALL: 'C', TZ: 'UTC' };
  delete env.UNZIP;
  delete env.UNZIPOPT;
  delete env.ZIPINFO;
  delete env.ZIPINFOOPT;
  const run = (command, args) => execFileSync(command, args, { env, maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const listing = run('unzip', ['-Z1', archive]).toString('utf8');
  if (!listing.endsWith('\n')) throw new Error('Invalid archive member listing');
  const names = listing.slice(0, -1).split('\n');
  const seen = new Set();
  for (const name of names) {
    assertMemberPath(name);
    if (seen.has(name)) throw new Error('Duplicate archive entry');
    seen.add(name);
    if (!expected.has(name)) throw new Error('Extra archive member');
  }
  if (seen.size !== expected.size) throw new Error('Missing archive member');
  const modes = run('zipinfo', ['-l', archive]).toString('utf8').split('\n').filter(line => /^\S{10}\s+\d+\.\d+\s/.test(line));
  if (modes.length !== names.length) throw new Error('Cannot establish archive member types');
  if (modes.some(line => line.startsWith('l'))) throw new Error('Symlink archive entry');
  if (modes.some(line => !line.startsWith('-'))) throw new Error('Non-regular archive entry');
  for (const name of names) {
    const data = run('unzip', ['-p', archive, name]);
    const member = expected.get(name);
    if (data.length !== member.size) throw new Error(`Member size mismatch: ${name}`);
    if (sha256(data) !== member.sha256) throw new Error(`Member SHA-256 mismatch: ${name}`);
  }
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: verify-release.mjs <release-dir> <trusted-key-dir>');
    verifyRelease(process.argv[2], process.argv[3]);
    console.log('Release signature, archive, and members verified');
  } catch (error) {
    console.error(`Release verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
