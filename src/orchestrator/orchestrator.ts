/**
 * Orchestrator - Main conversation handler
 * Routes slash commands and AI messages appropriately
 */
import { IPlatformAdapter, IAssistantClient } from '../types';
import * as db from '../db/conversations';
import * as codebaseDb from '../db/codebases';
import * as sessionDb from '../db/sessions';
import * as commandHandler from '../handlers/command-handler';
import { formatToolCall } from '../utils/tool-formatter';

export async function handleMessage(
  platform: IPlatformAdapter,
  aiClient: IAssistantClient,
  conversationId: string,
  message: string
): Promise<void> {
  try {
    console.log(`[Orchestrator] Handling message for conversation ${conversationId}`);

    // Get or create conversation
    let conversation = await db.getOrCreateConversation('telegram', conversationId);

    // Handle slash commands
    if (message.startsWith('/')) {
      console.log(`[Orchestrator] Processing slash command: ${message}`);
      const result = await commandHandler.handleCommand(conversation, message);
      await platform.sendMessage(conversationId, result.message);

      // Reload conversation if modified
      if (result.modified) {
        conversation = await db.getOrCreateConversation('telegram', conversationId);
      }
      return;
    }

    // Require codebase for AI conversations
    if (!conversation.codebase_id) {
      await platform.sendMessage(
        conversationId,
        'No codebase configured. Use /clone <repo-url> to get started.'
      );
      return;
    }

    console.log(`[Orchestrator] Starting AI conversation`);

    // Get or create session
    let session = await sessionDb.getActiveSession(conversation.id);
    const codebase = await codebaseDb.getCodebase(conversation.codebase_id);
    const cwd = conversation.cwd || codebase?.default_cwd || '/workspace';

    if (!session) {
      console.log(`[Orchestrator] Creating new session for conversation ${conversation.id}`);
      session = await sessionDb.createSession({
        conversation_id: conversation.id,
        codebase_id: conversation.codebase_id
      });
    } else {
      console.log(`[Orchestrator] Resuming session ${session.id}`);
    }

    // Send to AI and stream responses
    const mode = platform.getStreamingMode();
    console.log(`[Orchestrator] Streaming mode: ${mode}`);

    if (mode === 'stream') {
      // Stream mode: Send each chunk immediately
      for await (const msg of aiClient.sendQuery(message, cwd, session.assistant_session_id || undefined)) {
        if (msg.type === 'assistant' && msg.content) {
          await platform.sendMessage(conversationId, msg.content);
        } else if (msg.type === 'tool' && msg.toolName) {
          // Format and send tool call notification
          const toolMessage = formatToolCall(msg.toolName, msg.toolInput);
          await platform.sendMessage(conversationId, toolMessage);
        } else if (msg.type === 'result' && msg.sessionId) {
          // Save session ID for resume
          await sessionDb.updateSession(session.id, msg.sessionId);
        }
      }
    } else {
      // Batch mode: Accumulate chunks, send final response
      const buffer: string[] = [];
      for await (const msg of aiClient.sendQuery(message, cwd, session.assistant_session_id || undefined)) {
        if (msg.type === 'assistant' && msg.content) {
          buffer.push(msg.content);
        } else if (msg.type === 'tool' && msg.toolName) {
          // Format and add tool call notification to buffer
          const toolMessage = formatToolCall(msg.toolName, msg.toolInput);
          buffer.push(toolMessage);
        } else if (msg.type === 'result' && msg.sessionId) {
          await sessionDb.updateSession(session.id, msg.sessionId);
        }
      }

      if (buffer.length > 0) {
        await platform.sendMessage(conversationId, buffer.join('\n\n'));
      }
    }

    console.log(`[Orchestrator] Message handling complete`);
  } catch (error) {
    console.error('[Orchestrator] Error:', error);
    await platform.sendMessage(
      conversationId,
      '⚠️ An error occurred. Try /reset to start a fresh session.'
    );
  }
}
