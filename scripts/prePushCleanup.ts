import { spawnSync } from 'child_process';
import { cleanupFiles } from './reviewContextLib';

const ZERO_SHA = '0'.repeat(40);

function runGitCommand(args: string[]): string[] {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(result.stderr || 'Failed to collect pushed file list.');
  }
  const output = result.stdout.trim();
  if (output.length === 0) {
    return [];
  }
  return output.split('\n').map(entry => entry.trim()).filter(entry => entry.length > 0);
}

export function gatherDiffFiles(lines: string[]): string[] {
  const files = new Set<string>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length < 4) {
      continue;
    }
    const localSha = parts[1];
    const remoteSha = parts[3];
    if (!localSha || localSha === ZERO_SHA) {
      continue;
    }
    if (remoteSha && remoteSha !== ZERO_SHA) {
      for (const entry of runGitCommand(['diff', '--name-only', remoteSha, localSha])) {
        files.add(entry);
      }
      continue;
    }
    const commits = runGitCommand(['rev-list', localSha, '--not', '--remotes']);
    if (commits.length === 0) {
      for (const entry of runGitCommand(['diff-tree', '--no-commit-id', '--name-only', '-r', localSha])) {
        files.add(entry);
      }
      continue;
    }
    for (const commit of commits) {
      for (const entry of runGitCommand(['diff-tree', '--no-commit-id', '--name-only', '-r', commit])) {
        files.add(entry);
      }
    }
  }
  return Array.from(files);
}

export function runHook(raw: string): void {
  const lines = raw.split('\n');
  const files = gatherDiffFiles(lines);
  if (files.length === 0) {
    console.log('[REVCTX] Hook pruned', { removedFiles: [], clearedSlugs: [] });
    process.exit(0);
  }
  try {
    cleanupFiles({ files });
  } catch (error) {
    if (error instanceof Error) {
      console.error('[REVCTX] Cleanup skipped:', error.message);
    } else {
      console.error('[REVCTX] Cleanup skipped:', String(error));
    }
    process.exit(0);
  }
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk;
});
process.stdin.on('end', () => {
  runHook(buffer);
});
