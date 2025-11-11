/**
 * Unit tests for Telegram adapter
 */
import { TelegramAdapter } from './telegram';

describe('TelegramAdapter', () => {
  describe('streaming mode configuration', () => {
    test('should return batch mode when configured', () => {
      const adapter = new TelegramAdapter('fake-token-for-testing', 'batch');
      expect(adapter.getStreamingMode()).toBe('batch');
    });

    test('should default to stream mode', () => {
      const adapter = new TelegramAdapter('fake-token-for-testing');
      expect(adapter.getStreamingMode()).toBe('stream');
    });

    test('should return stream mode when explicitly configured', () => {
      const adapter = new TelegramAdapter('fake-token-for-testing', 'stream');
      expect(adapter.getStreamingMode()).toBe('stream');
    });
  });

  describe('bot instance', () => {
    test('should provide access to bot instance', () => {
      const adapter = new TelegramAdapter('fake-token-for-testing');
      const bot = adapter.getBot();
      expect(bot).toBeDefined();
      expect(bot.telegram).toBeDefined();
    });
  });
});
