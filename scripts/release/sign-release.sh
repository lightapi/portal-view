#!/usr/bin/env bash
set -euo pipefail
umask 077

die() { printf '%s\n' "$*" >&2; exit 1; }
[[ $# == 2 ]] || die 'Usage: sign-release.sh <release-dir> <private-key.pem>'
release_dir=$(realpath -- "$1")
private_key=$(realpath -- "$2")
[[ -f "$private_key" ]] || die 'Signing private key is missing'
private_mode=$(stat -c '%a' -- "$private_key")
if (( (8#$private_mode & 077) != 0 )); then
  die 'Signing private key must not be group/world accessible'
fi
[[ -f "$release_dir/release-manifest.json" && ! -L "$release_dir/release-manifest.json" ]] || die 'Missing regular release manifest'
temporary=$(mktemp -d)
trap 'rm -rf -- "$temporary"' EXIT
# Public DER prefix identifies Ed25519 without printing private material.
openssl pkey -in "$private_key" -pubout -out "$temporary/public.pem"
openssl pkey -pubin -in "$temporary/public.pem" -outform DER -out "$temporary/public.der"
[[ $(od -An -tx1 -N12 "$temporary/public.der" | tr -d ' \n') == 302a300506032b6570032100 ]] || die 'Signing key must be Ed25519'
openssl pkeyutl -sign -inkey "$private_key" -rawin -in "$release_dir/release-manifest.json" -out "$temporary/signature"
openssl pkeyutl -verify -pubin -inkey "$temporary/public.pem" -rawin -in "$release_dir/release-manifest.json" -sigfile "$temporary/signature"
[[ ! -L "$release_dir/release-manifest.sig" ]] || die 'Refusing a symlink signature output'
install -m 0600 -- "$temporary/signature" "$release_dir/release-manifest.sig"
