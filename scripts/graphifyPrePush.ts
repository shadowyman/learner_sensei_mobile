import { existsSync } from 'fs';
import { spawnSync } from 'child_process';

const ZERO_SHA = '0'.repeat(40);
const CODE_EXTENSIONS = new Set([
  '.c',
  '.cc',
  '.cpp',
  '.cjs',
  '.css',
  '.go',
  '.h',
  '.hpp',
  '.html',
  '.java',
  '.js',
  '.jsx',
  '.kt',
  '.m',
  '.mm',
  '.mjs',
  '.py',
  '.sh',
  '.swift',
  '.ts',
  '.tsx'
]);
const EXCLUDED_PREFIXES = [
  '.git/',
  '.serena/',
  'backup/',
  'graphify-out/',
  'logs/',
  'node_modules/',
  'SenseiMobile/app_web/webview_dist/',
  'tmp/'
];

function runGit(args: string[]): string[] {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(result.stderr || 'Failed to collect pushed file list.');
  }
  const output = result.stdout.trim();
  return output.length === 0 ? [] : output.split('\n').map(line => line.trim()).filter(Boolean);
}

function gatherDiffFiles(lines: string[]): string[] {
  const files = new Set<string>();
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) {
      continue;
    }
    const localSha = parts[1];
    const remoteSha = parts[3];
    if (!localSha || localSha === ZERO_SHA) {
      continue;
    }
    const diffArgs = remoteSha && remoteSha !== ZERO_SHA
      ? ['diff', '--name-only', remoteSha, localSha]
      : ['diff-tree', '--no-commit-id', '--name-only', '-r', localSha];
    for (const file of runGit(diffArgs)) {
      files.add(file);
    }
  }
  return Array.from(files);
}

function extensionOf(file: string): string {
  const index = file.lastIndexOf('.');
  return index === -1 ? '' : file.slice(index);
}

function isSourceFile(file: string): boolean {
  if (EXCLUDED_PREFIXES.some(prefix => file.startsWith(prefix))) {
    return false;
  }
  return CODE_EXTENSIONS.has(extensionOf(file));
}

function tail(value: string, limit = 12000): string {
  if (value.length <= limit) {
    return value;
  }
  return value.slice(value.length - limit);
}

function runHook(raw: string): void {
  if (!existsSync('graphify-out/graph.json')) {
    console.log('[GRAPHIFY] Skipped: graphify-out/graph.json not found.');
    return;
  }
  let files: string[];
  try {
    files = gatherDiffFiles(raw.split('\n'));
  } catch (error) {
    console.error('[GRAPHIFY] Skipped:', error instanceof Error ? error.message : String(error));
    return;
  }
  const sourceFiles = files.filter(isSourceFile);
  if (sourceFiles.length === 0) {
    console.log('[GRAPHIFY] Skipped: no pushed source files changed.');
    return;
  }
  if (!spawnSync('graphify', ['--version'], { encoding: 'utf8' }).stdout) {
    console.log('[GRAPHIFY] Skipped: graphify is not on PATH.');
    return;
  }
  const result = spawnSync('graphify', ['update', '.', '--no-cluster'], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  if (output.length > 0) {
    console.log(tail(output));
  }
  if (result.error) {
    console.error('[GRAPHIFY] Refresh skipped:', result.error.message);
    return;
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    console.error('[GRAPHIFY] Refresh failed; push not blocked.');
    return;
  }
  console.log(`[GRAPHIFY] Refreshed graph from ${sourceFiles.length} pushed source file(s).`);
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buffer += chunk;
});
process.stdin.on('end', () => {
  runHook(buffer);
});
