import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { spawnSync } from 'child_process';

type DiffMode = 'staged' | 'working';

type DiffHunk = {
  header: string;
  lines: string[];
  additions: number;
  deletions: number;
};

type ParsedDiff = {
  meta: string[];
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
};

type HunkSummary = {
  id: string;
  label: string;
  additions: number;
  deletions: number;
};

type FileSection = {
  path: string;
  id: string;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  summaries: HunkSummary[];
  meta: string[];
};

function parseArgument(argv: string[], name: string): string {
  const flag = `--${name}`;
  const prefix = `${flag}=`;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token) {
      continue;
    }
    if (token.startsWith(prefix)) {
      return token.slice(prefix.length);
    }
    if (token === flag && i + 1 < argv.length) {
      const value = argv[i + 1];
      if (typeof value === 'string') {
        return value;
      }
    }
  }
  return '';
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function countSentences(text: string): number {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) {
    return 0;
  }
  const matches = normalized.match(/[^.?!]+[.?!]/g);
  if (matches && matches.length > 0) {
    return matches.length;
  }
  return 0;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function computeTargetFilename(directory: string, slug: string): { filename: string; finalSlug: string; previousFilename?: string } {
  const baseFilename = `review_${slug}.html`;
  const entries = readdirSync(directory);
  const baseExists = existsSync(resolve(directory, baseFilename));
  let versionsFound = false;
  let highestVersion = 1;
  let latestFilename: string | undefined = baseExists ? baseFilename : undefined;
  const pattern = new RegExp(`^review_${slug}_v(\\d+)\\.html$`);

  for (const name of entries) {
    const match = name.match(pattern);
    if (match) {
      versionsFound = true;
      const group = match[1];
      if (group) {
        const value = parseInt(group, 10);
        if (!Number.isNaN(value) && value > highestVersion) {
          highestVersion = value;
        }
      }
    }
  }

  if (!baseExists && !versionsFound) {
    return { filename: baseFilename, finalSlug: slug };
  }

  const nextVersion = versionsFound ? highestVersion + 1 : 2;
  const finalSlug = `${slug}_v${nextVersion}`;
  const filename = `review_${finalSlug}.html`;
  const previousFilename = versionsFound
    ? `review_${slug}_v${highestVersion}.html`
    : baseFilename;
  return { filename, finalSlug, previousFilename };
}

function loadPreviousPrRequests(directory: string, filename?: string): string[] {
  if (!filename) {
    return [];
  }
  const target = resolve(directory, filename);
  if (!existsSync(target)) {
    return [];
  }
  try {
    const content = readFileSync(target, 'utf8');
    const scriptMatch = content.match(/<script type="application\/json" id="pr-request-data">([\s\S]*?)<\/script>/);
    if (scriptMatch && scriptMatch[1]) {
      const jsonRaw = scriptMatch[1].trim();
      if (jsonRaw.length > 0) {
        const parsed = JSON.parse(jsonRaw);
        if (Array.isArray(parsed)) {
          return parsed.map(item => (typeof item === 'string' ? item : String(item))).filter(text => text.trim().length > 0);
        }
      }
    }
    const sectionMatch = content.match(/<section class="pr-request">([\s\S]*?)<\/section>/);
    if (!sectionMatch || typeof sectionMatch[1] !== 'string') {
      return [];
    }
    const body = sectionMatch[1];
    const items: string[] = [];
    const liMatches = body.match(/<li>([\s\S]*?)<\/li>/g);
    if (liMatches) {
      for (const li of liMatches) {
        const cleaned = stripHtml(li);
        if (cleaned.length > 0) {
          items.push(cleaned);
        }
      }
    } else {
      const pMatches = body.match(/<p>([\s\S]*?)<\/p>/g);
      if (pMatches) {
        for (const p of pMatches) {
          const cleaned = stripHtml(p);
          if (cleaned.length > 0) {
            items.push(cleaned);
          }
        }
      }
    }
    return items;
  } catch (error) {
    return [];
  }
}

function buildPrRequestMarkup(entries: string[]): { html: string; script: string } {
  if (entries.length === 0) {
    return { html: '', script: '' };
  }
  let body: string;
  if (entries.length === 1) {
    body = `<p>${escapeHtml(entries[0] ?? '')}</p>`;
  } else {
    body = `<ol>${entries.map(entry => `<li>${escapeHtml(entry)}</li>`).join('')}</ol>`;
  }
  const html = `<section class="pr-request"><h2>PR Review Context</h2>${body}</section>`;
  const script = `<script type="application/json" id="pr-request-data">${JSON.stringify(entries)}</script>`;
  return { html, script };
}

function timestamp(): string {
  const now = new Date();
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function runGit(args: string[]): string {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    const message = result.stderr ? result.stderr.toString() : 'git command failed';
    throw new Error(message);
  }
  return result.stdout;
}

function listChangedFiles(): { files: string[]; mode: DiffMode } {
  const staged = runGit(['diff', '--cached', '--name-only']).split('\n').map(line => line.trim()).filter(Boolean);
  if (staged.length > 0) {
    return { files: staged, mode: 'staged' };
  }
  const working = runGit(['diff', '--name-only']).split('\n').map(line => line.trim()).filter(Boolean);
  return { files: working, mode: 'working' };
}

function fileDiff(path: string, mode: DiffMode): string {
  const args = ['diff'];
  if (mode === 'staged') {
    args.push('--cached');
  }
  args.push('--', path);
  return runGit(args);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseDiff(content: string): ParsedDiff {
  const lines = content.split('\n');
  const meta: string[] = [];
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  let totalAdd = 0;
  let totalDel = 0;

  const flush = () => {
    if (!current) {
      return;
    }
    hunks.push(current);
    totalAdd += current.additions;
    totalDel += current.deletions;
    current = null;
  };

  for (const line of lines) {
    if (line.startsWith('@@')) {
      flush();
      current = {
        header: line,
        lines: [line],
        additions: 0,
        deletions: 0,
      };
      continue;
    }
    if (!current) {
      if (line.trim().length > 0) {
        meta.push(line);
      }
      continue;
    }
    current.lines.push(line);
    if (line.startsWith('+') && !line.startsWith('+++')) {
      current.additions += 1;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      current.deletions += 1;
    }
  }

  flush();

  if (hunks.length === 0 && content.trim().length > 0) {
    const additions = lines.filter(line => line.startsWith('+') && !line.startsWith('+++')).length;
    const deletions = lines.filter(line => line.startsWith('-') && !line.startsWith('---')).length;
    hunks.push({ header: '(entire diff)', lines, additions, deletions });
    totalAdd = additions;
    totalDel = deletions;
  }

  return { meta, hunks, additions: totalAdd, deletions: totalDel };
}

function sectionIdForPath(path: string, registry: Map<string, number>): string {
  const baseRaw = path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  const base = baseRaw.length > 0 ? baseRaw : 'file';
  const count = registry.get(base) ?? 0;
  registry.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function buildChecklist(sections: FileSection[]): { html: string; text: string } {
  if (sections.length === 0) {
    return { html: '', text: '' };
  }
  const htmlParts: string[] = ['<section class="checklist"><h2>Review Checklist</h2><ol>'];
  const textParts: string[] = [];
  sections.forEach((section, index) => {
    htmlParts.push(`<li><div class="checklist-file"><span class="checklist-file-name">${escapeHtml(section.path)}</span><span class="checklist-file-counts">+${section.additions} / -${section.deletions}</span></div>`);
    textParts.push(`${index + 1}. ${section.path}`);
    if (section.summaries.length > 0) {
      htmlParts.push('<ul>');
      section.summaries.forEach(summary => {
        htmlParts.push(`<li><a href="#${escapeHtml(summary.id)}">${escapeHtml(summary.label)}</a><span class="checklist-hunk-counts">+${summary.additions} / -${summary.deletions}</span></li>`);
        textParts.push(`   - ${summary.label} -> ${summary.id} (+${summary.additions} / -${summary.deletions})`);
      });
      htmlParts.push('</ul>');
    } else {
      htmlParts.push('<ul><li>No discrete change blocks detected.</li></ul>');
      textParts.push('   - No discrete change blocks detected');
    }
    htmlParts.push('</li>');
  });
  htmlParts.push('</ol></section>');
  return { html: htmlParts.join(''), text: textParts.join('\n') };
}

function buildFileSection(section: FileSection): string {
  const header = `<header class="file-header"><h2>${escapeHtml(section.path)}</h2><div class="file-stats"><span class="file-additions">+${section.additions}</span><span class="file-deletions">-${section.deletions}</span></div></header>`;
  const hunkIndex = section.summaries.length > 0
    ? `<div class="hunk-index"><h3>Block Index</h3><ol>${section.summaries.map(summary => `<li><a href="#${escapeHtml(summary.id)}">${escapeHtml(summary.label)}</a><span class="hunk-counts">+${summary.additions} / -${summary.deletions}</span></li>`).join('')}</ol></div>`
    : '';
  const metaLines = section.meta ?? [];
  const articles = section.hunks.map((hunk, idx) => {
    const summary = section.summaries[idx];
    const hunkId = summary ? summary.id : `${section.id}-h${idx + 1}`;
    const label = summary ? summary.label : `Change Block ${idx + 1}`;
    const diffText = idx === 0 && metaLines.length > 0
      ? `${metaLines.join('\n')}\n${hunk.lines.join('\n')}`
      : hunk.lines.join('\n');
    const notes = '<li>Review pending – document findings here during RCI.</li>';
    return `<article id="${escapeHtml(hunkId)}" class="hunk"><header class="hunk-header"><h3>${escapeHtml(label)}</h3><span class="hunk-summary">${escapeHtml(hunk.header)}</span><span class="hunk-diff-counts">+${hunk.additions} / -${hunk.deletions}</span></header><pre><code>${escapeHtml(diffText)}</code></pre><div class="review-notes"><h4>Review Notes</h4><ul>${notes}</ul></div><div class="hunk-nav"><a href="#${escapeHtml(section.id)}">Back to file</a><span>•</span><a href="#top">Back to top</a></div></article>`;
  }).join('');
  return `<section id="${escapeHtml(section.id)}" class="file-section">${header}${hunkIndex}${articles}</section>`;
}

function buildNoDiffDocument(featureSlug: string, generatedAt: string, path: string, prMarkup: { html: string; script: string }): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Code Review - ${escapeHtml(featureSlug)} - ${generatedAt}</title><style>body{font-family:Arial,Helvetica,sans-serif;margin:32px;color:#1f2933;background:#f8fafc;}h1{margin-bottom:16px;}p{margin-bottom:12px;}section.pr-request{margin-top:20px;padding:16px;background:#fff;border-radius:12px;box-shadow:0 6px 18px rgba(15,23,42,0.08);}section.pr-request h2{margin-top:0;margin-bottom:12px;}</style></head><body><h1>Code Review: ${escapeHtml(featureSlug)}</h1><p>Generated: ${escapeHtml(generatedAt)}</p>${prMarkup.html}<p>No staged or working tree changes were detected. Nothing to review.</p><p>Output: ${escapeHtml(path)}</p>${prMarkup.script}</body></html>`;
}

function buildDocument(featureSlug: string, generatedAt: string, mode: DiffMode, sections: FileSection[], checklistHtml: string, prMarkup: { html: string; script: string }): string {
  const diffSource = mode === 'staged' ? 'Staged changes (git diff --cached)' : 'Working tree changes (git diff)';
  const totalAdditions = sections.reduce((acc, section) => acc + section.additions, 0);
  const totalDeletions = sections.reduce((acc, section) => acc + section.deletions, 0);
  const sectionHtml = sections.map(buildFileSection).join('');
  const styles = `body{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:24px;background:#eef2f8;color:#1b2733;}a{color:#2563eb;text-decoration:none;}a:hover{text-decoration:underline;}header.page-header{display:flex;flex-direction:column;gap:8px;margin-bottom:24px;}header.page-header h1{margin:0;font-size:28px;}header.page-header .metadata{font-size:14px;color:#475569;}header.page-header .summary{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px;}header.page-header .summary-card{background:#fff;border-radius:12px;box-shadow:0 6px 18px rgba(15,23,42,0.08);padding:16px 20px;min-width:160px;display:flex;flex-direction:column;gap:4px;}header.page-header .summary-card span.label{font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;}header.page-header .summary-card span.value{font-size:22px;font-weight:600;}section.pr-request{background:#fff;border-radius:12px;box-shadow:0 6px 18px rgba(15,23,42,0.08);padding:20px;margin-bottom:28px;}section.pr-request h2{margin:0 0 12px;font-size:18px;border:none;}section.pr-request p{margin:0 0 10px;font-size:14px;line-height:1.6;}section.checklist{background:#fff;border-radius:12px;box-shadow:0 6px 18px rgba(15,23,42,0.08);padding:20px;margin-bottom:28px;}section.checklist h2{margin:0 0 12px;font-size:18px;border:none;}section.checklist ol{margin:0;padding-left:20px;}section.checklist li{margin-bottom:12px;font-size:14px;}section.checklist .checklist-file{display:flex;align-items-center;gap:12px;font-weight:600;}section.checklist .checklist-file-name{font-size:15px;}section.checklist .checklist-file-counts{color:#475569;font-size:13px;}section.checklist ul{margin:8px 0 0;padding-left:20px;}section.checklist ul li{font-weight:500;margin-bottom:6px;}section.checklist .checklist-hunk-counts{margin-left:8px;font-size:12px;color:#64748b;}section.file-section{background:#fff;border-radius:16px;box-shadow:0 18px 36px rgba(15,23,42,0.1);margin-bottom:32px;padding:24px;}section.file-section .file-header{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid #e2e8f0;padding-bottom:12px;}section.file-section h2{margin:0;font-size:22px;border:none;}section.file-section .file-stats{display:flex;gap:10px;font-weight:600;font-size:14px;}section.file-section .file-additions{color:#15803d;}section.file-section .file-deletions{color:#b91c1c;}section.file-section .hunk-index{margin:20px 0;}section.file-section .hunk-index h3{margin:0 0 10px;font-size:16px;}section.file-section .hunk-index ol{margin:0;padding-left:20px;}section.file-section .hunk-index li{margin-bottom:8px;font-size:14px;}article.hunk{margin-top:28px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;}article.hunk .hunk-header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;background:#f8fafc;padding:16px;border-bottom:1px solid #e2e8f0;}article.hunk .hunk-header h3{margin:0;font-size:18px;}article.hunk .hunk-summary{font-size:12px;color:#475569;margin-top:4px;flex-basis:100%;}article.hunk .hunk-diff-counts{font-weight:600;color:#0ea5e9;}article.hunk pre{margin:0;background:#0f172a;color:#e2e8f0;padding:20px;font-size:13px;line-height:1.5;}article.hunk pre code{display:block;white-space:pre;}article.hunk .review-notes{background:#f8fafc;padding:16px;border-top:1px solid #e2e8f0;}article.hunk .review-notes h4{margin:0 0 10px;font-size:15px;}article.hunk .review-notes ul{margin:0;padding-left:18px;}article.hunk .review-notes li{margin-bottom:6px;font-size:14px;}article.hunk .hunk-nav{display:flex;align-items:center;gap:10px;padding:12px 16px;background:#f1f5f9;border-top:1px solid #e2e8f0;font-size:13px;}article.hunk .hunk-nav span{color:#94a3b8;}footer.page-footer{margin-top:40px;text-align:center;font-size:13px;color:#64748b;}
  `;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Code Review - ${escapeHtml(featureSlug)} - ${generatedAt}</title><style>${styles}</style></head><body><header id="top" class="page-header"><h1>Code Review • ${escapeHtml(featureSlug)}</h1><div class="metadata"><span>Generated: ${escapeHtml(generatedAt)}</span><span>Source: ${escapeHtml(diffSource)}</span></div><div class="summary"><div class="summary-card"><span class="label">Total Additions</span><span class="value">+${totalAdditions}</span></div><div class="summary-card"><span class="label">Total Deletions</span><span class="value">-${totalDeletions}</span></div><div class="summary-card"><span class="label">Files Changed</span><span class="value">${sections.length}</span></div></div></header>${prMarkup.html}${checklistHtml}${sectionHtml}${prMarkup.script}<footer class="page-footer"><a href="#top">Back to top</a></footer></body></html>`;
}

function ensureDirectory(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function generateReview(): void {
  const argv = process.argv.slice(2);
  const slug = parseArgument(argv, 'feature');
  if (!slug) {
    console.error('Missing required --feature <slug> argument.');
    process.exit(1);
  }
  const prRequestRaw = parseArgument(argv, 'pr_request').trim();
  const generated = timestamp();
  const outputDir = resolve(process.cwd(), 'code_review');
  ensureDirectory(outputDir);
  const { files, mode } = listChangedFiles();
  const { filename, finalSlug, previousFilename } = computeTargetFilename(outputDir, slug);
  const targetPath = resolve(outputDir, filename);
  const previousEntries = loadPreviousPrRequests(outputDir, previousFilename);
  const hasPrevious = previousEntries.length > 0;

  let prEntries: string[] = [];
  if (!hasPrevious) {
    if (!prRequestRaw) {
      console.error('Missing required --pr_request "<explanation>" argument.');
      process.exit(1);
    }
    const sentenceCount = countSentences(prRequestRaw);
    if (sentenceCount < 10) {
      console.error(`PR request narrative must contain at least 10 sentences; received ${sentenceCount}.`);
      process.exit(1);
    }
    prEntries = [prRequestRaw];
  } else {
    prEntries = previousEntries.slice();
    if (prRequestRaw) {
      const newSentenceCount = countSentences(prRequestRaw);
      if (newSentenceCount === 0) {
        console.error('PR request updates must contain at least one sentence.');
        process.exit(1);
      }
      prEntries.push(prRequestRaw);
    }
    if (prEntries.length === 0) {
      console.error('Unable to recover previous PR review context. Please rerun with --pr_request providing at least 10 sentences.');
      process.exit(1);
    }
  }

  const prMarkup = buildPrRequestMarkup(prEntries);

  if (files.length === 0) {
    const content = buildNoDiffDocument(finalSlug, generated, targetPath, prMarkup);
    writeFileSync(targetPath, content, 'utf8');
    console.log(`No changes found. Review log saved to ${targetPath}`);
    return;
  }

  const sections: FileSection[] = [];
  const registry = new Map<string, number>();

  for (const path of files) {
    const diff = fileDiff(path, mode);
    if (!diff.trim()) {
      continue;
    }
    const parsed = parseDiff(diff);
    const sectionId = sectionIdForPath(path, registry);
    const summaries: HunkSummary[] = parsed.hunks.map((hunk, index) => ({
      id: `${sectionId}-h${index + 1}`,
      label: `Block ${index + 1}`,
      additions: hunk.additions,
      deletions: hunk.deletions,
    }));
    sections.push({
      path,
      id: sectionId,
      additions: parsed.additions,
      deletions: parsed.deletions,
      hunks: parsed.hunks,
      summaries,
      meta: parsed.meta,
    });
  }

  if (sections.length === 0) {
    const content = buildNoDiffDocument(finalSlug, generated, targetPath, prMarkup);
    writeFileSync(targetPath, content, 'utf8');
    console.log(`No diff content found. Review log saved to ${targetPath}`);
    return;
  }

  const checklist = buildChecklist(sections);
  if (checklist.text.trim().length > 0) {
    console.log(`Review Checklist:\n${checklist.text}\n`);
  }

  const html = buildDocument(finalSlug, generated, mode, sections, checklist.html, prMarkup);
  writeFileSync(targetPath, html, 'utf8');
  console.log(`Code review generated at ${targetPath}`);
}

generateReview();
