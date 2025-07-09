/**
 * Common test helper functions
 */

/**
 * Waits for all promises to resolve
 * @returns {Promise<void>}
 */
export const flushPromises = () =>
  new Promise((resolve) => setImmediate(resolve));

/**
 * Creates a test environment with common setup
 * @returns {object} Test environment
 */
export const createTestEnvironment = () => {
  // Save original environment variables
  const originalEnv = { ...process.env };

  // Reset function to restore original environment
  const reset = () => {
    process.env = originalEnv;
  };

  return {
    originalEnv,
    reset,
  };
};

/**
 * Asserts that an error response matches expected format
 * @param {object} response - Response object
 * @param {number} expectedStatus - Expected status code
 * @param {string} expectedStage - Expected error stage
 */
export const assertErrorResponse = (
  response,
  expectedStatus,
  expectedStage
) => {
  expect(response.statusCode).toBe(expectedStatus);
  expect(response.body).toMatchObject({
    error: true,
    message: expect.any(String),
    originalStatusCode: expectedStatus,
  });

  if (expectedStage) {
    expect(response.body.stage).toBe(expectedStage);
  }
};

/**
 * Asserts that a successful response matches expected format
 * @param {object} response - Response object
 * @param {number} expectedStatus - Expected status code (default 200)
 */
export const assertSuccessResponse = (response, expectedStatus = 200) => {
  expect(response.statusCode).toBe(expectedStatus);
  expect(response.body).toBeDefined();
  expect(response.body.error).toBeUndefined();
};

/**
 * Creates a delay for testing timeouts
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Suppresses console output during tests
 * @returns {object} Object with restore function
 */
export const suppressConsole = () => {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
  console.debug = jest.fn();

  return {
    restore: () => {
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      console.debug = originalConsole.debug;
    },
  };
};

/**
 * Generates a random string for testing
 * @param {number} length - Length of the string
 * @returns {string} Random string
 */
export const generateRandomString = (length = 10) => {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Creates a large payload for testing size limits
 * @param {number} sizeInKb - Size in kilobytes
 * @returns {object} Large payload
 */
export const createLargePayload = (sizeInKb) => {
  const largeString = 'x'.repeat(sizeInKb * 1024);
  return {
    llmId: 'test-llm',
    targetPayload: {
      largeData: largeString,
    },
  };
};
