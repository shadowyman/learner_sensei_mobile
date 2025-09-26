import * as ts from 'typescript'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

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

const repoRoot = process.cwd()
const outDir = path.join(repoRoot, 'tmp', 'analysis')
const functionNodeById = new Map<string, { sf: ts.SourceFile; node: ts.FunctionLikeDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression; file: string }>()
const functionStableIdById = new Map<string, string>()
const selectorDefinitions: SelectorDefinition[] = []
const selectorUsages: SelectorUsage[] = []
const templateRecords: TemplateRecord[] = []
const handlerRecords: HandlerRecord[] = []
let enableDomIndex = false

type CliOptions = {
  include?: string[]
  entry?: string
  maxDepth?: number
  domIndex?: boolean
  preset?: string[]
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
  if (f.includes('/node_modules/')) return false
  return f.endsWith('.ts') || f.endsWith('.tsx')
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

function resolveImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.') && !spec.startsWith('/')) return null
  const base = path.dirname(fromFile)
  const full = path.resolve(base, spec)
  const candidates = [full, path.join(full, 'index')]
  const exts = ['.ts', '.tsx', '.d.ts', '.js', '.jsx']
  for (const c of candidates) {
    for (const ext of exts) {
      const file = c + ext
      if (fs.existsSync(file)) return rel(file)
    }
  }
  return null
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
  if (ts.isStringLiteral(node)) return node.text
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  return null
}

function selectorsFromHtml(html: string) {
  const result: { selector: string; kind: SelectorKind }[] = []
  const idRegex = /id\s*=\s*"([^"]+)"/g
  const classRegex = /class\s*=\s*"([^"]+)"/g
  let match: RegExpExecArray | null
  while ((match = idRegex.exec(html))) {
    const value = match[1]
    if (value) result.push({ selector: `#${value}`, kind: 'id' })
  }
  while ((match = classRegex.exec(html))) {
    const value = match[1]
    if (value) {
      const classes = value.split(/\s+/).filter(Boolean)
      for (const c of classes) result.push({ selector: `.${c}`, kind: 'class' })
    }
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
const presetSeedPath = path.join(repoRoot, 'config', 'preset-seeds.json')
const presetManifestPath = path.join(repoRoot, 'config', 'presets.generated.json')

function loadPresetSeeds(): PresetSeed[] {
  if (!fs.existsSync(presetSeedPath)) return []
  const raw = fs.readFileSync(presetSeedPath, 'utf8')
  const parsed = JSON.parse(raw) as PresetSeed[]
  return parsed.slice().sort((a, b) => a.slug.localeCompare(b.slug))
}

function computeGraphHash(seeds: PresetSeed[], funcs: FunctionInfo[]) {
  const hash = crypto.createHash('sha256')
  hash.update(JSON.stringify(seeds))
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

function collectImportGraph(program: ts.Program, include?: string[]) {
  const graph: ImportGraph = {}
  for (const sf of program.getSourceFiles()) {
    if (!isProjectSource(sf)) continue
    const file = rel(sf.fileName)
    if (include && include.length && !include.some(p => file.includes(p))) {
      graph[file] = []
      continue
    }
    const deps = new Set<string>()
    sf.forEachChild(node => {
      if (ts.isImportDeclaration(node)) {
        const text = node.moduleSpecifier.getText(sf).slice(1, -1)
        const resolved = resolveImport(sf.fileName, text)
        if (resolved) deps.add(resolved)
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
  const base = kind === 'network' || kind === 'filesystem'
    ? { kind, detail, cost: 'High' as const, blast: 'High' as const, concurrency: 'Medium' as const }
    : (kind === 'state-write' || kind === 'dom'
        ? { kind, detail, cost: 'Medium' as const, blast: 'Medium' as const, concurrency: 'Medium' as const }
        : { kind, detail, cost: 'Low' as const, blast: 'Low' as const, concurrency: 'Low' as const })
  return loc ? { ...base, loc } : base
}

type ImportAlias = { local: string; source: string; export: string }

function collectAliases(sf: ts.SourceFile): ImportAlias[] {
  const aliases: ImportAlias[] = []
  sf.forEachChild(node => {
    if (ts.isImportDeclaration(node) && node.importClause) {
      const mod = node.moduleSpecifier.getText(sf).slice(1, -1)
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
  return aliases
}

function stripNonNull(expr: ts.Expression): ts.Expression {
  if (ts.isNonNullExpression(expr)) return stripNonNull(expr.expression)
  return expr
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

function gatherFile(sf: ts.SourceFile, functionIndex: Map<string, string>): FileData {
  const file = rel(sf.fileName)
  const locals = new Map<string, string>()
  const nodes: NodeInfo[] = []
  const instanceTypes = new Map<string, { source: string; className: string }>()
  const aliases = collectAliases(sf)
  const classNames = new Set<string>()
  sf.forEachChild(node => {
    if (ts.isClassDeclaration(node) && node.name) {
      classNames.add(node.name.getText(sf))
    }
  })

  const addFunc = (name: string, node: ts.FunctionLikeDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression, kind: FunctionInfo['kind'], exported: boolean, className?: string, registerLocal = true) => {
    const id = functionId(file, name, node.pos)
    if (registerLocal) locals.set(name, id)
    functionIndex.set(`${file}::${name}`, id)
    const info: NodeInfo = { name, id, node, kind, exported }
    if (className) info.className = className
    nodes.push(info)
    functionNodeById.set(id, { sf, node, file })
    return id
  }

  sf.forEachChild(node => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      const exported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
      addFunc(node.name.getText(sf), node, 'function', exported)
    } else if (ts.isVariableStatement(node)) {
      const exported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue
        if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
          addFunc(decl.name.getText(sf), decl.initializer, 'arrow', exported)
        } else if (ts.isNewExpression(decl.initializer)) {
          const classExpr = stripNonNull(decl.initializer.expression)
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
          addFunc(`${cname}.${member.name.getText(sf)}`, member, 'method', false, cname)
        } else if (ts.isConstructorDeclaration(member)) {
          addFunc(`${cname}.constructor`, member, 'function', false, cname)
        }
      }
    }
  })

  return { sf, file, nodes, locals, instanceTypes }
}

function collectFunctions(program: ts.Program, include?: string[]) {
  const functionIndex = new Map<string, string>()
  const fileData: FileData[] = []

  for (const sf of program.getSourceFiles()) {
    if (!isProjectSource(sf)) continue
    const file = rel(sf.fileName)
    if (include && include.length && !include.some(p => file.includes(p))) {
      continue
    }
    fileData.push(gatherFile(sf, functionIndex))
  }

  const funcs: FunctionInfo[] = []
  const edges: CallEdge[] = []
  const assumptions: Assumption[] = []

  for (const data of fileData) {
    analyzeFile(data, functionIndex, funcs, edges, assumptions)
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

function analyzeFile(data: FileData, functionIndex: Map<string, string>, funcs: FunctionInfo[], edges: CallEdge[], assumptions: Assumption[]) {
  const { sf, file, nodes, locals, instanceTypes } = data
  const aliases = collectAliases(sf)
  const classFieldInstances = new Map<string, Map<string, { source: string; className: string }>>()
  let anonCounter = 0

  const resolveIdentifier = (name: string): string | null => {
    if (locals.has(name)) return locals.get(name)!
    const alias = aliases.find(a => a.local === name)
    if (alias) {
      const key = `${alias.source}::${alias.export}`
      return functionIndex.get(key) ?? key
    }
    const key = `${file}::${name}`
    return functionIndex.get(key) ?? null
  }

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

    const recordEdge = (to: string, via: string, loc: Location) => {
      calls.push(to)
      const toStable = functionStableIdById.get(to)
      const edgeRecord: CallEdge = { from: currentId, to, via, loc, fromStable: currentStableId }
      if (toStable) edgeRecord.toStable = toStable
      edges.push(edgeRecord)
    }

    const addAnonFunc = (node: ts.ArrowFunction | ts.FunctionExpression): string => {
      const anonName = `${fn.name}__anon${++anonCounter}`
      const kind: FunctionInfo['kind'] = ts.isArrowFunction(node) ? 'arrow' : 'function'
      const id = functionId(file, anonName, node.pos)
      functionIndex.set(`${file}::${anonName}`, id)
      const info: NodeInfo = { name: anonName, id, node, kind, exported: false }
      if (className) info.className = className
      nodes.push(info)
      functionNodeById.set(id, { sf, node, file })
      return id
    }

    const resolveInstanceTarget = (source: string, className: string, prop: string) => {
      const key = `${source}::${className}.${prop}`
      return functionIndex.get(key) ?? key
    }

    const visit = (node: ts.Node) => {
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
        const expr = node.expression
        if (ts.isIdentifier(expr)) {
          const target = resolveIdentifier(expr.getText(sf))
          if (target) {
            recordEdge(target, expr.getText(sf), getLoc(sf, node))
          } else {
            const stmt = `Invocation of global or external function '${expr.getText(sf)}' in ${file}`
            assumptions.push({
              statement: stmt,
              rationale: 'Call target cannot be statically linked to project source; ensure external dependency is safe.',
              impact: 'Medium',
              verification: 'Review external API usage and ensure expected behavior.',
              loc: getLoc(sf, node)
            })
          }
          if (expr.getText(sf) === 'fetch' || expr.getText(sf) === 'axios') {
            sideEffects.push(mkSideEffect('network', expr.getText(sf), getLoc(sf, node)))
          }
          if (expr.getText(sf) === 'setTimeout' || expr.getText(sf) === 'setInterval') {
            sideEffects.push(mkSideEffect('timer', expr.getText(sf), getLoc(sf, node)))
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
          const rawRecv = stripNonNull(expr.expression)
          const prop = expr.name.getText(sf)
          const recvText = rawRecv.getText(sf)

          if (ts.isIdentifier(rawRecv)) {
            const instance = instanceTypes.get(rawRecv.getText(sf))
            if (instance) {
              const target = resolveInstanceTarget(instance.source, instance.className, prop)
              recordEdge(target, `${recvText}.${prop}`, getLoc(sf, node))
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
              const target = resolveInstanceTarget(info.source, info.className, prop)
              recordEdge(target, `${recvText}.${prop}`, getLoc(sf, node))
            }
          }

          if (recvText === 'fs') sideEffects.push(mkSideEffect('filesystem', `fs.${prop}`, getLoc(sf, node)))
          if (recvText === 'document' || recvText === 'window') sideEffects.push(mkSideEffect('dom', `${recvText}.${prop}`, getLoc(sf, node)))
          if (recvText === 'localStorage' || recvText === 'sessionStorage') sideEffects.push(mkSideEffect('state-write', `${recvText}.${prop}`, getLoc(sf, node)))
        }
        if (ts.isElementAccessExpression(expr)) {
          const rawRecv = stripNonNull(expr.expression)
          const arg = expr.argumentExpression
          const prop = arg && ts.isStringLiteral(arg) ? arg.text : '[computed]'
          const recvText = rawRecv.getText(sf)
          if (ts.isIdentifier(rawRecv)) {
            const instance = instanceTypes.get(rawRecv.getText(sf))
            if (instance) {
              const target = resolveInstanceTarget(instance.source, instance.className, prop)
              recordEdge(target, `${recvText}[${prop}]`, getLoc(sf, node))
            }
          }
        }

        node.arguments.forEach(arg => {
          const stripped = stripNonNull(arg as ts.Expression)
          if (ts.isIdentifier(stripped)) {
          const cbTarget = resolveIdentifier(stripped.getText(sf))
            if (cbTarget) {
              recordEdge(cbTarget, `arg:${stripped.getText(sf)}`, getLoc(sf, stripped))
            }
          } else if (ts.isArrowFunction(stripped) || ts.isFunctionExpression(stripped)) {
            const anonId = addAnonFunc(stripped)
            recordEdge(anonId, 'cb:inline', getLoc(sf, stripped))
          }
        })
      }

      if (ts.isBinaryExpression(node) && ['=', '+=', '-=', '*=', '/=', '%='].includes(ts.tokenToString(node.operatorToken.kind) || '')) {
        const left = node.left
        if (ts.isIdentifier(left) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isNewExpression(node.right)) {
          const classExpr = stripNonNull(node.right.expression)
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
          const classExpr = stripNonNull(node.right.expression)
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
          const text = left.getText(sf)
          if (!text.startsWith('this.')) {
            sideEffects.push(mkSideEffect('state-write', text, getLoc(sf, left)))
          }
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
  const cand = funcs.find(f => `${f.file}::${f.name}`.startsWith(entryFuzzy))
  if (!cand) return null
  const start = cand.id
  const adj = buildAdjacency(edges)
  const seen = new Set<string>()
  const keptEdges: CallEdge[] = []
  const keptFuncs = new Set<string>([start])
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
        keptEdges.push({ ...edge })
        keptFuncs.add(to)
        q.push({ node: to, depth: depth + 1 })
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
  const fullImportGraph = collectImportGraph(program, undefined)
  const { funcs: fullFuncs, edges: fullEdges, assumptions: fullAssumptions } = collectFunctions(program, undefined)

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

  const importGraph = opts.include && opts.include.length ? collectImportGraph(program, opts.include) : fullImportGraph
  const { fanIn, fanOut } = computeFanMaps(importGraph)
  const { funcs, edges, assumptions } = opts.include && opts.include.length
    ? collectFunctions(program, opts.include)
    : { funcs: fullFuncs, edges: fullEdges, assumptions: fullAssumptions }
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
