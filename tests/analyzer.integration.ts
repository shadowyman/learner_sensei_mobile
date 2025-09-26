import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(__dirname, '..')
const tsconfigPath = path.join(repoRoot, 'tsconfig.json')
const originalTsconfig = fs.readFileSync(tsconfigPath, 'utf8')

function cleanAnalysis() {
  fs.rmSync(path.join(repoRoot, 'tmp', 'analysis'), { recursive: true, force: true })
}

function runAnalyzer(args: string[]) {
  cleanAnalysis()
  execFileSync('npx', ['ts-node', path.join('scripts', 'analyze.ts'), ...args], { cwd: repoRoot, stdio: 'ignore' })
}

function writeFile(rel: string, content: string) {
  const abs = path.join(repoRoot, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
}

function readJSON<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, rel), 'utf8')) as T
}

function setTsconfig(json: any) {
  fs.writeFileSync(tsconfigPath, JSON.stringify(json, null, 2))
}

function restoreTsconfig() {
  fs.writeFileSync(tsconfigPath, originalTsconfig)
}

function testPathAlias() {
  const aliasDir = 'tmp/analyzer-tests/path-alias/src'
  writeFile(path.join(aliasDir, 'a.ts'), "import { b } from '@/b';\nexport function callB() { b(); }\n")
  writeFile(path.join(aliasDir, 'b.ts'), 'export function b() {}\n')
  const config = JSON.parse(originalTsconfig)
  config.compilerOptions = config.compilerOptions || {}
  config.compilerOptions.baseUrl = '.'
  const existingPaths = config.compilerOptions.paths || {}
  existingPaths['@/*'] = [`${aliasDir}/*`]
  config.compilerOptions.paths = existingPaths
  setTsconfig(config)
  runAnalyzer([])
  let calls = readJSON<any[]>('tmp/analysis/calls.json')
  let edge = calls.find(c => typeof c.from === 'string' && c.from.startsWith(`${aliasDir}/a.ts::callB`) && typeof c.to === 'string' && c.to.includes(`${aliasDir}/b.ts::b`))
  assert(edge, 'edge missing for alias call')
  assert(edge.toStable, 'toStable missing for alias call')
  runAnalyzer(['--include', `${aliasDir}/a.ts`])
  calls = readJSON<any[]>('tmp/analysis/calls.json')
  edge = calls.find(c => typeof c.from === 'string' && c.from.startsWith(`${aliasDir}/a.ts::callB`) && typeof c.to === 'string' && c.to.includes(`${aliasDir}/b.ts::b`))
  assert(edge, 'edge missing for alias include run')
  assert(edge.toStable, 'toStable missing for alias include run')
  restoreTsconfig()
}

function testStaticNamespace() {
  const base = 'tmp/analyzer-tests/static-ns'
  writeFile(path.join(base, 'ns.ts'), 'export function callMe() {}\n')
  writeFile(path.join(base, 'use.ts'), "import * as ns from './ns';\nexport function runAll() { ns.callMe(); }\n")
  runAnalyzer(['--no-typechecker'])
  const calls = readJSON<any[]>('tmp/analysis/calls.json')
  const edge = calls.find(c => typeof c.from === 'string' && c.from.startsWith(`${base}/use.ts::runAll`) && typeof c.toStable === 'string' && c.toStable.includes(`${base}/ns.ts::callMe`))
  assert(edge, 'static namespace edge missing')
}

function testCallbacks() {
  const base = 'tmp/analyzer-tests/callbacks'
  writeFile(path.join(base, 'callbacks.ts'), 'export function host(cb: () => void) { cb(); }\nexport function handler() {}\n')
  writeFile(path.join(base, 'use.ts'), "import { host, handler } from './callbacks';\nexport function runAll() {\n  host(() => {});\n  host(handler);\n  host({ done() {} } as any);\n  console.log(() => {});\n}\n")
  runAnalyzer(['--include', `${base}/use.ts`])
  const calls = readJSON<any[]>('tmp/analysis/calls.json').filter(c => typeof c.from === 'string' && c.from.startsWith(`${base}/use.ts::runAll`))
  const vias = new Set(calls.map(c => c.via))
  assert(vias.has('cb:inline'), 'missing inline callback edge')
  assert(vias.has('arg:handler'), 'missing handler callback edge')
  assert([...vias].some(v => typeof v === 'string' && v.startsWith('arg.obj.') && v.includes(':cb:inline')), 'missing object literal callback edge')
  const consoleEdge = calls.find(c => c.to === 'global::console.log')
  assert(consoleEdge, 'missing console edge')
}

function testDomSelectors() {
  const base = 'tmp/analyzer-tests/dom'
  writeFile(path.join(base, 'dom.ts'), "export function template() { return \"<div id='hero' class='big primary'><span class=\\\"inner\\\"></span></div>\"; }\n")
  runAnalyzer(['--include', `${base}/dom.ts`, '--dom-index'])
  const index = readJSON<{ selectors: { selector: string }[] }>('tmp/analysis/domsuite_index.json')
  const selectors = new Set(index.selectors.filter(s => s.selector).map(s => s.selector))
  assert(selectors.has('#hero'), 'missing #hero selector')
  assert(selectors.has('.big'), 'missing .big selector')
  assert(selectors.has('.primary'), 'missing .primary selector')
  assert(selectors.has('.inner'), 'missing .inner selector')
}

function testGlobalExposure() {
  const base = 'tmp/analyzer-tests/global-expose'
  writeFile(path.join(base, 'expose.ts'), 'function foo() {}\n(window as any).foo = foo;\nObject.defineProperty(window, \"bar\", { value: foo });\n')
  runAnalyzer(['--include', `${base}/expose.ts`])
  const functions = readJSON<any[]>('tmp/analysis/functions.json')
  const synthetic = functions.find(f => f.id === 'global::exposed')
  assert(synthetic, 'global::exposed function missing')
  const calls = readJSON<any[]>('tmp/analysis/calls.json').filter(c => c.from === 'global::exposed' && typeof c.to === 'string' && c.to.includes(`${base}/expose.ts::foo`))
  assert(calls.length >= 2, 'global exposure edges missing')
}

async function main() {
  try {
    testPathAlias()
    testStaticNamespace()
    testCallbacks()
    testDomSelectors()
    testGlobalExposure()
    console.log('Analyzer integration tests passed.')
  } catch (err) {
    restoreTsconfig()
    console.error(err)
    process.exit(1)
  }
}

main().finally(() => {
  restoreTsconfig()
})
