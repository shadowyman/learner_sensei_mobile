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
  runAnalyzer(['--include', `${base}/`])
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



function testStableIdsAndCrosswalk() {
  const base = 'tmp/analyzer-tests/stable'
  writeFile(path.join(base, 'm.ts'), 'export function f() {}\nexport const g = () => {};\n')
  writeFile(path.join(base, 'u.ts'), "import { f, g } from './m';\nexport function caller(){ f(); g(); }\n")
  runAnalyzer(['--include', `${base}/u.ts,${base}/m.ts`])

  const funcs = readJSON<any[]>('tmp/analysis/functions.json')
  const fInfo = funcs.find(x => x.file === `${base}/m.ts` && x.name === 'f')
  const gInfo = funcs.find(x => x.file === `${base}/m.ts` && x.name.startsWith('g'))
  const caller = funcs.find(x => x.file === `${base}/u.ts` && x.name === 'caller')
  assert(fInfo && gInfo && caller, 'missing functions')

  // stableId format and crosswalk presence
  const crosswalk = readJSON<{functions: any[]}>('tmp/analysis/function_crosswalk.json').functions
  const stableIdPattern = /#[0-9a-f]{12}$/
  for (const fn of [fInfo, gInfo, caller]) {
    assert(stableIdPattern.test(fn.stableId), 'stableId should include a 12-hex digest')
    const cw = crosswalk.find((r: any) => r.id === fn.id)
    assert(cw && cw.stableId === fn.stableId, 'crosswalk mismatch')
  }

  // edges carry fromStable/toStable
  const edges = readJSON<any[]>('tmp/analysis/calls.json').filter(e => typeof e.from === 'string' && e.from.startsWith(`${base}/u.ts::caller`))
  for (const e of edges) {
    assert(e.fromStable && e.toStable, 'edge is missing stable ids')
  }
}

function testNetworkAndTimerSideEffects() {
  const base = 'tmp/analyzer-tests/effects-net'
  writeFile(path.join(base, 'n.ts'), `
    export async function hit() {
      fetch('/api');       // network (global)
      setTimeout(()=>{}, 10); // timer
      // unresolved external library call -> axios
      // not imported on purpose, should mark network + assumption
      axios('/api2');
    }`)
  runAnalyzer(['--include', `${base}/n.ts`])

  const funcs = readJSON<any[]>('tmp/analysis/functions.json')
  const hit = funcs.find(f => f.file === `${base}/n.ts` && f.name === 'hit')
  assert(hit, 'hit missing')
  const kinds = new Set(hit.sideEffects.map((s: any) => s.kind))
  assert(kinds.has('network'), 'missing network side effect')
  assert(kinds.has('timer'), 'missing timer side effect')

  // axios call should produce an assumption
  const assumptions = readJSON<any[]>('tmp/analysis/assumptions.json')
  const ax = assumptions.find(a => typeof a.statement === 'string' && a.statement.includes("axios"))
  assert(ax, 'missing assumption for axios')
}

function testFilesystemAndStateWriteSideEffects() {
  const base = 'tmp/analyzer-tests/effects-fs-dom'
  writeFile(path.join(base, 'm.ts'), `
    import * as fs from 'node:fs'
    export function k() {
      fs.readFileSync('x');            // filesystem
      const obj:any = {}; obj.a = 1;   // state-write
      const el:any = {}; el.innerHTML = '<b/>'; // dom (mutating final prop)
      el.classList.add('c');           // dom (classList mutator)
      el.dataset.foo = 'bar';          // dom (dataset)
      el.style.color = 'red';          // dom (style)
    }`)
  runAnalyzer(['--include', `${base}/m.ts`])

  const funcs = readJSON<any[]>('tmp/analysis/functions.json')
  const k = funcs.find((f:any) => f.file === `${base}/m.ts` && f.name === 'k')
  const kinds = new Set(k.sideEffects.map((s:any) => s.kind))
  assert(kinds.has('filesystem'), 'missing filesystem side effect')
  assert(kinds.has('state-write'), 'missing state-write side effect')
  assert(kinds.has('dom'), 'missing dom side effects')
}

function testInstanceMethodResolution() {
  const base = 'tmp/analyzer-tests/instance'
  writeFile(path.join(base, 'lib.ts'), `
    export class C { m(){} }
    export function target() {}
  `)
  writeFile(path.join(base, 'u.ts'), `
    import { C } from './lib'
    export function run(){
      const c = new C()
      c.m()
    }`)
  runAnalyzer(['--include', `${base}/u.ts,${base}/m.ts`])

  const calls = readJSON<any[]>('tmp/analysis/calls.json')
  const edge = calls.find(c => typeof c.from === 'string' && c.from.startsWith(`${base}/u.ts::run`) && typeof c.to === 'string' && c.to.includes(`${base}/lib.ts::C.m`))
  assert(edge, 'missing instance method edge')
}

function testThisFieldInstanceResolution() {
  const base = 'tmp/analyzer-tests/this-field'
  writeFile(path.join(base, 'lib.ts'), `export class Svc { ping(){} }`)
  writeFile(path.join(base, 'cls.ts'), `
    import { Svc } from './lib'
    export class K {
      svc!: Svc
      constructor(){ this.svc = new Svc() }
      tick(){ this.svc.ping() }
    }`)
  runAnalyzer(['--include', `${base}/cls.ts`])

  const calls = readJSON<any[]>('tmp/analysis/calls.json')
  const edge = calls.find(c => typeof c.to === 'string' && c.to.includes(`${base}/lib.ts::Svc.ping`))
  assert(edge, 'missing this.field instance method edge')
}

function testDynamicImportResolution() {
  const base = 'tmp/analyzer-tests/dyn-import'
  writeFile(path.join(base, 'm.ts'), `export function f(){}\nexport function g(){}`)
  writeFile(path.join(base, 'u.ts'), `
    export async function a(){
      const mod = await import('./m')
      mod.f()
      const { g } = await import('./m')
      g()
    }`)
  runAnalyzer(['--include', `${base}/u.ts,${base}/m.ts`])

  const calls = readJSON<any[]>('tmp/analysis/calls.json').filter(c => typeof c.from === 'string' && c.from.startsWith(`${base}/u.ts::a`))
  assert(calls.some(c => typeof c.to === 'string' && c.to.includes(`${base}/m.ts::f`)), 'missing mod.f edge')
  assert(calls.some(c => typeof c.to === 'string' && c.to.includes(`${base}/m.ts::g`)), 'missing destructured g edge')
}

function testElementAccessResolution() {
  const base = 'tmp/analyzer-tests/elem-access'
  writeFile(path.join(base, 'lib.ts'), `export function z(){}`)
  writeFile(path.join(base, 'u.ts'), `
    import * as ns from './lib'
    const o:any = { z: ns.z }
    export function run(){
      ns['z']()
      o['z']()
    }`)
  runAnalyzer(['--include', `${base}/u.ts,${base}/lib.ts`])

  const calls = readJSON<any[]>('tmp/analysis/calls.json').filter(c => c.from?.startsWith(`${base}/u.ts::run`))
  assert(calls.some(c => c.to?.includes(`${base}/lib.ts::z`)), 'missing ns[\'z\'] edge')
  // o['z']() resolves to instance/alias path; analyzer will not deep-resolve through object literal here (expected not to link).
}

function testPureNamespacesIgnored() {
  const base = 'tmp/analyzer-tests/pure-ns'
  writeFile(path.join(base, 'u.ts'), `export function run(){ Math.max(1,2); JSON.stringify({}); }`)
  runAnalyzer(['--include', `${base}/u.ts`])
  const calls = readJSON<any[]>('tmp/analysis/calls.json').filter(c => c.from?.startsWith(`${base}/u.ts::run`))
  const assumptions = readJSON<any[]>('tmp/analysis/assumptions.json')
  assert(!calls.some(c => String(c.to||'').includes('Math') || String(c.via||'').includes('Math')), 'should not create Math edges')
  assert(!assumptions.some(a => a.statement?.includes('Math')), 'should not create Math assumptions')
}

function testAssumptionsForUnresolvedCall() {
  const base = 'tmp/analyzer-tests/assumption'
  writeFile(path.join(base, 'u.ts'), `export function run(){ mysteriousGlobal(); }`)
  runAnalyzer(['--include', `${base}/u.ts`])
  const assumptions = readJSON<any[]>('tmp/analysis/assumptions.json')
  assert(assumptions.some(a => a.statement?.includes("mysteriousGlobal")), 'missing assumption for unresolved call')
}

function testPresetManifestAndApplication() {
  const base = 'tmp/analyzer-tests/presets'
  writeFile(path.join(base, 'seed.ts'), `export function seed(){}`)
  writeFile(path.join(base, 'use.ts'), `import { seed } from './seed'; export function run(){ seed(); }`)

  // Seed file
  writeFile('config/preset-seeds.json', JSON.stringify([{
    slug: 'smoke',
    description: 'seed by function',
    seedFunctions: [`${base}/seed.ts::seed`],
    defaultEntry: `${base}/use.ts::run`,
    defaultMaxDepth: 2,
    forceDomIndex: false,
    maxIncludeFiles: 10
  }], null, 2))

  // First run (generates manifest)
  runAnalyzer([])
  const manifest = JSON.parse(fs.readFileSync(path.join('config','presets.generated.json'), 'utf8'))
  assert(manifest.presets.smoke, 'preset not generated')

  // Second run applying preset (should merge include and set entry/maxDepth)
  runAnalyzer(['--preset','smoke'])
  const summary = readJSON<any>('tmp/analysis/summary.json')
  assert(Array.isArray(summary.entryCandidates), 'summary missing')

  // sanity: ensure calls exist (preset include applied)
  const calls = readJSON<any[]>('tmp/analysis/calls.json')
  assert(calls.some(c => typeof c.to === 'string' && c.to.includes(`${base}/seed.ts::seed`)), 'preset include not applied to analysis')
}

function testEntryFocus() {
  const base = 'tmp/analyzer-tests/focus'
  writeFile(path.join(base, 'a.ts'), `export function a(){}`)
  writeFile(path.join(base, 'b.ts'), `import { a } from './a'; export function b(){ a(); }`)
  writeFile(path.join(base, 'c.ts'), `import { b } from './b'; export function c(){ b(); }`)
  runAnalyzer(['--entry', `${base}/c.ts::c`, '--maxDepth','2'])
  const focE = readJSON<any[]>('tmp/analysis/focused_calls.json')
  const focF = readJSON<any[]>('tmp/analysis/focused_functions.json')
  assert(focE.length > 0 && focF.length > 0, 'focused artifacts missing')
  const trace = fs.readFileSync(path.join('tmp','analysis','focused_trace.txt'),'utf8')
  assert(trace.includes(`${base}/c.ts::c`), 'focused trace missing start')
}

function testDomEventDelegationAndReceiver() {
  const base = 'tmp/analyzer-tests/dom-evt'
  writeFile(path.join(base, 'u.ts'), `
    export function mount(root: any) {
      document.querySelector('#hero')!.addEventListener('click', (e:any) => {
        e.target.closest('.card')
      })
    }`)
  runAnalyzer(['--include', `${base}/u.ts`, '--dom-index'])
  const handlers = readJSON<{handlers:any[]}>('tmp/analysis/domsuite_handlers.json').handlers
  const h = handlers.find(x => x.file === `${base}/u.ts` && x.event?.includes('click'))
  assert(h && h.delegated === true, 'delegation not detected')
  assert(h.delegatedSelectors.includes('.card'), 'delegated selector missing')

  const index = readJSON<{selectors:any[]}>('tmp/analysis/domsuite_index.json').selectors
  const hasHeroUse = index.some(s => s.selector === '#hero')
  assert(hasHeroUse, 'receiver selector #hero not recorded')
}

function testGlobalExposureVariants() {
  const base = 'tmp/analyzer-tests/global-expose-variants'
  writeFile(path.join(base, 'lib.ts'), `export function api(){} export function get(){} export function set(){} `)
  writeFile(path.join(base, 'u.ts'), `
    import { api, get, set } from './lib'
    const w = window
    w['x'] = api
    Object.assign(window, { y: api })
    Object.defineProperty(window, 'z', { value: api })
    Object.defineProperties(window, { zz: { get, set } })
    function cb() {}
    window.cbBound = cb.bind(null)
  `)
  runAnalyzer(['--include', `${base}/u.ts`])
  const calls = readJSON<any[]>('tmp/analysis/calls.json').filter(c => c.from === 'global::exposed')
  const hasApi = calls.some(c => c.to?.includes(`${base}/lib.ts::api`))
  const hasGet = calls.some(c => c.to?.includes(`${base}/lib.ts::get`))
  const hasSet = calls.some(c => c.to?.includes(`${base}/lib.ts::set`))
  assert(hasApi && hasGet && hasSet, 'missing global exposure edges for variants')
}

function testNamespaceResolutionWithoutTypechecker() {
  const base = 'tmp/analyzer-tests/no-tc-ns'
  writeFile(path.join(base, 'lib.ts'), `export function run(){} `)
  writeFile(path.join(base, 'u.ts'), `import * as ns from './lib'; export function caller(){ ns.run() }`)
  runAnalyzer(['--include', `${base}/u.ts,${base}/lib.ts`, '--no-typechecker'])
  const calls = readJSON<any[]>('tmp/analysis/calls.json')
  const edge = calls.find(c => typeof c.to === 'string' && c.to.includes(`${base}/lib.ts::run`))
  assert(edge, 'namespace resolution failed without typechecker')
}

function testIncludeFilter() {
  const base = 'tmp/analyzer-tests/include'
  writeFile(path.join(base, 'a.ts'), `export function a(){}`)
  writeFile(path.join(base, 'b.ts'), `export function b(){}`)
  runAnalyzer(['--include', `${base}/a.ts`])

  const funcs = readJSON<any[]>('tmp/analysis/functions.json')
  assert(funcs.some(f => f.file === `${base}/a.ts`), 'included file functions missing')
  assert(!funcs.some(f => f.file === `${base}/b.ts`), 'excluded file leaked into analysis')
}

function testFanInFanOutAndEntryCandidates() {
  const base = 'tmp/analyzer-tests/fan'
  writeFile(path.join(base, 'index.ts'), `import './leaf';`)
  writeFile(path.join(base, 'leaf.ts'), `export const x = 1;`)
  runAnalyzer(['--include', `${base}/`])
  const fanIn = readJSON<Record<string,number>>('tmp/analysis/fan_in.json')
  const fanOut = readJSON<Record<string,number>>('tmp/analysis/fan_out.json')
  assert(typeof fanOut[`${base}/index.ts`] === 'number', 'fan_out missing index')
  assert(typeof fanIn[`${base}/leaf.ts`] === 'number', 'fan_in missing leaf')
  const summary = readJSON<any>('tmp/analysis/summary.json')
  assert(summary.entryCandidates.some((f:string) => f.endsWith('index.ts')), 'entryCandidates should include index.ts')
}

function testTemplateExtractionAndSnippet() {
  const base = 'tmp/analyzer-tests/tpl'
  const longClass = 'x'.repeat(300)
  writeFile(path.join(base, 't.ts'), `
    export function tpl(){
      return "<div id='root' class=\\"a b ${longClass}\\"></div>"
    }`)
  runAnalyzer(['--include', `${base}/t.ts`, '--dom-index'])
  const tmpl = readJSON<{templates:any[]}>('tmp/analysis/domsuite_templates.json').templates
  const t = tmpl.find(x => x.file === `${base}/t.ts`)
  assert(t, 'template record missing')
  assert(t.snippet.length <= 200, 'snippet not truncated')
  const index = readJSON<{selectors:any[]}>('tmp/analysis/domsuite_index.json')
  const sels = new Set(index.selectors.map((s:any)=>s.selector))
  assert(sels.has('#root') && sels.has('.a') && sels.has('.b'), 'missing selectors from template')
}

function testConsoleEdgeStableIds() {
  const base = 'tmp/analyzer-tests/console'
  writeFile(path.join(base, 'u.ts'), `export function run(){ console.log('x'); console.warn('y') }`)
  runAnalyzer(['--include', `${base}/u.ts`])
  const edges = readJSON<any[]>('tmp/analysis/calls.json').filter(e => e.from?.startsWith(`${base}/u.ts::run`) && typeof e.to === 'string' && e.to.startsWith('global::console.'))
  assert(edges.length >= 2, 'console edges missing')
  for (const e of edges) {
    assert(e.toStable === e.to, 'console edge missing toStable')
  }
}

async function main() {
  try {
    console.log('Running testPathAlias')
    testPathAlias()
    console.log('Running testStaticNamespace')
    testStaticNamespace()
    console.log('Running testCallbacks')
    testCallbacks()
    console.log('Running testDomSelectors')
    testDomSelectors()
    console.log('Running testGlobalExposure')
    testGlobalExposure()

    console.log('Running testStableIdsAndCrosswalk')
    testStableIdsAndCrosswalk()
    console.log('Running testNetworkAndTimerSideEffects')
    testNetworkAndTimerSideEffects()
    console.log('Running testFilesystemAndStateWriteSideEffects')
    testFilesystemAndStateWriteSideEffects()
    console.log('Running testInstanceMethodResolution')
    testInstanceMethodResolution()
    console.log('Running testThisFieldInstanceResolution')
    testThisFieldInstanceResolution()
    console.log('Running testDynamicImportResolution')
    testDynamicImportResolution()
    console.log('Running testElementAccessResolution')
    testElementAccessResolution()
    console.log('Running testPureNamespacesIgnored')
    testPureNamespacesIgnored()
    console.log('Running testAssumptionsForUnresolvedCall')
    testAssumptionsForUnresolvedCall()
    console.log('Running testPresetManifestAndApplication')
    testPresetManifestAndApplication()
    console.log('Running testEntryFocus')
    testEntryFocus()
    console.log('Running testDomEventDelegationAndReceiver')
    testDomEventDelegationAndReceiver()
    console.log('Running testGlobalExposureVariants')
    testGlobalExposureVariants()
    console.log('Running testNamespaceResolutionWithoutTypechecker')
    testNamespaceResolutionWithoutTypechecker()
    console.log('Running testIncludeFilter')
    testIncludeFilter()
    console.log('Running testFanInFanOutAndEntryCandidates')
    testFanInFanOutAndEntryCandidates()
    console.log('Running testTemplateExtractionAndSnippet')
    testTemplateExtractionAndSnippet()
    console.log('Running testConsoleEdgeStableIds')
    testConsoleEdgeStableIds()

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
