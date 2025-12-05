/**
 * Unit tests for Slack adapter
 */
import { SlackAdapter, SlackMessageEvent } from './slack';

// Mock @slack/bolt
jest.mock('@slack/bolt', () => ({
  App: jest.fn().mockImplementation(() => ({
    client: {
      chat: {
        postMessage: jest.fn().mockResolvedValue(undefined),
      },
      conversations: {
        replies: jest.fn().mockResolvedValue({ messages: [] }),
      },
    },
    event: jest.fn(),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
  })),
  LogLevel: {
    INFO: 'info',
  },
}));

describe('SlackAdapter', () => {
  describe('streaming mode configuration', () => {
    test('should return batch mode when configured', () => {
      const adapter = new SlackAdapter('xoxb-fake', 'xapp-fake', 'batch');
      expect(adapter.getStreamingMode()).toBe('batch');
    });

    test('should default to batch mode', () => {
      const adapter = new SlackAdapter('xoxb-fake', 'xapp-fake');
      expect(adapter.getStreamingMode()).toBe('batch');
    });

    test('should return stream mode when explicitly configured', () => {
      const adapter = new SlackAdapter('xoxb-fake', 'xapp-fake', 'stream');
      expect(adapter.getStreamingMode()).toBe('stream');
    });
  });

  describe('platform type', () => {
    test('should return slack', () => {
      const adapter = new SlackAdapter('xoxb-fake', 'xapp-fake');
      expect(adapter.getPlatformType()).toBe('slack');
    });
  });

  describe('thread detection', () => {
    let adapter: SlackAdapter;

    beforeEach(() => {
      adapter = new SlackAdapter('xoxb-fake', 'xapp-fake');
    });

    test('should detect thread when thread_ts differs from ts', () => {
      const event: SlackMessageEvent = {
        text: 'test',
        user: 'U123',
        channel: 'C456',
        ts: '1234567890.123456',
        thread_ts: '1234567890.000001',
      };
      expect(adapter.isThread(event)).toBe(true);
    });

    test('should not detect thread when thread_ts equals ts', () => {
      const event: SlackMessageEvent = {
        text: 'test',
        user: 'U123',
        channel: 'C456',
        ts: '1234567890.123456',
        thread_ts: '1234567890.123456',
      };
      expect(adapter.isThread(event)).toBe(false);
    });

    test('should not detect thread when thread_ts is undefined', () => {
      const event: SlackMessageEvent = {
        text: 'test',
        user: 'U123',
        channel: 'C456',
        ts: '1234567890.123456',
      };
      expect(adapter.isThread(event)).toBe(false);
    });
  });

  describe('conversation ID', () => {
    let adapter: SlackAdapter;

    beforeEach(() => {
      adapter = new SlackAdapter('xoxb-fake', 'xapp-fake');
    });

    test('should return channel:thread_ts for thread messages', () => {
      const event: SlackMessageEvent = {
        text: 'test',
        user: 'U123',
        channel: 'C456',
        ts: '1234567890.123456',
        thread_ts: '1234567890.000001',
      };
      expect(adapter.getConversationId(event)).toBe('C456:1234567890.000001');
    });

    test('should return channel:ts for non-thread messages', () => {
      const event: SlackMessageEvent = {
        text: 'test',
        user: 'U123',
        channel: 'C456',
        ts: '1234567890.123456',
      };
      expect(adapter.getConversationId(event)).toBe('C456:1234567890.123456');
    });
  });

  describe('stripBotMention', () => {
    let adapter: SlackAdapter;

    beforeEach(() => {
      adapter = new SlackAdapter('xoxb-fake', 'xapp-fake');
    });

    test('should strip bot mention from start', () => {
      expect(adapter.stripBotMention('<@U1234ABCD> /clone https://github.com/test/repo')).toBe(
        '/clone https://github.com/test/repo'
      );
    });

    test('should strip multiple mentions', () => {
      expect(adapter.stripBotMention('<@U1234ABCD> <@W5678EFGH> hello')).toBe(
        '<@W5678EFGH> hello'
      );
    });

    test('should return unchanged if no mention', () => {
      expect(adapter.stripBotMention('/status')).toBe('/status');
    });

    test('should normalize Slack URL formatting', () => {
      expect(
        adapter.stripBotMention('<@U1234ABCD> /clone <https://github.com/test/repo>')
      ).toBe('/clone https://github.com/test/repo');
    });

    test('should normalize Slack URL with label', () => {
      expect(
        adapter.stripBotMention('<@U1234ABCD> check <https://github.com/test/repo|github.com/test/repo>')
      ).toBe('check https://github.com/test/repo');
    });

    test('should normalize multiple URLs', () => {
      expect(
        adapter.stripBotMention('<@U1234ABCD> compare <https://github.com/a> and <https://github.com/b>')
      ).toBe('compare https://github.com/a and https://github.com/b');
    });
  });

  describe('parent conversation ID', () => {
    let adapter: SlackAdapter;

    beforeEach(() => {
      adapter = new SlackAdapter('xoxb-fake', 'xapp-fake');
    });

    test('should return parent conversation ID for thread messages', () => {
      const event: SlackMessageEvent = {
        text: 'test',
        user: 'U123',
        channel: 'C456',
        ts: '1234567890.123456',
        thread_ts: '1234567890.000001',
      };
      expect(adapter.getParentConversationId(event)).toBe('C456:1234567890.000001');
    });

    test('should return null for non-thread messages', () => {
      const event: SlackMessageEvent = {
        text: 'test',
        user: 'U123',
        channel: 'C456',
        ts: '1234567890.123456',
      };
      expect(adapter.getParentConversationId(event)).toBe(null);
    });
  });

  describe('app instance', () => {
    test('should provide access to app instance', () => {
      const adapter = new SlackAdapter('xoxb-fake', 'xapp-fake');
      const app = adapter.getApp();
      expect(app).toBeDefined();
      expect(app.client).toBeDefined();
    });
  });
});
