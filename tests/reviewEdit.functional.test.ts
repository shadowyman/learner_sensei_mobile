import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import * as parse5 from 'parse5'

type P5Node = any

const repoRoot = path.resolve(__dirname, '..')
const cliPath = path.join('scripts', 'reviewEdit.ts')
const tmpRoot = path.join(repoRoot, 'tmp', 'review-cli-tests')
const logPath = path.join(repoRoot, 'logs', 'console_logs.log')

const activeDirs: string[] = []

function logValidation(message: string) {
  fs.appendFileSync(logPath, `[REVIEW_CLI_TESTS] ${message}\n`)
}

function ensureTmpRoot() {
  fs.mkdirSync(tmpRoot, { recursive: true })
}

function cleanupDir(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true })
  logValidation(`Cleaned mock artifact directory ${path.relative(repoRoot, dir)}`)
}

function cleanupAll() {
  for (const dir of activeDirs.splice(0, activeDirs.length)) {
    cleanupDir(dir)
  }
}

type NoteOverride = {
  className?: string
  body?: string
}

type FixtureOptions = {
  includeRealNote?: boolean
  removeReviewNotes?: boolean
  noteOverrides?: Record<string, NoteOverride>
  verdictHtml?: string
}

function ensureHtml(body: string): string {
  const trimmed = body.trim()
  if (!trimmed) return '<p></p>'
  return trimmed.startsWith('<') ? body : `<p>${body}</p>`
}

function createFixture(caseName: string, options?: FixtureOptions) {
  ensureTmpRoot()
  const caseDir = path.join(tmpRoot, caseName)
  fs.rmSync(caseDir, { recursive: true, force: true })
  fs.mkdirSync(caseDir, { recursive: true })
  const artifactPath = path.join(caseDir, 'artifact.html')
  const includeRealNote = options?.includeRealNote !== false
  const removeReviewNotes = options?.removeReviewNotes === true
  const overrides = options?.noteOverrides ?? {}
  const renderNote = (uuid: string, defaultBody: string): string => {
    const override = overrides[uuid] ?? {}
    const className = override.className ?? 'review-notes'
    const body = ensureHtml(override.body ?? defaultBody)
    return `<div class="${className}"><h4>Review Notes</h4>${body}</div>`
  }
  const placeholderNote = renderNote('uuid-1', 'Review pending – document findings here during RCI.')
  const secondDefaultBody = includeRealNote ? 'Looks fine.' : 'Review pending – document findings here during RCI.'
  const secondNote = removeReviewNotes ? '' : renderNote('uuid-2', secondDefaultBody)
  const verdictSection = options?.verdictHtml ?? ''
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Test</title></head><body><section class="pr-request" id="pr-request"><h2>PR Review Context</h2><p>Context for ${caseName}</p></section>${verdictSection}<section id="file-sample.ts" class="file-section"><header class="file-header"><h2>sample.ts</h2></header><article class="hunk" id="file-sample.ts-h1" data-uuid="uuid-1"><header class="hunk-header"><h3>Block 1</h3></header>${placeholderNote}<pre><code>@@ -1,2 +1,2@@\n- old\n+ new\n</code></pre></article><article class="hunk" id="file-sample.ts-h2" data-uuid="uuid-2"><header class="hunk-header"><h3>Block 2</h3></header>${secondNote}<pre><code>@@ -3,4 +3,4@@\n- old line\n+ new line\n</code></pre></article></section></body></html>`
  fs.writeFileSync(artifactPath, html)
  activeDirs.push(caseDir)
  logValidation(`Created mock artifact for ${caseName}`)
  return { artifactPath, caseDir }
}

function runCli(args: string[], opts?: { input?: string }) {
  const res = spawnSync('npx', ['ts-node', cliPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    input: opts?.input ?? undefined
  })
  return res
}

function parseHtml(filePath: string): P5Node {
  const raw = fs.readFileSync(filePath, 'utf8')
  return parse5.parse(raw)
}

function findNodeByPredicate(node: P5Node, predicate: (n: P5Node) => boolean): P5Node | null {
  if (!node || typeof node !== 'object') return null
  if (predicate(node)) return node
  const children: P5Node[] = node.childNodes || []
  for (const child of children) {
    const found = findNodeByPredicate(child, predicate)
    if (found) return found
  }
  return null
}

function getAttr(node: P5Node, name: string): string {
  const attrs = node?.attrs || []
  const match = attrs.find((a: any) => a.name === name)
  return match ? String(match.value) : ''
}

function textOf(node: P5Node): string {
  if (!node) return ''
  let out = ''
  const stack: P5Node[] = [node]
  while (stack.length) {
    const current = stack.pop()
    if (!current) continue
    if (current.nodeName === '#text' && typeof current.value === 'string') {
      out += current.value
    }
    const children = current.childNodes || []
    for (const child of children) stack.push(child)
  }
  return out
}

function extractStatuses(stdout: string): string[] {
  const statuses: string[] = []
  const regex = /Status: ([A-Z]+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(stdout)) !== null) {
    statuses.push(match[1])
  }
  return statuses
}

function expectStatuses(stdout: string, expected: string[]) {
  const actual = extractStatuses(stdout)
  assert.deepEqual(actual, expected, `Expected statuses ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}\nOutput:\n${stdout}`)
}

function expectHeadingPresence(stdout: string, heading: string, present: boolean) {
  const found = stdout.includes(heading)
  if (present) {
    assert.ok(found, `Expected heading "${heading}" in output`) 
  } else {
    assert.ok(!found, `Heading "${heading}" should not appear in output`)
  }
}

function expectNotContains(stdout: string, fragments: string[]) {
  for (const fragment of fragments) {
    assert.ok(!stdout.includes(fragment), `Output should not include "${fragment}"`)
  }
}

function expectContains(stdout: string, fragments: string[]) {
  for (const fragment of fragments) {
    assert.ok(stdout.includes(fragment), `Output missing expected fragment "${fragment}"`)
  }
}

function expectReviewNotesClass(doc: P5Node, uuid: string, expectedClass: string) {
  const article = findNodeByPredicate(doc, n => n.tagName === 'article' && getAttr(n, 'data-uuid') === uuid)
  assert.ok(article, `article with uuid ${uuid} should exist`)
  const reviewNotes = findNodeByPredicate(article, n => n.tagName === 'div' && (getAttr(n, 'class') || '').includes('review-notes'))
  assert.ok(reviewNotes, 'review-notes div missing')
  assert.equal(getAttr(reviewNotes, 'class'), expectedClass)
}

function expectVerdictClass(doc: P5Node, expectedClass: string) {
  const verdictSection = findNodeByPredicate(doc, n => n.tagName === 'section' && (getAttr(n, 'class') || '').includes('pr-request') && (getAttr(n, 'class') || '').includes('verdict'))
  assert.ok(verdictSection, 'verdict section missing')
  const cls = getAttr(verdictSection, 'class')
  assert.ok(cls.includes(expectedClass), `verdict class ${cls} should include ${expectedClass}`)
}

function expectVerdictAfterContext(doc: P5Node) {
  const body = findNodeByPredicate(doc, n => n.tagName === 'body')
  assert.ok(body, 'body not found')
  const children = body!.childNodes || []
  let contextIndex = -1
  let verdictIndex = -1
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const cls = getAttr(child, 'class')
    if (cls.includes('pr-request') && !cls.includes('verdict')) contextIndex = i
    if (cls.includes('verdict')) verdictIndex = i
  }
  assert.ok(contextIndex >= 0, 'context section missing')
  assert.ok(verdictIndex > contextIndex, 'verdict should appear after context')
}
function getReviewNotesClass(doc: P5Node, uuid: string): string {
  const article = findNodeByPredicate(doc, n => n.tagName === 'article' && getAttr(n, 'data-uuid') === uuid)
  assert.ok(article, `article with uuid ${uuid} should exist`)
  const reviewNotes = findNodeByPredicate(article, n => n.tagName === 'div' && (getAttr(n, 'class') || '').includes('review-notes'))
  assert.ok(reviewNotes, 'review-notes div missing')
  return getAttr(reviewNotes, 'class')
}

type TestCase = {
  name: string
  execute: () => void
}

function runCase(testCase: TestCase) {
  console.log(`--> START ${testCase.name}`)
  logValidation(`Case start: ${testCase.name}`)
  try {
    testCase.execute()
    logValidation(`Case success: ${testCase.name}`)
    console.log(`<-- PASS ${testCase.name}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logValidation(`Case failure: ${testCase.name} :: ${message}`)
    console.error(`<-- FAIL ${testCase.name}`)
    throw error
  }
}

const testCases: TestCase[] = [
  {
    name: 'list-uuid prints available UUIDs',
    execute: () => {
      const { artifactPath } = createFixture('case-list-uuid', { includeRealNote: true })
      const res = runCli(['list-uuid', '--file', artifactPath])
      assert.equal(res.status, 0)
      assert.ok(res.stdout.includes('uuid-1'))
      assert.ok(res.stdout.includes('uuid-2'))
      assert.ok(res.stdout.includes('To show: npm run review:edit -- show-diff'))
    }
  },
  {
    name: 'show-diff renders diff for uuid-1',
    execute: () => {
      const { artifactPath } = createFixture('case-show-diff')
      const res = runCli(['show-diff', '--file', artifactPath, '--uuid', 'uuid-1'])
      assert.equal(res.status, 0)
      assert.ok(res.stdout.includes('Block 1'))
      assert.ok(res.stdout.includes('@@ -1,2 +1,2@@'))
    }
  },
  {
    name: 'remark assigns PASS styling',
    execute: () => {
      const { artifactPath } = createFixture('case-remark-pass')
      const res = runCli(['remark', '--file', artifactPath, '--uuid', 'uuid-1', '--body', 'PASS: approval granted'])
      assert.equal(res.status, 0)
      const doc = parseHtml(artifactPath)
      expectReviewNotesClass(doc, 'uuid-1', 'review-notes is-pass')
    }
  },
  {
    name: 'remark handles PASS and FAIL neutrally',
    execute: () => {
      const { artifactPath } = createFixture('case-remark-neutral')
      const res = runCli(['remark', '--file', artifactPath, '--uuid', 'uuid-2', '--body', 'PASS but also FAIL'])
      assert.equal(res.status, 0)
      const doc = parseHtml(artifactPath)
      expectReviewNotesClass(doc, 'uuid-2', 'review-notes')
    }
  },
  {
    name: 'remark accepts empty stdin body neutrally',
    execute: () => {
      const { artifactPath } = createFixture('case-remark-empty-stdin')
      const res = runCli(['remark', '--file', artifactPath, '--uuid', 'uuid-1', '--body', '-'], { input: '' })
      assert.equal(res.status, 0)
      const doc = parseHtml(artifactPath)
      expectReviewNotesClass(doc, 'uuid-1', 'review-notes')
    }
  },
  {
    name: 'verdict PASS inserts verdict section with pass class',
    execute: () => {
      const { artifactPath } = createFixture('case-verdict-pass')
      const res = runCli(['verdict', '--file', artifactPath, '--body', '<div><strong>PASS</strong></div>'])
      assert.equal(res.status, 0)
      const doc = parseHtml(artifactPath)
      expectVerdictClass(doc, 'is-pass')
      expectVerdictAfterContext(doc)
    }
  },
  {
    name: 'verdict FAIL applies fail styling',
    execute: () => {
      const { artifactPath } = createFixture('case-verdict-fail')
      const res = runCli(['verdict', '--file', artifactPath, '--body', 'FAIL: needs work'])
      assert.equal(res.status, 0)
      const doc = parseHtml(artifactPath)
      expectVerdictClass(doc, 'is-fail')
    }
  },
  {
    name: 'verdict neutral text stays neutral',
    execute: () => {
      const { artifactPath } = createFixture('case-verdict-neutral')
      const res = runCli(['verdict', '--file', artifactPath, '--body', 'Needs discussion'])
      assert.equal(res.status, 0)
      const doc = parseHtml(artifactPath)
      const verdictSection = findNodeByPredicate(doc, n => n.tagName === 'section' && (getAttr(n, 'class') || '').includes('verdict'))
      assert.ok(verdictSection)
      const cls = getAttr(verdictSection, 'class')
      assert.ok(!cls.includes('is-pass') && !cls.includes('is-fail'))
    }
  },
  {
    name: 'verdict empty stdin body stays neutral',
    execute: () => {
      const { artifactPath } = createFixture('case-verdict-empty-stdin')
      const res = runCli(['verdict', '--file', artifactPath, '--body', '-'], { input: '' })
      assert.equal(res.status, 0)
      const doc = parseHtml(artifactPath)
      const section = findNodeByPredicate(doc, n => n.tagName === 'section' && (getAttr(n, 'class') || '').includes('verdict'))
      assert.ok(section)
      const cls = getAttr(section, 'class')
      assert.ok(!cls.includes('is-pass') && !cls.includes('is-fail'))
    }
  },
  {
    name: 'review:result prioritizes failing hunks',
    execute: () => {
      const { artifactPath } = createFixture('case-result-failing', { includeRealNote: true })
      const failRemark = runCli(['remark', '--file', artifactPath, '--uuid', 'uuid-2', '--body', 'FAIL: needs attention'])
      assert.equal(failRemark.status, 0)
      const verdictRes = runCli(['verdict', '--file', artifactPath, '--body', 'FAIL: unresolved issues'])
      assert.equal(verdictRes.status, 0)
      const res = runCli(['result', '--file', artifactPath])
      assert.equal(res.status, 0)
      expectHeadingPresence(res.stdout, '=== FAILED / NEUTRAL HUNKS ===', true)
      expectHeadingPresence(res.stdout, '=== VERDICT ===', true)
      expectStatuses(res.stdout, ['FAIL'])
      expectContains(res.stdout, ['UUID uuid-2', 'Diff:'])
    }
  },
  {
    name: 'review:result emits verdict when hunks pass',
    execute: () => {
      const { artifactPath } = createFixture('case-result-verdict', { includeRealNote: true })
      const passOne = runCli(['remark', '--file', artifactPath, '--uuid', 'uuid-1', '--body', 'PASS: looks good'])
      assert.equal(passOne.status, 0)
      const passTwo = runCli(['remark', '--file', artifactPath, '--uuid', 'uuid-2', '--body', 'PASS: cleared'])
      assert.equal(passTwo.status, 0)
      const verdictRes = runCli(['verdict', '--file', artifactPath, '--body', '<div><strong>PASS</strong></div>'])
      assert.equal(verdictRes.status, 0)
      const res = runCli(['result', '--file', artifactPath])
      assert.equal(res.status, 0)
      expectHeadingPresence(res.stdout, '=== FAILED / NEUTRAL HUNKS ===', false)
      expectHeadingPresence(res.stdout, '=== VERDICT ===', true)
      expectStatuses(res.stdout, [])
      expectContains(res.stdout, ['=== VERDICT ==='])
      expectContains(res.stdout, ['PASS'])
    }
  },
  {
    name: 'review:result handles neutral classification',
    execute: () => {
      const { artifactPath } = createFixture('case-result-neutral', { includeRealNote: false })
      const neutralRemark = runCli(['remark', '--file', artifactPath, '--uuid', 'uuid-1', '--body', 'Needs clarification for reviewer'])
      assert.equal(neutralRemark.status, 0)
      const res = runCli(['result', '--file', artifactPath])
      assert.equal(res.status, 0)
      expectHeadingPresence(res.stdout, '=== FAILED / NEUTRAL HUNKS ===', true)
      expectStatuses(res.stdout, ['NEUTRAL'])
      expectNotContains(res.stdout, ['Status: FAIL'])
    }
  },
  {
    name: 'review:result orders fail before neutral',
    execute: () => {
      const { artifactPath } = createFixture('case-result-ordering', { includeRealNote: true })
      const neutralRemark = runCli(['remark', '--file', artifactPath, '--uuid', 'uuid-1', '--body', 'Needs clarification before approval'])
      assert.equal(neutralRemark.status, 0)
      const failRemark = runCli(['remark', '--file', artifactPath, '--uuid', 'uuid-2', '--body', 'FAIL: regression detected'])
      assert.equal(failRemark.status, 0)
      const res = runCli(['result', '--file', artifactPath])
      assert.equal(res.status, 0)
      expectStatuses(res.stdout, ['FAIL', 'NEUTRAL'])
    }
  },
  {
    name: 'review:result uses CSS fallback when tokens are neutral',
    execute: () => {
      const { artifactPath } = createFixture('case-result-class-fallback', {
        includeRealNote: false,
        noteOverrides: {
          'uuid-1': {
            className: 'review-notes is-fail',
            body: 'Needs attention from reviewer'
          }
        }
      })
      const res = runCli(['result', '--file', artifactPath])
      assert.equal(res.status, 0)
      expectStatuses(res.stdout, ['FAIL'])
      expectContains(res.stderr, ['[REVIEW_FILTER] classified FAIL'])
    }
  },
  {
    name: 'review:result handles punctuation wrapped fail tokens',
    execute: () => {
      const { artifactPath } = createFixture('case-result-punctuation', { includeRealNote: false })
      const remark = runCli(['remark', '--file', artifactPath, '--uuid', 'uuid-2', '--body', '***FAIL*** critical regression'])
      assert.equal(remark.status, 0)
      const res = runCli(['result', '--file', artifactPath])
      assert.equal(res.status, 0)
      expectStatuses(res.stdout, ['FAIL'])
    }
  },
  {
    name: 'review:result treats malformed token as neutral',
    execute: () => {
      const { artifactPath } = createFixture('case-result-malformed-token', { includeRealNote: false })
      const neutralRemark = runCli(['remark', '--file', artifactPath, '--uuid', 'uuid-1', '--body', 'FA1L token should remain neutral'])
      assert.equal(neutralRemark.status, 0)
      const res = runCli(['result', '--file', artifactPath])
      assert.equal(res.status, 0)
      expectStatuses(res.stdout, ['NEUTRAL'])
      expectNotContains(res.stdout, ['Status: FAIL'])
    }
  },
  {
    name: 'review:result handles empty verdict content',
    execute: () => {
      const { artifactPath } = createFixture('case-result-empty-verdict', {
        includeRealNote: false,
        verdictHtml: '<section class="pr-request verdict"><h2>VERDICT</h2><div class="verdict-content"></div></section>'
      })
      const failRemark = runCli(['remark', '--file', artifactPath, '--uuid', 'uuid-1', '--body', 'FAIL: missing verdict content'])
      assert.equal(failRemark.status, 0)
      const res = runCli(['result', '--file', artifactPath])
      assert.equal(res.status, 0)
      expectStatuses(res.stdout, ['FAIL'])
      expectHeadingPresence(res.stdout, '=== VERDICT ===', false)
    }
  },
  {
    name: 'review:result extracts complex verdict html',
    execute: () => {
      const verdictHtml = `<section class=\"pr-request verdict\"><h2>VERDICT</h2><div class=\"verdict-content\"><strong>Verdict: PASS</strong><p>Analysis: All clear.</p><ul><li>✓ Token parsing</li><li>✓ CLI output</li></ul><pre><code>diff --stat</code></pre></div></section>`
      const { artifactPath } = createFixture('case-result-complex-verdict', { includeRealNote: false, verdictHtml })
      const failRemark = runCli(['remark', '--file', artifactPath, '--uuid', 'uuid-1', '--body', 'FAIL: needs fix'])
      assert.equal(failRemark.status, 0)
      const res = runCli(['result', '--file', artifactPath])
      assert.equal(res.status, 0)
      expectHeadingPresence(res.stdout, '=== VERDICT ===', true)
      expectContains(res.stdout, ['Verdict: PASS', 'Analysis: All clear.', '- ✓ Token parsing', 'diff --stat'])
    }
  },
  {
    name: 'review:result emits diagnostic stderr logs',
    execute: () => {
      const { artifactPath } = createFixture('case-result-diagnostics', { includeRealNote: true })
      const failRemark = runCli(['remark', '--file', artifactPath, '--uuid', 'uuid-1', '--body', 'FAIL: ensure logging visible'])
      assert.equal(failRemark.status, 0)
      const neutralRemark = runCli(['remark', '--file', artifactPath, '--uuid', 'uuid-2', '--body', 'Needs more discussion'])
      assert.equal(neutralRemark.status, 0)
      const res = runCli(['result', '--file', artifactPath])
      assert.equal(res.status, 0)
      expectStatuses(res.stdout, ['FAIL', 'NEUTRAL'])
      expectContains(res.stderr, ['[REVIEW_FILTER] classified FAIL', '[REVIEW_FILTER] classified NEUTRAL', '[REVIEW_FILTER] emitting'])
    }
  },
  {
    name: 'review:result tolerates missing verdict section',
    execute: () => {
      const { artifactPath } = createFixture('case-result-no-verdict', { includeRealNote: false, verdictHtml: '' })
      const failRemark = runCli(['remark', '--file', artifactPath, '--uuid', 'uuid-1', '--body', 'FAIL: missing verdict scenario'])
      assert.equal(failRemark.status, 0)
      const res = runCli(['result', '--file', artifactPath])
      assert.equal(res.status, 0)
      expectStatuses(res.stdout, ['FAIL'])
      expectHeadingPresence(res.stdout, '=== VERDICT ===', false)
    }
  },
  {
    name: 'list-uuid rejects missing --file',
    execute: () => {
      const res = runCli(['list-uuid'])
      assert.notEqual(res.status, 0)
      assert.ok(res.stderr.includes('Missing required --file'))
    }
  },
  {
    name: 'show-diff rejects missing --uuid',
    execute: () => {
      const { artifactPath } = createFixture('case-show-diff-missing-uuid')
      const res = runCli(['show-diff', '--file', artifactPath])
      assert.notEqual(res.status, 0)
      assert.ok(res.stderr.includes('Missing required --uuid'))
    }
  },
  {
    name: 'show-diff rejects invalid uuid',
    execute: () => {
      const { artifactPath } = createFixture('case-show-diff-invalid-uuid')
      const res = runCli(['show-diff', '--file', artifactPath, '--uuid', 'bogus'])
      assert.notEqual(res.status, 0)
      assert.ok(res.stderr.includes('Invalid UUID'))
    }
  },
  {
    name: 'remark rejects invalid uuid',
    execute: () => {
      const { artifactPath } = createFixture('case-remark-invalid-uuid')
      const res = runCli(['remark', '--file', artifactPath, '--uuid', 'bogus', '--body', 'test'])
      assert.notEqual(res.status, 0)
      assert.ok(res.stderr.includes('Invalid UUID'))
      const doc = parseHtml(artifactPath)
      const className = getReviewNotesClass(doc, 'uuid-1')
      assert.equal(className, 'review-notes')
    }
  },
  {
    name: 'remark rejects missing body',
    execute: () => {
      const { artifactPath } = createFixture('case-remark-missing-body')
      const res = runCli(['remark', '--file', artifactPath, '--uuid', 'uuid-1'])
      assert.notEqual(res.status, 0)
      assert.ok(res.stderr.includes('Missing required --body'))
      const doc = parseHtml(artifactPath)
      const className = getReviewNotesClass(doc, 'uuid-1')
      assert.equal(className, 'review-notes')
    }
  },
  {
    name: 'remark rejects unsupported --verdict flag',
    execute: () => {
      const { artifactPath } = createFixture('case-remark-verdict-flag')
      const res = runCli(['remark', '--file', artifactPath, '--uuid', 'uuid-1', '--body', 'PASS', '--verdict', 'ok'])
      assert.notEqual(res.status, 0)
      assert.ok(res.stderr.includes('Do not pass --verdict'))
      const doc = parseHtml(artifactPath)
      const className = getReviewNotesClass(doc, 'uuid-1')
      assert.equal(className, 'review-notes')
    }
  },
  {
    name: 'review:result fails when only placeholders exist',
    execute: () => {
      const { artifactPath } = createFixture('case-result-placeholder-only', { includeRealNote: false })
      const res = runCli(['result', '--file', artifactPath])
      assert.notEqual(res.status, 0)
      assert.ok(res.stderr.includes('No review notes found'))
    }
  },
  {
    name: 'review:result fails when review-notes missing',
    execute: () => {
      const { artifactPath } = createFixture('case-result-missing-review-notes', { includeRealNote: true, removeReviewNotes: true })
      const res = runCli(['result', '--file', artifactPath])
      assert.notEqual(res.status, 0)
      assert.ok(res.stderr.includes('No review notes found'))
    }
  },
  {
    name: 'verdict rejects missing body',
    execute: () => {
      const { artifactPath } = createFixture('case-verdict-missing-body')
      const res = runCli(['verdict', '--file', artifactPath])
      assert.notEqual(res.status, 0)
      assert.ok(res.stderr.includes('Missing required --body'))
    }
  }
]

function main() {
  console.log('=== Review CLI functional tests begin ===')
  let failure: unknown = null
  try {
    for (const testCase of testCases) {
      runCase(testCase)
    }
    logValidation('Suite success: all review CLI cases passed')
    console.log('=== Review CLI functional tests passed ===')
  } catch (error) {
    failure = error
    const message = error instanceof Error ? error.message : String(error)
    logValidation(`Suite failure: ${message}`)
    console.error('=== Review CLI functional tests failed ===')
  } finally {
    logValidation('Harness teardown start')
    cleanupAll()
    logValidation('Harness teardown removed temporary logs and artifacts')
    console.log('Cleanup complete')
    if (failure) {
      throw failure
    }
  }
}

main()
