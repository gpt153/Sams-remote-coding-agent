// Global test setup and configuration

// Increase default timeout for async tests
jest.setTimeout(10000);

// Clean up mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Restore all mocks after all tests complete
afterAll(() => {
  jest.restoreAllMocks();
});
