const { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');

function ensurePrePushHook() {
  const root = process.cwd();
  const hooksDir = resolve(root, '.git', 'hooks');
  if (!existsSync(hooksDir)) {
    return;
  }
  const hookPath = resolve(hooksDir, 'pre-push');
  const payload = `#!/bin/sh
tmp_file="\${TMPDIR:-/tmp}/sensei-pre-push-$$.refs"
cat > "$tmp_file"
npm run review:hook:prepush --silent < "$tmp_file"
review_status=$?
npm run graphify:hook:prepush --silent < "$tmp_file"
graphify_status=$?
rm -f "$tmp_file"
if [ "$review_status" -ne 0 ]; then
  exit "$review_status"
fi
exit "$graphify_status"
`;
  if (existsSync(hookPath)) {
    try {
      const current = readFileSync(hookPath, 'utf8');
      if (current.includes('review:hook:prepush') && current.includes('graphify:hook:prepush')) {
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
