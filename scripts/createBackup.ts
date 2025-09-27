import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

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
const manifestPath = join(process.cwd(), 'file-manifest.json');
if (!existsSync(manifestPath)) {
  fail('file-manifest.json not found.');
}
let manifestContent: string;
try {
  manifestContent = readFileSync(manifestPath, 'utf8');
} catch (error) {
  fail('Unable to read file-manifest.json.');
}
let manifestEntries: unknown;
try {
  manifestEntries = JSON.parse(manifestContent);
} catch (error) {
  fail('file-manifest.json contains invalid JSON.');
}
if (!Array.isArray(manifestEntries) || !manifestEntries.every(item => typeof item === 'string')) {
  fail('file-manifest.json must be an array of strings.');
}
const manifestFiles = manifestEntries as string[];
if (manifestFiles.length === 0) {
  fail('file-manifest.json is empty.');
}
manifestFiles.forEach(relativePath => {
  const targetPath = join(process.cwd(), relativePath);
  if (!existsSync(targetPath)) {
    fail(`Manifest entry missing: ${relativePath}`);
  }
});
const backupDir = join(process.cwd(), 'backup');
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
const zipArgs = ['-q', zipPath, 'backup/BACKUP_CONTEXT.md', ...manifestFiles];
const zipResult = spawnSync('zip', zipArgs, { cwd: process.cwd() });
if (zipResult.error || typeof zipResult.status === 'number' && zipResult.status !== 0) {
  try {
    unlinkSync(contextPath);
  } catch (error) {
  }
  fail('zip command failed.');
}
const verifyResult = spawnSync('unzip', ['-l', zipPath], { encoding: 'utf8' });
if (verifyResult.error || typeof verifyResult.status === 'number' && verifyResult.status !== 0) {
  try {
    unlinkSync(contextPath);
  } catch (error) {
  }
  fail('Unable to verify backup contents.');
}
if (!verifyResult.stdout.includes('BACKUP_CONTEXT.md')) {
  try {
    unlinkSync(contextPath);
  } catch (error) {
  }
  fail('Backup archive is missing BACKUP_CONTEXT.md.');
}
try {
  unlinkSync(contextPath);
} catch (error) {
  fail('Unable to remove BACKUP_CONTEXT.md after archiving.');
}
console.log(`Backup created at ${zipPath}`);
