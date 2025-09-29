import { readFileSync, writeFileSync } from 'fs'
import { resolve, isAbsolute } from 'path'
import { spawnSync } from 'child_process'
import * as parse5 from 'parse5'

type P5Node = any

function parseArg(argv: string[], name: string): string {
  const flag = `--${name}`
  const eq = `${flag}=`
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i]
    if (!t) continue
    if (t.startsWith(eq)) return t.slice(eq.length)
    if (t === flag && typeof argv[i+1] === 'string') return argv[i+1] as string
  }
  return ''
}

function getRepoRoot(): string {
  const r = spawnSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' })
  if (r.status !== 0) return process.cwd()
  const dir = r.stdout.trim()
  const base = isAbsolute(dir) ? dir : resolve(process.cwd(), dir)
  return resolve(base, '..')
}

function resolveArtifactPath(input: string): string {
  if (isAbsolute(input)) return input
  if (input.includes('/')) return resolve(process.cwd(), input)
  const root = getRepoRoot()
  return resolve(root, 'code_review', input)
}

function attr(node: P5Node, name: string): string | undefined {
  const a = (node.attrs || []).find((x: any) => x.name === name)
  return a ? a.value : undefined
}

function setAttr(node: P5Node, name: string, value: string) {
  const a = (node.attrs || []).find((x: any) => x.name === name)
  if (a) a.value = value
  else {
    if (!node.attrs) node.attrs = []
    node.attrs.push({ name, value })
  }
}

function hasClass(node: P5Node, cls: string): boolean {
  const c = attr(node, 'class') || ''
  return c.split(/\s+/).includes(cls)
}

function textContent(node: P5Node): string {
  let out = ''
  const visit = (n: P5Node) => {
    if (!n) return
    if (n.nodeName === '#text' && typeof n.value === 'string') {
      out += n.value
    }
    const kids = n.childNodes || []
    for (const k of kids) visit(k)
  }
  visit(node)
  return out
}

function findAllArticlesWithUuid(doc: P5Node): { article: P5Node; uuid: string }[] {
  const found: { article: P5Node; uuid: string }[] = []
  const visit = (n: P5Node) => {
    if (!n || typeof n !== 'object') return
    if (n.tagName === 'article' && hasClass(n, 'hunk')) {
      const idv = attr(n, 'data-uuid')
      if (idv && idv.trim().length > 0) found.push({ article: n, uuid: idv })
    }
    const kids = n.childNodes || []
    for (const k of kids) visit(k)
  }
  visit(doc)
  return found
}

function findChildBySelector(node: P5Node, tag: string, cls?: string): P5Node | null {
  const kids = node.childNodes || []
  for (const k of kids) {
    if (k.tagName === tag && (!cls || hasClass(k, cls))) return k
  }
  return null
}

function findNodeByTagAndId(doc: P5Node, tag: string, id: string): P5Node | null {
  let found: P5Node | null = null
  const visit = (n: P5Node) => {
    if (found) return
    if (n && n.tagName === tag) {
      const v = attr(n, 'id')
      if (v === id) { found = n; return }
    }
    const kids = n && n.childNodes ? n.childNodes : []
    for (const k of kids) visit(k)
  }
  visit(doc)
  return found
}

function getScriptText(node: P5Node): string {
  const parts: string[] = []
  const kids = node && node.childNodes ? node.childNodes : []
  for (const k of kids) {
    if (k.nodeName === '#text' && typeof k.value === 'string') parts.push(k.value)
  }
  return parts.join('')
}

function findSectionByClass(doc: P5Node, tag: string, cls: string): P5Node | null {
  let found: P5Node | null = null
  const visit = (n: P5Node) => {
    if (found) return
    if (n && n.tagName === tag && hasClass(n, cls)) { found = n; return }
    const kids = n && n.childNodes ? n.childNodes : []
    for (const k of kids) visit(k)
  }
  visit(doc)
  return found
}

function extractPrReviewContext(doc: P5Node): { entries?: string[]; text?: string } | null {
  const script = findNodeByTagAndId(doc, 'script', 'pr-request-data')
  if (script) {
    try {
      const raw = getScriptText(script).trim()
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const entries = parsed.map((x: any) => typeof x === 'string' ? x : String(x))
          return { entries }
        }
      }
    } catch {}
  }
  const section = findSectionByClass(doc, 'section', 'pr-request')
  if (section) {
    const t = textContent(section).trim()
    if (t) return { text: t }
  }
  return null
}

function stdout(s: string) { process.stdout.write(s) }
function stderr(s: string) { process.stderr.write(s) }

function ensureBody(body: string): string {
  const trimmed = body.trim()
  if (trimmed.startsWith('<')) return body
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<p>${escaped}</p>`
}

function ensureVerdictBody(body: string): string {
  const trimmed = body.trim()
  if (trimmed.startsWith('<')) return body
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<pre><code>${escaped}</code></pre>`
}

function cmdListUuid(fileArg: string) {
  if (!fileArg) {
    stderr('Missing required --file <artifact>\n')
    process.exit(1)
  }
  const path = resolveArtifactPath(fileArg)
  let raw: string
  try { raw = readFileSync(path, 'utf8') } catch { stderr(`Artifact not found: ${path}\n`); process.exit(1) }
  const doc = parse5.parse(raw)
  const entries = findAllArticlesWithUuid(doc)
  if (entries.length === 0) {
    stderr('Artifact lacks UUIDs. Please regenerate with: npm run review:create\n')
    process.exit(1)
  }
  for (const e of entries) stdout(`${e.uuid}\n`)
  stdout(`\nTo show: npm run review:edit -- show-diff --file ${fileArg} --uuid <uuid>\n`)
  const ctx = extractPrReviewContext(doc)
  if (ctx) {
    stdout(`\nPR Review Context:\n`)
    if (ctx.entries && ctx.entries.length) {
      for (let i = 0; i < ctx.entries.length; i++) {
        const block = ctx.entries[i] ?? ''
        stdout(block)
        if (i !== ctx.entries.length - 1) stdout(`\n\n`)
      }
      stdout(`\n`)
    } else if (ctx.text) {
      stdout(ctx.text + `\n`)
    }
  }
}

function cmdShowDiff(fileArg: string, uuid: string) {
  if (!fileArg) { stderr('Missing required --file <artifact>\n'); process.exit(1) }
  if (!uuid) { stderr('Missing required --uuid <id>\n'); process.exit(1) }
  const path = resolveArtifactPath(fileArg)
  let raw: string
  try { raw = readFileSync(path, 'utf8') } catch { stderr(`Artifact not found: ${path}\n`); process.exit(1) }
  const doc = parse5.parse(raw)
  const entries = findAllArticlesWithUuid(doc)
  if (entries.length === 0) {
    stderr('Artifact lacks UUIDs. Please regenerate with: npm run review:create\n')
    process.exit(1)
  }
  const match = entries.find(e => e.uuid === uuid)
  if (!match) {
    stderr(`Invalid UUID: ${uuid}\n`)
    stderr('Valid UUIDs (top-down):\n')
    for (const e of entries) stderr(`${e.uuid}\n`)
    stderr(`\nExamples:\n`)
    stderr(`  npm run review:edit -- list-uuid --file ${fileArg}\n`)
    stderr(`  npm run review:edit -- show-diff --file ${fileArg} --uuid <uuid>\n`)
    process.exit(1)
  }
  const article = match.article
  const header = findChildBySelector(article, 'header', 'hunk-header')
  const h3 = header ? findChildBySelector(header, 'h3') : null
  const label = h3 ? textContent(h3).trim() : ''
  const summarySpan = header ? (header.childNodes || []).find((n: P5Node) => n.tagName === 'span' && hasClass(n, 'hunk-summary')) : null
  const summary = summarySpan ? textContent(summarySpan).trim() : ''
  const pre = (article.childNodes || []).find((n: P5Node) => n.tagName === 'pre')
  const code = pre ? findChildBySelector(pre, 'code') : null
  const diff = code ? textContent(code) : ''
  if (label) stdout(`${label}\n`)
  if (summary) stdout(`${summary}\n`)
  if (diff) stdout(`${diff}\n`)
}

function cmdRemark(fileArg: string, uuid: string, bodyArg: string) {
  if (!fileArg) { stderr('Missing required --file <artifact>\n'); process.exit(1) }
  if (!uuid) { stderr('Missing required --uuid <id>\n'); process.exit(1) }
  const path = resolveArtifactPath(fileArg)
  let raw: string
  try { raw = readFileSync(path, 'utf8') } catch { stderr(`Artifact not found: ${path}\n`); process.exit(1) }
  let body = bodyArg
  const verdictArg = parseArg(process.argv.slice(2), 'verdict')
  if (verdictArg) {
    stderr('Do not pass --verdict together with --uuid. Use the separate verdict command.\n')
    stderr(`Example: npm run review:edit -- verdict --file ${fileArg} --body "<div><strong>PASS</strong>: Ready</div>"\n`)
    process.exit(1)
  }
  if (body === '-') {
    body = readFileSync(0, 'utf8')
  }
  const doc = parse5.parse(raw)
  const entries = findAllArticlesWithUuid(doc)
  if (entries.length === 0) {
    stderr('Artifact lacks UUIDs. Please regenerate with: npm run review:create\n')
    process.exit(1)
  }
  const match = entries.find(e => e.uuid === uuid)
  if (!match) {
    stderr(`Invalid UUID: ${uuid}\n`)
    stderr('Valid UUIDs (top-down):\n')
    for (const e of entries) stderr(`${e.uuid}\n`)
    stderr(`\nExamples:\n`)
    stderr(`  npm run review:edit -- list-uuid --file ${fileArg}\n`)
    stderr(`  npm run review:edit -- show-diff --file ${fileArg} --uuid <uuid>\n`)
    process.exit(1)
  }
  const article = match.article
  const notes = (article.childNodes || []).find((n: P5Node) => n.tagName === 'div' && hasClass(n, 'review-notes'))
  if (!notes) {
    stderr('Could not locate review-notes section in artifact. Please regenerate with: npm run review:create\n')
    process.exit(1)
  }
  setAttr(notes, 'data-uuid', uuid)
  const contentHtml = ensureBody(body)
  const fragment = parse5.parseFragment(contentHtml)
  const kids = notes.childNodes || []
  const keep: P5Node[] = []
  for (const k of kids) {
    if (k.tagName === 'h4') { keep.push(k); break }
  }
  notes.childNodes = keep
  ;(fragment.childNodes || []).forEach((n: P5Node) => {
    notes.childNodes.push(n)
  })
  const updated = parse5.serialize(doc)
  writeFileSync(path, updated, 'utf8')
  stdout(`Updated remark for UUID ${uuid} in ${path}\n`)
}

function findSectionByTag(doc: P5Node, tag: string): P5Node | null {
  let result: P5Node | null = null
  const visit = (n: P5Node) => {
    if (result) return
    if (n && n.tagName === tag) { result = n; return }
    const kids = n && n.childNodes ? n.childNodes : []
    for (const k of kids) visit(k)
  }
  visit(doc)
  return result
}

function findChildIndexByClass(parent: P5Node, tag: string, cls: string): number {
  if (!parent || !parent.childNodes) return -1
  for (let i = 0; i < parent.childNodes.length; i++) {
    const n = parent.childNodes[i]
    if (n && n.tagName === tag && hasClass(n, cls)) return i
  }
  return -1
}

function insertVerdict(path: string, raw: string, verdictBody: string) {
  const doc = parse5.parse(raw)
  const verdictHtml = ensureVerdictBody(verdictBody)
  const bodyNode = findSectionByTag(doc, 'body')
  const prIdx = findChildIndexByClass(bodyNode, 'section', 'pr-request')
  const verdictIdxExisting = findChildIndexByClass(bodyNode, 'section', 'verdict')
  if (verdictIdxExisting >= 0) {
    bodyNode.childNodes.splice(verdictIdxExisting, 1)
  }
  const fragment = parse5.parseFragment(`<section class="verdict"><h2>VERDICT</h2>${verdictHtml}</section>`) as P5Node
  const newSection = (fragment.childNodes || []).find((n: P5Node) => n.tagName === 'section')
  if (newSection) {
    const insertAt = prIdx >= 0 ? prIdx + 1 : (bodyNode.childNodes || []).length
    bodyNode.childNodes.splice(insertAt, 0, newSection)
    const updated = parse5.serialize(doc)
    writeFileSync(path, updated, 'utf8')
  }
}

function cmdVerdict(fileArg: string, bodyArg: string) {
  if (!fileArg) { stderr('Missing required --file <artifact>\n'); process.exit(1) }
  let body = bodyArg
  if (!body) { stderr('Missing required --body <html|code|->\n'); process.exit(1) }
  const path = resolveArtifactPath(fileArg)
  let raw: string
  try { raw = readFileSync(path, 'utf8') } catch { stderr(`Artifact not found: ${path}\n`); process.exit(1) }
  if (body === '-') {
    body = readFileSync(0, 'utf8')
  }
  insertVerdict(path, raw, body)
  stdout(`Updated VERDICT section in ${path}\n`)
}

function main() {
  const argv = process.argv.slice(2)
  if (!argv.length) {
    stderr('Usage: review:edit -- <list-uuid|show-diff|remark|verdict> --file <artifact> [--uuid <id>] [--body <text|html|->]\n')
    process.exit(1)
  }
  const sub = argv[0]
  const fileArg = parseArg(argv, 'file')
  if (sub === 'list-uuid') {
    cmdListUuid(fileArg)
    return
  }
  if (sub === 'show-diff') {
    const uuid = parseArg(argv, 'uuid')
    cmdShowDiff(fileArg, uuid)
    return
  }
  if (sub === 'remark') {
    const uuid = parseArg(argv, 'uuid')
    let body = parseArg(argv, 'body')
    if (!body) { stderr('Missing required --body <text|<div>…|->\n'); process.exit(1) }
    cmdRemark(fileArg, uuid, body)
    return
  }
  if (sub === 'verdict') {
    let body = parseArg(argv, 'body')
    if (!body) { stderr('Missing required --body <html|code|->\n'); process.exit(1) }
    cmdVerdict(fileArg, body)
    return
  }
  stderr(`Unknown subcommand: ${sub}\n`)
  process.exit(1)
}

main()
