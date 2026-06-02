import fs from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';
import type { Ignore } from 'ignore';

type ManifestSyncConfig = {
  roots: string[];
  extraFiles?: string[];
  extensions?: string[];
  ignoreDirs?: string[];
};

type GitignoreMatcher = {
  baseAbs: string;
  baseRel: string;
  ig: Ignore;
};

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function normalizeSlashes(input: string) {
  return input.replace(/\\/g, '/');
}

function isDtsFile(filePath: string) {
  return /\.d\.(ts|mts|cts)$/i.test(filePath);
}

function isPathInside(parent: string, child: string) {
  const rel = path.relative(parent, child);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function loadConfig(repoRoot: string): ManifestSyncConfig {
  const configPath = path.join(repoRoot, 'config', 'file-manifest.roots.json');
  if (!fs.existsSync(configPath)) {
    fail(`Missing config at ${configPath}`);
  }
  let raw = '';
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch {
    fail(`Unable to read ${configPath}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail(`Invalid JSON in ${configPath}`);
  }
  if (!parsed || typeof parsed !== 'object') {
    fail(`Invalid config shape in ${configPath}`);
  }
  const cfg = parsed as ManifestSyncConfig;
  if (!Array.isArray(cfg.roots) || !cfg.roots.every(r => typeof r === 'string' && r.trim().length > 0)) {
    fail(`Config ${configPath} must contain { "roots": string[] }`);
  }
  return cfg;
}

function loadGitignoreMatchers(repoRoot: string, scanRoots: string[], contextRoots: string[], ignoreDirNames: Set<string>) {
  const gitignorePaths = new Set<string>();
  const addGitignoreInDir = (dir: string) => {
    if (!isPathInside(repoRoot, dir)) return;
    const gitignorePath = path.join(dir, '.gitignore');
    if (fs.existsSync(gitignorePath) && fs.statSync(gitignorePath).isFile()) {
      gitignorePaths.add(gitignorePath);
    }
  };
  addGitignoreInDir(repoRoot);
  const scan = (dir: string) => {
    if (!isPathInside(repoRoot, dir)) return;
    addGitignoreInDir(dir);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (!ent.isDirectory() || ent.isSymbolicLink()) continue;
      if (ignoreDirNames.has(ent.name)) continue;
      if (ent.name.startsWith('node_modules')) continue;
      scan(path.join(dir, ent.name));
    }
  };
  const addAncestorGitignores = (candidate: string) => {
    const resolved = path.resolve(repoRoot, candidate);
    const dir = fs.existsSync(resolved) && fs.statSync(resolved).isFile() ? path.dirname(resolved) : resolved;
    let cursor = dir;
    while (isPathInside(repoRoot, cursor)) {
      addGitignoreInDir(cursor);
      if (cursor === repoRoot) break;
      cursor = path.dirname(cursor);
    }
    return dir;
  };
  for (const candidate of contextRoots) {
    addAncestorGitignores(candidate);
  }
  for (const candidate of scanRoots) {
    const dir = addAncestorGitignores(candidate);
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) scan(dir);
  }
  const defaults = ignore();
  defaults.add([
    '.venv/',
    'SenseiMobile/.bundle/',
    'SenseiMobile/node_modules 2/',
    '.sonar-config/.env.sonar',
    'SenseiMobile/* 2',
    'SenseiMobile/* 2.*',
    'SenseiMobile/* copy*'
  ]);
  const matchers: GitignoreMatcher[] = [{
    baseAbs: repoRoot,
    baseRel: '',
    ig: defaults
  }];
  for (const gitignorePath of Array.from(gitignorePaths).sort((a, b) => a.localeCompare(b))) {
    let raw = '';
    try {
      raw = fs.readFileSync(gitignorePath, 'utf8');
    } catch {
      continue;
    }
    const baseAbs = path.dirname(gitignorePath);
    if (baseAbs !== repoRoot && isIgnoredByGitignore(baseAbs, repoRoot, matchers, true)) continue;
    matchers.push({
      baseAbs,
      baseRel: normalizeSlashes(path.relative(repoRoot, baseAbs)),
      ig: ignore().add(raw)
    });
  }
  return matchers.sort((a, b) => a.baseRel.length - b.baseRel.length);
}

function isIgnoredByGitignore(absPath: string, repoRoot: string, matchers: GitignoreMatcher[], isDirectory: boolean) {
  const normalizedAbs = path.resolve(absPath);
  let ignored = false;
  for (const matcher of matchers) {
    if (!isPathInside(matcher.baseAbs, normalizedAbs)) continue;
    let rel = normalizeSlashes(path.relative(matcher.baseAbs, normalizedAbs));
    if (!rel) continue;
    if (isDirectory && !rel.endsWith('/')) rel += '/';
    const result = matcher.ig.test(rel);
    if (result.ignored) ignored = true;
    if (result.unignored) ignored = false;
  }
  return ignored;
}

function walkFiles(absDir: string, repoRoot: string, ignoreDirNames: Set<string>, gitignoreMatchers: GitignoreMatcher[], out: string[]) {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const full = path.join(absDir, ent.name);
    if (ent.isSymbolicLink()) continue;
    if (ent.isDirectory()) {
      if (ignoreDirNames.has(ent.name)) continue;
      if (ent.name.startsWith('node_modules')) continue;
      if (isIgnoredByGitignore(full, repoRoot, gitignoreMatchers, true)) continue;
      walkFiles(full, repoRoot, ignoreDirNames, gitignoreMatchers, out);
      continue;
    }
    if (!ent.isFile()) continue;
    if (isIgnoredByGitignore(full, repoRoot, gitignoreMatchers, false)) continue;
    out.push(full);
  }
}

function main() {
  const repoRoot = process.cwd();
  const cfg = loadConfig(repoRoot);

  const defaultExtensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
  const extensions = new Set(
    (cfg.extensions && cfg.extensions.length ? cfg.extensions : defaultExtensions)
      .map(ext => ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`)
  );
  const ignoreDirNames = new Set(['.git', 'backup', 'coverage', 'dist', 'build', 'tmp', 'node_modules']);
  (cfg.ignoreDirs || []).forEach(d => {
    if (typeof d === 'string' && d.trim().length) ignoreDirNames.add(d.trim());
  });
  const rootCandidates = cfg.roots.filter(item => typeof item === 'string' && item.trim().length);
  const contextCandidates = [...cfg.roots, ...(cfg.extraFiles || [])].filter(item => typeof item === 'string' && item.trim().length);
  const gitignoreMatchers = loadGitignoreMatchers(repoRoot, rootCandidates, contextCandidates, ignoreDirNames);

  const allFilesAbs: string[] = [];
  for (const root of cfg.roots) {
    const resolved = path.resolve(repoRoot, root);
    if (!fs.existsSync(resolved)) {
      fail(`Root does not exist: ${root}`);
    }
    const stat = fs.statSync(resolved);
    if (stat.isFile()) {
      allFilesAbs.push(resolved);
      continue;
    }
    if (stat.isDirectory()) {
      if (!isIgnoredByGitignore(resolved, repoRoot, gitignoreMatchers, true)) {
        walkFiles(resolved, repoRoot, ignoreDirNames, gitignoreMatchers, allFilesAbs);
      }
      continue;
    }
    fail(`Unsupported root type: ${root}`);
  }
  for (const file of cfg.extraFiles || []) {
    if (typeof file !== 'string' || !file.trim()) continue;
    const resolved = path.resolve(repoRoot, file);
    if (!fs.existsSync(resolved)) {
      fail(`extraFiles entry missing: ${file}`);
    }
    const st = fs.statSync(resolved);
    if (!st.isFile()) {
      fail(`extraFiles entry is not a file: ${file}`);
    }
    if (isIgnoredByGitignore(resolved, repoRoot, gitignoreMatchers, false)) continue;
    allFilesAbs.push(resolved);
  }

  const relPaths: string[] = [];
  for (const abs of allFilesAbs) {
    const ext = path.extname(abs).toLowerCase();
    if (!extensions.has(ext)) continue;
    if (isDtsFile(abs)) continue;
    const rel = normalizeSlashes(path.relative(repoRoot, abs));
    if (!rel || rel.startsWith('..')) continue;
    relPaths.push(rel);
  }
  relPaths.push('src/file-manifest.json');
  relPaths.push('config/file-manifest.roots.json');

  const unique = Array.from(new Set(relPaths)).sort((a, b) => a.localeCompare(b));

  const manifestPath = path.join(repoRoot, 'src', 'file-manifest.json');
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(unique, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${unique.length} entries to ${manifestPath}`);
}

main();
