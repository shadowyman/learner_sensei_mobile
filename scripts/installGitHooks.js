const { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');

function ensurePrePushHook() {
  const root = process.cwd();
  const hooksDir = resolve(root, '.git', 'hooks');
  if (!existsSync(hooksDir)) {
    return;
  }
  const hookPath = resolve(hooksDir, 'pre-push');
  const payload = '#!/bin/sh\nnpm run review:hook:prepush --silent\n';
  if (existsSync(hookPath)) {
    try {
      const current = readFileSync(hookPath, 'utf8');
      if (current.includes('review:hook:prepush')) {
        return;
      }
    } catch (error) {}
  } else {
    mkdirSync(hooksDir, { recursive: true });
  }
  writeFileSync(hookPath, payload, 'utf8');
  chmodSync(hookPath, 0o755);
}

ensurePrePushHook();
