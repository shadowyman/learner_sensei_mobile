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

function createFixture(caseName: string, options?: { includeRealNote?: boolean; removeReviewNotes?: boolean }) {
  ensureTmpRoot()
  const caseDir = path.join(tmpRoot, caseName)
  fs.rmSync(caseDir, { recursive: true, force: true })
  fs.mkdirSync(caseDir, { recursive: true })
  const artifactPath = path.join(caseDir, 'artifact.html')
  const includeRealNote = options?.includeRealNote !== false
  const removeReviewNotes = options?.removeReviewNotes === true
  const placeholderNote = `<div class="review-notes"><h4>Review Notes</h4><p>Review pending – document findings here during RCI.</p></div>`
  const realNote = `<div class="review-notes"><h4>Review Notes</h4><p>Looks fine.</p></div>`
  const reviewNotesSecond = removeReviewNotes ? '' : realNote
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Test</title></head><body><section class="pr-request" id="pr-request"><h2>PR Review Context</h2><p>Context for ${caseName}</p></section><section id="file-sample.ts" class="file-section"><header class="file-header"><h2>sample.ts</h2></header><article class="hunk" id="file-sample.ts-h1" data-uuid="uuid-1"><header class="hunk-header"><h3>Block 1</h3></header>${placeholderNote}<pre><code>@@ -1,2 +1,2@@\n- old\n+ new\n</code></pre></article><article class="hunk" id="file-sample.ts-h2" data-uuid="uuid-2"><header class="hunk-header"><h3>Block 2</h3></header>${includeRealNote ? reviewNotesSecond : placeholderNote}<pre><code>@@ -3,4 +3,4@@\n- old line\n+ new line\n</code></pre></article></section></body></html>`
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
    name: 'review:result emits populated remark summary',
    execute: () => {
      const { artifactPath } = createFixture('case-result-success', { includeRealNote: true })
      const res = runCli(['result', '--file', artifactPath])
      assert.equal(res.status, 0)
      assert.ok(res.stdout.includes('Block 2'))
      assert.ok(res.stdout.includes('Review Note'))
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
