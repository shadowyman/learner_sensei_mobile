import { Worker } from 'node:worker_threads';
import { resolve, basename } from 'node:path';
import { existsSync, promises as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  ArtifactStatusRecord,
  ArtifactState,
  DashboardSnapshot,
  MainToWorkerMessage,
  WorkerInitMessage,
  WorkerToMainMessage,
  ReviewVerdict
} from './review_mediator/messages.ts';
import { LogManager } from './review_mediator/log_manager.ts';
import { DashboardRenderer } from './review_mediator/dashboard.ts';

interface ArtifactJob {
  artifactPath: string;
  originalArtifact: string;
  slug: string;
  narrative: string;
}

interface WorkerHandle {
  worker: Worker;
  job: ArtifactJob;
  threadId: number;
}

const reviewDir = resolve(process.cwd(), 'code_review');
const reviewProcessDir = resolve(reviewDir, 'review_process');

async function main(): Promise<void> {
  const artifacts = parseArtifacts(process.argv.slice(2));
  if (artifacts.length === 0) {
    printUsage();
    process.exitCode = 1;
    return;
  }
  await fs.mkdir(reviewProcessDir, { recursive: true });
  const logManager = new LogManager(reviewProcessDir);
  const renderer = new DashboardRenderer();
  const statusRecords = new Map<string, ArtifactStatusRecord>();
  const workerHandles = new Map<string, WorkerHandle>();
  const activeOriginals = new Map<string, { completed: boolean }>();
  let shutdownRequested = false;
  let encounteredFailure = false;
  let nextThreadId = 1;
  let lastRenderLog = 0;

  for (const job of artifacts) {
    const key = artifactKey(job.artifactPath);
    await logManager.resetLog(key);
    statusRecords.set(key, createStatusRecord(key, 'Pending', 'Queued'));
    activeOriginals.set(job.originalArtifact, { completed: false });
    spawnWorker(job);
  }
  console.info('[REVIEW_MEDIATOR] CLI initialized with artifacts', { artifacts: artifacts.map(job => job.artifactPath) });

  const interval = setInterval(() => {
    render(renderer, statusRecords, logManager);
  }, 200);

  process.on('exit', () => renderer.dispose());

  process.on('SIGINT', () => {
    if (shutdownRequested) {
      return;
    }
    shutdownRequested = true;
    console.info('[REVIEW_MEDIATOR] Shutdown requested');
    clearInterval(interval);
    for (const handle of workerHandles.values()) {
      handle.worker.postMessage({ type: 'control:shutdown' } satisfies MainToWorkerMessage);
    }
    const terminationPromises: Promise<number>[] = [];
    for (const handle of workerHandles.values()) {
      terminationPromises.push(handle.worker.terminate());
    }
    for (const record of statusRecords.values()) {
      if (record.state !== 'Complete' && record.state !== 'Error') {
        record.state = 'Error';
        record.text = 'Shutdown requested';
        record.spinner = false;
      }
    }
    encounteredFailure = true;
    render(renderer, statusRecords, logManager);
    void Promise.allSettled(terminationPromises).finally(() => {
      renderer.dispose();
      process.exit(1);
    });
  });

  function spawnWorker(job: ArtifactJob): void {
    const key = artifactKey(job.artifactPath);
    const candidatePaths = ['worker.ts', 'worker.js'].map(file =>
      resolve(process.cwd(), 'scripts', 'review_mediator', file)
    );
    const existingPath = candidatePaths.find(path => existsSync(path));
    const chosenPath = existingPath ?? candidatePaths[0];
    if (!chosenPath) {
      throw new Error('review mediator worker script missing');
    }
    const workerScript = pathToFileURL(chosenPath);
    const threadId = nextThreadId++;
    const initMessage: WorkerInitMessage = {
      context: {
        artifactPath: job.artifactPath,
        originalArtifact: job.originalArtifact,
        slug: job.slug,
        narrative: job.narrative,
        reviewProcessDir,
        threadId: threadId
      }
    };
    const worker = new Worker(workerScript, {
      workerData: initMessage,
      stdout: false,
      stderr: false,
      execArgv: chosenPath.endsWith('.ts') ? ['--require', 'ts-node/register'] : []
    });
    const handle: WorkerHandle = { worker, job, threadId };
    workerHandles.set(key, handle);
    worker.on('message', message => {
      void handleWorkerMessage(message as WorkerToMainMessage, handle).catch(error => {
        console.error('Sensei: [REVIEW_MEDIATOR] Message handling failed', error);
        encounteredFailure = true;
      });
    });
    worker.on('error', error => {
      const record = statusRecords.get(key);
      if (record) {
        record.state = 'Error';
        record.text = error.message;
        record.spinner = false;
      }
      const tracker = activeOriginals.get(handle.job.originalArtifact);
      if (tracker) {
        tracker.completed = true;
      }
      encounteredFailure = true;
      render(renderer, statusRecords, logManager);
    });
    worker.on('exit', () => {
      workerHandles.delete(key);
      const tracker = activeOriginals.get(handle.job.originalArtifact);
      if (tracker && !tracker.completed) {
        tracker.completed = true;
      }
      render(renderer, statusRecords, logManager);
      checkCompletion();
    });
  }

  async function handleWorkerMessage(message: WorkerToMainMessage, handle: WorkerHandle): Promise<void> {
    switch (message.type) {
      case 'status:update': {
        const key = message.artifactId;
        const record = statusRecords.get(key) ?? createStatusRecord(key, message.state, message.text);
        const previousState = record.state;
        record.state = message.state;
        record.text = message.text;
        record.spinner = message.spinner;
        if (message.aiLine !== undefined) {
          const previousAiLine = typeof record.aiLine === 'string' ? record.aiLine : '';
          delete record.aiLine;
          let parsedLine: string | null = null;
          try {
            const parsed = JSON.parse(message.aiLine) as { item?: { text?: unknown }; text?: unknown };
            if (typeof parsed.item?.text === 'string') {
              parsedLine = parsed.item.text;
            } else if (typeof parsed.text === 'string') {
              parsedLine = parsed.text;
            }
          } catch {
            /* ignore parse errors */
          }
          if (parsedLine !== null) {
            const padded = previousAiLine.length > parsedLine.length
              ? parsedLine + ' '.repeat(previousAiLine.length - parsedLine.length)
              : parsedLine;
            record.aiLine = padded;
          } else if (previousAiLine.length > 0) {
            record.aiLine = previousAiLine;
          }
        }
        if (message.verdict) {
          record.verdict = message.verdict;
        }
        record.lastUpdate = message.timestamp;
        statusRecords.set(key, record);
        if (!renderer.isInteractive() && previousState !== message.state) {
          console.info('[REVIEW_MEDIATOR] Status update received', { artifact: key, state: message.state });
        }
        break;
      }
      case 'log:append': {
        if (!statusRecords.has(message.artifactId)) {
          statusRecords.set(message.artifactId, createStatusRecord(message.artifactId, 'Pending', 'Pending log stream'));
        }
        await logManager.append({
          artifactId: message.artifactId,
          threadId: message.threadId,
          message: message.message,
          timestamp: message.timestamp
        });
        break;
      }
      case 'status:newArtifact': {
        const key = artifactKey(handle.job.artifactPath);
        const record = statusRecords.get(key);
        if (record) {
          record.text = `Review craft:${message.newArtifactPath}`;
          record.lastUpdate = message.timestamp;
        }
        await logManager.append({ artifactId: key, threadId: handle.threadId, message: `[REVIEW_MEDIATOR] Review craft:${message.newArtifactPath}`, timestamp: message.timestamp });
        break;
      }
      case 'status:error': {
        const record = statusRecords.get(message.artifactId) ?? createStatusRecord(message.artifactId, 'Error', message.message);
        record.state = 'Error';
        record.text = message.message;
        record.spinner = false;
        record.lastUpdate = message.timestamp;
        delete record.aiLine;
        statusRecords.set(message.artifactId, record);
        const tracker = activeOriginals.get(handle.job.originalArtifact);
        if (tracker) {
          tracker.completed = true;
        }
        encounteredFailure = true;
        break;
      }
      case 'status:complete': {
        const record = statusRecords.get(message.artifactId) ?? createStatusRecord(message.artifactId, 'Complete', 'Completed');
        record.state = 'Complete';
        record.text = 'Review process is complete';
        record.spinner = false;
        record.verdict = message.verdict;
        record.lastUpdate = message.timestamp;
        statusRecords.set(message.artifactId, record);
        const tracker = activeOriginals.get(handle.job.originalArtifact);
        if (tracker) {
          tracker.completed = true;
        }
        if (message.verdict !== 'PASS') {
          encounteredFailure = true;
        }
        break;
      }
      case 'status:heartbeat': {
        const record = statusRecords.get(message.artifactId);
        if (record) {
          record.lastUpdate = message.timestamp;
        }
        break;
      }
    }
    render(renderer, statusRecords, logManager);
  }

  function checkCompletion(): void {
    if (workerHandles.size > 0) {
      return;
    }
    const pending = [...activeOriginals.values()].some(entry => !entry.completed);
    if (!pending) {
      clearInterval(interval);
      render(renderer, statusRecords, logManager);
      console.info('[REVIEW_MEDIATOR] CLI entry complete');
      renderer.dispose();
      process.exitCode = encounteredFailure || shutdownRequested ? 1 : 0;
    }
  }

  function createStatusRecord(id: string, state: ArtifactState, text: string): ArtifactStatusRecord {
    return {
      artifactId: id,
      state,
      text,
      spinner: false,
      lastUpdate: Date.now()
    };
  }

  function artifactKey(artifactPath: string): string {
    return basename(artifactPath);
  }

  function render(rendererInstance: DashboardRenderer, records: Map<string, ArtifactStatusRecord>, manager: LogManager): void {
    const snapshot: DashboardSnapshot = {
      statuses: [...records.values()],
      logs: manager.getVisibleLogs()
    };
    rendererInstance.render(snapshot);
    lastRenderLog = Date.now();
  }

  checkCompletion();
}

function parseArtifacts(argv: string[]): ArtifactJob[] {
  const inputs: string[] = [];
  for (let index = 0; index < argv.length;) {
    const token = argv[index];
    if (!token) {
      index += 1;
      continue;
    }
    if (token === '--file') {
      index += 1;
      while (index < argv.length) {
        const candidate = argv[index];
        if (!candidate || candidate.startsWith('--')) {
          break;
        }
        inputs.push(candidate);
        index += 1;
      }
      continue;
    }
    if (!token.startsWith('--')) {
      inputs.push(token);
    }
    index += 1;
  }
  const jobs: ArtifactJob[] = [];
  for (const input of inputs) {
    const resolved = resolvePathInput(input);
    jobs.push({
      artifactPath: resolved,
      originalArtifact: resolved,
      slug: deriveSlug(resolved),
      narrative: defaultNarrative()
    });
  }
  return jobs;
}

function resolvePathInput(input: string): string {
  const absolute = resolve(process.cwd(), input);
  if (existsSync(absolute)) {
    return absolute;
  }
  const candidate = resolve(process.cwd(), 'code_review', input);
  if (existsSync(candidate)) {
    return candidate;
  }
  return absolute;
}

function deriveSlug(path: string): string {
  const base = basename(path).replace(/^review_/, '').replace(/\.html$/i, '');
  return base.replace(/_(codex|claude)(?:_v\d+)?$/i, '');
}

function defaultNarrative(): string {
  return 'Automated remediation updated the implementation to address the identified review remarks. The mediator ensured dispatch completed successfully. The remediation pipeline re-evaluated artifacts with the latest changes. The system refreshed inline status indicators throughout the operation. The AI assistant reviewed remaining failures and suggested targeted edits. The mediator scheduled new review requests after remediation. The logging window captured every operational transition. The JSON report was generated for downstream automation. The workflow enforces graceful shutdown without dangling processes. The mediator confirmed completion before advancing to the next artifact.';
}

function printUsage(): void {
  console.error('Usage: ts-node scripts/review_mediator.ts [--file <artifact.html> ...] <artifact.html> [...artifact.html]');
}

main().catch(error => {
  console.error('Sensei: Review mediator failed', error);
  process.exitCode = 1;
});
