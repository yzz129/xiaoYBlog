#!/usr/bin/env node
'use strict';

// Print locations only: never copy a detected credential into logs.
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pattern = '(^|[^A-Za-z0-9_-])sk-[A-Za-z0-9_-]{20,}';
const args = process.argv.slice(2);
let scope;
if (args.length === 0) {
  scope = ['--untracked', '--exclude-standard'];
} else if (args.length === 1 && args[0] === '--staged') {
  scope = ['--cached'];
} else if (args.length === 2 && args[0] === '--revision' && /^[a-f0-9]{7,40}$/i.test(args[1])) {
  scope = [args[1]];
} else {
  console.error('Usage: node scripts/check-api-secrets.cjs [--staged | --revision COMMIT_SHA]');
  process.exit(2);
}

const result = spawnSync('git', ['grep', '-l', '-z', '-I', '-E', '-e', pattern, ...scope, '--', '.'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.error || (result.status !== 0 && result.status !== 1)) {
  console.error('API key scan could not complete. Check Git availability and the selected revision.');
  process.exit(2);
}

if (result.status === 0) {
  console.error('Potential API key found. Remove it from source and revoke it if it was exposed.');
  for (const file of result.stdout.split('\0').filter(Boolean)) {
    console.error(JSON.stringify(file));
  }
  process.exit(1);
}

console.log('API key scan passed (sk- token pattern only; this does not verify revocation or erase history).');
