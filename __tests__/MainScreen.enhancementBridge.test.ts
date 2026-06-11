import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.join(__dirname, '..');

function readSource(...segments: string[]): string {
  return fs.readFileSync(path.join(repoRoot, ...segments), 'utf8');
}

function extractEnhancementBranch(source: string): string {
  const start = source.indexOf("if (parsed.type === 'enhancement:request')");
  const endMarkers = [
    source.indexOf("if (parsed.type === 'selectionSensei:modalMessageRequest')", start),
    source.indexOf("if (parsed.type === 'analysis:request')", start),
    source.indexOf("if (parsed.type === 'teachingPlan:request')", start),
    source.indexOf("if (parsed.type === 'llmStream:request')", start)
  ].filter((index) => index > start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(endMarkers.length).toBeGreaterThan(0);

  const end = Math.min(...endMarkers);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('MainScreen Sensei enhancement bridge transport', () => {
  it('defines structured request and result bridge contracts with bridge-owned enhancement payload types', () => {
    const contracts = readSource('SenseiMobile', 'src', 'mobile', 'bridge', 'contracts.ts');
    const types = readSource('SenseiMobile', 'src', 'mobile', 'network', 'types.ts');

    expect(contracts).not.toContain("../network/types");
    expect(contracts).toContain('SenseiEnhancementRequestPayload');
    expect(contracts).toContain('SenseiEnhancementResult');
    expect(contracts).toContain("{ type: 'enhancement:request'; requestId: string; payload: SenseiEnhancementRequestPayload }");
    expect(contracts).toContain("{ type: 'enhancement:result'; requestId: string; success: true; result: SenseiEnhancementResult }");
    expect(contracts).toContain("{ type: 'enhancement:result'; requestId: string; success: false; error: string }");
    expect(contracts).toContain('originalMarkdown: string');
    expect(contracts).toContain('wordCount?: number');
    expect(types).toContain('SenseiEnhancementRequestPayload');
    expect(types).toContain('SenseiEnhancementResult');
    expect(types).toContain("} from '../bridge/contracts';");
    expect(types).toContain('runSenseiEnhancement(payload: SenseiEnhancementRequestPayload): Promise<SenseiEnhancementResult>;');
  });

  it('passes the structured enhancement payload through MainScreen to BffClient without prompt/provider ownership', () => {
    const source = readSource('SenseiMobile', 'src', 'mobile', 'MainScreen.tsx');
    const branch = extractEnhancementBranch(source);

    expect(branch).toContain('const result = await bffClient.runSenseiEnhancement(parsed.payload);');
    expect(branch).toContain("type: 'enhancement:result'");
    expect(branch).toContain('requestId: parsed.requestId');
    expect(branch).toContain('success: true');
    expect(branch).toContain('result');
    expect(branch).not.toMatch(/\bprompt\b|\bfinalPrompt\b|\bpromptText\b|\bsystemInstruction\b|\binstruction\b|\bmodel\b|\btemperature\b|\bproviderOptions\b|\bsafetySettings\b|\bconfig\b|\btools\b|\bchat\b|\bhistory\b/);
    expect(branch).not.toMatch(/\bGoogleGenAI\b|\bchats\.create\b|\bsendMessage\b|\bgenerateContent\b/);
    expect(branch).not.toMatch(/\brenderMarkdown\b|\bapplyEnhancement/i);
  });

  it('enqueues a same-request failure result with a fixed safe error string', () => {
    const source = readSource('SenseiMobile', 'src', 'mobile', 'MainScreen.tsx');
    const branch = extractEnhancementBranch(source);

    expect(branch).toContain('success: false');
    expect(branch).toContain("error: 'Sensei enhancement unavailable'");
    expect(branch).toContain('errorName: error instanceof Error ? error.name : typeof error');
    expect(branch).not.toContain('error.message');
    expect(branch).not.toContain('String(error)');
    expect(branch).not.toContain('{ error }');
    expect(branch).not.toContain('originalMarkdown');
  });
});
