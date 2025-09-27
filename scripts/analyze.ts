import * as ts from 'typescript'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import * as parse5 from 'parse5'

type ImportGraph = Record<string, string[]>
type FanMap = Record<string, number>
type Location = {
  file: string
  start: { line: number; col: number }
  end: { line: number; col: number }
}

type CallEdge = { from: string; to: string; via: string; loc: Location; fromStable?: string; toStable?: string }
type SideEffect = {
  kind: string
  detail: string
  cost: 'High' | 'Medium' | 'Low'
  blast: 'High' | 'Medium' | 'Low'
  concurrency: 'High' | 'Medium' | 'Low'
  loc?: Location
}
type FunctionInfo = {
  id: string
  file: string
  name: string
  kind: 'function' | 'arrow' | 'method'
  export: boolean
  async: boolean
  sideEffects: SideEffect[]
  calls: string[]
  loc: Location
  stableId: string
  startLine: number
  startCol: number
}
type Assumption = {
  statement: string
  rationale: string
  impact: 'High' | 'Medium' | 'Low'
  verification: string
  loc?: Location
}

type SelectorKind = 'id' | 'class' | 'unknown'
type SelectorDefinition = {
  selector: string
  kind: SelectorKind
  file: string
  loc: Location
  snippet: string
}
type SelectorUsage = {
  selector: string
  kind: SelectorKind
  file: string
  via: string
  loc: Location
  delegated: boolean
  handler?: string
}
type TemplateRecord = {
  file: string
  loc: Location
  snippet: string
  selectors: { selector: string; kind: SelectorKind }[]
}
type HandlerRecord = {
  file: string
  loc: Location
  event: string
  handler: string
  delegated: boolean
  delegatedSelectors: string[]
  receiverSelector?: string
  receiverVia?: string
}

type PresetSeed = {
  slug: string
  description?: string
  seedFunctions?: string[]
  seedFiles?: string[]
  defaultEntry?: string
  defaultMaxDepth?: number
  forceDomIndex?: boolean
  maxIncludeFiles?: number
}

type GeneratedPreset = {
  slug: string
  includeFiles: string[]
  entry?: string
  maxDepth?: number
  domIndex?: boolean
  description?: string
}

type PresetManifest = {
  generatedAt: string
  graphHash: string
  presets: Record<string, GeneratedPreset>
}

type NodeInfo = {
  name: string
  id: string
  node: ts.FunctionLikeDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression
  kind: FunctionInfo['kind']
  exported: boolean
  className?: string
}

type ImportResolver = (fromFile: string, spec: string) => string | null

type P5Node = any

function createTsResolver(program: ts.Program, repoRoot: string): ImportResolver {
  const opts = program.getCompilerOptions()
  const cache = ts.createModuleResolutionCache(repoRoot, s => s, opts)
  const normalize = (p: string) => path.relative(repoRoot, p).split(path.sep).join('/')
  return (fromFile, spec) => {
    const cached = (program as any).getResolvedModuleWithFailedLookupLocationsFromCache?.(spec, fromFile)
    const resolvedModule = cached?.resolvedModule ?? ts.resolveModuleName(spec, fromFile, opts, ts.sys, cache).resolvedModule
    if (!resolvedModule) return null
    const f = resolvedModule.resolvedFileName
    const isNodeModules = f.includes(`${path.sep}node_modules${path.sep}`)
    const ext = path.extname(f)
    const isSourceExt = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)
    const isDts = f.endsWith('.d.ts') || f.endsWith('.d.tsx')
    if (isNodeModules || !isSourceExt || isDts) return null
    return normalize(f)
  }
}

const repoRoot = process.cwd()
const outDir = path.join(repoRoot, 'tmp', 'analysis')
const functionNodeById = new Map<string, { sf: ts.SourceFile; node: ts.FunctionLikeDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression; file: string }>()
const functionStableIdById = new Map<string, string>()
const selectorDefinitions: SelectorDefinition[] = []
const selectorUsages: SelectorUsage[] = []
const templateRecords: TemplateRecord[] = []
const handlerRecords: HandlerRecord[] = []
let enableDomIndex = false
let useTypeChecker = true
let checker: ts.TypeChecker = undefined as any
const functionIdByNode = new WeakMap<ts.Node, string>()
const functionIdByDeclNode = new WeakMap<ts.Node, string>()
const PURE_GLOBAL_IDENTIFIERS = new Set([
  'String','Boolean','Object','Array','Symbol','BigInt','Date',
  'isFinite','encodeURI','decodeURI','encodeURIComponent','decodeURIComponent'
])
const PURE_GLOBAL_NAMESPACES = new Set(['Math','JSON','Reflect'])

function unaliasSymbol(sym: ts.Symbol | undefined): ts.Symbol | undefined {
  if (!sym) return sym
  if (!useTypeChecker || !checker) return sym
  let s = sym
  while ((s.flags & ts.SymbolFlags.Alias) !== 0) {
    const a = checker.getAliasedSymbol(s)
    if (!a || a === s) break
    s = a
  }
  return s
}

  function isUnionType(t: ts.Type): t is ts.UnionType {
    return (t.flags & ts.TypeFlags.Union) !== 0
  }

  function isPureGlobalIdentifier(name: string): boolean {
    return PURE_GLOBAL_IDENTIFIERS.has(name)
  }

  function isPureGlobalNamespace(baseName: string): boolean {
    return PURE_GLOBAL_NAMESPACES.has(baseName)
  }

  function propertyChain(pa: ts.PropertyAccessExpression, sfLocal: ts.SourceFile): string[] {
    const out: string[] = []
    let cur: ts.Expression = pa
    while (ts.isPropertyAccessExpression(cur)) {
      out.unshift(cur.name.getText(sfLocal))
      cur = cur.expression
    }
    if (ts.isIdentifier(cur)) out.unshift(cur.getText(sfLocal))
    return out
  }

  const DOM_MUTATING_FINAL_PROPS = new Set([
    'innerHTML','outerHTML','textContent','innerText','value','checked','disabled','src','href','className','cookie'
  ])

  const DOM_MUTATOR_METHODS = new Set([
    'setAttribute','removeAttribute','appendChild','insertBefore','replaceWith','remove',
    'after','before','append','prepend','replaceChildren','insertAdjacentHTML'
  ])

  function isDomMutationChain(parts: string[]): boolean {
    if (parts.includes('dataset')) return true
    if (parts.includes('style')) return true
    if (parts.includes('classList')) return true
    const last = parts.length > 0 ? parts[parts.length - 1]! : ''
    if (DOM_MUTATING_FINAL_PROPS.has(last)) return true
    return false
  }

type CliOptions = {
  include?: string[]
  entry?: string
  maxDepth?: number
  domIndex?: boolean
  preset?: string[]
  noTypechecker?: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--include' && typeof argv[i+1] === 'string') {
      const val = argv[i+1] as string
      i++
      opts.include = val.split(',').map(s => s.trim()).filter(Boolean)
    } else if (a === '--entry' && typeof argv[i+1] === 'string') {
      const val = argv[i+1] as string
      i++
      opts.entry = val
    } else if (a === '--maxDepth' && typeof argv[i+1] === 'string') {
      const val = argv[i+1] as string
      i++
      const n = parseInt(val, 10)
      if (!Number.isNaN(n)) opts.maxDepth = n
    } else if (a === '--dom-index') {
      opts.domIndex = true
    } else if (a === '--preset' && typeof argv[i+1] === 'string') {
      const val = argv[i+1] as string
      i++
      if (!opts.preset) opts.preset = []
      opts.preset.push(val)
    } else if (a === '--no-typechecker') {
      opts.noTypechecker = true
    }
  }
  return opts
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true })
}

function rel(file: string) {
  return path.relative(repoRoot, file).split(path.sep).join('/')
}

function isProjectSource(sf: ts.SourceFile) {
  const f = sf.fileName
  if (!f.startsWith(repoRoot)) return false
  if (sf.isDeclarationFile) return false
  const nm = `${path.sep}node_modules${path.sep}`
  if (f.includes(nm)) return false
  const ext = path.extname(f)
  const allowed = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
  return allowed.has(ext)
}

function loadProgram() {
  const configPath = ts.findConfigFile(repoRoot, ts.sys.fileExists, 'tsconfig.json')
  if (!configPath) throw new Error('tsconfig.json not found')
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, repoRoot)
  return ts.createProgram(parsed.fileNames, parsed.options)
}

function getLoc(sf: ts.SourceFile, node: ts.Node): Location {
  const startPos = node.getStart(sf)
  const endPos = node.getEnd()
  const start = sf.getLineAndCharacterOfPosition(startPos)
  const end = sf.getLineAndCharacterOfPosition(endPos)
  return {
    file: rel(sf.fileName),
    start: { line: start.line + 1, col: start.character + 1 },
    end: { line: end.line + 1, col: end.character + 1 }
  }
}

function snippet(text: string) {
  return text.length > 200 ? text.slice(0, 197) + '...' : text
}

function selectorKindFromString(selector: string): SelectorKind {
  if (selector.startsWith('#')) return 'id'
  if (selector.startsWith('.')) return 'class'
  return 'unknown'
}

function literalText(node: ts.Expression, sf: ts.SourceFile): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isTemplateExpression(node)) {
    const head = node.head.text
    if (node.templateSpans.every(s => ts.isStringLiteral(s.expression))) {
      return head + node.templateSpans.map(s => (s.expression as ts.StringLiteral).text + s.literal.text).join('')
    }
  }
  return null
}

function unwrap(e: ts.Expression): ts.Expression {
  while (true) {
    if (ts.isParenthesizedExpression(e)) {
      e = e.expression
      continue
    }
    if (ts.isNonNullExpression(e)) {
      e = e.expression
      continue
    }
    if (ts.isAsExpression(e)) {
      e = e.expression
      continue
    }
    if (ts.isTypeAssertionExpression(e)) {
      e = e.expression
      continue
    }
    break
  }
  return e
}

function selectorsFromHtml(html: string) {
  const result: { selector: string; kind: SelectorKind }[] = []
  const fragment = parse5.parseFragment(html, { sourceCodeLocationInfo: false }) as P5Node

  const visit = (node: P5Node) => {
    if (node && typeof node === 'object') {
      if (Array.isArray(node.attrs)) {
        for (const attr of node.attrs) {
          if (!attr || typeof attr !== 'object') continue
          if (attr.name === 'id' && attr.value) {
            result.push({ selector: `#${attr.value}`, kind: 'id' })
          } else if (attr.name === 'class' && attr.value) {
            const classes = attr.value.split(/\s+/).filter(Boolean)
            for (const c of classes) result.push({ selector: `.${c}`, kind: 'class' })
          } else if (attr.name) {
            result.push({ selector: `[${attr.name}]`, kind: 'unknown' })
            if (attr.value) {
              const escaped = attr.value.replace(/"/g, '\\"')
              result.push({ selector: `[${attr.name}="${escaped}"]`, kind: 'unknown' })
            }
          }
        }
      }
      if (Array.isArray(node.childNodes)) {
        node.childNodes.forEach(visit)
      }
    }
  }

  if (fragment && Array.isArray(fragment.childNodes)) {
    fragment.childNodes.forEach(visit)
  }

  return result
}

function isDelegatedSubject(expr: ts.Expression, params: Set<string>, sf: ts.SourceFile): boolean {
  if (ts.isIdentifier(expr)) return params.has(expr.getText(sf))
  if (ts.isPropertyAccessExpression(expr)) return isDelegatedSubject(expr.expression, params, sf)
  return false
}

function analyzeDelegatedHandler(node: ts.FunctionLikeDeclaration | ts.ArrowFunction | ts.FunctionExpression, sf: ts.SourceFile) {
  const params = new Set<string>()
  node.parameters.forEach(param => {
    if (ts.isIdentifier(param.name)) params.add(param.name.getText(sf))
  })
  if (!params.size) return { delegated: false, selectors: [] as string[] }
  const selectors = new Set<string>()
  let delegated = false
  const visit = (child: ts.Node) => {
    if (ts.isCallExpression(child)) {
      if (ts.isPropertyAccessExpression(child.expression)) {
        const method = child.expression.name.getText(sf)
        if (method === 'matches' || method === 'closest') {
          if (isDelegatedSubject(child.expression.expression, params, sf)) {
            delegated = true
            const arg = child.arguments[0]
            if (arg) {
              const value = literalText(arg as ts.Expression, sf)
              if (value) selectors.add(value)
            }
          }
        }
      }

      
    }
    child.forEachChild(visit)
  }
  node.forEachChild(visit)
  return { delegated, selectors: Array.from(selectors) }
}

function extractReceiverSelector(expr: ts.Expression, sf: ts.SourceFile) {
  if (ts.isCallExpression(expr)) {
    const callee = expr.expression
    if (ts.isPropertyAccessExpression(callee)) {
      const method = callee.name.getText(sf)
      const base = callee.expression.getText(sf)
      const arg = expr.arguments[0]
      if (arg) {
        const value = literalText(arg as ts.Expression, sf)
        if (value) {
          if (method === 'getElementById') return { selector: `#${value}`, via: `${base}.${method}` }
          if (method === 'querySelector' || method === 'querySelectorAll') return { selector: value, via: `${base}.${method}` }
          if (method === 'getElementsByClassName') {
            const first = value.split(/\s+/).filter(Boolean)[0]
            if (first) return { selector: `.${first}`, via: `${base}.${method}` }
          }
        }
      }
    }
  }
  return {}
}

function addSelectorDefinition(selector: string, kind: SelectorKind, file: string, loc: Location, source: string) {
  selectorDefinitions.push({ selector, kind, file, loc, snippet: snippet(source) })
}

function addSelectorUsage(selector: string, file: string, via: string, loc: Location, delegated: boolean, handler?: string) {
  const kind = selectorKindFromString(selector)
  const payload: SelectorUsage = { selector, kind, file, via, loc, delegated }
  if (handler) payload.handler = handler
  selectorUsages.push(payload)
}

function addTemplateRecord(file: string, loc: Location, source: string, selectors: { selector: string; kind: SelectorKind }[]) {
  templateRecords.push({ file, loc, snippet: snippet(source), selectors })
}

function addHandlerRecord(record: HandlerRecord) {
  handlerRecords.push(record)
}

function mergeInclude(opts: CliOptions, additions: string[]) {
  const set = new Set(opts.include || [])
  additions.forEach(item => set.add(item))
  opts.include = Array.from(set)
}

function ensureSyntheticFunction(funcs: FunctionInfo[], id: string, label?: string) {
  if (funcs.some(f => f.id === id)) return
  const fakeLoc: Location = { file: '<synthetic>', start: { line: 1, col: 1 }, end: { line: 1, col: 1 } }
  const info: FunctionInfo = {
    id,
    file: '<synthetic>',
    name: label ?? id,
    kind: 'function',
    export: false,
    async: false,
    sideEffects: [],
    calls: [],
    loc: fakeLoc,
    stableId: id,
    startLine: 1,
    startCol: 1
  }
  functionStableIdById.set(id, id)
  funcs.push(info)
}
const presetSeedPath = path.join(repoRoot, 'config', 'preset-seeds.json')
const presetManifestPath = path.join(repoRoot, 'config', 'presets.generated.json')

function loadPresetSeeds(): PresetSeed[] {
  if (!fs.existsSync(presetSeedPath)) return []
  const raw = fs.readFileSync(presetSeedPath, 'utf8')
  const parsed = JSON.parse(raw) as PresetSeed[]
  return parsed.slice().sort((a, b) => a.slug.localeCompare(b.slug))
}

function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']'
  const keys = Object.keys(obj).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}'
}

function computeGraphHash(seeds: PresetSeed[], funcs: FunctionInfo[]) {
  const hash = crypto.createHash('sha256')
  hash.update(stableStringify(seeds))
  const stableIds = funcs.map(f => f.stableId || `${f.file}::${f.name}`).sort()
  hash.update(stableIds.join('|'))
  return hash.digest('hex')
}

function buildFunctionLookups(funcs: FunctionInfo[]) {
  const byId = new Map<string, FunctionInfo>()
  const byPrefix = new Map<string, FunctionInfo[]>()
  for (const fn of funcs) {
    byId.set(fn.id, fn)
    const prefix = `${fn.file}::${fn.name}`
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, [])
    byPrefix.get(prefix)!.push(fn)
  }
  return { byId, byPrefix }
}

function buildDirectedAdjacency(edges: CallEdge[]) {
  const adj = new Map<string, string[]>()
  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, [])
    adj.get(edge.from)!.push(edge.to)
  }
  return adj
}

function resolveSeedFunction(prefix: string, byPrefix: Map<string, FunctionInfo[]>) {
  const matches = byPrefix.get(prefix)
  if (!matches || matches.length === 0) return []
  return matches.map(fn => fn.id)
}

function generatePreset(
  seed: PresetSeed,
  funcs: FunctionInfo[],
  edges: CallEdge[],
  byId: Map<string, FunctionInfo>,
  byPrefix: Map<string, FunctionInfo[]>,
  adjacency: Map<string, string[]>
): GeneratedPreset {
  const includeFiles = new Set<string>(seed.seedFiles ?? [])
  const maxDepth = typeof seed.defaultMaxDepth === 'number' ? seed.defaultMaxDepth : 5
  const maxIncludeFiles = seed.maxIncludeFiles ?? 80
  const queue: { id: string; depth: number }[] = []
  const visited = new Set<string>()

  if (seed.seedFunctions && seed.seedFunctions.length) {
    for (const prefix of seed.seedFunctions) {
      const ids = resolveSeedFunction(prefix, byPrefix)
      if (!ids.length) {
        console.warn(`Preset seed '${seed.slug}' could not resolve function '${prefix}'`)
      }
      ids.forEach(id => queue.push({ id, depth: 0 }))
    }
  }

  if (seed.defaultEntry) {
    if (byId.has(seed.defaultEntry)) {
      queue.push({ id: seed.defaultEntry, depth: 0 })
    } else {
      const entryIds = resolveSeedFunction(seed.defaultEntry, byPrefix)
      if (entryIds.length) {
        entryIds.forEach(id => queue.push({ id, depth: 0 }))
      } else {
        console.warn(`Preset seed '${seed.slug}' could not resolve default entry '${seed.defaultEntry}'`)
      }
    }
  }

  if (!queue.length && seed.seedFiles) {
    for (const fn of funcs) {
      if (seed.seedFiles.includes(fn.file)) {
        queue.push({ id: fn.id, depth: 0 })
      }
    }
  }

  while (queue.length) {
    const current = queue.shift()!
    if (visited.has(current.id)) continue
    visited.add(current.id)
    const fn = byId.get(current.id)
    if (fn) includeFiles.add(fn.file)
    if (includeFiles.size > maxIncludeFiles) {
      console.warn(`Preset '${seed.slug}' exceeded max include files (${maxIncludeFiles}).`)
      break
    }
    if (current.depth >= maxDepth) continue
    const outs = adjacency.get(current.id) || []
    for (const target of outs) {
      if (!visited.has(target)) queue.push({ id: target, depth: current.depth + 1 })
    }
  }

  const includeList = Array.from(includeFiles).sort()

  const preset: GeneratedPreset = {
    slug: seed.slug,
    includeFiles: includeList
  }
  if (typeof maxDepth === 'number') preset.maxDepth = maxDepth
  if (seed.defaultEntry) preset.entry = seed.defaultEntry
  if (seed.forceDomIndex) preset.domIndex = true
  if (seed.description) preset.description = seed.description
  return preset
}

function regeneratePresetManifest(seeds: PresetSeed[], funcs: FunctionInfo[], edges: CallEdge[], graphHash: string): PresetManifest {
  const { byId, byPrefix } = buildFunctionLookups(funcs)
  const adjacency = buildDirectedAdjacency(edges)
  const presets: Record<string, GeneratedPreset> = {}
  for (const seed of seeds) {
    presets[seed.slug] = generatePreset(seed, funcs, edges, byId, byPrefix, adjacency)
  }
  return {
    generatedAt: new Date().toISOString(),
    graphHash,
    presets
  }
}

function ensurePresetManifest(seeds: PresetSeed[], funcs: FunctionInfo[], edges: CallEdge[]) {
  const graphHash = computeGraphHash(seeds, funcs)
  let regenerated = false
  let manifest: PresetManifest | null = null
  if (fs.existsSync(presetManifestPath)) {
    try {
      const raw = fs.readFileSync(presetManifestPath, 'utf8')
      const parsed = JSON.parse(raw) as PresetManifest
      const missingSlug = seeds.some(seed => !(seed.slug in parsed.presets))
      if (!missingSlug && parsed.graphHash === graphHash) {
        manifest = parsed
      }
    } catch (err) {
      console.warn('Failed to read preset manifest, regenerating...')
    }
  }
  if (!manifest) {
    manifest = regeneratePresetManifest(seeds, funcs, edges, graphHash)
    fs.mkdirSync(path.dirname(presetManifestPath), { recursive: true })
    fs.writeFileSync(presetManifestPath, JSON.stringify(manifest, null, 2))
    regenerated = true
  }
  return { manifest, regenerated }
}

function applyPresets(opts: CliOptions, manifest: PresetManifest) {
  if (!opts.preset || !opts.preset.length) return [] as string[]
  const applied: string[] = []
  for (const slug of opts.preset) {
    const preset = manifest.presets[slug]
    if (!preset) {
      console.warn(`Preset '${slug}' is undefined. Run the analyzer without presets to regenerate.`)
      continue
    }
    mergeInclude(opts, preset.includeFiles)
    if (!opts.entry && preset.entry) opts.entry = preset.entry
    if (typeof opts.maxDepth !== 'number' && typeof preset.maxDepth === 'number') opts.maxDepth = preset.maxDepth
    if (preset.domIndex) opts.domIndex = true
    applied.push(slug)
  }
  return applied
}

function collectImportGraph(program: ts.Program, include: string[] | undefined, resolveImport: ImportResolver) {
  const graph: ImportGraph = {}
  const inScope = (file: string) => !include || include.length === 0 || include.some(p => file.includes(p))

  for (const sf of program.getSourceFiles()) {
    if (!isProjectSource(sf)) continue
    const file = rel(sf.fileName)
    if (!inScope(file)) continue
    const deps = new Set<string>()
    sf.forEachChild(node => {
      if (ts.isImportDeclaration(node)) {
        const spec = node.moduleSpecifier
        if (!ts.isStringLiteral(spec)) return
        const text = spec.text
        const resolved = resolveImport(sf.fileName, text)
        if (resolved && inScope(resolved)) deps.add(resolved)
      }
    })
    graph[file] = Array.from(deps)
  }
  return graph
}

function computeFanMaps(graph: ImportGraph) {
  const fanIn: FanMap = {}
  const fanOut: FanMap = {}
  for (const [file, deps] of Object.entries(graph)) {
    fanOut[file] = deps.length
    if (!(file in fanIn)) fanIn[file] = 0
    deps.forEach(dep => {
      fanIn[dep] = (fanIn[dep] || 0) + 1
    })
  }
  return { fanIn, fanOut }
}

function functionId(file: string, name: string, pos: number) {
  return `${file}::${name}@${pos}`
}

function mkSideEffect(kind: string, detail: string, loc?: Location): SideEffect {
  const high = new Set(['network', 'filesystem'])
  const medium = new Set(['state-write', 'dom', 'timer'])
  const base = high.has(kind)
    ? { kind, detail, cost: 'High' as const, blast: 'High' as const, concurrency: 'Medium' as const }
    : (medium.has(kind)
        ? { kind, detail, cost: 'Medium' as const, blast: 'Medium' as const, concurrency: 'Medium' as const }
        : { kind, detail, cost: 'Low' as const, blast: 'Low' as const, concurrency: 'Low' as const })
  return loc ? { ...base, loc } : base
}

type ImportAlias = { local: string; source: string; export: string }

function collectAliases(sf: ts.SourceFile, resolveImport: ImportResolver): ImportAlias[] {
  const aliases: ImportAlias[] = []
  sf.forEachChild(node => {
    if (ts.isImportDeclaration(node) && node.importClause) {
      const spec = node.moduleSpecifier
      if (!ts.isStringLiteral(spec)) return
      const mod = spec.text
      const resolved = resolveImport(sf.fileName, mod)
      if (!resolved) return
      const ic = node.importClause
      if (ic.name) {
        aliases.push({ local: ic.name.getText(sf), source: resolved, export: 'default' })
      }
      if (ic.namedBindings && ts.isNamedImports(ic.namedBindings)) {
        for (const el of ic.namedBindings.elements) {
          const local = el.name.getText(sf)
          const exported = el.propertyName ? el.propertyName.getText(sf) : el.name.getText(sf)
          aliases.push({ local, source: resolved, export: exported })
        }
      }
    }
  })

  sf.forEachChild(node => {
    if (!ts.isVariableStatement(node)) return
    for (const decl of node.declarationList.declarations) {
      if (!ts.isObjectBindingPattern(decl.name) || !decl.initializer) continue
      const init = ts.isAwaitExpression(decl.initializer) ? decl.initializer.expression : decl.initializer
      if (!ts.isCallExpression(init) || init.expression.kind !== ts.SyntaxKind.ImportKeyword) continue
      const arg = init.arguments[0]
      if (!arg || !ts.isStringLiteral(arg)) continue
      const source = resolveImport(sf.fileName, arg.text)
      if (!source) continue
      for (const el of decl.name.elements) {
        if (!ts.isBindingElement(el)) continue
        const local = el.name.getText(sf)
        const exported = el.propertyName ? el.propertyName.getText(sf) : el.name.getText(sf)
        aliases.push({ local, source, export: exported })
      }
    }
  })

  return aliases
}

function isThisExpression(expr: ts.Expression): boolean {
  return expr.kind === ts.SyntaxKind.ThisKeyword
}

type FileData = {
  sf: ts.SourceFile
  file: string
  nodes: NodeInfo[]
  locals: Map<string, string>
  instanceTypes: Map<string, { source: string; className: string }>
}

function gatherFile(sf: ts.SourceFile, functionIndex: Map<string, string>, resolveImport: ImportResolver): FileData {
  const file = rel(sf.fileName)
  const locals = new Map<string, string>()
  const nodes: NodeInfo[] = []
  const instanceTypes = new Map<string, { source: string; className: string }>()
  const aliases = collectAliases(sf, resolveImport)
  const classNames = new Set<string>()
  sf.forEachChild(node => {
    if (ts.isClassDeclaration(node) && node.name) {
      classNames.add(node.name.getText(sf))
    }
  })

  const addFunc = (
    name: string,
    node: ts.FunctionLikeDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression,
    kind: FunctionInfo['kind'],
    exported: boolean,
    className?: string,
    registerLocal = true,
    declNode?: ts.Node
  ) => {
    const id = functionId(file, name, node.pos)
    if (registerLocal) locals.set(name, id)
    functionIndex.set(`${file}::${name}`, id)
    const info: NodeInfo = { name, id, node, kind, exported }
    if (className) info.className = className
    nodes.push(info)
    functionNodeById.set(id, { sf, node, file })
    functionIdByNode.set(node, id)
    if (declNode) functionIdByDeclNode.set(declNode, id)
    return id
  }

  sf.forEachChild(node => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      const exported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
      addFunc(node.name.getText(sf), node, 'function', exported, undefined, true, node)
    } else if (ts.isVariableStatement(node)) {
      const exported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue
        if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
          const kind: FunctionInfo['kind'] = ts.isArrowFunction(decl.initializer) ? 'arrow' : 'function'
          addFunc(decl.name.getText(sf), decl.initializer, kind, exported, undefined, true, decl)
        } else if (ts.isNewExpression(decl.initializer)) {
  const classExpr = unwrap(decl.initializer.expression as ts.Expression)
          if (classExpr && ts.isIdentifier(classExpr)) {
            const classToken = classExpr.getText(sf)
            const alias = aliases.find(a => a.local === classToken)
            if (alias) {
              const className = alias.export === 'default' ? classToken : alias.export
              instanceTypes.set(decl.name.getText(sf), { source: alias.source, className })
            } else if (classNames.has(classToken)) {
              instanceTypes.set(decl.name.getText(sf), { source: file, className: classToken })
            }
          }
        }
      }
    } else if (ts.isClassDeclaration(node)) {
      const cname = node.name ? node.name.getText(sf) : 'AnonymousClass'
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
          addFunc(`${cname}.${member.name.getText(sf)}`, member, 'method', false, cname, true, member)
        } else if (ts.isConstructorDeclaration(member)) {
          addFunc(`${cname}.constructor`, member, 'function', false, cname, true, member)
        } else if (ts.isPropertyDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
          const init = member.initializer
          if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
            addFunc(`${cname}.${member.name.getText(sf)}`, init, 'method', false, cname, true, member)
          }
        }
      }
    }
  })

  sf.forEachChild(node => {
    if (ts.isFunctionDeclaration(node) && node.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)) {
      const existingId = functionIdByDeclNode.get(node)
      if (existingId) {
        functionIndex.set(`${file}::default`, existingId)
      } else {
        const exported = true
        const funcName = node.name?.getText(sf) ?? 'defaultExport'
        const id = addFunc(funcName, node, 'function', exported, undefined, true, node)
        functionIndex.set(`${file}::default`, id)
      }
    }
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      const expr = unwrap(node.expression as ts.Expression)
      if (ts.isIdentifier(expr)) {
        const key = `${file}::${expr.text}`
        const id = functionIndex.get(key) || locals.get(expr.text)
        if (id) functionIndex.set(`${file}::default`, id)
      } else if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
        const name = 'defaultExport'
        const kind: FunctionInfo['kind'] = ts.isArrowFunction(expr) ? 'arrow' : 'function'
        const id = functionId(file, name, expr.pos)
        locals.set(name, id)
        functionIndex.set(`${file}::${name}`, id)
        functionIndex.set(`${file}::default`, id)
        functionNodeById.set(id, { sf, node: expr, file })
        functionIdByNode.set(expr, id)
        const info: NodeInfo = { name, id, node: expr, kind, exported: true }
        nodes.push(info)
      }
    }
  })

  return { sf, file, nodes, locals, instanceTypes }
}

function collectFunctions(program: ts.Program, resolveImport: ImportResolver, include?: string[]) {
  const functionIndex = new Map<string, string>()
  const fileData: FileData[] = []

  for (const sf of program.getSourceFiles()) {
    if (!isProjectSource(sf)) continue
    const file = rel(sf.fileName)
    if (include && include.length && !include.some(p => file.includes(p))) {
      continue
    }
    fileData.push(gatherFile(sf, functionIndex, resolveImport))
  }

  const funcs: FunctionInfo[] = []
  const edges: CallEdge[] = []
  const assumptions: Assumption[] = []

  for (const data of fileData) {
    analyzeFile(data, functionIndex, funcs, edges, assumptions, resolveImport)
  }

  scanGlobalExposures(program, edges, functionIndex, resolveImport, useTypeChecker, funcs)
  ensureSyntheticFunction(funcs, 'global::exposed', 'global::exposed')
  for (const e of edges) {
    if (e.to.startsWith('global::') && !functionStableIdById.has(e.to)) {
      functionStableIdById.set(e.to, e.to)
      ensureSyntheticFunction(funcs, e.to, e.to)
    }
  }

  for (const edge of edges) {
    if (!edge.fromStable) {
      const stable = functionStableIdById.get(edge.from)
      if (stable) edge.fromStable = stable
    }
    if (!edge.toStable) {
      const stable = functionStableIdById.get(edge.to)
      if (stable) edge.toStable = stable
    }
  }

  return { funcs, edges, assumptions }
}

function analyzeFile(
  data: FileData,
  functionIndex: Map<string, string>,
  funcs: FunctionInfo[],
  edges: CallEdge[],
  assumptions: Assumption[],
  resolveImport: ImportResolver
) {
  const { sf, file, nodes, locals, instanceTypes } = data
  const aliases = collectAliases(sf, resolveImport)
  const nsImports = new Map<string, string>()
  sf.forEachChild(n => {
    if (!ts.isVariableStatement(n)) return
    for (const decl of n.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue
      let init = decl.initializer as ts.Expression
      if (ts.isAwaitExpression(init)) init = init.expression as ts.Expression
      if (!ts.isCallExpression(init) || init.expression.kind !== ts.SyntaxKind.ImportKeyword) continue
      const arg = init.arguments[0]
      if (!arg || !ts.isStringLiteral(arg)) continue
      const source = resolveImport(sf.fileName, arg.text)
      if (source) nsImports.set(decl.name.text, source)
    }
  })
  sf.forEachChild(n => {
    if (!ts.isImportDeclaration(n) || !n.importClause) return
    const nb = n.importClause.namedBindings
    if (nb && ts.isNamespaceImport(nb)) {
      const spec = n.moduleSpecifier
      if (!ts.isStringLiteral(spec)) return
      const source = resolveImport(sf.fileName, spec.text)
      if (source) nsImports.set(nb.name.getText(sf), source)
    }
  })
  const classFieldInstances = new Map<string, Map<string, { source: string; className: string }>>()
  const assumptionKeySet = new Set<string>()
  let anonCounter = 0

  const resolveIdentifier = (name: string): string | null => {
    if (locals.has(name)) return locals.get(name)!
    const alias = aliases.find(a => a.local === name)
    if (alias) {
      const key = `${alias.source}::${alias.export}`
      const id = functionIndex.get(key)
      return id ?? null
    }
    const key = `${file}::${name}`
    return functionIndex.get(key) ?? null
  }

  const resolveStringLiteralFromIdentifier = (identifier: ts.Identifier): string | null => {
    if (!useTypeChecker || !checker) return null
    const sym = checker.getSymbolAtLocation(identifier)
    if (!sym) return null
    const decls = sym.getDeclarations() || []
    for (const decl of decls) {
      if (ts.isVariableDeclaration(decl) && decl.initializer) {
        const init = unwrap(decl.initializer as ts.Expression)
        if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) return init.text
        if (ts.isTemplateExpression(init) && init.templateSpans.length === 0) return init.head.text
      }
    }
    return null
  }

  const pseudoLinkExternal = (name: string, loc: Location, se?: SideEffect[]): boolean => {
    if (name === 'fetch' || name === 'axios') {
      recordEdgeLocal(`global::${name}`, name, loc, se, 'network')
      return true
    }
    if (name === 'setTimeout' || name === 'setInterval' || name === 'requestAnimationFrame' || name === 'clearTimeout' || name === 'clearInterval') {
      recordEdgeLocal(`global::${name}`, name, loc, se, 'timer')
      return true
    }
    if (name === 'parseInt' || name === 'parseFloat' || name === 'Number' || name === 'isNaN') {
      recordEdgeLocal(`global::${name}`, name, loc)
      return true
    }
    return false
  }

  let currentCallsRef: string[] = []

  function recordEdgeLocal(to: string, via: string, loc: Location, se?: SideEffect[], seKind?: 'network' | 'timer') {
    if (to.startsWith('global::') && !functionStableIdById.has(to)) {
      functionStableIdById.set(to, to)
    }
    const toStable = functionStableIdById.get(to)
    const edgeRecord: CallEdge = { from: currentIdTemp, to, via, loc, fromStable: currentStableIdTemp }
    if (toStable) edgeRecord.toStable = toStable
    edges.push(edgeRecord)
    if (currentCallsRef) currentCallsRef.push(to)
    if (se && seKind === 'network') se.push(mkSideEffect('network', via, loc))
    if (se && seKind === 'timer') se.push(mkSideEffect('timer', via, loc))
  }

  let currentIdTemp = ''
  let currentStableIdTemp = ''

  for (let index = 0; index < nodes.length; index++) {
    const fn = nodes[index]!
    const sideEffects: SideEffect[] = []
    const calls: string[] = []
    const currentId = fn.id
    const className = fn.className
    const fieldInstances = new Map<string, { source: string; className: string }>()
    const selfLoc = getLoc(sf, fn.node)
    const currentStableId = `${file}::${fn.name}#L${selfLoc.start.line}`
    functionStableIdById.set(currentId, currentStableId)
    functionStableIdById.set(`${file}::${fn.name}`, currentStableId)

    currentIdTemp = currentId
    currentStableIdTemp = currentStableId

    const paramSlotByLocal = new Map<string, { index: number; prop: string }>()
    fn.node.parameters?.forEach((p: ts.ParameterDeclaration, pIndex: number) => {
      const nameNode = p.name
      if (ts.isObjectBindingPattern(nameNode)) {
        for (const el of nameNode.elements) {
          if (!el.name) continue
          const localId = ts.isIdentifier(el.name) ? el.name.text : el.name.getText(sf)
          const prop = el.propertyName
            ? (ts.isIdentifier(el.propertyName) || ts.isStringLiteral(el.propertyName))
              ? el.propertyName.text
              : el.propertyName.getText(sf)
            : localId
          paramSlotByLocal.set(localId, { index: pIndex, prop })
        }
      }
    })

    const recordEdge = (to: string, via: string, loc: Location) => {
      calls.push(to)
      const toStable = functionStableIdById.get(to)
      const edgeRecord: CallEdge = { from: currentId, to, via, loc, fromStable: currentStableId }
      if (toStable) edgeRecord.toStable = toStable
      edges.push(edgeRecord)
    }

    currentCallsRef = calls

    const addAnonFunc = (node: ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration, preferredName?: string): string => {
      const existing = functionIdByNode.get(node)
      if (existing) {
        if (!functionNodeById.has(existing)) {
          functionNodeById.set(existing, { sf, node, file })
        }
        return existing
      }
      const anonName = preferredName ? `${fn.name}.${preferredName}` : `${fn.name}__anon${++anonCounter}`
      const kind: FunctionInfo['kind'] = ts.isArrowFunction(node) ? 'arrow' : 'function'
      const id = functionId(file, anonName, node.pos)
      functionIndex.set(`${file}::${anonName}`, id)
      const info: NodeInfo = { name: anonName, id, node, kind, exported: false }
      if (className) info.className = className
      nodes.push(info)
      functionNodeById.set(id, { sf, node, file })
      functionIdByNode.set(node, id)
      return id
    }

    const recordEdgeForInitializer = (
      init: ts.Expression,
      propName: string,
      viaPrefix: string,
      sfLocal: ts.SourceFile,
      addAnon: (node: ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration) => string,
      rec: (to: string, via: string, loc: Location) => void
    ): boolean => {
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
        const anonId = addAnon(init as any)
        rec(anonId, `${viaPrefix}${propName}:cb:inline`, getLoc(sfLocal, init))
        return true
      }
      if (ts.isIdentifier(init)) {
        const locInit = getLoc(sfLocal, init)
        const initText = init.getText(sfLocal)
        if (useTypeChecker && checker) {
          const base = unaliasSymbol(checker.getSymbolAtLocation(init))
          if (base) {
            const decls = base.getDeclarations() || []
            for (const d of decls) {
              const sfDecl = d.getSourceFile()
              if (isProjectSource(sfDecl) && !sfDecl.isDeclarationFile) {
                const toId = functionIdByDeclNode.get(d) || (ts.isVariableDeclaration(d) && d.initializer ? functionIdByNode.get(d.initializer) : undefined) || functionIdByNode.get(d as any) || null
                if (toId) {
                  rec(toId, `${viaPrefix}${propName}:id`, locInit)
                  return true
                }
              }
            }
            if (decls.length && !decls.some(d => isProjectSource(d.getSourceFile()) && !d.getSourceFile().isDeclarationFile)) {
              if (pseudoLinkExternal(initText, locInit, sideEffects)) {
                rec(`global::${initText}`, `${viaPrefix}${propName}:external`, locInit)
                return true
              }
            }
          }
        }
        const resolvedFallback = resolveIdentifier(initText)
        if (resolvedFallback) {
          rec(resolvedFallback, `${viaPrefix}${propName}:id`, locInit)
          return true
        }
        if (pseudoLinkExternal(initText, locInit, sideEffects)) {
          rec(`global::${initText}`, `${viaPrefix}${propName}:external`, locInit)
          return true
        }
        return false
      }
      if (ts.isPropertyAccessExpression(init)) {
        const methodName = init.name.getText(sfLocal)
        if (useTypeChecker && checker) {
          let propSym = unaliasSymbol(checker.getSymbolAtLocation(init.name))
          if (!propSym) {
            const recvType = checker.getTypeAtLocation(init.expression)
            const types: ts.Type[] = isUnionType(recvType) && (recvType as ts.UnionType).types ? (recvType as ts.UnionType).types : [recvType]
            for (const t of types) {
              const apparent = checker.getApparentType(t)
              const s = unaliasSymbol(apparent.getProperty(methodName))
              if (s) { propSym = s; break }
            }
          }
          if (propSym) {
            const decls = propSym.getDeclarations() || []
            for (const d of decls) {
              const sfDecl = d.getSourceFile()
              if (isProjectSource(sfDecl) && !sfDecl.isDeclarationFile) {
                const toId = functionIdByDeclNode.get(d) || functionIdByNode.get(d as any)
                if (toId) {
                  rec(toId, `${viaPrefix}${propName}:prop`, getLoc(sfLocal, init))
                  return true
                }
              }
            }
            if (decls.length && !decls.some(d => isProjectSource(d.getSourceFile()) && !d.getSourceFile().isDeclarationFile)) {
              if (pseudoLinkExternal(init.getText(sfLocal), getLoc(sfLocal, init), sideEffects)) {
                rec(`global::${init.getText(sfLocal)}`, `${viaPrefix}${propName}:external`, getLoc(sfLocal, init))
                return true
              }
            }
          }
        }

        const recvExpr = init.expression
        const locInit = getLoc(sfLocal, init)
        if (ts.isIdentifier(recvExpr)) {
          const nsSource = nsImports.get(recvExpr.text)
          if (nsSource) {
            const target = functionIndex.get(`${nsSource}::${methodName}`)
              ?? (methodName === 'default' ? functionIndex.get(`${nsSource}::default`) : undefined)
            if (target) {
              rec(target, `${viaPrefix}${propName}:prop`, locInit)
              return true
            }
          }
          const alias = aliases.find(a => a.local === recvExpr.text)
          if (alias) {
            const target = functionIndex.get(`${alias.source}::${methodName}`)
            if (target) {
              rec(target, `${viaPrefix}${propName}:prop`, locInit)
              return true
            }
          }
        }
        if (pseudoLinkExternal(init.getText(sfLocal), locInit, sideEffects)) {
          rec(`global::${init.getText(sfLocal)}`, `${viaPrefix}${propName}:external`, locInit)
          return true
        }
      }
      return false
    }

    const visitObjectLiteralArg = (
      obj: ts.ObjectLiteralExpression,
      sfLocal: ts.SourceFile,
      addAnon: (node: ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration) => string,
      rec: (to: string, via: string, loc: Location) => void
    ) => {
      for (const prop of obj.properties) {
        if (ts.isPropertyAssignment(prop)) {
          const name = (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) ? prop.name.text : prop.name.getText(sfLocal)
          recordEdgeForInitializer(prop.initializer, name, 'arg.obj.', sfLocal, addAnon, rec)
        } else if (ts.isShorthandPropertyAssignment(prop)) {
          const id = prop.name
          if (useTypeChecker && checker) {
            const base = unaliasSymbol(checker.getSymbolAtLocation(id))
            if (base) {
              const decls = base.getDeclarations() || []
              for (const d of decls) {
                const sfDecl = d.getSourceFile()
                if (isProjectSource(sfDecl) && !sfDecl.isDeclarationFile) {
                  const toId = functionIdByDeclNode.get(d) || (ts.isVariableDeclaration(d) && d.initializer ? functionIdByNode.get(d.initializer) : undefined) || functionIdByNode.get(d as any)
                  if (toId) {
                    rec(toId, `arg.obj.${id.text}:shorthand`, getLoc(sfLocal, prop))
                    break
                  }
                }
              }
            }
          } else {
            const fallback = resolveIdentifier(id.text)
            if (fallback) {
              rec(fallback, `arg.obj.${id.text}:shorthand`, getLoc(sfLocal, prop))
            }
          }
        } else if (ts.isMethodDeclaration(prop as any)) {
          const name = (prop as any).name?.getText?.(sfLocal) ?? 'method'
          const anonId = addAnon(prop as any)
          rec(anonId, `arg.obj.${name}:cb:inline`, getLoc(sfLocal, prop))
        }
      }
    }

    const resolveInstanceTarget = (source: string, className: string, prop: string) => {
      const directKey = `${source}::${className}.${prop}`
      const direct = functionIndex.get(directKey)
      if (direct) return direct
      const candidates: { key: string; value: string }[] = []
      for (const [key, value] of functionIndex) {
        if (!key.startsWith(`${source}::`)) continue
        if (!key.endsWith(`.${prop}`)) continue
        candidates.push({ key, value })
      }
      if (candidates.length === 1) {
        const candidate = candidates[0]!
        return candidate.key.includes(`::${className}.`) ? candidate.value : null
      }
      return null
    }

    const visit = (node: ts.Node) => {
      if (
        node !== fn.node && (
          ts.isFunctionDeclaration(node) ||
          ts.isFunctionExpression(node) ||
          ts.isArrowFunction(node) ||
          ts.isMethodDeclaration(node) ||
          ts.isConstructorDeclaration(node)
        )
      ) {
        return
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        let init = node.initializer as ts.Expression
        if (ts.isAwaitExpression(init)) init = init.expression as ts.Expression
        if (ts.isCallExpression(init) && init.expression.kind === ts.SyntaxKind.ImportKeyword) {
          const arg = init.arguments[0]
          if (arg && ts.isStringLiteral(arg)) {
            const source = resolveImport(sf.fileName, arg.text)
            if (source) nsImports.set(node.name.text, source)
          }
        }
      } else if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer) {
        let init = node.initializer as ts.Expression
        if (ts.isAwaitExpression(init)) init = init.expression as ts.Expression
        if (ts.isCallExpression(init) && init.expression.kind === ts.SyntaxKind.ImportKeyword) {
          const arg = init.arguments[0]
          if (arg && ts.isStringLiteral(arg)) {
            const source = resolveImport(sf.fileName, arg.text)
            if (source) {
              for (const el of node.name.elements) {
                if (!ts.isBindingElement(el)) continue
                const local = el.name.getText(sf)
                const exported = el.propertyName ? el.propertyName.getText(sf) : el.name.getText(sf)
                aliases.push({ local, source, export: exported })
              }
            }
          }
        }
      }
      if (enableDomIndex) {
        if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isStringLiteral(node)) {
          const text = (node as ts.NoSubstitutionTemplateLiteral | ts.StringLiteral).text
          if (text.includes('<') && text.includes('>')) {
            const loc = getLoc(sf, node)
            const selectors = selectorsFromHtml(text)
            if (selectors.length) {
              addTemplateRecord(file, loc, text, selectors)
              for (const sel of selectors) addSelectorDefinition(sel.selector, sel.kind, file, loc, text)
            }
          }
        }
      }
      if (ts.isCallExpression(node)) {
        let calleeLinked = false
        const linkCallee = (toId: string, via: string) => {
          recordEdge(toId, via, getLoc(sf, node))
          calleeLinked = true
        }
        const expr = node.expression
        if (useTypeChecker && checker) {
          if (ts.isIdentifier(expr)) {
            const base = unaliasSymbol(checker.getSymbolAtLocation(expr))
            if (base) {
              const decls = base.getDeclarations() || []
              for (const d of decls) {
                const sfDecl = d.getSourceFile()
                if (isProjectSource(sfDecl) && !sfDecl.isDeclarationFile) {
                  const toIdDirect = functionIdByDeclNode.get(d)
                  if (toIdDirect) {
                    linkCallee(toIdDirect, expr.getText(sf))
                    break
                  }
                  if (ts.isVariableDeclaration(d) && d.initializer) {
                    const init = d.initializer
                    const byInit = functionIdByNode.get(init)
                    if (byInit) {
                      linkCallee(byInit, expr.getText(sf))
                      break
                    }
                    if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
                      const byDecl = functionIdByDeclNode.get(d)
                      if (byInit || byDecl) {
                        const id = byInit ?? byDecl!
                        linkCallee(id, expr.getText(sf))
                        break
                      }
                      const preferred = ts.isIdentifier(d.name) ? d.name.text : undefined
                      const id = addAnonFunc(init, preferred)
                      functionIdByDeclNode.set(d, id)
                      linkCallee(id, expr.getText(sf))
                      break
                    }
                    if (ts.isPropertyAccessExpression(init)) {
                      const propSym0 = checker.getSymbolAtLocation(init.name)
                      const propSym = propSym0 && (propSym0.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(propSym0) : propSym0
                      if (propSym) {
                        const pdecls = propSym.getDeclarations() || []
                        for (const pd of pdecls) {
                          const psf = pd.getSourceFile()
                          if (isProjectSource(psf) && !psf.isDeclarationFile) {
                            const mapped = functionIdByDeclNode.get(pd) || functionIdByNode.get(pd as any)
                            if (mapped) {
                              linkCallee(mapped, expr.getText(sf))
                              break
                            }
                          }
                        }
                        if (calleeLinked) break
                      } else {
                        const method = init.name.getText(d.getSourceFile())
                        let candidate: string | null = null
                        let count = 0
                        for (const [k, v] of functionIndex) {
                          if (k.endsWith(`::${method}`)) {
                            candidate = v
                            count++
                            if (count > 1) break
                          }
                        }
                        if (count === 1 && candidate) {
                          linkCallee(candidate, expr.getText(sf))
                          break
                        }
                      }
                    }
                  }
                }
              }
              if (!calleeLinked && decls.length && !decls.some(d => isProjectSource(d.getSourceFile()) && !d.getSourceFile().isDeclarationFile)) {
                const name = expr.getText(sf)
                if (!isPureGlobalIdentifier(name)) calleeLinked = pseudoLinkExternal(name, getLoc(sf, node), sideEffects)
              }
            }
          } else if (ts.isPropertyAccessExpression(expr)) {
            const methodName = expr.name.getText(sf)
            let propSym = unaliasSymbol(checker.getSymbolAtLocation(expr.name))
            if (!propSym) {
              const recvType = checker.getTypeAtLocation(expr.expression)
              const tryTypes: ts.Type[] = isUnionType(recvType) && recvType.types ? recvType.types : [recvType]
              for (const t of tryTypes) {
                const apparent = checker.getApparentType(t)
                const s = apparent.getProperty(methodName)
                if (s) {
                  propSym = unaliasSymbol(s)
                  break
                }
              }
            }
            if (propSym) {
              const decls = propSym.getDeclarations() || []
              for (const d of decls) {
                const sfDecl = d.getSourceFile()
                if (isProjectSource(sfDecl) && !sfDecl.isDeclarationFile) {
                  const toIdDirect = functionIdByDeclNode.get(d) || functionIdByNode.get(d as any)
                  if (toIdDirect) {
                          linkCallee(toIdDirect, expr.getText(sf))
                    break
                  }
                }
              }
              const recvTxt = expr.expression.getText(sf)
              const baseSym = checker.getSymbolAtLocation(expr.expression)
              if (!calleeLinked && baseSym) {
                const bdecls = baseSym.getDeclarations() || []
                if (bdecls.length && !bdecls.some(d => isProjectSource(d.getSourceFile()) && !d.getSourceFile().isDeclarationFile)) {
                  if (isPureGlobalNamespace(recvTxt)) calleeLinked = true
                  if (!calleeLinked && isPureGlobalIdentifier(recvTxt)) calleeLinked = pseudoLinkExternal(recvTxt, getLoc(sf, node), sideEffects)
                }
              }
              if (!calleeLinked && recvTxt === 'console') {
                recordEdgeLocal(`global::console.${methodName}`, expr.getText(sf), getLoc(sf, node))
                calleeLinked = true
              }
            }
          }
        }
        if (!calleeLinked && ts.isPropertyAccessExpression(expr)) {
          const recv = expr.expression
          const methodName = expr.name.getText(sf)
          if (ts.isIdentifier(recv)) {
            const nsSource = nsImports.get(recv.text)
            if (nsSource) {
              const target = functionIndex.get(`${nsSource}::${methodName}`)
                ?? (methodName === 'default' ? functionIndex.get(`${nsSource}::default`) : undefined)
              if (target) {
                linkCallee(target, expr.getText(sf))
                calleeLinked = true
              }
            }
            if (!calleeLinked) {
              const alias = aliases.find(a => a.local === recv.text)
              if (alias) {
                const target = functionIndex.get(`${alias.source}::${methodName}`)
                if (target) {
                  linkCallee(target, expr.getText(sf))
                  calleeLinked = true
                }
              }
            }
            if (!calleeLinked && recv.text === 'console') {
              recordEdgeLocal(`global::console.${methodName}`, expr.getText(sf), getLoc(sf, node))
              calleeLinked = true
            }
          }
          if (!calleeLinked) {
            const locExpr = getLoc(sf, node)
            if (pseudoLinkExternal(expr.getText(sf), locExpr, sideEffects)) calleeLinked = true
          }
        }

        if (!calleeLinked && ts.isIdentifier(expr)) {
          const name = expr.getText(sf)
          const loc = getLoc(sf, node)
          const slot = paramSlotByLocal.get(name)
          if (slot) {
            const slotId = `${currentStableId}::param${slot.index}.${slot.prop}`
            if (!functionStableIdById.has(slotId)) {
              ensureSyntheticFunction(funcs, slotId, slotId)
            }
            recordEdge(slotId, `${name}:param-slot`, loc)
            calleeLinked = true
          }
          if (!calleeLinked) {
            const target = resolveIdentifier(name)
            if (target) {
              linkCallee(target, name)
            } else {
              const stmt = `Invocation of global or external function '${name}' in ${file}`
              const assumeKey = `${loc.file}:${loc.start.line}:${loc.start.col}:${stmt}`
              if (!assumptionKeySet.has(assumeKey)) {
                assumptions.push({
                  statement: stmt,
                  rationale: 'Call target cannot be statically linked to project source; ensure external dependency is safe.',
                  impact: 'Medium',
                  verification: 'Review external API usage and ensure expected behavior.',
                  loc
                })
                assumptionKeySet.add(assumeKey)
              }
            }
          }
          if (name === 'fetch' || name === 'axios') {
            sideEffects.push(mkSideEffect('network', name, loc))
          }
          if (name === 'setTimeout' || name === 'setInterval') {
            sideEffects.push(mkSideEffect('timer', name, loc))
          }
        }
        if (enableDomIndex && ts.isPropertyAccessExpression(expr)) {
          const method = expr.name.getText(sf)
          if (method === 'getElementById' || method === 'getElementsByClassName' || method === 'querySelector' || method === 'querySelectorAll') {
            const arg = node.arguments[0]
            if (arg) {
              const value = literalText(arg as ts.Expression, sf)
              if (value) {
                if (method === 'getElementById') {
                  addSelectorUsage(`#${value}`, file, expr.getText(sf), getLoc(sf, arg), false, currentId)
                } else if (method === 'getElementsByClassName') {
                  const classes = value.split(/\s+/).filter(Boolean)
                  for (const c of classes) addSelectorUsage(`.${c}`, file, expr.getText(sf), getLoc(sf, arg), false, currentId)
                } else {
                  addSelectorUsage(value, file, expr.getText(sf), getLoc(sf, arg), false, currentId)
                }
              }
            }
          } else if (method === 'matches' || method === 'closest') {
            const arg = node.arguments[0]
            if (arg) {
              const value = literalText(arg as ts.Expression, sf)
              if (value) addSelectorUsage(value, file, expr.getText(sf), getLoc(sf, arg), true, currentId)
            }
          } else if (method === 'addEventListener') {
            const eventArg = node.arguments[0]
            const handlerArg = node.arguments[1]
            if (handlerArg) {
              const eventName = eventArg ? literalText(eventArg as ts.Expression, sf) ?? eventArg.getText(sf) : ''
              let handlerName = handlerArg.getText(sf)
              let handlerNode: ts.FunctionLikeDeclaration | ts.ArrowFunction | ts.FunctionExpression | null = null
              let handlerSf = sf
              if (ts.isArrowFunction(handlerArg) || ts.isFunctionExpression(handlerArg)) {
                handlerNode = handlerArg
                const handlerLoc = getLoc(sf, handlerArg)
                handlerName = `inline@${handlerLoc.start.line}`
              } else if (ts.isIdentifier(handlerArg)) {
                const resolved = resolveIdentifier(handlerArg.getText(sf))
                if (resolved) {
                  const mapped = functionNodeById.get(resolved)
                  if (mapped) {
                    handlerNode = mapped.node as ts.FunctionLikeDeclaration | ts.ArrowFunction | ts.FunctionExpression
                    handlerSf = mapped.sf
                    handlerName = handlerArg.getText(sf)
                  }
                }
              }
              let delegated = false
              let delegatedSelectors: string[] = []
              if (handlerNode) {
                const info = analyzeDelegatedHandler(handlerNode, handlerSf)
                delegated = info.delegated
                delegatedSelectors = info.selectors
                if (delegatedSelectors.length) {
                  for (const sel of delegatedSelectors) addSelectorUsage(sel, rel(handlerSf.fileName), `${handlerName}.delegated`, getLoc(handlerSf, handlerNode), true, handlerName)
                }
              }
              const receiverInfo = extractReceiverSelector(expr.expression, sf)
              if (receiverInfo.selector) addSelectorUsage(receiverInfo.selector, file, receiverInfo.via || expr.getText(sf), getLoc(sf, node), false, handlerName)
              const handlerRecord: HandlerRecord = {
                file,
                loc: getLoc(sf, node),
                event: eventName,
                handler: handlerName,
                delegated,
                delegatedSelectors
              }
              if (receiverInfo.selector) handlerRecord.receiverSelector = receiverInfo.selector
              if (receiverInfo.via) handlerRecord.receiverVia = receiverInfo.via
              addHandlerRecord(handlerRecord)
            }
          }
        }
        if (ts.isPropertyAccessExpression(expr)) {
          const rawRecv = unwrap(expr.expression as ts.Expression)
          const prop = expr.name.getText(sf)
          const recvText = rawRecv.getText(sf)

          if (ts.isIdentifier(rawRecv)) {
            const instance = instanceTypes.get(rawRecv.getText(sf))
            if (instance) {
              const resolved = resolveInstanceTarget(instance.source, instance.className, prop)
              const fallback = resolved ?? `${instance.source}::${instance.className}.${prop}`
              if (!functionStableIdById.has(fallback)) ensureSyntheticFunction(funcs, fallback, fallback)
              recordEdge(resolved ?? fallback, `${recvText}.${prop}`, getLoc(sf, node))
            } else {
              const nsSrc = nsImports.get(rawRecv.text)
              if (nsSrc) {
                const target = functionIndex.get(`${nsSrc}::${prop}`)
                if (target) recordEdge(target, `${recvText}.${prop}`, getLoc(sf, node))
              }
            }
          } else if (isThisExpression(rawRecv) && className) {
            const candidate = resolveIdentifier(`${className}.${prop}`)
            if (candidate) {
              recordEdge(candidate, `this.${prop}`, getLoc(sf, node))
            }
          } else if (ts.isPropertyAccessExpression(rawRecv) && className && isThisExpression(rawRecv.expression as ts.Expression)) {
            const field = rawRecv.name.getText(sf)
            const info = fieldInstances.get(field) || classFieldInstances.get(className)?.get(field)
            if (info) {
              const resolved = resolveInstanceTarget(info.source, info.className, prop)
              const fallback = resolved ?? `${info.source}::${info.className}.${prop}`
              if (!functionStableIdById.has(fallback)) ensureSyntheticFunction(funcs, fallback, fallback)
              recordEdge(resolved ?? fallback, `${recvText}.${prop}`, getLoc(sf, node))
            }
          }

          if (recvText === 'fs') sideEffects.push(mkSideEffect('filesystem', `fs.${prop}`, getLoc(sf, node)))
          const domRecv = recvText === 'document' || recvText === 'window' ||
            recvText === 'globalThis' ||
            recvText.endsWith('.document') || recvText.endsWith('.window')
          if (domRecv) sideEffects.push(mkSideEffect('dom', `${recvText}.${prop}`, getLoc(sf, node)))
          if (recvText === 'localStorage' || recvText === 'sessionStorage') sideEffects.push(mkSideEffect('state-write', `${recvText}.${prop}`, getLoc(sf, node)))
          if (DOM_MUTATOR_METHODS.has(prop) ||
             ((prop === 'add' || prop === 'remove' || prop === 'toggle' || prop === 'replace') && recvText.endsWith('.classList')) ||
             ((prop === 'setProperty' || prop === 'removeProperty') && recvText.endsWith('.style'))) {
            sideEffects.push(mkSideEffect('dom', `${recvText}.${prop}`, getLoc(sf, node)))
          }
        }
        if (ts.isElementAccessExpression(expr)) {
          const rawRecv = unwrap(expr.expression as ts.Expression)
          const arg = expr.argumentExpression ? unwrap(expr.argumentExpression as ts.Expression) : null
          let propLiteral: string | null = null
          if (arg) {
            if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
              propLiteral = arg.text
            } else if (ts.isTemplateExpression(arg) && arg.templateSpans.length === 0) {
              propLiteral = arg.head.text
            } else if (ts.isIdentifier(arg)) {
              propLiteral = resolveStringLiteralFromIdentifier(arg)
            }
          }
          const prop = propLiteral ?? '[computed]'
          const recvText = rawRecv.getText(sf)
          if (ts.isIdentifier(rawRecv)) {
            const instance = instanceTypes.get(rawRecv.getText(sf))
            if (instance && propLiteral) {
              const resolved = resolveInstanceTarget(instance.source, instance.className, propLiteral)
              const fallback = resolved ?? `${instance.source}::${instance.className}.${prop}`
              if (!functionStableIdById.has(fallback)) ensureSyntheticFunction(funcs, fallback, fallback)
              recordEdge(resolved ?? fallback, `${recvText}[${prop}]`, getLoc(sf, node))
            } else if (propLiteral) {
              const nsSrc = nsImports.get(rawRecv.text)
              if (nsSrc) {
                const target = functionIndex.get(`${nsSrc}::${propLiteral}`)
                if (target) recordEdge(target, `${recvText}[${prop}]`, getLoc(sf, node))
              }
            }
          }
        }

        node.arguments.forEach(arg => {
          const stripped = unwrap(arg as ts.Expression)
          if (ts.isIdentifier(stripped)) {
            const cbTarget = resolveIdentifier(stripped.getText(sf))
            if (cbTarget) {
              recordEdge(cbTarget, `arg:${stripped.getText(sf)}`, getLoc(sf, stripped))
            }
          } else if (ts.isArrowFunction(stripped) || ts.isFunctionExpression(stripped)) {
            const anonId = addAnonFunc(stripped)
            recordEdge(anonId, 'cb:inline', getLoc(sf, stripped))
          } else if (ts.isObjectLiteralExpression(stripped)) {
            visitObjectLiteralArg(stripped, sf, addAnonFunc, recordEdge)
          }
        })
      }

      if (ts.isBinaryExpression(node) && ['=', '+=', '-=', '*=', '/=', '%='].includes(ts.tokenToString(node.operatorToken.kind) || '')) {
        const left = node.left
        if (ts.isIdentifier(left) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isNewExpression(node.right)) {
          const classExpr = unwrap(node.right.expression as ts.Expression)
          if (ts.isIdentifier(classExpr)) {
            const classToken = classExpr.getText(sf)
            const alias = aliases.find(a => a.local === classToken)
            if (alias) {
              const classNameResolved = alias.export === 'default' ? classToken : alias.export
              instanceTypes.set(left.getText(sf), { source: alias.source, className: classNameResolved })
            }
          }
        }
        if (ts.isPropertyAccessExpression(left) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isNewExpression(node.right) && className && isThisExpression(left.expression as ts.Expression)) {
          const field = left.name.getText(sf)
          const classExpr = unwrap(node.right.expression as ts.Expression)
          if (ts.isIdentifier(classExpr)) {
            const classToken = classExpr.getText(sf)
            const alias = aliases.find(a => a.local === classToken)
            const resolved = alias
              ? { source: alias.source, className: alias.export === 'default' ? classToken : alias.export }
              : { source: file, className: classToken }
            fieldInstances.set(field, resolved)
            if (!classFieldInstances.has(className)) classFieldInstances.set(className, new Map())
            classFieldInstances.get(className)!.set(field, resolved)
          }
        } else if (ts.isPropertyAccessExpression(left)) {
          const parts = propertyChain(left, sf)
          const seKind = isDomMutationChain(parts) ? 'dom' : 'state-write'
          sideEffects.push(mkSideEffect(seKind, left.getText(sf), getLoc(sf, left)))
        } else if (ts.isElementAccessExpression(left)) {
          const base = left.expression.getText(sf)
          const idx = left.argumentExpression && unwrap(left.argumentExpression as ts.Expression)
          const prop = idx && ts.isStringLiteral(idx) ? idx.text : '[computed]'
          const seKind = isDomMutationChain([base, prop]) ? 'dom' : 'state-write'
          sideEffects.push(mkSideEffect(seKind, `${base}[${prop}]`, getLoc(sf, left)))
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(fn.node)

    const asyncFlag = Boolean((fn.node as any).async) || Boolean(fn.node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword))

    funcs.push({
      id: currentId,
      file,
      name: fn.name,
      kind: fn.kind,
      export: fn.exported,
      async: asyncFlag,
      sideEffects,
      calls,
      loc: selfLoc,
      stableId: currentStableId,
      startLine: selfLoc.start.line,
      startCol: selfLoc.start.col
    })
  }
}

function scanGlobalExposures(
  program: ts.Program,
  edges: CallEdge[],
  functionIndex: Map<string, string>,
  resolveImport: ImportResolver,
  useTypeCheckerFlag: boolean,
  funcs: FunctionInfo[]
) {
  const globals = new Set(['window', 'globalThis', 'self'])

  const tryBuildPath = (lhs: ts.Expression, sf: ts.SourceFile, aliases: Set<string>) => {
    const parts: string[] = []
    let cur: ts.Expression = lhs
    while (ts.isPropertyAccessExpression(cur) || ts.isElementAccessExpression(cur)) {
      if (ts.isPropertyAccessExpression(cur)) {
        parts.unshift(cur.name.getText(sf))
        cur = cur.expression
      } else {
        const arg = cur.argumentExpression && unwrap(cur.argumentExpression as ts.Expression)
        if (!arg || !ts.isStringLiteral(arg)) return null
        parts.unshift(arg.text)
        cur = cur.expression
      }
    }
    cur = unwrap(cur)
    if (!ts.isIdentifier(cur)) return null
    const root = cur.text
    if (!aliases.has(root)) return null
    return { root, path: parts.join('.') }
  }

  const propertyNameText = (name: ts.PropertyName | undefined, sf: ts.SourceFile): string | null => {
    if (!name) return null
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) || ts.isPrivateIdentifier(name)) return name.text
    if (ts.isComputedPropertyName(name)) {
      const expr = unwrap(name.expression)
      if (ts.isStringLiteral(expr) || ts.isNumericLiteral(expr)) return expr.text
      return expr.getText(sf)
    }
    return name.getText(sf)
  }

  const resolveTarget = (
    rhs: ts.Expression,
    sf: ts.SourceFile,
    file: string,
    aliasByLocal: Map<string, ImportAlias>,
    nsImports: Map<string, string>
  ): string | null => {
    rhs = unwrap(rhs)
    if (!useTypeCheckerFlag || !checker) {
      if (ts.isIdentifier(rhs)) {
        const byLocal = functionIndex.get(`${file}::${rhs.text}`)
        if (byLocal) return byLocal
        const alias = aliasByLocal.get(rhs.text)
        if (alias) return functionIndex.get(`${alias.source}::${alias.export}`) ?? `${alias.source}::${alias.export}`
        return null
      }
      if (ts.isPropertyAccessExpression(rhs) && ts.isIdentifier(rhs.expression)) {
        const ns = nsImports.get(rhs.expression.text)
        if (ns) {
          const name = rhs.name.getText(sf)
          const direct = functionIndex.get(`${ns}::${name}`)
          if (direct) return direct
          if (name === 'default') return functionIndex.get(`${ns}::default`) ?? `${ns}::default`
          return `${ns}::${name}`
        }
      }
      return null
    }
    if (ts.isCallExpression(rhs) && ts.isPropertyAccessExpression(rhs.expression) && rhs.expression.name.getText(sf) === 'bind') {
      return resolveTarget(rhs.expression.expression as ts.Expression, sf, file, aliasByLocal, nsImports)
    }
      if (ts.isIdentifier(rhs)) {
        const byLocal = functionIndex.get(`${file}::${rhs.text}`)
        if (byLocal) return byLocal
        const alias = aliasByLocal.get(rhs.text)
        if (alias) return functionIndex.get(`${alias.source}::${alias.export}`) ?? `${alias.source}::${alias.export}`
        if (useTypeCheckerFlag && checker) {
          const sym = unaliasSymbol(checker.getSymbolAtLocation(rhs))
          if (sym) {
            const decls = sym.getDeclarations() || []
            for (const d of decls) {
              const to = functionIdByDeclNode.get(d) || (ts.isVariableDeclaration(d) && d.initializer ? functionIdByNode.get(d.initializer) : undefined) || functionIdByNode.get(d as any)
              if (to) return to
            }
          }
        }
        return null
      }
      if (ts.isPropertyAccessExpression(rhs)) {
        const name = rhs.name.getText(sf)
        if (ts.isIdentifier(rhs.expression)) {
          const src = nsImports.get(rhs.expression.text)
          if (src) {
            const direct = functionIndex.get(`${src}::${name}`)
            if (direct) return direct
            if (name === 'default') return functionIndex.get(`${src}::default`) ?? `${src}::default`
            return `${src}::${name}`
          }
        }
        if (useTypeCheckerFlag && checker) {
          const propSym0 = checker.getSymbolAtLocation(rhs.name)
          const propSym = propSym0 && (propSym0.flags & ts.SymbolFlags.Alias) ? checker.getAliasedSymbol(propSym0) : propSym0
          if (propSym) {
            const decls = propSym.getDeclarations() || []
            for (const d of decls) {
              const to = functionIdByDeclNode.get(d) || functionIdByNode.get(d as any)
              if (to) return to
            }
          }
        }
        return null
      }
    return null
  }

  for (const sf of program.getSourceFiles()) {
    if (!isProjectSource(sf)) continue
    const file = rel(sf.fileName)
    const importAliases = collectAliases(sf, resolveImport)
    const aliasByLocal = new Map(importAliases.map(a => [a.local, a]))

    const windowAliases = new Set<string>(globals)
    sf.forEachChild(n => {
      if (!ts.isVariableStatement(n)) return
      for (const decl of n.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue
        const init = unwrap(decl.initializer as ts.Expression)
        if (ts.isIdentifier(init) && globals.has(init.text)) windowAliases.add(decl.name.text)
      }
    })

    const nsImports = new Map<string, string>()
    sf.forEachChild(n => {
      if (!ts.isVariableStatement(n)) return
      for (const decl of n.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue
        let init = decl.initializer as ts.Expression
        if (ts.isAwaitExpression(init)) init = init.expression as ts.Expression
        if (!ts.isCallExpression(init) || init.expression.kind !== ts.SyntaxKind.ImportKeyword) continue
        const arg = init.arguments[0]
        if (!arg || !ts.isStringLiteral(arg)) continue
        const source = resolveImport(sf.fileName, arg.text)
        if (source) nsImports.set(decl.name.text, source)
      }
    })
    sf.forEachChild(n => {
      if (!ts.isImportDeclaration(n) || !n.importClause) return
      const nb = n.importClause.namedBindings
      if (nb && ts.isNamespaceImport(nb)) {
        const spec = n.moduleSpecifier
        if (!ts.isStringLiteral(spec)) return
        const source = resolveImport(sf.fileName, spec.text)
        if (source) nsImports.set(nb.name.getText(sf), source)
      }
    })

    const addEdge = (to: string, via: string, locNode: ts.Node) => {
      const loc = getLoc(sf, locNode)
      const hasAtPos = /@-?\d+$/.test(to)
      if (!hasAtPos && !functionStableIdById.has(to)) {
        functionStableIdById.set(to, to)
        ensureSyntheticFunction(funcs, to, to)
      }
      let toStable = functionStableIdById.get(to)
      if (!toStable) {
        toStable = to
        functionStableIdById.set(to, toStable)
      }
      const rec: CallEdge = { from: 'global::exposed', to, via, loc }
      if (toStable) rec.toStable = toStable
      edges.push(rec)
    }

    const visit = (node: ts.Node) => {
      if (ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression) && node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const be = node.expression
        const lhsInfo = (ts.isPropertyAccessExpression(be.left) || ts.isElementAccessExpression(be.left)) && tryBuildPath(be.left, sf, windowAliases)
        if (lhsInfo) {
          const to = resolveTarget(be.right as ts.Expression, sf, file, aliasByLocal, nsImports)
          if (to) addEdge(to, `${lhsInfo.root}.${lhsInfo.path}=id`, node)
        }
      }

      if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)) {
        const call = node.expression
        const callee = call.expression
        const name = ts.isPropertyAccessExpression(callee) ? callee.name.getText(sf) : (ts.isIdentifier(callee) ? callee.text : '')
        if (name === 'defineProperty' || name === 'defineProperties' || name === 'assign') {
          const args = call.arguments
          if (args.length >= 1) {
            const target = unwrap(args[0] as ts.Expression)
            const isGlobalTarget = ts.isIdentifier(target) && windowAliases.has(target.text)
            if (isGlobalTarget) {
              if (name === 'assign' && args.length >= 2) {
                const second = unwrap(args[1] as ts.Expression)
                if (ts.isObjectLiteralExpression(second)) {
                  for (const p of second.properties) {
                    if (ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p as any)) {
                      const valueExpr = ts.isPropertyAssignment(p) ? (p.initializer as ts.Expression) : (p as any)
                      const to = resolveTarget(valueExpr, sf, file, aliasByLocal, nsImports)
                      if (to) {
                        const pname = propertyNameText((p as ts.PropertyAssignment | ts.MethodDeclaration).name, sf)
                        if (pname) addEdge(to, `Object.assign(${(target as ts.Identifier).text}).${pname}`, node)
                      }
                    }
                  }
                }
              } else if (name === 'defineProperty' && args.length >= 3) {
                const propArg = unwrap(args[1] as ts.Expression)
                const desc = unwrap(args[2] as ts.Expression)
                if (ts.isStringLiteral(propArg) && ts.isObjectLiteralExpression(desc)) {
                  const propName = propArg.text
                  for (const dp of desc.properties) {
                    if (!ts.isPropertyAssignment(dp)) continue
                    const key = propertyNameText(dp.name, sf)
                    if (!key) continue
                    if (key !== 'value' && key !== 'get' && key !== 'set') continue
                    const to = resolveTarget(dp.initializer as ts.Expression, sf, file, aliasByLocal, nsImports)
                    if (to) addEdge(to, `Object.defineProperty(${(target as ts.Identifier).text}).${propName}.${key}`, node)
                  }
                }
              } else if (name === 'defineProperties' && args.length >= 2) {
                const second = unwrap(args[1] as ts.Expression)
                if (ts.isObjectLiteralExpression(second)) {
                  for (const p of second.properties) {
                    if (!ts.isPropertyAssignment(p)) continue
                    const propName = propertyNameText(p.name, sf)
                    if (!propName) continue
                    const descExpr = unwrap(p.initializer as ts.Expression)
                    if (!ts.isObjectLiteralExpression(descExpr)) continue
                    for (const dp of descExpr.properties) {
                    if (!ts.isPropertyAssignment(dp) && !ts.isShorthandPropertyAssignment(dp)) continue
                    const key = propertyNameText(dp.name, sf)
                    if (!key) continue
                    if (key !== 'value' && key !== 'get' && key !== 'set') continue
                    let exprTarget: ts.Expression | null = null
                    if (ts.isPropertyAssignment(dp)) {
                      exprTarget = dp.initializer as ts.Expression
                    } else if (ts.isShorthandPropertyAssignment(dp)) {
                      exprTarget = dp.name as unknown as ts.Expression
                    }
                    if (!exprTarget) continue
                    const to = resolveTarget(exprTarget, sf, file, aliasByLocal, nsImports)
                    if (to) addEdge(to, `Object.defineProperties(${(target as ts.Identifier).text}).${propName}.${key}`, node)
                  }
                }
              }
            }
          }
          }
        }
      }

      ts.forEachChild(node, visit)
    }

    sf.forEachChild(visit)
  }
}

function selectEntryCandidates(graph: ImportGraph, fanIn: FanMap) {
  const files = Object.keys(graph)
  const zeroFanIn = files.filter(f => (fanIn[f] || 0) === 0)
  const indexFiles = files.filter(f => f.endsWith('index.tsx') || f.endsWith('index.ts'))
  const combined = Array.from(new Set([...indexFiles, ...zeroFanIn]))
  combined.sort()
  return combined
}

function buildAdjacency(edges: CallEdge[]) {
  const m = new Map<string, CallEdge[]>()
  for (const e of edges) {
    if (!m.has(e.from)) m.set(e.from, [])
    m.get(e.from)!.push(e)
  }
  return m
}

function focusFromEntry(entryFuzzy: string, funcs: FunctionInfo[], edges: CallEdge[], maxDepth: number) {
  const cand = funcs.find(f =>
    f.id === entryFuzzy ||
    f.stableId === entryFuzzy ||
    `${f.file}::${f.name}`.startsWith(entryFuzzy)
  )
  if (!cand) return null
  const start = cand.id
  const adj = buildAdjacency(edges)
  const seen = new Set<string>()
  const keptEdges: CallEdge[] = []
  const keptFuncs = new Set<string>([start])
  const funcSet = new Set(funcs.map(f => f.id))
  const q: { node: string; depth: number }[] = [{ node: start, depth: 0 }]
  while (q.length) {
    const { node, depth } = q.shift()!
    if (depth >= maxDepth) continue
    const outs = adj.get(node) || []
    for (const edge of outs) {
      const to = edge.to
      const key = node + '>' + to
      if (!seen.has(key)) {
        seen.add(key)
        if (funcSet.has(to)) {
          keptEdges.push({ ...edge })
          keptFuncs.add(to)
          q.push({ node: to, depth: depth + 1 })
        }
      }
    }
  }
  const funcObjs = funcs.filter(f => keptFuncs.has(f.id))
  return { start, funcObjs, keptEdges }
}

function emitDomSuiteArtifacts() {
  const selectorsMap = new Map<string, { selector: string; kind: SelectorKind; definitions: SelectorDefinition[]; usages: SelectorUsage[] }>()
  for (const def of selectorDefinitions) {
    const entry = selectorsMap.get(def.selector) || { selector: def.selector, kind: def.kind, definitions: [], usages: [] }
    if (!selectorsMap.has(def.selector)) selectorsMap.set(def.selector, entry)
    entry.kind = def.kind
    entry.definitions.push(def)
  }
  for (const use of selectorUsages) {
    const entry = selectorsMap.get(use.selector) || { selector: use.selector, kind: use.kind, definitions: [], usages: [] }
    if (!selectorsMap.has(use.selector)) selectorsMap.set(use.selector, entry)
    if (entry.kind === 'unknown' && use.kind !== 'unknown') entry.kind = use.kind
    entry.usages.push(use)
  }
  const selectorPayload = Array.from(selectorsMap.values()).sort((a, b) => a.selector.localeCompare(b.selector)).map(item => ({
    selector: item.selector,
    kind: item.kind,
    definitions: item.definitions.map(def => ({ file: def.file, loc: def.loc, snippet: def.snippet })),
    usages: item.usages.map(use => ({ file: use.file, via: use.via, loc: use.loc, delegated: use.delegated, handler: use.handler }))
  }))
  const templatesPayload = templateRecords.slice().sort((a, b) => {
    const fileCompare = a.file.localeCompare(b.file)
    if (fileCompare !== 0) return fileCompare
    return a.loc.start.line - b.loc.start.line
  })
  const handlersPayload = handlerRecords.slice().sort((a, b) => {
    const fileCompare = a.file.localeCompare(b.file)
    if (fileCompare !== 0) return fileCompare
    return a.loc.start.line - b.loc.start.line
  })
  fs.writeFileSync(path.join(outDir, 'domsuite_index.json'), JSON.stringify({ selectors: selectorPayload }, null, 2))
  fs.writeFileSync(path.join(outDir, 'domsuite_templates.json'), JSON.stringify({ templates: templatesPayload }, null, 2))
  fs.writeFileSync(path.join(outDir, 'domsuite_handlers.json'), JSON.stringify({ handlers: handlersPayload }, null, 2))
}

function main() {
  ensureDir(outDir)
  const opts = parseArgs(process.argv.slice(2))
  const seeds = loadPresetSeeds()

  functionNodeById.clear()
  functionStableIdById.clear()
  selectorDefinitions.length = 0
  selectorUsages.length = 0
  templateRecords.length = 0
  handlerRecords.length = 0
  enableDomIndex = false

  const program = loadProgram()
  const resolveImport = createTsResolver(program, repoRoot)
  useTypeChecker = !opts.noTypechecker
  checker = useTypeChecker ? program.getTypeChecker() : (undefined as any)
  if (useTypeChecker) console.log('[RESOLUTION] TypeChecker enabled')
  const fullImportGraph = collectImportGraph(program, undefined, resolveImport)
  const { funcs: fullFuncs, edges: fullEdges, assumptions: fullAssumptions } = collectFunctions(program, resolveImport)
  const fullStableCache = new Map(functionStableIdById)

  const { manifest, regenerated } = ensurePresetManifest(seeds, fullFuncs, fullEdges)
  if (regenerated) {
    console.log('Preset manifest regenerated based on current graph.')
  }

  functionNodeById.clear()
  functionStableIdById.clear()
  selectorDefinitions.length = 0
  selectorUsages.length = 0
  templateRecords.length = 0
  handlerRecords.length = 0

  const appliedPresets = applyPresets(opts, manifest)
  if (appliedPresets.length) {
    console.log(`Presets applied: ${appliedPresets.join(', ')}`)
  }

  enableDomIndex = opts.domIndex === true

  const includeHasFiles = Boolean(opts.include && opts.include.length)
  const importGraph = includeHasFiles ? collectImportGraph(program, opts.include, resolveImport) : fullImportGraph
  const needsFullRecollect = enableDomIndex && !includeHasFiles
  const { fanIn, fanOut } = computeFanMaps(importGraph)
  const { funcs, edges, assumptions } = includeHasFiles
    ? collectFunctions(program, resolveImport, opts.include)
    : needsFullRecollect
      ? collectFunctions(program, resolveImport)
      : { funcs: fullFuncs, edges: fullEdges, assumptions: fullAssumptions }
  for (const [key, value] of fullStableCache) {
    if (!functionStableIdById.has(key)) functionStableIdById.set(key, value)
  }
  for (const edge of edges) {
    if (!edge.fromStable) {
      const mapped = functionStableIdById.get(edge.from)
      if (mapped) edge.fromStable = mapped
    }
    if (!edge.toStable) {
      const mapped = functionStableIdById.get(edge.to)
      if (mapped) edge.toStable = mapped
    }
  }
  const entryCandidates = selectEntryCandidates(importGraph, fanIn)

  const summary = {
    entryCandidates,
    topFanIn: Object.entries(fanIn).sort((a, b) => b[1] - a[1]).slice(0, 10),
    topFanOut: Object.entries(fanOut).sort((a, b) => b[1] - a[1]).slice(0, 10),
    functionCount: funcs.length
  }

  fs.writeFileSync(path.join(outDir, 'imports.json'), JSON.stringify(importGraph, null, 2))
  fs.writeFileSync(path.join(outDir, 'fan_in.json'), JSON.stringify(fanIn, null, 2))
  fs.writeFileSync(path.join(outDir, 'fan_out.json'), JSON.stringify(fanOut, null, 2))
  fs.writeFileSync(path.join(outDir, 'functions.json'), JSON.stringify(funcs, null, 2))
  fs.writeFileSync(path.join(outDir, 'calls.json'), JSON.stringify(edges, null, 2))
  fs.writeFileSync(path.join(outDir, 'assumptions.json'), JSON.stringify(assumptions, null, 2))
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
  const crosswalk = funcs.map(f => ({ id: f.id, stableId: f.stableId, file: f.file, name: f.name, startLine: f.startLine, startCol: f.startCol }))
  fs.writeFileSync(path.join(outDir, 'function_crosswalk.json'), JSON.stringify({ functions: crosswalk }, null, 2))

  const lines = [
    'Entry candidates:',
    ...entryCandidates.map(f => `  - ${f}`),
    'Top fan-in:',
    ...summary.topFanIn.map(([file, c]) => `  - ${file} (${c})`),
    'Top fan-out:',
    ...summary.topFanOut.map(([file, c]) => `  - ${file} (${c})`)
  ]
  fs.writeFileSync(path.join(outDir, 'summary.txt'), lines.join('\n'))
  if (enableDomIndex) emitDomSuiteArtifacts()
  if (opts.entry) {
    const depth = typeof opts.maxDepth === 'number' ? opts.maxDepth : 6
    const focus = focusFromEntry(opts.entry, funcs, edges, depth)
    if (focus) {
      fs.writeFileSync(path.join(outDir, 'focused_calls.json'), JSON.stringify(focus.keptEdges, null, 2))
      fs.writeFileSync(path.join(outDir, 'focused_functions.json'), JSON.stringify(focus.funcObjs, null, 2))
      const t = [`Focused from ${focus.start} depth<=${depth}:`]
      for (const e of focus.keptEdges) t.push(`  ${e.from.replace(/@.*/, '')} -> ${e.to.replace(/@.*/, '')}`)
      fs.writeFileSync(path.join(outDir, 'focused_trace.txt'), t.join('\n'))
      console.log(path.join('tmp','analysis','focused_trace.txt'))
    }
  }
  console.log(path.join('tmp', 'analysis', 'summary.txt'))
}

main()
