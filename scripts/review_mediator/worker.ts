import { parentPort, workerData } from 'node:worker_threads';
import { basename, resolve, relative } from 'node:path';
import { promises as fs } from 'node:fs';
import {
  ArtifactState,
  MainToWorkerMessage,
  WorkerInitMessage,
  WorkerToMainMessage,
  ReviewVerdict,
  StatusUpdateMessage
} from './messages.ts';
import {
  runDispatch,
  runReviewResult,
  runAgentCommand,
  jsonReportExists,
  OutputListener
} from './command_adapters.ts';
import type { ManagedCommand } from './command_adapters.ts';

interface VerdictResult {
  verdict: ReviewVerdict;
  output: string;
}

const AGENT_PROMPT_TEMPLATE = `Skip all predating protocols and mandates of the project, no other rules apply and only follow this directive:
You must remediate the review comments for a pending changelist.

0. DURING THE ENTIRE PROCESS, EMIT AS MANY REASONING TYPE MESSAGES AS POSSIBLE TO EXPLAIN YOUR THOUGHT PROCESS.
1. Run \`npm run review:result -- --file "<artifact_path>"\`. This command outputs the current verdicts and remarks of the changelist.
You must use it immediately to understand the outstanding work before modifying the code.
2. Analyze the source code and the review remark’s description (from the command output) to understand what needs fixing. Do not open or read the HTML review artifact itself—focus only
  on the code and the remark content surfaced by the required command.
3. You must fix all review remarks in the changelist UNLESS you can definitively determine that a remark is invalid.
4. Ensure you are not changing any code that is outside the scope of review remarks, except step 7.
5. You must NOT run any git commands EXCEPT read-only commands AND git add as explained below.
6. Your work is complete after all review remarks have been implemented. No additional work is allowed.
7. If you're modifying a file that was not staged in git (because of a side effect of fixing a remark), run git add <file> to stage it.
8. No automated tests are available, you must NOT run any tests.
9. Don't do double checks of your own work, one check is enough.

After studying the command output:

1. Create a backup using backup command.
2. Apply all required fixes in the repository so that no remarks remain.
3. Confirm all review remarks are addressed and no pending work remains by running \`npm run review:result -- --file "<artifact_path>"\` as a reminder.
4. The result command is not dynamic and will not reflect your changes, which is expected.
5. Produce a new review artifact with \`npm run review:create -- --feature "<slug>" --pr_request "<10+ sentence>"\`.
The narrative must describe all of the implemented changes in at least ten sentences.
6. This command outputs the path to the new artifact. Pick the one that has 'codex' in the name if multiple are present.
7. Create a JSON report at /code_review/review_process/<json_name> with the exact structure: {"new_artifact": "<relative_path_to_new_artifact>"}. Do not include additional fields, capitalization changes, or formatting variations.
8. json file must not be staged in git.
Return success only after every remark is resolved, the new artifact is generated, and the JSON report (matching the schema above) is present.`;

const messagePort = parentPort;
const init = workerData as WorkerInitMessage;
const context = init.context;
let shouldShutdown = false;
const activeCommands = new Set<ManagedCommand>();
let currentState: ArtifactState | null = null;

if (messagePort) {
  messagePort.on('message', message => {
    const typed = message as MainToWorkerMessage;
    if (typed.type === 'control:shutdown') {
      shouldShutdown = true;
      for (const cmd of activeCommands) {
        cmd.terminate('SIGTERM');
      }
    }
  });
}

const artifactId = basename(context.artifactPath);
let lastDispatchAiText = '';
let currentIteration = 1;
let currentArtifactPath = context.artifactPath;

void run();

function trackCommand(handle: ManagedCommand): ManagedCommand {
  activeCommands.add(handle);
  void handle.result.finally(() => activeCommands.delete(handle));
  return handle;
}

async function run(): Promise<void> {
  try {
    currentIteration = 1;
    currentArtifactPath = context.artifactPath;
    postStatus('Pending', 'Queued for AI review', false);
    if (await runDispatchPhase(context.artifactPath)) {
      await reviewLoop(context.artifactPath, context.slug, false);
    } else if (!shouldShutdown) {
      postStatus('Error', 'Dispatch command failed', false);
      postComplete('ERROR');
    }
  } catch (error) {
    postError(formatError(error));
  } finally {
    postHeartbeat();
  }
}

async function runDispatchPhase(currentArtifact: string): Promise<boolean> {
  if (shouldShutdown) {
    return false;
  }
  currentArtifactPath = currentArtifact;
  lastDispatchAiText = '';
  postLog('[runDispatchPhase] review phase started');
  postStatus('Dispatching', reviewingText(currentArtifact), true);
  const handle = trackCommand(runDispatch(currentArtifact, dispatchListener));
  const result = await handle.result;
  postLog(`[runDispatchPhase] review phase exited {"code":${result.exitCode}}`);
  if (shouldShutdown) {
    return false;
  }
  if (result.exitCode !== 0) {
    postError('Review command failed');
    return false;
  }
  return true;
}

async function reviewLoop(startArtifact: string, initialSlug: string, needsDispatch: boolean): Promise<void> {
  let artifactPath = startArtifact;
  let slug = initialSlug;
  while (!shouldShutdown) {
    if (needsDispatch) {
      if (!(await runDispatchPhase(artifactPath))) {
        return;
      }
      needsDispatch = false;
    }
    postStatus('AwaitingReview', 'Evaluating review results', true);
    const verdictResult = await evaluateArtifact(artifactPath);
    if (shouldShutdown) {
      return;
    }
    postLog(`[reviewLoop] Review result {"artifact":"${basename(artifactPath)}","verdict":"${verdictResult.verdict}"}`);
    if (verdictResult.verdict === 'PASS') {
      postStatus('Complete', 'Review process is complete', false, undefined, 'PASS');
      postComplete('PASS');
      return;
    }
    if (verdictResult.verdict === 'COMMAND_ERROR') {
      postStatus('Error', 'Review result command failed', false);
      postError('Review result command failed');
      postComplete('ERROR');
      return;
    }
    if (verdictResult.verdict === 'PARSE_ERROR') {
      postStatus('Error', 'Review result parsing failed', false);
      postComplete('ERROR');
      return;
    }
    const remediationResult = await runRemediation(artifactPath, slug);
    if (!remediationResult) {
      postStatus('Error', 'Remediation failed', false);
      postComplete('ERROR');
      return;
    }
    postLog(`[reviewLoop] New artifact queued {"original":"${basename(context.originalArtifact)}","new":"${basename(remediationResult.artifactPath)}"}`);
    postNewArtifact(context.originalArtifact, remediationResult.artifactPath);
    artifactPath = remediationResult.artifactPath;
    slug = remediationResult.slug;
    currentIteration += 1;
    currentArtifactPath = artifactPath;
    needsDispatch = true;
  }
}

async function evaluateArtifact(artifactPath: string): Promise<VerdictResult> {
  const handle = trackCommand(runReviewResult(artifactPath));
  const result = await handle.result;
  if (result.exitCode !== 0) {
    return { verdict: 'COMMAND_ERROR', output: result.output };
  }
  const verdict = parseVerdict(result.output);
  return { verdict, output: result.output };
}

function parseVerdict(output: string): ReviewVerdict {
  if (/^Verdict:[\s\S]*?FAIL\b/mi.test(output)) {
    return 'FAIL';
  }
  if (/^Verdict:[\s\S]*?PASS\b/mi.test(output)) {
    return 'PASS';
  }
  return 'PARSE_ERROR';
}

async function runRemediation(currentArtifact: string, currentSlug: string): Promise<{ artifactPath: string; slug: string } | null> {
  if (shouldShutdown) {
    return null;
  }
  currentArtifactPath = currentArtifact;
  postStatus('Remediating', remediatingText(currentArtifact), true);
  postLog('[runRemediation] Remediation started');
  const aiOutcome = await runAgent(currentArtifact);
  if (!aiOutcome) {
    postError('Agent command unavailable or failed');
    return null;
  }
  if (shouldShutdown) {
    return null;
  }
  const baseName = basename(currentArtifact);
  const jsonResult = await waitForJsonReport(baseName, 120000);
  if (!jsonResult) {
    postLog('[runRemediation] JSON validation failed or timed out');
    postError('JSON validation failed or timed out');
    return null;
  }
  const resolvedArtifact = resolve(repoRoot(), jsonResult.newArtifact);
  const nextSlug = deriveSlugFromFilename(basename(resolvedArtifact));
  return { artifactPath: resolvedArtifact, slug: nextSlug };
}

async function runAgent(artifactPath: string): Promise<{ summary?: string } | null> {
  const prompt = buildAgentPrompt(artifactPath, context.slug);
  const stream: { latest: string } = { latest: '' };
  let lastBroadcast = '';
  const listener: OutputListener = (_channel, chunk) => {
    const lines = chunk.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length > 0) {
      const recent = lines[lines.length - 1];
      stream.latest = recent ?? stream.latest;
    }
  };
  const handle = trackCommand(runAgentCommand(prompt, artifactPath, listener));
  const ticker = setInterval(() => {
    if (shouldShutdown) {
      clearInterval(ticker);
      return;
    }
    if (stream.latest && stream.latest !== lastBroadcast) {
      lastBroadcast = stream.latest;
      postStatus('Remediating', remediatingText(artifactPath), true, stream.latest);
      postLog(`[runAgent] ${stream.latest}`);
    }
  }, 2000);
  const result = await handle.result;
  clearInterval(ticker);
  if (stream.latest && stream.latest !== lastBroadcast) {
    postStatus('Remediating', remediatingText(artifactPath), true, stream.latest);
    postLog(`[runAgent] ${stream.latest}`);
  } else {
    postStatus('Remediating', remediatingText(artifactPath), true);
  }
  if (result.exitCode !== 0) {
    const summary = summarizeCommandFailure('Agent', result.exitCode, result.signal, result.output);
    postLog(summary);
    postError('Agent execution failed');
    return null;
  }
  return { summary: stream.latest };
}

async function waitForJsonReport(artifactFileName: string, timeoutMs: number): Promise<{ newArtifact: string } | null> {
  const deadline = Date.now() + timeoutMs;
  const target = resolve(context.reviewProcessDir, artifactFileName.replace(/\.html$/i, '.json'));
  while (Date.now() < deadline) {
    if (jsonReportExists(context.reviewProcessDir, artifactFileName)) {
      try {
        const raw = await fs.readFile(target, 'utf8');
        if (raw.trim().length > 0) {
          const parsed = JSON.parse(raw) as { new_artifact?: string };
          if (typeof parsed.new_artifact === 'string') {
            const candidate = parsed.new_artifact.trim();
            if (candidate.length > 0) {
              return { newArtifact: candidate };
            }
          }
        }
      } catch {}
    }
    if (shouldShutdown) {
      return null;
    }
    await delay(500);
  }
  return null;
}

function buildAgentPrompt(artifactPath: string, slug: string): string {
  return AGENT_PROMPT_TEMPLATE
    .replace(/<artifact_path>/g, artifactPath)
    .replace('<slug>', slug)
    .replace('<json_name>', basename(artifactPath).replace(/\.html$/i, '.json'));
}

function deriveSlugFromFilename(filename: string): string {
  const base = filename.replace(/^review_/, '').replace(/\.html$/i, '');
  return base.replace(/_(codex|claude)(?:_v\d+)?$/i, '');
}

function postStatus(state: ArtifactState, text: string, spinner: boolean, aiLine?: string, verdict?: ReviewVerdict): void {
  if (currentState !== state) {
    currentState = state;
    postLog(`[postStatus] Worker phase transition {"state":"${state}"}`);
  }
  const labelledText = applyIterationLabel(text);
  const message = {
    type: 'status:update',
    artifactId,
    state,
    text: labelledText,
    spinner,
    timestamp: Date.now(),
    ...(aiLine !== undefined ? { aiLine } : {}),
    ...(verdict ? { verdict } : {})
  } satisfies StatusUpdateMessage;
  messagePort?.postMessage(message);
}

function postLog(message: string): void {
  const payload: WorkerToMainMessage = {
    type: 'log:append',
    artifactId,
    threadId: context.threadId,
    message,
    timestamp: Date.now()
  };
  messagePort?.postMessage(payload);
}

function postError(message: string): void {
  const payload: WorkerToMainMessage = {
    type: 'status:error',
    artifactId,
    message,
    timestamp: Date.now()
  };
  messagePort?.postMessage(payload);
}

function postNewArtifact(originalArtifact: string, newArtifact: string): void {
  const payload: WorkerToMainMessage = {
    type: 'status:newArtifact',
    originalArtifact,
    newArtifactPath: newArtifact,
    timestamp: Date.now()
  };
  messagePort?.postMessage(payload);
}

function postComplete(verdict: ReviewVerdict): void {
  const payload: WorkerToMainMessage = {
    type: 'status:complete',
    artifactId,
    verdict,
    timestamp: Date.now()
  };
  messagePort?.postMessage(payload);
}

function postHeartbeat(): void {
  const payload: WorkerToMainMessage = {
    type: 'status:heartbeat',
    artifactId,
    timestamp: Date.now()
  };
  messagePort?.postMessage(payload);
}

function dispatchListener(_channel: 'stdout' | 'stderr', chunk: string): void {
  const lines = chunk.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  for (const line of lines) {
    postLog(line);
    const aiText = extractTextFromJson(line);
    if (aiText !== null && aiText !== lastDispatchAiText) {
      lastDispatchAiText = aiText;
      postStatus('Dispatching', reviewingText(currentArtifactPath), true, line);
    }
  }
}

function repoRoot(): string {
  return resolve(process.cwd());
}

function delay(ms: number): Promise<void> {
  return new Promise(resolveDelay => setTimeout(resolveDelay, ms));
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

function summarizeCommandFailure(label: string, code: number | null, signal: NodeJS.Signals | null, output: string): string {
  const base = {
    code,
    signal,
    output: truncateOutput(output)
  };
  return `[summarizeCommandFailure] ${label} command failed ${JSON.stringify(base)}`;
}


function extractTextFromJson(line: string): string | null {
  try {
    const parsed = JSON.parse(line) as { item?: { text?: unknown }; text?: unknown };
    if (typeof parsed.item?.text === 'string') {
      return parsed.item.text;
    }
    if (typeof parsed.text === 'string') {
      return parsed.text;
    }
  } catch {
    /* ignore parse errors */
  }
  return null;
}

function truncateOutput(output: string, max = 160): string {
  const normalized = output.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max)}…`;
}

function reviewingText(path: string): string {
  return `Reviewing ${basename(path)}`;
}

function remediatingText(path: string): string {
  return `Remediating ${basename(path)}`;
}

function applyIterationLabel(text: string): string {
  const normalized = text ?? '';
  if (normalized.startsWith('[Iteration')) {
    return normalized;
  }
  return `[Iteration ${currentIteration}] ${normalized}`;
}
