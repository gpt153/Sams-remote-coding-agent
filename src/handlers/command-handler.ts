/**
 * Command handler for slash commands
 * Handles deterministic operations without AI
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import { Conversation, CommandResult } from '../types';
import * as db from '../db/conversations';
import * as codebaseDb from '../db/codebases';
import * as sessionDb from '../db/sessions';

const execAsync = promisify(exec);

export function parseCommand(text: string): { command: string; args: string[] } {
  const parts = text.trim().split(/\s+/);
  return {
    command: parts[0].substring(1), // Remove leading '/'
    args: parts.slice(1)
  };
}

export async function handleCommand(
  conversation: Conversation,
  message: string
): Promise<CommandResult> {
  const { command, args } = parseCommand(message);

  switch (command) {
    case 'help':
      return {
        success: true,
        message: `Available Commands:
/help - Show this help message
/status - Show conversation state
/getcwd - Show current working directory
/setcwd <path> - Set working directory
/clone <repo-url> - Clone GitHub repository
/reset - Clear active session`
      };

    case 'status': {
      let msg = `Platform: ${conversation.platform_type}\nAI Assistant: ${conversation.ai_assistant_type}`;

      if (conversation.codebase_id) {
        const cb = await codebaseDb.getCodebase(conversation.codebase_id);
        if (cb) {
          msg += `\n\nCodebase: ${cb.name}`;
          if (cb.repository_url) {
            msg += `\nRepository: ${cb.repository_url}`;
          }
        }
      } else {
        msg += '\n\nNo codebase configured. Use /clone <repo-url> to get started.';
      }

      msg += `\n\nCurrent Working Directory: ${conversation.cwd || 'Not set'}`;

      const session = await sessionDb.getActiveSession(conversation.id);
      if (session) {
        msg += `\nActive Session: ${session.id.substring(0, 8)}...`;
      }

      return { success: true, message: msg };
    }

    case 'getcwd':
      return {
        success: true,
        message: `Current working directory: ${conversation.cwd || 'Not set'}`
      };

    case 'setcwd': {
      if (args.length === 0) {
        return { success: false, message: 'Usage: /setcwd <path>' };
      }
      const newCwd = args.join(' ');
      await db.updateConversation(conversation.id, { cwd: newCwd });
      return {
        success: true,
        message: `Working directory set to: ${newCwd}`,
        modified: true
      };
    }

    case 'clone': {
      if (args.length === 0) {
        return { success: false, message: 'Usage: /clone <repo-url>' };
      }

      const repoUrl = args[0];
      const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'unknown';
      // Inside Docker container, always use /workspace (mounted volume)
      const workspacePath = '/workspace';
      const targetPath = `${workspacePath}/${repoName}`;

      try {
        console.log(`[Clone] Cloning ${repoUrl} to ${targetPath}`);
        await execAsync(`git clone ${repoUrl} ${targetPath}`);

        const codebase = await codebaseDb.createCodebase({
          name: repoName,
          repository_url: repoUrl,
          default_cwd: targetPath
        });

        await db.updateConversation(conversation.id, {
          codebase_id: codebase.id,
          cwd: targetPath
        });

        return {
          success: true,
          message: `Repository cloned successfully!\n\nCodebase: ${repoName}\nPath: ${targetPath}\n\nYou can now start asking questions about the code.`,
          modified: true
        };
      } catch (error) {
        const err = error as Error;
        console.error('[Clone] Failed:', err);
        return {
          success: false,
          message: `Failed to clone repository: ${err.message}`
        };
      }
    }

    case 'reset': {
      const session = await sessionDb.getActiveSession(conversation.id);
      if (session) {
        await sessionDb.deactivateSession(session.id);
        return {
          success: true,
          message: 'Session cleared. Starting fresh on next message.\n\nCodebase configuration preserved.'
        };
      }
      return {
        success: true,
        message: 'No active session to reset.'
      };
    }

    default:
      return {
        success: false,
        message: `Unknown command: /${command}\n\nType /help to see available commands.`
      };
  }
}
