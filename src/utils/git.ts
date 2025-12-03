import { readFile } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execFileAsync = promisify(execFile);

/**
 * Check if a path is inside a git worktree (vs main repo)
 * Worktrees have a .git FILE, main repos have a .git DIRECTORY
 */
export async function isWorktreePath(path: string): Promise<boolean> {
  try {
    const gitPath = join(path, '.git');
    const content = await readFile(gitPath, 'utf-8');
    // Worktree .git file contains "gitdir: /path/to/main/.git/worktrees/..."
    return content.startsWith('gitdir:');
  } catch {
    return false;
  }
}

/**
 * Create a git worktree for an issue or PR
 * Returns the worktree path
 */
export async function createWorktreeForIssue(
  repoPath: string,
  issueNumber: number,
  isPR: boolean
): Promise<string> {
  const branchName = isPR ? `pr-${String(issueNumber)}` : `issue-${String(issueNumber)}`;
  const worktreePath = join(repoPath, '..', 'worktrees', branchName);

  try {
    // Try to create with new branch
    await execFileAsync('git', ['-C', repoPath, 'worktree', 'add', worktreePath, '-b', branchName], {
      timeout: 30000,
    });
  } catch (error) {
    const err = error as Error & { stderr?: string };
    // Branch already exists - use existing branch
    if (err.stderr?.includes('already exists')) {
      await execFileAsync('git', ['-C', repoPath, 'worktree', 'add', worktreePath, branchName], {
        timeout: 30000,
      });
    } else {
      throw error;
    }
  }

  return worktreePath;
}

/**
 * Remove a git worktree
 * Throws if uncommitted changes exist (git's natural guardrail)
 */
export async function removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
  await execFileAsync('git', ['-C', repoPath, 'worktree', 'remove', worktreePath], {
    timeout: 30000,
  });
}

/**
 * Get canonical repo path from a worktree path
 * If already canonical, returns the same path
 */
export async function getCanonicalRepoPath(path: string): Promise<string> {
  if (await isWorktreePath(path)) {
    // Read .git file to find main repo
    const gitPath = join(path, '.git');
    const content = await readFile(gitPath, 'utf-8');
    // gitdir: /path/to/repo/.git/worktrees/branch-name
    const match = /gitdir: (.+)\/\.git\/worktrees\//.exec(content);
    if (match) {
      return match[1];
    }
  }
  return path;
}
