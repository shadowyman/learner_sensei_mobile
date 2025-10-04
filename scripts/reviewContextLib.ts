import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'path';
import { spawnSync } from 'child_process';

export type ManifestSlugRef = {
  name: string;
  assignedAt: string;
};

export type ManifestSlugEntry = {
  files: string[];
  lastAssignedAt: string;
  lastAssignedBy: string;
};

export type ManifestFileEntry = {
  slugs: ManifestSlugRef[];
};

export type Manifest = {
  generatedAt: string;
  slugs: Record<string, ManifestSlugEntry>;
  files: Record<string, ManifestFileEntry>;
};

const DEFAULT_AUTHOR = process.env.REVIEW_CONTEXT_OPERATOR ?? 'codex';

function resolveRoot(provided?: string): string {
  if (provided) {
    return resolve(provided);
  }
  if (process.env.REVIEW_CONTEXT_ROOT) {
    return resolve(process.env.REVIEW_CONTEXT_ROOT);
  }
  return process.cwd();
}

function manifestPath(root?: string): string {
  const base = resolveRoot(root);
  return resolve(base, 'tmp', 'review-contexts', 'assignments.json');
}

function ensureDirectory(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function emptyManifest(): Manifest {
  return {
    generatedAt: new Date().toISOString(),
    slugs: {},
    files: {},
  };
}

export function loadManifest(root?: string): Manifest {
  const target = manifestPath(root);
  if (!existsSync(target)) {
    return emptyManifest();
  }
  const raw = readFileSync(target, 'utf8');
  try {
    const data = JSON.parse(raw) as Manifest;
    if (!data.generatedAt) {
      data.generatedAt = new Date().toISOString();
    }
    if (!data.slugs) {
      data.slugs = {};
    }
    if (!data.files) {
      data.files = {};
    }
    return data;
  } catch (error) {
    throw new Error('Unable to parse review context manifest. Remove or repair tmp/review-contexts/assignments.json.');
  }
}

export function saveManifest(manifest: Manifest, root?: string): void {
  const target = manifestPath(root);
  ensureDirectory(target);
  manifest.generatedAt = new Date().toISOString();
  const payload = JSON.stringify(manifest, null, 2);
  const tempPath = `${target}.${Date.now()}.tmp`;
  writeFileSync(tempPath, payload, 'utf8');
  renameSync(tempPath, target);
}

function toPosix(path: string): string {
  if (sep === '/') {
    return path;
  }
  return path.split(sep).join('/');
}

function resolveFile(root: string, input: string): string {
  const absolute = isAbsolute(input) ? resolve(input) : resolve(root, input);
  const rel = toPosix(relative(root, absolute));
  if (rel.startsWith('..')) {
    throw new Error(`Path ${input} is outside repository root.`);
  }
  return rel === '' ? '.' : rel;
}

function listStagedDeletions(root: string): Set<string> {
  const result = spawnSync('git', ['ls-files', '--deleted'], { cwd: root, encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(result.stderr || 'Unable to read staged deletions.');
  }
  const entries = result.stdout.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  return new Set(entries.map(item => toPosix(item)));
}

function validateFiles(root: string, files: string[]): { normalized: string[]; docPaths: string[]; missing: string[] } {
  const normalized: string[] = [];
  const docPaths: string[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  const stagedDeletions = listStagedDeletions(root);
  for (const entry of files) {
    const rel = resolveFile(root, entry);
    if (rel === '.') {
      missing.push(entry);
      continue;
    }
    if (rel.startsWith('docs/')) {
      docPaths.push(rel);
      continue;
    }
    const absolute = resolve(root, rel);
    if (!existsSync(absolute)) {
      if (stagedDeletions.has(rel)) {
        if (!seen.has(rel)) {
          seen.add(rel);
          normalized.push(rel);
        }
      } else {
        missing.push(rel);
      }
      continue;
    }
    if (!seen.has(rel)) {
      seen.add(rel);
      normalized.push(rel);
    }
  }
  return { normalized, docPaths, missing };
}

function normalizePaths(root: string, files: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const entry of files) {
    const rel = resolveFile(root, entry);
    if (rel === '.') {
      continue;
    }
    if (!seen.has(rel)) {
      seen.add(rel);
      normalized.push(rel);
    }
  }
  return normalized;
}

function stagePaths(root: string, paths: string[]): void {
  if (paths.length === 0) {
    return;
  }
  const result = spawnSync('git', ['add', '--', ...paths], { cwd: root, encoding: 'utf8' });
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(result.stderr || 'Failed to stage files.');
  }
}

function touchSlug(manifest: Manifest, slug: string): ManifestSlugEntry {
  const entry = manifest.slugs[slug];
  if (entry) {
    return entry;
  }
  const created: ManifestSlugEntry = {
    files: [],
    lastAssignedAt: new Date().toISOString(),
    lastAssignedBy: DEFAULT_AUTHOR,
  };
  manifest.slugs[slug] = created;
  return created;
}

function addFileReference(manifest: Manifest, file: string, slug: string): void {
  const now = new Date().toISOString();
  const entry = manifest.files[file] ?? { slugs: [] };
  const existing = entry.slugs.find(item => item.name === slug);
  if (existing) {
    existing.assignedAt = now;
  } else {
    entry.slugs.push({ name: slug, assignedAt: now });
  }
  manifest.files[file] = entry;
}

function removeFileReference(manifest: Manifest, file: string, slug: string): void {
  const entry = manifest.files[file];
  if (!entry) {
    return;
  }
  entry.slugs = entry.slugs.filter(item => item.name !== slug);
  if (entry.slugs.length === 0) {
    delete manifest.files[file];
  } else {
    manifest.files[file] = entry;
  }
}

export type AssignOptions = {
  slug: string;
  files: string[];
  append?: boolean;
  root?: string;
};

export type AssignResult = {
  assigned: string[];
  removed: string[];
  overlaps: string[];
};

export function assignFiles(options: AssignOptions): AssignResult {
  const root = resolveRoot(options.root);
  if (!options.slug) {
    throw new Error('Missing --feature <slug> parameter.');
  }
  if (!options.files || options.files.length === 0) {
    throw new Error('Provide at least one path via --files.');
  }
  const manifest = loadManifest(root);
  const { normalized, docPaths, missing } = validateFiles(root, options.files);
  if (docPaths.length > 0) {
    throw new Error(`Docs cannot be assigned: ${docPaths.join(', ')}`);
  }
  if (missing.length > 0) {
    throw new Error(`Files not found: ${missing.join(', ')}`);
  }
  const slugEntry = touchSlug(manifest, options.slug);
  const prior = new Set(slugEntry.files);
  const nextFiles = options.append ? Array.from(new Set([...slugEntry.files, ...normalized])) : normalized;
  const removed = options.append ? [] : slugEntry.files.filter(file => !nextFiles.includes(file));
  const overlaps: string[] = [];
  for (const file of nextFiles) {
    const owners = manifest.files[file]?.slugs.map(item => item.name) ?? [];
    if (owners.some(name => name !== options.slug)) {
      overlaps.push(file);
    }
  }
  slugEntry.files = nextFiles;
  slugEntry.lastAssignedAt = new Date().toISOString();
  slugEntry.lastAssignedBy = DEFAULT_AUTHOR;
  if (!options.append) {
    for (const file of removed) {
      removeFileReference(manifest, file, options.slug);
    }
  }
  for (const file of nextFiles) {
    addFileReference(manifest, file, options.slug);
  }
  stagePaths(root, nextFiles);
  saveManifest(manifest, root);
  console.log('[REVCTX] Manifest persisted for slug', options.slug, nextFiles.length);
  console.log('[REVCTX] Assigned files for slug', options.slug, nextFiles);
  if (overlaps.length > 0) {
    for (const file of overlaps) {
      const owners = manifest.files[file]?.slugs.map(item => item.name) ?? [];
      console.log('[REVCTX] File shared with', { file, slugs: owners });
    }
  }
  return {
    assigned: nextFiles,
    removed,
    overlaps,
  };
}

export type ResetOptions = {
  slug: string;
  files?: string[];
  root?: string;
};

export type ResetResult = {
  clearedFiles: string[];
  clearedSlug: boolean;
};

export function resetAssignments(options: ResetOptions): ResetResult {
  const root = resolveRoot(options.root);
  const manifest = loadManifest(root);
  const slugEntry = manifest.slugs[options.slug];
  if (!slugEntry) {
    return { clearedFiles: [], clearedSlug: false };
  }
  let targets: string[];
  if (options.files && options.files.length > 0) {
    const normalized = normalizePaths(root, options.files);
    targets = slugEntry.files.filter(file => normalized.includes(file));
  } else {
    targets = [...slugEntry.files];
  }
  const remaining = slugEntry.files.filter(file => !targets.includes(file));
  for (const file of targets) {
    removeFileReference(manifest, file, options.slug);
  }
  if (remaining.length === 0) {
    delete manifest.slugs[options.slug];
  } else {
    slugEntry.files = remaining;
    manifest.slugs[options.slug] = slugEntry;
  }
  saveManifest(manifest, root);
  console.log('[REVCTX] Cleanup removed entries', targets);
  return {
    clearedFiles: targets,
    clearedSlug: remaining.length === 0,
  };
}

export type ShowOptions = {
  slug?: string;
  root?: string;
};

export function showAssignments(options: ShowOptions): void {
  const manifest = loadManifest(options.root);
  if (options.slug) {
    const entry = manifest.slugs[options.slug];
    if (!entry) {
      console.log(`No entries recorded for slug ${options.slug}.`);
      return;
    }
    console.log(JSON.stringify({ slug: options.slug, files: entry.files, lastAssignedAt: entry.lastAssignedAt, lastAssignedBy: entry.lastAssignedBy }, null, 2));
    return;
  }
  console.log(JSON.stringify(manifest.slugs, null, 2));
}

export type CleanupOptions = {
  files: string[];
  root?: string;
};

export type CleanupResult = {
  removedFiles: string[];
  clearedSlugs: string[];
};

export function cleanupFiles(options: CleanupOptions): CleanupResult {
  const root = resolveRoot(options.root);
  if (!options.files || options.files.length === 0) {
    throw new Error('Provide file paths via --files for cleanup.');
  }
  const manifest = loadManifest(root);
  const normalized = normalizePaths(root, options.files);
  const removedFiles: string[] = [];
  const clearedSlugs: string[] = [];
  const clearedSlugSet = new Set<string>();
  for (const slug of Object.keys(manifest.slugs)) {
    const entry = manifest.slugs[slug];
    if (!entry) {
      continue;
    }
    const keep: string[] = [];
    let removed = false;
    for (const file of entry.files) {
      if (normalized.includes(file)) {
        removed = true;
        removeFileReference(manifest, file, slug);
        removedFiles.push(file);
      } else {
        keep.push(file);
      }
    }
    if (removed) {
      if (keep.length === 0) {
        delete manifest.slugs[slug];
        clearedSlugSet.add(slug);
      } else {
        manifest.slugs[slug] = {
          ...entry,
          files: keep,
        };
      }
    }
  }
  saveManifest(manifest, root);
  const cleared = Array.from(clearedSlugSet);
  console.log('[REVCTX] Hook pruned', { removedFiles, clearedSlugs: cleared });
  return {
    removedFiles,
    clearedSlugs: cleared,
  };
}

export function getManifestPath(root?: string): string {
  return manifestPath(root);
}

export function partitionAssignedFiles(assigned: string[], staged: string[]): { selected: string[]; missing: string[] } {
  const stagedSet = new Set(staged);
  const selected = assigned.filter(file => stagedSet.has(file));
  const missing = assigned.filter(file => !stagedSet.has(file));
  return { selected, missing };
}
