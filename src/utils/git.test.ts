import { isWorktreePath, getCanonicalRepoPath } from './git';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('git utilities', () => {
  const testDir = join(tmpdir(), 'git-utils-test-' + Date.now());

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('isWorktreePath', () => {
    it('returns false for directory without .git', async () => {
      const result = await isWorktreePath(testDir);
      expect(result).toBe(false);
    });

    it('returns false for main repo (.git directory)', async () => {
      await mkdir(join(testDir, '.git'));
      const result = await isWorktreePath(testDir);
      expect(result).toBe(false);
    });

    it('returns true for worktree (.git file with gitdir)', async () => {
      await writeFile(
        join(testDir, '.git'),
        'gitdir: /some/repo/.git/worktrees/branch-name'
      );
      const result = await isWorktreePath(testDir);
      expect(result).toBe(true);
    });

    it('returns false for .git file without gitdir prefix', async () => {
      await writeFile(join(testDir, '.git'), 'some other content');
      const result = await isWorktreePath(testDir);
      expect(result).toBe(false);
    });
  });

  describe('getCanonicalRepoPath', () => {
    it('returns same path for non-worktree', async () => {
      const result = await getCanonicalRepoPath(testDir);
      expect(result).toBe(testDir);
    });

    it('returns same path for main repo with .git directory', async () => {
      await mkdir(join(testDir, '.git'));
      const result = await getCanonicalRepoPath(testDir);
      expect(result).toBe(testDir);
    });

    it('extracts main repo path from worktree', async () => {
      await writeFile(
        join(testDir, '.git'),
        'gitdir: /workspace/my-repo/.git/worktrees/issue-42'
      );
      const result = await getCanonicalRepoPath(testDir);
      expect(result).toBe('/workspace/my-repo');
    });

    it('handles worktree path with nested directories', async () => {
      await writeFile(
        join(testDir, '.git'),
        'gitdir: /home/user/projects/my-app/.git/worktrees/feature-branch'
      );
      const result = await getCanonicalRepoPath(testDir);
      expect(result).toBe('/home/user/projects/my-app');
    });
  });
});
