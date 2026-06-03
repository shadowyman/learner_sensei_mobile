import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname, relative } from 'path';
import { spawnSync } from 'child_process';
import ignore from 'ignore';

function fail(message: string): never {
  console.error(message);
  console.error('Backup creation failed. Please instruct Codex to perform a manual backup.');
  process.exit(1);
}

const argv = process.argv.slice(2);
let featureArg = '';
let contextArg = '';
for (let i = 0; i < argv.length; i += 1) {
  const token = argv[i];
  if (typeof token !== 'string') {
    continue;
  }
  if (token === '--feature') {
    const next = argv[i + 1];
    if (typeof next !== 'string') {
      fail('Missing value for --feature argument.');
    } else {
      featureArg = next;
    }
    i += 1;
    continue;
  }
  if (token.startsWith('--feature=')) {
    featureArg = token.slice('--feature='.length);
    continue;
  }
  if (token === '--context') {
    const next = argv[i + 1];
    if (typeof next !== 'string') {
      fail('Missing value for --context argument.');
    } else {
      contextArg = next;
    }
    i += 1;
    continue;
  }
  if (token.startsWith('--context=')) {
    contextArg = token.slice('--context='.length);
    continue;
  }
}
if (!featureArg.trim()) {
  fail('Missing required --feature argument.');
}
if (!contextArg.trim()) {
  fail('Missing required --context argument.');
}
const featureSlug = featureArg.trim();
const normalizedFeature = featureSlug.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
if (!normalizedFeature) {
  fail('Feature slug did not contain any alphanumeric characters.');
}
const repoRoot = process.cwd();
const manifestPath = join(repoRoot, 'src', 'backup-file-manifest.json');
if (!existsSync(manifestPath)) {
  fail('backup-file-manifest.json not found.');
}
const manifestDir = dirname(manifestPath);
let manifestContent: string;
try {
  manifestContent = readFileSync(manifestPath, 'utf8');
} catch (error) {
  fail('Unable to read backup-file-manifest.json.');
}
let manifestEntries: unknown;
try {
  manifestEntries = JSON.parse(manifestContent);
} catch (error) {
  fail('backup-file-manifest.json contains invalid JSON.');
}
if (!Array.isArray(manifestEntries) || !manifestEntries.every(item => typeof item === 'string')) {
  fail('backup-file-manifest.json must be an array of strings.');
}
const manifestFiles = manifestEntries as string[];
if (manifestFiles.length === 0) {
  fail('backup-file-manifest.json is empty.');
}
const backupConfigPath = join(repoRoot, 'config', 'backup-manifest.roots.json');
let excludePatterns: string[] = [];
if (existsSync(backupConfigPath)) {
  try {
    const parsed = JSON.parse(readFileSync(backupConfigPath, 'utf8')) as { excludePatterns?: unknown };
    if (Array.isArray(parsed.excludePatterns) && parsed.excludePatterns.every(item => typeof item === 'string')) {
      excludePatterns = parsed.excludePatterns;
    }
  } catch (error) {
    fail('Unable to read backup manifest exclude patterns.');
  }
}
const forbiddenMatcher = ignore().add(excludePatterns);
const resolvedManifestFiles: string[] = [];
manifestFiles.forEach(relativePath => {
  const manifestRelativePath = join(manifestDir, relativePath);
  if (existsSync(manifestRelativePath)) {
    resolvedManifestFiles.push(manifestRelativePath);
    return;
  }
  const repoRelativePath = join(repoRoot, relativePath);
  if (existsSync(repoRelativePath)) {
    resolvedManifestFiles.push(repoRelativePath);
    return;
  }
  fail(`Manifest entry missing: ${relativePath}`);
});
const backupDir = join(repoRoot, 'backup');
if (!existsSync(backupDir)) {
  try {
    mkdirSync(backupDir, { recursive: true });
  } catch (error) {
    fail('Unable to create backup directory.');
  }
}
const timestamp = new Date();
const formattedTimestamp = `${timestamp.getFullYear()}${String(timestamp.getMonth() + 1).padStart(2, '0')}${String(timestamp.getDate()).padStart(2, '0')}_${String(timestamp.getHours()).padStart(2, '0')}${String(timestamp.getMinutes()).padStart(2, '0')}${String(timestamp.getSeconds()).padStart(2, '0')}`;
const contextLines = contextArg.split(/\r?\n/).map(line => line.trimEnd());
const contextPath = join(backupDir, 'BACKUP_CONTEXT.md');
const lines = [`Timestamp: ${timestamp.toISOString()}`, `Feature: ${featureSlug}`, 'Context:'];
lines.push(...contextLines);
const contextContent = `${lines.join('\n')}\n`;
try {
  writeFileSync(contextPath, contextContent, 'utf8');
} catch (error) {
  fail('Unable to write BACKUP_CONTEXT.md.');
}
const zipName = `sensei_backup_${normalizedFeature}_${formattedTimestamp}.zip`;
const zipPath = join(backupDir, zipName);
if (existsSync(zipPath)) {
  try {
    unlinkSync(contextPath);
  } catch (error) {
  }
  fail('Backup archive already exists for this feature and timestamp.');
}
const archiveFiles = resolvedManifestFiles.map(filePath => relative(repoRoot, filePath).replace(/\\/g, '/'));
const zipArgs = ['-q', zipPath, 'backup/BACKUP_CONTEXT.md', ...archiveFiles];
const zipResult = spawnSync('zip', zipArgs, { cwd: repoRoot });
if (zipResult.error || typeof zipResult.status === 'number' && zipResult.status !== 0) {
  try {
    unlinkSync(contextPath);
  } catch (error) {
  }
  fail('zip command failed.');
}
const verifyResult = spawnSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' });
if (verifyResult.error || typeof verifyResult.status === 'number' && verifyResult.status !== 0) {
  try {
    unlinkSync(contextPath);
  } catch (error) {
  }
  fail('Unable to verify backup contents.');
}
const archiveEntries = verifyResult.stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
const archiveEntrySet = new Set(archiveEntries);
const allowedEntries = new Set([...archiveFiles, 'backup/BACKUP_CONTEXT.md']);
if (!archiveEntrySet.has('backup/BACKUP_CONTEXT.md')) {
  try {
    unlinkSync(contextPath);
  } catch (error) {
  }
  fail('Backup archive is missing BACKUP_CONTEXT.md.');
}
for (const entry of archiveEntries) {
  if (!allowedEntries.has(entry)) {
    try {
      unlinkSync(contextPath);
    } catch (error) {
    }
    fail(`Backup archive contains non-manifest entry: ${entry}`);
  }
  if (entry !== 'backup/BACKUP_CONTEXT.md' && forbiddenMatcher.test(entry).ignored) {
    try {
      unlinkSync(contextPath);
    } catch (error) {
    }
    fail(`Backup archive contains excluded entry: ${entry}`);
  }
}
const requiredEntries = [
  'AGENTS.md',
  'package.json',
  'package-lock.json',
  'config/file-manifest.roots.json',
  'config/backup-manifest.roots.json',
  'src/file-manifest.json',
  'src/backup-file-manifest.json',
  '__tests__/saveLoadProgress.test.ts',
  '__mocks__/react-native.js',
  'bff/package.json',
  'bff/src/server.js',
  'core/index.ts',
  'protocol/index.ts',
  'SenseiMobile/package.json',
  'SenseiMobile/metro.config.js',
  'SenseiMobile/src/mobile/MainScreen.tsx',
  'SenseiMobile/ios/Podfile',
  'SenseiMobile/ios/SenseiMobile.xcodeproj/project.pbxproj',
  'SenseiMobile/ios/SenseiMobile/AppDelegate.swift',
  'SenseiMobile/ios/SenseiMobile/Info.plist',
  'SenseiMobile/ios/SenseiMobile/LaunchScreen.storyboard',
  'SenseiMobile/ios/SenseiMobile/Images.xcassets/Contents.json',
  'SenseiMobile/android/settings.gradle',
  'SenseiMobile/android/app/src/main/AndroidManifest.xml'
];
for (const entry of requiredEntries) {
  if (!archiveEntrySet.has(entry)) {
    try {
      unlinkSync(contextPath);
    } catch (error) {
    }
    fail(`Backup archive missing required restore anchor: ${entry}`);
  }
}
try {
  unlinkSync(contextPath);
} catch (error) {
  fail('Unable to remove BACKUP_CONTEXT.md after archiving.');
}
console.log(`Backup created at ${zipPath}`);
