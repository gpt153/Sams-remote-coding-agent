import type { QueryResult, QueryResultRow } from 'pg';

export interface MockPool {
  query: jest.Mock;
}

export const createMockPool = (): MockPool => ({
  query: jest.fn(),
});

export const mockPool = createMockPool();

export const resetMockPool = (): void => {
  mockPool.query.mockReset();
};

// Helper to create mock query results
export const createQueryResult = <T extends QueryResultRow>(
  rows: T[],
  rowCount?: number
): QueryResult<T> => ({
  rows,
  rowCount: rowCount ?? rows.length,
  command: 'SELECT',
  oid: 0,
  fields: [],
});
