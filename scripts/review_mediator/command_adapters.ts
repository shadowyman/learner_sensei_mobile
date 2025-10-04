import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';

export type OutputChannel = 'stdout' | 'stderr';

export interface CommandResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  output: string;
}

export interface ManagedCommand {
  result: Promise<CommandResult>;
  terminate(signal?: NodeJS.Signals): void;
}

export type OutputListener = (channel: OutputChannel, chunk: string) => void;

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const codexCmd = process.env.REVIEW_MEDIATOR_AGENT_CMD;
const defaultAgentCommand = [
  'codex',
  'exec',
  '--experimental-json',
  '--model',
  'gpt-5-codex',
  '--sandbox',
  'danger-full-access',
  '-c',
  'approval_policy="never"',
  '-c',
  'model_reasoning_effort="high"'
];

function tokenizeCommand(raw: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escape = false;
  for (const char of raw) {
    if (escape) {
      current += char;
      escape = false;
      continue;
    }
    if (char === '\\' && !inSingle) {
      escape = true;
      continue;
    }
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (!inSingle && !inDouble && /\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (escape) {
    current += '\\';
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}

function resolveAgentCommandParts(override: string | undefined): string[] {
  if (!override || override.trim().length === 0) {
    return [...defaultAgentCommand];
  }
  const trimmed = override.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
        const filtered = parsed
          .map(entry => entry.trim())
          .filter(entry => entry.length > 0);
        if (filtered.length > 0) {
          return [...filtered];
        }
      }
    } catch {}
  }
  const tokens = tokenizeCommand(trimmed).filter(entry => entry.length > 0);
  if (tokens.length === 0) {
    return [...defaultAgentCommand];
  }
  return tokens;
}

function repoRoot(): string {
  return resolve(process.cwd());
}

function runManagedCommand(command: string, args: string[], listener?: OutputListener, env?: NodeJS.ProcessEnv): ManagedCommand {
  const child = spawn(command, args, {
    cwd: repoRoot(),
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const buffers: string[] = [];
  child.stdout.on('data', data => {
    const chunk = data.toString();
    buffers.push(chunk);
    if (listener) {
      listener('stdout', chunk);
    }
  });
  child.stderr.on('data', data => {
    const chunk = data.toString();
    buffers.push(chunk);
    if (listener) {
      listener('stderr', chunk);
    }
  });
  const result = new Promise<CommandResult>((resolve) => {
    child.once('error', error => {
      const message = `[REVIEW_MEDIATOR] command spawn failed: ${error.message}`;
      buffers.push(message);
      if (listener) {
        listener('stderr', message);
      }
      resolve({ exitCode: null, signal: null, output: buffers.join('') });
    });
    child.once('exit', (code, signal) => {
      resolve({ exitCode: code, signal, output: buffers.join('') });
    });
  });
  const terminate = (signal?: NodeJS.Signals) => {
    if (!child.killed) {
      child.kill(signal ?? 'SIGTERM');
    }
  };
  return { result, terminate };
}

export function runDispatch(filePath: string, listener?: OutputListener): ManagedCommand {
  return runManagedCommand(npmCmd, ['run', 'review:dispatch', '--', '--file', filePath], listener);
}

export function runReviewResult(filePath: string): ManagedCommand {
  return runManagedCommand(npmCmd, ['run', 'review:result', '--', '--file', filePath]);
}

export function runReviewCreate(slug: string, narrative: string, listener?: OutputListener): ManagedCommand {
  return runManagedCommand(npmCmd, ['run', 'review:create', '--', '--feature', slug, '--pr_request', narrative], listener);
}

export function runAgentCommand(prompt: string, artifactPath: string, listener?: OutputListener): ManagedCommand {
  const parts = resolveAgentCommandParts(codexCmd);
  const [first, ...rest] = parts.length > 0 ? parts : ['codex'];
  const resolvedCommand = first ?? 'codex';
  return runManagedCommand(resolvedCommand, [...rest, prompt], listener);
}

export async function writeJsonReport(directory: string, artifactFileName: string, newArtifactPath: string): Promise<void> {
  const safeName = artifactFileName.replace(/\.html$/i, '.json');
  const target = resolve(directory, safeName);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(target, JSON.stringify({ new_artifact: newArtifactPath }, null, 2), 'utf8');
}

export function jsonReportExists(directory: string, artifactFileName: string): boolean {
  const safeName = artifactFileName.replace(/\.html$/i, '.json');
  return existsSync(resolve(directory, safeName));
}
