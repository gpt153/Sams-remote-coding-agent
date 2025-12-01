// Mock the Claude and Codex clients before importing factory
jest.mock('./claude', () => ({
  ClaudeClient: jest.fn().mockImplementation(() => ({
    getType: () => 'claude',
  })),
}));

jest.mock('./codex', () => ({
  CodexClient: jest.fn().mockImplementation(() => ({
    getType: () => 'codex',
  })),
}));

import { getAssistantClient } from './factory';
import { ClaudeClient } from './claude';
import { CodexClient } from './codex';

describe('factory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAssistantClient', () => {
    test('returns ClaudeClient for claude type', () => {
      const client = getAssistantClient('claude');

      expect(ClaudeClient).toHaveBeenCalledTimes(1);
      expect(client.getType()).toBe('claude');
    });

    test('returns CodexClient for codex type', () => {
      const client = getAssistantClient('codex');

      expect(CodexClient).toHaveBeenCalledTimes(1);
      expect(client.getType()).toBe('codex');
    });

    test('throws error for unknown type', () => {
      expect(() => getAssistantClient('unknown')).toThrow(
        "Unknown assistant type: unknown. Supported types: 'claude', 'codex'"
      );
    });

    test('throws error for empty string', () => {
      expect(() => getAssistantClient('')).toThrow(
        "Unknown assistant type: . Supported types: 'claude', 'codex'"
      );
    });

    test('is case sensitive - Claude throws', () => {
      expect(() => getAssistantClient('Claude')).toThrow(
        "Unknown assistant type: Claude. Supported types: 'claude', 'codex'"
      );
    });

    test('each call returns new instance', () => {
      const client1 = getAssistantClient('claude');
      const client2 = getAssistantClient('claude');

      expect(ClaudeClient).toHaveBeenCalledTimes(2);
      // Since they're mock instances, they'll be different objects
      expect(client1).not.toBe(client2);
    });
  });
});
