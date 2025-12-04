import {
  isWorktreePath,
  getCanonicalRepoPath,
  getWorktreeBase,
  worktreeExists,
  listWorktrees,
  findWorktreeByBranch,
} from './git';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import { execFile } from 'child_process';

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

const mockExecFile = execFile as unknown as jest.Mock;

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

  describe('getWorktreeBase', () => {
    const originalEnv = process.env.WORKTREE_BASE;

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.WORKTREE_BASE;
      } else {
        process.env.WORKTREE_BASE = originalEnv;
      }
    });

    it('returns sibling worktrees dir by default', () => {
      delete process.env.WORKTREE_BASE;
      const result = getWorktreeBase('/workspace/my-repo');
      expect(result).toBe(join('/workspace/my-repo', '..', 'worktrees'));
    });

    it('uses WORKTREE_BASE env var when set', () => {
      process.env.WORKTREE_BASE = '/custom/worktrees';
      const result = getWorktreeBase('/workspace/my-repo');
      expect(result).toBe('/custom/worktrees');
    });

    it('expands tilde to home directory', () => {
      process.env.WORKTREE_BASE = '~/tmp/worktrees';
      const result = getWorktreeBase('/workspace/my-repo');
      expect(result).toBe(join(homedir(), 'tmp/worktrees'));
    });
  });

  describe('worktreeExists', () => {
    it('returns true when path and .git exist', async () => {
      await mkdir(join(testDir, 'worktree-test'), { recursive: true });
      await writeFile(join(testDir, 'worktree-test', '.git'), 'gitdir: /some/path');

      const result = await worktreeExists(join(testDir, 'worktree-test'));
      expect(result).toBe(true);
    });

    it('returns false when path does not exist', async () => {
      const result = await worktreeExists(join(testDir, 'nonexistent'));
      expect(result).toBe(false);
    });

    it('returns false when .git does not exist', async () => {
      await mkdir(join(testDir, 'no-git'), { recursive: true });
      const result = await worktreeExists(join(testDir, 'no-git'));
      expect(result).toBe(false);
    });
  });

  describe('listWorktrees', () => {
    it('parses git worktree list --porcelain output', async () => {
      const mockOutput = `worktree /path/to/main
HEAD abc123
branch refs/heads/main

worktree /path/to/feature
HEAD def456
branch refs/heads/feature/auth

`;
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          _opts: unknown,
          callback: (err: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          callback(null, { stdout: mockOutput, stderr: '' });
        }
      );

      const result = await listWorktrees('/path/to/main');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ path: '/path/to/main', branch: 'main' });
      expect(result[1]).toEqual({ path: '/path/to/feature', branch: 'feature/auth' });
    });

    it('returns empty array on error', async () => {
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          _opts: unknown,
          callback: (err: Error | null) => void
        ) => {
          callback(new Error('git not found'));
        }
      );

      const result = await listWorktrees('/path/to/repo');
      expect(result).toEqual([]);
    });
  });

  describe('findWorktreeByBranch', () => {
    beforeEach(() => {
      const mockOutput = `worktree /workspace/main
HEAD abc123
branch refs/heads/main

worktree /workspace/worktrees/feature-auth
HEAD def456
branch refs/heads/feature/auth

`;
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          _opts: unknown,
          callback: (err: Error | null, result: { stdout: string; stderr: string }) => void
        ) => {
          callback(null, { stdout: mockOutput, stderr: '' });
        }
      );
    });

    it('finds exact branch match', async () => {
      const result = await findWorktreeByBranch('/workspace/main', 'feature/auth');
      expect(result).toBe('/workspace/worktrees/feature-auth');
    });

    it('finds slugified branch match', async () => {
      // Skill creates worktrees with slugified names (feature-auth instead of feature/auth)
      const result = await findWorktreeByBranch('/workspace/main', 'feature-auth');
      expect(result).toBe('/workspace/worktrees/feature-auth');
    });

    it('returns null when no match', async () => {
      const result = await findWorktreeByBranch('/workspace/main', 'nonexistent');
      expect(result).toBeNull();
    });
  });
});
