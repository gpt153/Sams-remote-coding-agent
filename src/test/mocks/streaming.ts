export interface StreamEvent {
  type: 'text' | 'tool' | 'error' | 'complete';
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  error?: Error;
}

export async function* createMockStream(events: StreamEvent[]): AsyncGenerator<StreamEvent> {
  for (const event of events) {
    yield event;
  }
}

export const createMockAssistantClient = (
  events: StreamEvent[] = []
): {
  sendMessage: jest.Mock;
  getType: jest.Mock;
  resumeSession: jest.Mock;
} => ({
  sendMessage: jest.fn(async function* () {
    for (const event of events) {
      yield event;
    }
  }),
  getType: jest.fn().mockReturnValue('claude'),
  resumeSession: jest.fn(async function* () {
    for (const event of events) {
      yield event;
    }
  }),
});
