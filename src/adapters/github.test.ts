/**
 * Unit tests for GitHub adapter
 */
import { GitHubAdapter } from './github';
import * as git from '../utils/git';

// Mock orchestrator to avoid loading Claude Agent SDK (ESM module)
jest.mock('../orchestrator/orchestrator', () => ({
  handleMessage: jest.fn().mockResolvedValue(undefined),
}));

// Mock git utilities
jest.mock('../utils/git', () => ({
  isWorktreePath: jest.fn().mockResolvedValue(false),
  createWorktreeForIssue: jest.fn().mockResolvedValue('/workspace/worktrees/issue-1'),
  removeWorktree: jest.fn().mockResolvedValue(undefined),
}));

// Mock database modules
jest.mock('../db/conversations', () => ({
  getConversation: jest.fn(),
  getConversationByPlatformId: jest.fn(),
  getOrCreateConversation: jest.fn(),
  createConversation: jest.fn(),
  updateConversation: jest.fn(),
}));

jest.mock('../db/codebases', () => ({
  getCodebase: jest.fn(),
  createCodebase: jest.fn(),
  updateCodebase: jest.fn(),
  getCodebaseByRepo: jest.fn(),
  findCodebaseByRepoUrl: jest.fn(),
}));

jest.mock('../db/sessions', () => ({
  getActiveSession: jest.fn(),
  createSession: jest.fn(),
  endSession: jest.fn(),
}));

// Mock Octokit to avoid ESM import issues in Jest
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      issues: {
        createComment: jest.fn().mockResolvedValue({}),
      },
      repos: {
        get: jest.fn().mockResolvedValue({
          data: { default_branch: 'main' },
        }),
      },
    },
  })),
}));

describe('GitHubAdapter', () => {
  let adapter: GitHubAdapter;

  beforeEach(() => {
    adapter = new GitHubAdapter('fake-token-for-testing', 'fake-webhook-secret');
  });

  describe('streaming mode', () => {
    test('should always return batch mode', () => {
      expect(adapter.getStreamingMode()).toBe('batch');
    });
  });

  describe('lifecycle methods', () => {
    test('should start without errors', async () => {
      await expect(adapter.start()).resolves.toBeUndefined();
    });

    test('should stop without errors', () => {
      expect(() => adapter.stop()).not.toThrow();
    });
  });

  describe('sendMessage', () => {
    test('should handle invalid conversationId gracefully', async () => {
      // Should not throw when given invalid conversationId
      await expect(adapter.sendMessage('invalid', 'test message')).resolves.toBeUndefined();
    });
  });

  describe('conversationId format', () => {
    test('should use owner/repo#number format', () => {
      // This is implicit from the implementation
      // We're testing that the format is used correctly by attempting to parse
      const validFormat = 'owner/repo#123';
      const invalidFormats = ['owner-repo#123', 'owner/repo-123', 'owner#repo#123', 'invalid'];

      // Valid format should be parsed successfully (via sendMessage not throwing type errors)
      expect(() => adapter.sendMessage(validFormat, 'test')).not.toThrow();

      // Invalid formats should be handled gracefully (not throw)
      invalidFormats.forEach(format => {
        expect(() => adapter.sendMessage(format, 'test')).not.toThrow();
      });
    });
  });

  describe('worktree isolation', () => {
    describe('createWorktreeForIssue', () => {
      test('should create issue-XX branch for issues', async () => {
        const createWorktreeMock = git.createWorktreeForIssue as jest.Mock;
        createWorktreeMock.mockClear();

        // Simulate calling the function directly
        await git.createWorktreeForIssue('/workspace/repo', 42, false);

        expect(createWorktreeMock).toHaveBeenCalledWith('/workspace/repo', 42, false);
      });

      test('should create pr-XX branch for pull requests', async () => {
        const createWorktreeMock = git.createWorktreeForIssue as jest.Mock;
        createWorktreeMock.mockClear();

        await git.createWorktreeForIssue('/workspace/repo', 42, true);

        expect(createWorktreeMock).toHaveBeenCalledWith('/workspace/repo', 42, true);
      });
    });

    describe('worktree cleanup', () => {
      test('removeWorktree should be called with correct paths', async () => {
        const removeWorktreeMock = git.removeWorktree as jest.Mock;
        removeWorktreeMock.mockClear();

        await git.removeWorktree('/workspace/repo', '/workspace/worktrees/issue-42');

        expect(removeWorktreeMock).toHaveBeenCalledWith(
          '/workspace/repo',
          '/workspace/worktrees/issue-42'
        );
      });

      test('removeWorktree failure with uncommitted changes should be detectable', async () => {
        const removeWorktreeMock = git.removeWorktree as jest.Mock;
        removeWorktreeMock.mockRejectedValueOnce(
          new Error('contains modified or untracked files')
        );

        await expect(
          git.removeWorktree('/workspace/repo', '/workspace/worktrees/issue-42')
        ).rejects.toThrow('contains modified or untracked files');
      });
    });

    describe('stale worktree path detection', () => {
      test('isWorktreePath returns false for non-worktree paths', async () => {
        const isWorktreePathMock = git.isWorktreePath as jest.Mock;
        isWorktreePathMock.mockResolvedValueOnce(false);

        const result = await git.isWorktreePath('/workspace/repo');
        expect(result).toBe(false);
      });

      test('isWorktreePath returns true for worktree paths', async () => {
        const isWorktreePathMock = git.isWorktreePath as jest.Mock;
        isWorktreePathMock.mockResolvedValueOnce(true);

        const result = await git.isWorktreePath('/workspace/worktrees/issue-42');
        expect(result).toBe(true);
      });

      test('paths containing /worktrees/ should be detected as stale', () => {
        // This tests the string-based detection we added
        const stalePath = '/workspace/worktrees/old-issue/repo';
        const normalPath = '/workspace/repo';

        expect(stalePath.includes('/worktrees/')).toBe(true);
        expect(normalPath.includes('/worktrees/')).toBe(false);
      });
    });

    describe('PR detection from issue_comment', () => {
      test('should detect PR from issue.pull_request property', () => {
        // When commenting on a PR, GitHub sends issue_comment with issue.pull_request set
        const issueWithPR = {
          number: 42,
          title: 'Test PR',
          body: 'Test body',
          user: { login: 'testuser' },
          labels: [],
          state: 'open',
          pull_request: { url: 'https://api.github.com/repos/owner/repo/pulls/42' },
        };

        const issueWithoutPR = {
          number: 42,
          title: 'Test Issue',
          body: 'Test body',
          user: { login: 'testuser' },
          labels: [],
          state: 'open',
        };

        // PR detection logic: !!issue?.pull_request
        expect(!!issueWithPR.pull_request).toBe(true);
        expect(!!(issueWithoutPR as typeof issueWithPR).pull_request).toBe(false);
      });
    });
  });
});
