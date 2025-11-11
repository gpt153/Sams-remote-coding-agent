/**
 * Claude Agent SDK wrapper
 * Provides async generator interface for streaming Claude responses
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import { IAssistantClient, MessageChunk } from '../types';

/**
 * Claude AI assistant client
 * Implements generic IAssistantClient interface
 */
export class ClaudeClient implements IAssistantClient {
  /**
   * Send a query to Claude and stream responses
   * @param prompt - User message or prompt
   * @param cwd - Working directory for Claude
   * @param resumeSessionId - Optional session ID to resume
   */
  async *sendQuery(
    prompt: string,
    cwd: string,
    resumeSessionId?: string
  ): AsyncGenerator<MessageChunk> {
    const options: any = {
      cwd,
      env: {
        PATH: process.env.PATH,
        ...process.env
      }
    };

    if (resumeSessionId) {
      options.resume = resumeSessionId;
      console.log(`[Claude] Resuming session: ${resumeSessionId}`);
    } else {
      console.log(`[Claude] Starting new session in ${cwd}`);
    }

    try {
      for await (const msg of query({ prompt, options })) {
        if (msg.type === 'assistant') {
          // Process assistant message content blocks
          const message = msg.message;

          for (const block of message.content) {
            // Text blocks - assistant responses
            if (block.type === 'text' && block.text) {
              yield { type: 'assistant', content: block.text };
            }

            // Tool use blocks - tool calls
            else if (block.type === 'tool_use') {
              yield {
                type: 'tool',
                toolName: block.name,
                toolInput: block.input || {}
              };
            }
          }
        } else if (msg.type === 'result') {
          // Extract session ID for persistence
          yield { type: 'result', sessionId: msg.session_id };
        }
        // Ignore other message types (system, thinking, tool_result, etc.)
      }
    } catch (error) {
      console.error('[Claude] Query error:', error);
      throw error;
    }
  }

  /**
   * Get the assistant type identifier
   */
  getType(): string {
    return 'claude';
  }
}
