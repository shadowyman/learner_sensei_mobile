import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import * as childProcess from 'child_process';
import { assignFiles, cleanupFiles, loadManifest, partitionAssignedFiles } from '../scripts/reviewContextLib';
import { gatherDiffFiles } from '../scripts/prePushCleanup';

describe('review context manifest workflow', () => {
  let root: string;
  let spawnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'review-context-'));
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'alpha.ts'), 'export const alpha = 1;');
    writeFileSync(join(root, 'src', 'beta.ts'), 'export const beta = 1;');
    spawnSpy = jest.spyOn(childProcess, 'spawnSync').mockImplementation(() => ({ status: 0, stdout: '', stderr: '' } as unknown as childProcess.SpawnSyncReturns<string>));
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    spawnSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
    rmSync(root, { recursive: true, force: true });
  });

  test('assignFiles overwrites slug and stages requested files', () => {
    assignFiles({ slug: 'alpha-slug', files: ['src/alpha.ts'], root });
    const manifest = loadManifest(root);
    expect(manifest.slugs['alpha-slug'].files).toEqual(['src/alpha.ts']);
    expect(spawnSpy).toHaveBeenCalledWith('git', ['add', '--', 'src/alpha.ts'], expect.objectContaining({ cwd: root, encoding: 'utf8' }));
    expect(logSpy).toHaveBeenCalledWith('[REVCTX] Manifest persisted for slug', 'alpha-slug', 1);
    expect(logSpy).toHaveBeenCalledWith('[REVCTX] Assigned files for slug', 'alpha-slug', ['src/alpha.ts']);
  });

  test('assignFiles rejects documentation paths', () => {
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, 'docs', 'note.md'), '# note');
    expect(() => assignFiles({ slug: 'alpha-slug', files: ['docs/note.md'], root })).toThrow('Docs cannot be assigned');
  });

  test('assignFiles accepts staged deletions', () => {
    const target = 'src/alpha.ts';
    rmSync(join(root, target));
    spawnSpy.mockImplementation((cmd, args) => {
      if (cmd === 'git' && Array.isArray(args) && args[0] === 'ls-files' && args[1] === '--deleted') {
        return { status: 0, stdout: `${target}\n`, stderr: '' } as unknown as childProcess.SpawnSyncReturns<string>;
      }
      return { status: 0, stdout: '', stderr: '' } as unknown as childProcess.SpawnSyncReturns<string>;
    });
    expect(() => assignFiles({ slug: 'alpha-slug', files: [target], root })).not.toThrow();
    const manifest = loadManifest(root);
    expect(manifest.slugs['alpha-slug'].files).toEqual([target]);
  });

  test('cleanupFiles removes entries and clears slugs when files ship', () => {
    assignFiles({ slug: 'alpha-slug', files: ['src/alpha.ts'], root });
    assignFiles({ slug: 'beta-slug', files: ['src/beta.ts'], root });
    logSpy.mockClear();
    cleanupFiles({ files: ['src/alpha.ts', 'src/beta.ts'], root });
    const manifest = loadManifest(root);
    expect(manifest.slugs['alpha-slug']).toBeUndefined();
    expect(manifest.slugs['beta-slug']).toBeUndefined();
    expect(logSpy).toHaveBeenCalledWith('[REVCTX] Hook pruned', { removedFiles: ['src/alpha.ts', 'src/beta.ts'], clearedSlugs: expect.arrayContaining(['alpha-slug', 'beta-slug']) });
  });

  test('partitionAssignedFiles reports staged and missing sets', () => {
    const result = partitionAssignedFiles(['src/alpha.ts', 'src/beta.ts'], ['src/alpha.ts']);
    expect(result.selected).toEqual(['src/alpha.ts']);
    expect(result.missing).toEqual(['src/beta.ts']);
  });

  test('gatherDiffFiles reads range diff for existing branches', () => {
    spawnSpy.mockReset();
    const calls: string[][] = [];
    spawnSpy.mockImplementation((cmd, args) => {
      calls.push(args as string[]);
      if (cmd === 'git' && Array.isArray(args) && args[0] === 'diff') {
        return { status: 0, stdout: 'src/alpha.ts\nsrc/beta.ts\n', stderr: '' } as unknown as childProcess.SpawnSyncReturns<string>;
      }
      return { status: 0, stdout: '', stderr: '' } as unknown as childProcess.SpawnSyncReturns<string>;
    });
    const files = gatherDiffFiles([
      'refs/heads/main 1111111111111111111111111111111111111111 refs/remotes/origin/main 2222222222222222222222222222222222222222'
    ]);
    expect(files.sort()).toEqual(['src/alpha.ts', 'src/beta.ts']);
    expect(calls[0]).toEqual(['diff', '--name-only', '2222222222222222222222222222222222222222', '1111111111111111111111111111111111111111']);
  });

  test('gatherDiffFiles unions multi commit new branch pushes', () => {
    spawnSpy.mockReset();
    const calls: string[][] = [];
    spawnSpy.mockImplementation((cmd, args) => {
      calls.push(args as string[]);
      if (cmd === 'git' && Array.isArray(args)) {
        if (args[0] === 'rev-list') {
          return { status: 0, stdout: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n', stderr: '' } as unknown as childProcess.SpawnSyncReturns<string>;
        }
        if (args[0] === 'diff-tree' && args[args.length - 1] === 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') {
          return { status: 0, stdout: 'src/alpha.ts\n', stderr: '' } as unknown as childProcess.SpawnSyncReturns<string>;
        }
        if (args[0] === 'diff-tree' && args[args.length - 1] === 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb') {
          return { status: 0, stdout: 'src/beta.ts\n', stderr: '' } as unknown as childProcess.SpawnSyncReturns<string>;
        }
      }
      return { status: 0, stdout: '', stderr: '' } as unknown as childProcess.SpawnSyncReturns<string>;
    });
    const files = gatherDiffFiles([
      'refs/heads/feature 1111111111111111111111111111111111111111 refs/remotes/origin/feature 0000000000000000000000000000000000000000'
    ]);
    expect(files.sort()).toEqual(['src/alpha.ts', 'src/beta.ts']);
    expect(calls[0]).toEqual(['rev-list', '1111111111111111111111111111111111111111', '--not', '--remotes']);
    expect(calls.slice(1)).toEqual([
      ['diff-tree', '--no-commit-id', '--name-only', '-r', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
      ['diff-tree', '--no-commit-id', '--name-only', '-r', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb']
    ]);
  });
});
