import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.join(__dirname, '..');

function readSource(...segments: string[]): string {
  return fs.readFileSync(path.join(repoRoot, ...segments), 'utf8');
}

function extractSelectionSenseiBranch(source: string): string {
  const start = source.indexOf("if (parsed.type === 'selectionSensei:modalMessageRequest')");
  const end = source.indexOf("if (parsed.type === 'teachingPlan:request')", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('MainScreen Selection Sensei modal bridge transport', () => {
  it('defines structured request and result bridge contracts with bridge-owned modal payload types', () => {
    const contracts = readSource('SenseiMobile', 'src', 'mobile', 'bridge', 'contracts.ts');
    const types = readSource('SenseiMobile', 'src', 'mobile', 'network', 'types.ts');

    expect(contracts).not.toContain("../network/types");
    expect(contracts).toContain('SelectionSenseiModalMessagePayload');
    expect(contracts).toContain('SelectionSenseiModalMessageResult');
    expect(contracts).toContain("{ type: 'selectionSensei:modalMessageRequest'; requestId: string; payload: SelectionSenseiModalMessagePayload }");
    expect(contracts).toContain("{ type: 'selectionSensei:modalMessageResult'; requestId: string; success: true; result: SelectionSenseiModalMessageResult }");
    expect(contracts).toContain("{ type: 'selectionSensei:modalMessageResult'; requestId: string; success: false; error: string }");
    expect(contracts).toContain("mode: 'toolbarAction'");
    expect(contracts).toContain("mode: 'followUp'");
    expect(types).toContain('SelectionSenseiModalMessagePayload');
    expect(types).toContain('SelectionSenseiModalMessageResult');
    expect(types).toContain("} from '../bridge/contracts';");
  });

  it('passes the structured modal payload through MainScreen to BffClient without prompt/provider ownership', () => {
    const source = readSource('SenseiMobile', 'src', 'mobile', 'MainScreen.tsx');
    const branch = extractSelectionSenseiBranch(source);

    expect(branch).toContain("const result = await bffClient.runSelectionSenseiModalMessage(parsed.payload);");
    expect(branch).toContain("type: 'selectionSensei:modalMessageResult'");
    expect(branch).toContain('requestId: parsed.requestId');
    expect(branch).toContain('success: true');
    expect(branch).toContain('result');
    expect(branch).not.toMatch(/\bselectedText\b/);
    expect(branch).not.toMatch(/\buserQuestion\b/);
    expect(branch).not.toMatch(/\bquestion\b/);
    expect(branch).not.toMatch(/\bprompt\b|\bsystemInstruction\b|\binstruction\b|\bmodel\b|\btemperature\b|\bproviderOptions\b|\bsafetySettings\b|\bhistory\b/);
    expect(branch).not.toMatch(/\bGoogleGenAI\b|\bchats\.create\b|\bsendMessage\b|\bgenerateContent\b/);
  });

  it('enqueues a same-request failure result with a fixed safe error string', () => {
    const source = readSource('SenseiMobile', 'src', 'mobile', 'MainScreen.tsx');
    const branch = extractSelectionSenseiBranch(source);

    expect(branch).toContain("success: false");
    expect(branch).toContain("error: 'Selection Sensei response unavailable'");
    expect(branch).toContain('errorName: error instanceof Error ? error.name : typeof error');
    expect(branch).not.toContain('error.message');
    expect(branch).not.toContain('String(error)');
    expect(branch).not.toContain('{ error }');
  });
});
