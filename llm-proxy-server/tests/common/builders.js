/**
 * Test builders for creating mock objects
 */

/**
 * Creates a mock Express request object
 * @param {object} overrides - Properties to override in the mock request
 * @returns {object} Mock request object
 */
export const createMockRequest = (overrides = {}) => ({
  body: {},
  headers: {},
  ip: '127.0.0.1',
  method: 'POST',
  path: '/api/llm-request',
  originalUrl: '/api/llm-request',
  ...overrides,
});

/**
 * Creates a mock Express response object
 * @returns {object} Mock response object
 */
export const createMockResponse = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    headersSent: false,
  };

  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });

  res.json = jest.fn((data) => {
    res.body = data;
    res.headersSent = true;
    return res;
  });

  res.send = jest.fn((data) => {
    res.body = data;
    res.headersSent = true;
    return res;
  });

  res.end = jest.fn(() => {
    res.headersSent = true;
    return res;
  });

  res.setHeader = jest.fn((name, value) => {
    res.headers[name] = value;
    return res;
  });

  res.on = jest.fn();

  return res;
};

/**
 * Creates a mock Next function for Express middleware
 * @returns {Function} Mock next function
 */
export const createMockNext = () => jest.fn();

/**
 * Creates a valid LLM request payload
 * @param {object} overrides - Properties to override in the payload
 * @returns {object} Valid LLM request payload
 */
export const createValidLlmRequestPayload = (overrides = {}) => ({
  llmId: 'test-llm-id',
  targetPayload: {
    model: 'test-model',
    messages: [
      {
        role: 'user',
        content: 'Test message',
      },
    ],
    temperature: 0.7,
    max_tokens: 150,
  },
  targetHeaders: {
    'X-Custom-Header': 'test-value',
  },
  ...overrides,
});

/**
 * Creates a mock logger
 * @returns {object} Mock logger object
 */
export const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});
