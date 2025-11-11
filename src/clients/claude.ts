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
          // Extract text content from assistant message
          const message = msg.message;
          const text = message.content
            .filter((c: any): c is { type: 'text'; text: string } => c.type === 'text')
            .map((c: { type: 'text'; text: string }) => c.text)
            .join('');

          if (text) {
            yield { type: 'assistant', content: text };
          }
        } else if (msg.type === 'result') {
          // Extract session ID for persistence
          yield { type: 'result', sessionId: msg.session_id };
        }
        // Ignore other message types (system, thinking, etc.)
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
