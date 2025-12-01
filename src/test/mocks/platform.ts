import type { IPlatformAdapter } from '../../types';

export class MockPlatformAdapter implements IPlatformAdapter {
  public sendMessage = jest.fn<Promise<void>, [string, string]>().mockResolvedValue(undefined);
  public getStreamingMode = jest.fn<'stream' | 'batch', []>().mockReturnValue('stream');
  public getPlatformType = jest.fn<string, []>().mockReturnValue('mock');
  public start = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
  public stop = jest.fn<undefined, []>();

  public reset(): void {
    this.sendMessage.mockClear();
    this.getStreamingMode.mockClear();
    this.getPlatformType.mockClear();
    this.start.mockClear();
    this.stop.mockClear();
  }
}

export const createMockPlatform = (): MockPlatformAdapter => new MockPlatformAdapter();
