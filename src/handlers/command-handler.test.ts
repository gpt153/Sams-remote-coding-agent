/**
 * Unit tests for command handler
 */
import { Conversation, Codebase, Session } from '../types';

// Mock fs/promises before importing the module under test
const mockAccess = jest.fn();
const mockReaddir = jest.fn();
const mockReadFile = jest.fn();
const mockWriteFile = jest.fn();

jest.mock('fs/promises', () => ({
  access: (...args: unknown[]) => mockAccess(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

// Mock child_process
const mockExec = jest.fn();
jest.mock('child_process', () => ({
  exec: (cmd: string, callback: (err: Error | null, result: { stdout: string }) => void) => {
    const result = mockExec(cmd);
    if (result instanceof Error) {
      callback(result, { stdout: '' });
    } else {
      callback(null, { stdout: result || '' });
    }
  },
}));

// Mock database modules
const mockUpdateConversation = jest.fn();
const mockFindCodebaseByRepoUrl = jest.fn();
const mockGetCodebase = jest.fn();
const mockCreateCodebase = jest.fn();
const mockGetActiveSession = jest.fn();
const mockDeactivateSession = jest.fn();

jest.mock('../db/conversations', () => ({
  updateConversation: (...args: unknown[]) => mockUpdateConversation(...args),
}));

jest.mock('../db/codebases', () => ({
  findCodebaseByRepoUrl: (...args: unknown[]) => mockFindCodebaseByRepoUrl(...args),
  getCodebase: (...args: unknown[]) => mockGetCodebase(...args),
  createCodebase: (...args: unknown[]) => mockCreateCodebase(...args),
  getCodebaseCommands: jest.fn().mockResolvedValue({}),
  updateCodebaseCommands: jest.fn().mockResolvedValue(undefined),
  registerCommand: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../db/sessions', () => ({
  getActiveSession: (...args: unknown[]) => mockGetActiveSession(...args),
  deactivateSession: (...args: unknown[]) => mockDeactivateSession(...args),
}));

import { parseCommand, handleCommand } from './command-handler';

describe('CommandHandler', () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseCommand', () => {
    test('should extract command and args from /clone command', () => {
      const result = parseCommand('/clone https://github.com/user/repo');
      expect(result.command).toBe('clone');
      expect(result.args).toEqual(['https://github.com/user/repo']);
    });

    test('should handle commands without args', () => {
      const result = parseCommand('/help');
      expect(result.command).toBe('help');
      expect(result.args).toEqual([]);
    });

    test('should handle /status command', () => {
      const result = parseCommand('/status');
      expect(result.command).toBe('status');
      expect(result.args).toEqual([]);
    });

    test('should handle /setcwd with path containing spaces', () => {
      const result = parseCommand('/setcwd /workspace/my repo');
      expect(result.command).toBe('setcwd');
      expect(result.args).toEqual(['/workspace/my', 'repo']);
    });

    test('should handle /reset command', () => {
      const result = parseCommand('/reset');
      expect(result.command).toBe('reset');
      expect(result.args).toEqual([]);
    });

    test('should handle command with multiple spaces', () => {
      const result = parseCommand('/clone   https://github.com/user/repo  ');
      expect(result.command).toBe('clone');
      expect(result.args).toEqual(['https://github.com/user/repo']);
    });

    test('should handle /getcwd command', () => {
      const result = parseCommand('/getcwd');
      expect(result.command).toBe('getcwd');
      expect(result.args).toEqual([]);
    });

    test('should parse quoted arguments', () => {
      const result = parseCommand('/command-invoke plan "Add dark mode"');
      expect(result.command).toBe('command-invoke');
      expect(result.args).toEqual(['plan', 'Add dark mode']);
    });

    test('should parse mixed quoted and unquoted args', () => {
      const result = parseCommand('/command-set test .test.md "Task: $1"');
      expect(result.command).toBe('command-set');
      expect(result.args).toEqual(['test', '.test.md', 'Task: $1']);
    });

    test('should parse /command-set', () => {
      const result = parseCommand('/command-set prime .claude/prime.md');
      expect(result.command).toBe('command-set');
      expect(result.args).toEqual(['prime', '.claude/prime.md']);
    });

    test('should parse /load-commands', () => {
      const result = parseCommand('/load-commands .claude/commands');
      expect(result.command).toBe('load-commands');
      expect(result.args).toEqual(['.claude/commands']);
    });

    test('should handle single quotes', () => {
      const result = parseCommand("/command-invoke plan 'Add dark mode'");
      expect(result.command).toBe('command-invoke');
      expect(result.args).toEqual(['plan', 'Add dark mode']);
    });

    test('should parse /repos', () => {
      const result = parseCommand('/repos');
      expect(result.command).toBe('repos');
      expect(result.args).toEqual([]);
    });

    // Bug fix tests: Multi-word quoted arguments should be preserved as single arg
    test('should preserve multi-word quoted string as single argument', () => {
      const result = parseCommand('/command-invoke plan "here is the request"');
      expect(result.command).toBe('command-invoke');
      expect(result.args).toEqual(['plan', 'here is the request']);
      // Specifically verify the second arg is the FULL quoted string
      expect(result.args[1]).toBe('here is the request');
    });

    test('should handle long quoted sentences', () => {
      const result = parseCommand(
        '/command-invoke execute "Implement the user authentication feature with JWT tokens"'
      );
      expect(result.command).toBe('command-invoke');
      expect(result.args).toEqual([
        'execute',
        'Implement the user authentication feature with JWT tokens',
      ]);
    });

    test('should handle multiple quoted arguments', () => {
      const result = parseCommand('/command-invoke test "first arg" "second arg" "third arg"');
      expect(result.command).toBe('command-invoke');
      expect(result.args).toEqual(['test', 'first arg', 'second arg', 'third arg']);
    });

    test('should handle mixed quoted and unquoted with spaces', () => {
      const result = parseCommand('/command-invoke plan "Add feature X" --flag value');
      expect(result.command).toBe('command-invoke');
      expect(result.args).toEqual(['plan', 'Add feature X', '--flag', 'value']);
    });

    test('should handle quoted arg with special characters', () => {
      const result = parseCommand('/command-invoke plan "Fix bug #123: handle edge case"');
      expect(result.command).toBe('command-invoke');
      expect(result.args).toEqual(['plan', 'Fix bug #123: handle edge case']);
    });

    test('should handle empty quoted string', () => {
      const result = parseCommand('/command-invoke plan ""');
      expect(result.command).toBe('command-invoke');
      // Empty quotes get matched by \S+ and stripped, resulting in empty string
      expect(result.args).toEqual(['plan', '']);
    });
  });

  describe('handleCommand', () => {
    // Test fixtures
    const mockConversation: Conversation = {
      id: 'conv-123',
      platform_type: 'test',
      platform_conversation_id: 'test-conv-123',
      codebase_id: null,
      cwd: null,
      ai_assistant_type: 'claude',
      created_at: new Date(),
      updated_at: new Date(),
    };

    const mockCodebase: Codebase = {
      id: 'codebase-456',
      name: 'test-repo',
      repository_url: 'https://github.com/user/test-repo',
      default_cwd: '/workspace/test-repo',
      ai_assistant_type: 'claude',
      commands: {},
      created_at: new Date(),
      updated_at: new Date(),
    };

    const mockSession: Session = {
      id: 'session-789',
      conversation_id: 'conv-123',
      codebase_id: 'codebase-456',
      ai_assistant_type: 'claude',
      assistant_session_id: 'assistant-session-abc',
      active: true,
      metadata: {},
      started_at: new Date(),
      ended_at: null,
    };

    describe('/clone command', () => {
      describe('when directory exists and codebase found', () => {
        test('links conversation to existing codebase (URL without .git)', async () => {
          // Directory exists
          mockAccess.mockResolvedValueOnce(undefined);
          // Codebase found on first URL check (without .git)
          mockFindCodebaseByRepoUrl.mockResolvedValueOnce(mockCodebase);
          // No active session
          mockGetActiveSession.mockResolvedValueOnce(null);
          // No command folders
          mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
          mockAccess.mockRejectedValueOnce(new Error('ENOENT'));

          const result = await handleCommand(
            mockConversation,
            '/clone https://github.com/user/test-repo'
          );

          expect(result.success).toBe(true);
          expect(result.message).toContain('Repository already cloned');
          expect(result.message).toContain('Linked to existing codebase: test-repo');
          expect(result.message).toContain('Session reset');
          expect(result.modified).toBe(true);

          // Verify conversation was updated
          expect(mockUpdateConversation).toHaveBeenCalledWith('conv-123', {
            codebase_id: 'codebase-456',
            cwd: '/workspace/test-repo',
          });
        });

        test('links conversation to existing codebase (URL with .git fallback)', async () => {
          // Directory exists
          mockAccess.mockResolvedValueOnce(undefined);
          // First URL check (without .git) returns null
          mockFindCodebaseByRepoUrl.mockResolvedValueOnce(null);
          // Second URL check (with .git) returns codebase
          const codebaseWithGit = {
            ...mockCodebase,
            repository_url: 'https://github.com/user/test-repo.git',
          };
          mockFindCodebaseByRepoUrl.mockResolvedValueOnce(codebaseWithGit);
          // No active session
          mockGetActiveSession.mockResolvedValueOnce(null);
          // No command folders
          mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
          mockAccess.mockRejectedValueOnce(new Error('ENOENT'));

          const result = await handleCommand(
            mockConversation,
            '/clone https://github.com/user/test-repo'
          );

          expect(result.success).toBe(true);
          expect(result.message).toContain('Linked to existing codebase');

          // Verify both URL variants were checked
          expect(mockFindCodebaseByRepoUrl).toHaveBeenCalledTimes(2);
          expect(mockFindCodebaseByRepoUrl).toHaveBeenNthCalledWith(
            1,
            'https://github.com/user/test-repo'
          );
          expect(mockFindCodebaseByRepoUrl).toHaveBeenNthCalledWith(
            2,
            'https://github.com/user/test-repo.git'
          );
        });

        test('deactivates existing session when linking to codebase', async () => {
          // Directory exists
          mockAccess.mockResolvedValueOnce(undefined);
          // Codebase found
          mockFindCodebaseByRepoUrl.mockResolvedValueOnce(mockCodebase);
          // Active session exists
          mockGetActiveSession.mockResolvedValueOnce(mockSession);
          // No command folders
          mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
          mockAccess.mockRejectedValueOnce(new Error('ENOENT'));

          const result = await handleCommand(
            mockConversation,
            '/clone https://github.com/user/test-repo'
          );

          expect(result.success).toBe(true);
          expect(mockDeactivateSession).toHaveBeenCalledWith('session-789');
        });

        test('detects .claude/commands folder and includes in response', async () => {
          // Directory exists
          mockAccess.mockResolvedValueOnce(undefined);
          // Codebase found
          mockFindCodebaseByRepoUrl.mockResolvedValueOnce(mockCodebase);
          // No active session
          mockGetActiveSession.mockResolvedValueOnce(null);
          // .claude/commands exists
          mockAccess.mockResolvedValueOnce(undefined);

          const result = await handleCommand(
            mockConversation,
            '/clone https://github.com/user/test-repo'
          );

          expect(result.success).toBe(true);
          expect(result.message).toContain('Found: .claude/commands/');
          expect(result.message).toContain('Use /load-commands .claude/commands');
        });

        test('detects .agents/commands folder when .claude/commands not found', async () => {
          // Directory exists
          mockAccess.mockResolvedValueOnce(undefined);
          // Codebase found
          mockFindCodebaseByRepoUrl.mockResolvedValueOnce(mockCodebase);
          // No active session
          mockGetActiveSession.mockResolvedValueOnce(null);
          // .claude/commands does not exist
          mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
          // .agents/commands exists
          mockAccess.mockResolvedValueOnce(undefined);

          const result = await handleCommand(
            mockConversation,
            '/clone https://github.com/user/test-repo'
          );

          expect(result.success).toBe(true);
          expect(result.message).toContain('Found: .agents/commands/');
          expect(result.message).toContain('Use /load-commands .agents/commands');
        });

        test('handles SSH URL format by converting to HTTPS', async () => {
          // Directory exists
          mockAccess.mockResolvedValueOnce(undefined);
          // Codebase found (stored with HTTPS URL)
          mockFindCodebaseByRepoUrl.mockResolvedValueOnce(mockCodebase);
          // No active session
          mockGetActiveSession.mockResolvedValueOnce(null);
          // No command folders
          mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
          mockAccess.mockRejectedValueOnce(new Error('ENOENT'));

          const result = await handleCommand(
            mockConversation,
            '/clone git@github.com:user/test-repo.git'
          );

          expect(result.success).toBe(true);
          expect(result.message).toContain('Linked to existing codebase');

          // Verify URL was converted to HTTPS format
          expect(mockFindCodebaseByRepoUrl).toHaveBeenCalledWith(
            'https://github.com/user/test-repo'
          );
        });
      });

      describe('when directory exists but no codebase found', () => {
        test('returns helpful error message with options', async () => {
          // Directory exists
          mockAccess.mockResolvedValueOnce(undefined);
          // No codebase found for either URL variant
          mockFindCodebaseByRepoUrl.mockResolvedValueOnce(null);
          mockFindCodebaseByRepoUrl.mockResolvedValueOnce(null);

          const result = await handleCommand(
            mockConversation,
            '/clone https://github.com/user/unknown-repo'
          );

          expect(result.success).toBe(false);
          expect(result.message).toContain('Directory already exists');
          expect(result.message).toContain('No matching codebase found in database');
          expect(result.message).toContain('Remove the directory and re-clone');
          expect(result.message).toContain('Use /setcwd');
        });
      });

      describe('when directory does not exist (fresh clone)', () => {
        test('clones repository and creates new codebase', async () => {
          // Directory does not exist
          mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
          // Git clone succeeds
          mockExec.mockReturnValue('');
          // Create codebase
          const newCodebase = { ...mockCodebase, id: 'new-codebase-123' };
          mockCreateCodebase.mockResolvedValueOnce(newCodebase);
          // No active session
          mockGetActiveSession.mockResolvedValueOnce(null);
          // No .codex or .claude folder detection
          mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
          mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
          // No command folders
          mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
          mockAccess.mockRejectedValueOnce(new Error('ENOENT'));

          const result = await handleCommand(
            mockConversation,
            '/clone https://github.com/user/test-repo'
          );

          expect(result.success).toBe(true);
          expect(result.message).toContain('Repository cloned successfully');
          expect(result.message).toContain('Codebase: test-repo');
          expect(result.modified).toBe(true);

          // Verify codebase was created
          expect(mockCreateCodebase).toHaveBeenCalledWith({
            name: 'test-repo',
            repository_url: 'https://github.com/user/test-repo',
            default_cwd: '/workspace/test-repo',
            ai_assistant_type: 'claude',
          });

          // Verify conversation was updated
          expect(mockUpdateConversation).toHaveBeenCalledWith('conv-123', {
            codebase_id: 'new-codebase-123',
            cwd: '/workspace/test-repo',
          });
        });

        test('returns error when git clone fails', async () => {
          // Directory does not exist
          mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
          // Git clone fails
          mockExec.mockReturnValue(new Error('fatal: repository not found'));

          const result = await handleCommand(
            mockConversation,
            '/clone https://github.com/user/nonexistent-repo'
          );

          expect(result.success).toBe(false);
          expect(result.message).toContain('Failed to clone repository');
        });
      });

      describe('edge cases', () => {
        test('handles URL with trailing slash', async () => {
          // Directory exists
          mockAccess.mockResolvedValueOnce(undefined);
          // Codebase found
          mockFindCodebaseByRepoUrl.mockResolvedValueOnce(mockCodebase);
          // No active session
          mockGetActiveSession.mockResolvedValueOnce(null);
          // No command folders
          mockAccess.mockRejectedValueOnce(new Error('ENOENT'));
          mockAccess.mockRejectedValueOnce(new Error('ENOENT'));

          const result = await handleCommand(
            mockConversation,
            '/clone https://github.com/user/test-repo/'
          );

          expect(result.success).toBe(true);
          // URL should be normalized (trailing slash removed)
          expect(mockFindCodebaseByRepoUrl).toHaveBeenCalledWith(
            'https://github.com/user/test-repo'
          );
        });

        test('returns error when no URL provided', async () => {
          const result = await handleCommand(mockConversation, '/clone');

          expect(result.success).toBe(false);
          expect(result.message).toContain('Usage: /clone <repo-url>');
        });
      });
    });

    describe('/help command', () => {
      test('returns help message', async () => {
        const result = await handleCommand(mockConversation, '/help');

        expect(result.success).toBe(true);
        expect(result.message).toContain('Available Commands');
        expect(result.message).toContain('/clone');
        expect(result.message).toContain('/status');
      });
    });

    describe('/status command', () => {
      test('shows status without codebase', async () => {
        const result = await handleCommand(mockConversation, '/status');

        expect(result.success).toBe(true);
        expect(result.message).toContain('Platform: test');
        expect(result.message).toContain('No codebase configured');
      });

      test('shows status with codebase', async () => {
        const convWithCodebase = { ...mockConversation, codebase_id: 'codebase-456' };
        mockGetCodebase.mockResolvedValueOnce(mockCodebase);
        mockGetActiveSession.mockResolvedValueOnce(null);

        const result = await handleCommand(convWithCodebase, '/status');

        expect(result.success).toBe(true);
        expect(result.message).toContain('Codebase: test-repo');
        expect(result.message).toContain('Repository: https://github.com/user/test-repo');
      });
    });

    describe('/reset command', () => {
      test('deactivates active session', async () => {
        mockGetActiveSession.mockResolvedValueOnce(mockSession);

        const result = await handleCommand(mockConversation, '/reset');

        expect(result.success).toBe(true);
        expect(result.message).toContain('Session cleared');
        expect(mockDeactivateSession).toHaveBeenCalledWith('session-789');
      });

      test('handles no active session', async () => {
        mockGetActiveSession.mockResolvedValueOnce(null);

        const result = await handleCommand(mockConversation, '/reset');

        expect(result.success).toBe(true);
        expect(result.message).toContain('No active session to reset');
      });
    });

    describe('unknown command', () => {
      test('returns error for unknown command', async () => {
        const result = await handleCommand(mockConversation, '/unknown');

        expect(result.success).toBe(false);
        expect(result.message).toContain('Unknown command: /unknown');
        expect(result.message).toContain('/help');
      });
    });
  });
});
