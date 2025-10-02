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

function resolveArticleFilePath(doc: P5Node, article: P5Node): string {
  const articleId = attr(article, 'id') || ''
  if (!articleId) return ''
  const sectionId = articleId.replace(/-h\d+$/, '')
  if (!sectionId || sectionId === articleId) return ''
  const fileSection = findNodeByTagAndId(doc, 'section', sectionId)
  if (!fileSection) return ''
  const header = findChildBySelector(fileSection, 'header', 'file-header')
  const h2 = header ? findChildBySelector(header, 'h2') : null
  return h2 ? textContent(h2).trim() : ''
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function cleanReviewNoteText(node: P5Node): string {
  let raw = textContent(node).replace(/\r/g, '')
  const heading = findChildBySelector(node, 'h4')
  if (heading) {
    const headingText = textContent(heading).replace(/\r/g, '').trim()
    if (headingText.length > 0) {
      const pattern = new RegExp(`^${escapeRegExp(headingText)}\s*`, 'i')
      raw = raw.replace(pattern, '')
    }
  }
  const lines = raw.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  return lines.join('\n').trim()
}

function isPlaceholderNote(text: string): boolean {
  const normalized = text.toLowerCase().trim()
  if (!normalized) return true
  const placeholder = 'review pending – document findings here during rci.'
  return normalized === placeholder || normalized.includes(placeholder)
}

type ReviewNoteStatus = 'fail' | 'pass' | 'neutral'

function normalizeVerdictToken(token: string): string {
  return token.replace(/^[^A-Za-z0-9]+/, '').replace(/[^A-Za-z0-9]+$/, '').toUpperCase()
}

function findLeadingVerdictToken(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const tokens = trimmed.split(/\s+/)
  for (const rawToken of tokens) {
    const normalized = normalizeVerdictToken(rawToken)
    if (!normalized) continue
    if (normalized === 'VERDICT') continue
    return normalized
  }
  return ''
}

function classifyReviewNoteStatus(noteNode: P5Node, noteText: string): ReviewNoteStatus {
  const token = findLeadingVerdictToken(noteText)
  if (token === 'FAIL') return 'fail'
  if (token === 'PASS') return 'pass'
  const classAttr = attr(noteNode, 'class') || ''
  const classTokens = classAttr.split(/\s+/)
  if (classTokens.includes('is-fail')) return 'fail'
  if (classTokens.includes('is-pass')) return 'pass'
  return 'neutral'
}

function extractVerdictLines(section: P5Node): string[] {
  const lines: string[] = []
  const content = findChildBySelector(section, 'div', 'verdict-content') || section
  const visit = (node: P5Node) => {
    if (!node || typeof node !== 'object') return
    if (node.tagName === 'p') {
      const value = textContent(node).trim()
      if (value) lines.push(value)
      return
    }
    if (node.tagName === 'li') {
      const value = textContent(node).trim()
      if (value) lines.push(`- ${value}`)
      return
    }
    if (node.tagName === 'pre') {
      const value = textContent(node).replace(/\r/g, '').trim()
      if (value) lines.push(value)
      return
    }
    if (node.tagName === 'strong') {
      const value = textContent(node).trim()
      if (value) lines.push(value)
      return
    }
    const children = node.childNodes || []
    for (const child of children) visit(child)
  }
  const children = content.childNodes || []
  for (const child of children) visit(child)
  return lines
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
  try { raw = readFileSync(path, 'utf8') } catch { stderr(`Artifact not found: ${path}. Verify the file name (including version suffix) and ensure the artifact was generated.\n`); process.exit(1) }
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
  try { raw = readFileSync(path, 'utf8') } catch { stderr(`Artifact not found: ${path}. Verify the file name (including version suffix) and ensure the artifact was generated.\n`); process.exit(1) }
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
  const filePathLabel = resolveArticleFilePath(doc, article)
  const pre = (article.childNodes || []).find((n: P5Node) => n.tagName === 'pre')
  const code = pre ? findChildBySelector(pre, 'code') : null
  const diff = code ? textContent(code) : ''
  if (label) stdout(`${label}\n`)
  if (filePathLabel) stdout(`${filePathLabel}\n`)
  if (diff) stdout(`${diff}\n`)
}

function cmdResult(fileArg: string) {
  if (!fileArg) {
    stderr('Missing required --file <artifact>\n')
    process.exit(1)
  }
  const path = resolveArtifactPath(fileArg)
  let raw: string
  try { raw = readFileSync(path, 'utf8') } catch { stderr(`Artifact not found: ${path}. Verify the file name (including version suffix) and ensure the artifact was generated.\n`); process.exit(1) }
  const doc = parse5.parse(raw)
  const entries = findAllArticlesWithUuid(doc)
  let hasRealNotes = false
  const failSections: string[] = []
  const neutralSections: string[] = []
  entries.forEach((entry, idx) => {
    const article = entry.article
    const notes = (article.childNodes || []).find((n: P5Node) => n.tagName === 'div' && hasClass(n, 'review-notes'))
    if (!notes) return
    const noteText = cleanReviewNoteText(notes)
    if (!noteText || isPlaceholderNote(noteText)) return
    hasRealNotes = true
    const status = classifyReviewNoteStatus(notes, noteText)
    stderr(`[REVIEW_FILTER] classified ${status.toUpperCase()} for ${entry.uuid}\n`)
    if (status === 'pass') return
    const header = findChildBySelector(article, 'header', 'hunk-header')
    const h3 = header ? findChildBySelector(header, 'h3') : null
    const label = h3 ? textContent(h3).trim() : `Block ${idx + 1}`
    const filePathLabel = resolveArticleFilePath(doc, article)
    const statusLabel = status === 'fail' ? 'FAIL' : 'NEUTRAL'
    const sections: string[] = []
    sections.push(`${label} — ${filePathLabel || 'Unknown file'} (UUID ${entry.uuid})`)
    sections.push(`Status: ${statusLabel}`)
    sections.push('Review Note:')
    sections.push(noteText)
    const pre = (article.childNodes || []).find((n: P5Node) => n.tagName === 'pre')
    const code = pre ? findChildBySelector(pre, 'code') : null
    const diff = code ? textContent(code) : ''
    if (diff) {
      sections.push('\nDiff:')
      sections.push(diff)
    }
    if (status === 'fail') {
      failSections.push(sections.join('\n'))
    } else {
      neutralSections.push(sections.join('\n'))
    }
  })
  if (!hasRealNotes) {
    stderr(`No review notes found in ${fileArg}. Add remarks first.\n`)
    process.exit(1)
  }
  const verdictSection = findSectionByClass(doc, 'section', 'verdict')
  const verdictLines = verdictSection ? extractVerdictLines(verdictSection) : []
  const verdictContentNode = verdictSection ? findChildBySelector(verdictSection, 'div', 'verdict-content') : null
  let verdictOutput = ''
  if (verdictLines.length) {
    verdictOutput = verdictLines.join('\n')
  } else if (!verdictContentNode && verdictSection) {
    verdictOutput = textContent(verdictSection).trim()
  }
  const totalCollected = failSections.length + neutralSections.length
  if (!totalCollected) {
    if (verdictOutput) {
      stderr('[REVIEW_FILTER] emitting verdict only\n')
      stdout('=== VERDICT ===\n')
      stdout(verdictOutput + '\n')
    } else {
      stdout('No failing or neutral review hunks found.\n')
    }
    return
  }
  stderr(`[REVIEW_FILTER] emitting ${totalCollected} hunks\n`)
  const separator = '\n' + '='.repeat(30) + '\n'
  stdout('=== FAILED / NEUTRAL HUNKS ===\n')
  const ordered = [...failSections, ...neutralSections]
  stdout(ordered.join(separator) + '\n')
  if (verdictOutput) {
    stdout('\n=== VERDICT ===\n')
    stdout(verdictOutput + '\n')
  }
}


function cmdRemark(fileArg: string, uuid: string, bodyArg: string) {
  if (!fileArg) { stderr('Missing required --file <artifact>\n'); process.exit(1) }
  if (!uuid) { stderr('Missing required --uuid <id>\n'); process.exit(1) }
  const path = resolveArtifactPath(fileArg)
  let raw: string
  try { raw = readFileSync(path, 'utf8') } catch { stderr(`Artifact not found: ${path}. Verify the file name (including version suffix) and ensure the artifact was generated.\n`); process.exit(1) }
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
  ensureReviewNoteStyles(doc)
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
  // Color coding based on PASS/FAIL keywords
  const plain = (body || '').replace(/<[^>]*>/g, ' ')
  let noteClass = 'review-notes'
  const hasFailN = /\bfail\b/i.test(plain)
  const hasPassN = /\bpass\b/i.test(plain)
  if (hasFailN && !hasPassN) noteClass += ' is-fail'
  else if (hasPassN && !hasFailN) noteClass += ' is-pass'
  setAttr(notes, 'class', noteClass)
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
  ensureVerdictStyles(doc)
  const verdictHtml = ensureVerdictBody(verdictBody)
  const plain = verdictBody.replace(/<[^>]*>/g, ' ')
  const hasFail = /\bFAIL\b/i.test(plain)
  const hasPass = /\bPASS\b/i.test(plain)
  let verdictClass = ''
  if (hasFail && !hasPass) verdictClass = ' is-fail'
  else if (hasPass && !hasFail) verdictClass = ' is-pass'
  const bodyNode = findSectionByTag(doc, 'body')
  const prIdx = findChildIndexByClass(bodyNode, 'section', 'pr-request')
  const verdictIdxExisting = findChildIndexByClass(bodyNode, 'section', 'verdict')
  if (verdictIdxExisting >= 0) {
    bodyNode.childNodes.splice(verdictIdxExisting, 1)
  }
  const fragment = parse5.parseFragment(`<section class="pr-request verdict${verdictClass}"><h2>VERDICT</h2><div class="verdict-content">${verdictHtml}</div></section>`) as P5Node
  const newSection = (fragment.childNodes || []).find((n: P5Node) => n.tagName === 'section')
  if (newSection) {
    const insertAt = prIdx >= 0 ? prIdx + 1 : (bodyNode.childNodes || []).length
    bodyNode.childNodes.splice(insertAt, 0, newSection)
    const updated = parse5.serialize(doc)
    writeFileSync(path, updated, 'utf8')
  }
}

function findHead(doc: P5Node): P5Node | null {
  let result: P5Node | null = null
  const visit = (n: P5Node) => {
    if (result) return
    if (n && n.tagName === 'head') { result = n; return }
    const kids = n && n.childNodes ? n.childNodes : []
    for (const k of kids) visit(k)
  }
  visit(doc)
  return result
}

function styleContains(node: P5Node, snippet: string): boolean {
  if (!node || node.tagName !== 'style') return false
  const kids = node.childNodes || []
  for (const k of kids) {
    if (k.nodeName === '#text' && typeof k.value === 'string' && k.value.includes(snippet)) return true
  }
  return false
}

function ensureVerdictStyles(doc: P5Node) {
  const head = findHead(doc)
  if (!head) return
  const hasBase = (head.childNodes || []).some((n: P5Node) => styleContains(n, 'section.pr-request.verdict{'))
  const hasVariants = (head.childNodes || []).some((n: P5Node) => styleContains(n, 'verdict.is-pass'))
  const hasNeutral = (head.childNodes || []).some((n: P5Node) => styleContains(n, 'verdict:not(.is-pass):not(.is-fail)'))
  if (!hasBase) {
    const baseCss = `section.pr-request.verdict{border-left:4px solid #94a3b8;background:#fff;box-shadow:0 10px 24px rgba(15,23,42,0.08);transition:box-shadow 200ms ease, transform 200ms ease}section.pr-request.verdict:hover{box-shadow:0 14px 32px rgba(15,23,42,0.12);transform:translateY(-1px)}section.pr-request.verdict h2{margin:0 0 12px;color:#334155}section.pr-request.verdict .verdict-content{display:block;font-size:14px;line-height:1.6;color:#475569}`
    const frag = parse5.parseFragment(`<style>${baseCss}</style>`) as P5Node
    const styleNode = (frag.childNodes || []).find((n: P5Node) => n.tagName === 'style')
    if (styleNode) {
      if (!head.childNodes) head.childNodes = []
      head.childNodes.push(styleNode)
    }
  }
  if (!hasVariants) {
    const variantsCss = `section.pr-request.verdict.is-pass{border-left-color:#10b981;background:#ecfdf5;box-shadow:0 10px 24px rgba(16,185,129,0.15)}section.pr-request.verdict.is-pass:hover{box-shadow:0 14px 32px rgba(16,185,129,0.22)}section.pr-request.verdict.is-pass h2{color:#065f46}section.pr-request.verdict.is-pass .verdict-content{color:#064e3b}section.pr-request.verdict.is-fail{border-left-color:#ef4444;background:#fef2f2;box-shadow:0 10px 24px rgba(239,68,68,0.15)}section.pr-request.verdict.is-fail:hover{box-shadow:0 14px 32px rgba(239,68,68,0.22)}section.pr-request.verdict.is-fail h2{color:#7f1d1d}section.pr-request.verdict.is-fail .verdict-content{color:#7f1d1d}`
    const frag2 = parse5.parseFragment(`<style>${variantsCss}</style>`) as P5Node
    const node2 = (frag2.childNodes || []).find((n: P5Node) => n.tagName === 'style')
    if (node2) {
      if (!head.childNodes) head.childNodes = []
      head.childNodes.push(node2)
    }
  }
  if (!hasNeutral) {
    const neutralCss = `section.pr-request.verdict:not(.is-pass):not(.is-fail){border-left-color:#94a3b8;background:#fff;box-shadow:0 10px 24px rgba(15,23,42,0.08)}section.pr-request.verdict:not(.is-pass):not(.is-fail) h2{color:#334155}section.pr-request.verdict:not(.is-pass):not(.is-fail) .verdict-content{color:#475569}`
    const frag3 = parse5.parseFragment(`<style>${neutralCss}</style>`) as P5Node
    const node3 = (frag3.childNodes || []).find((n: P5Node) => n.tagName === 'style')
    if (node3) {
      if (!head.childNodes) head.childNodes = []
      head.childNodes.push(node3)
    }
  }
}

function ensureReviewNoteStyles(doc: P5Node) {
  const head = findHead(doc)
  if (!head) return
  const has = (head.childNodes || []).some((n: P5Node) => styleContains(n, '.review-notes.is-pass') || styleContains(n, '.review-notes.is-fail'))
  if (has) return
  const css = `article.hunk .review-notes.is-pass{border-left:4px solid #10b981;background:#ecfdf5;box-shadow:0 8px 18px rgba(16,185,129,0.12)}article.hunk .review-notes.is-pass h4{color:#065f46}article.hunk .review-notes.is-pass p,article.hunk .review-notes.is-pass div{color:#064e3b}article.hunk .review-notes.is-fail{border-left:4px solid #ef4444;background:#fef2f2;box-shadow:0 8px 18px rgba(239,68,68,0.12)}article.hunk .review-notes.is-fail h4{color:#7f1d1d}article.hunk .review-notes.is-fail p,article.hunk .review-notes.is-fail div{color:#7f1d1d}`
  const frag = parse5.parseFragment(`<style>${css}</style>`) as P5Node
  const styleNode = (frag.childNodes || []).find((n: P5Node) => n.tagName === 'style')
  if (styleNode) {
    if (!head.childNodes) head.childNodes = []
    head.childNodes.push(styleNode)
  }
}

function cmdVerdict(fileArg: string, bodyArg: string) {
  if (!fileArg) { stderr('Missing required --file <artifact>\n'); process.exit(1) }
  let body = bodyArg
  if (!body) { stderr('Missing required --body <html|code|->\n'); process.exit(1) }
  const path = resolveArtifactPath(fileArg)
  let raw: string
  try { raw = readFileSync(path, 'utf8') } catch { stderr(`Artifact not found: ${path}. Verify the file name (including version suffix) and ensure the artifact was generated.\n`); process.exit(1) }
  if (body === '-') {
    body = readFileSync(0, 'utf8')
  }
  insertVerdict(path, raw, body)
  stdout(`Updated VERDICT section in ${path}\n`)
}

function main() {
  const argv = process.argv.slice(2)
  if (!argv.length) {
    stderr('Usage: review:edit -- <list-uuid|show-diff|result|remark|verdict> --file <artifact> [--uuid <id>] [--body <text|html|->]\n')
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
  if (sub === 'result') {
    cmdResult(fileArg)
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
