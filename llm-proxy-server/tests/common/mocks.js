/**
 * Common mocks for testing
 */

/**
 * Creates a mock LLM configuration
 * @param {object} overrides - Properties to override in the config
 * @returns {object} Mock LLM configuration
 */
export const createMockLlmConfig = (overrides = {}) => ({
  id: 'test-llm',
  name: 'Test LLM',
  provider: 'test-provider',
  baseUrl: 'https://api.test-provider.com',
  endpoint: '/v1/completions',
  apiKeyEnvVariable: 'TEST_API_KEY',
  defaultModel: 'test-model',
  ...overrides,
});

/**
 * Creates a mock API key service
 * @returns {object} Mock API key service
 */
export const createMockApiKeyService = () => ({
  getApiKey: jest.fn().mockResolvedValue({
    success: true,
    apiKey: 'test-api-key',
  }),
});

/**
 * Creates a mock LLM config service
 * @returns {object} Mock LLM config service
 */
export const createMockLlmConfigService = () => ({
  isOperational: jest.fn().mockReturnValue(true),
  getLlmById: jest.fn().mockReturnValue(createMockLlmConfig()),
  getInitializationErrorDetails: jest.fn().mockReturnValue(null),
  getResolvedConfigPath: jest.fn().mockReturnValue('/path/to/llm-configs.json'),
  getLlmConfigs: jest.fn().mockReturnValue({
    llms: {
      'test-llm': createMockLlmConfig(),
    },
  }),
  hasFileBasedApiKeys: jest.fn().mockReturnValue(false),
});

/**
 * Creates a mock LLM request service
 * @returns {object} Mock LLM request service
 */
export const createMockLlmRequestService = () => ({
  forwardRequestToLlm: jest.fn().mockResolvedValue({
    success: true,
    data: {
      id: 'test-response-id',
      choices: [
        {
          text: 'Test response',
        },
      ],
    },
    headers: {
      'content-type': 'application/json',
    },
  }),
});

/**
 * Creates a mock file system reader
 * @returns {object} Mock file system reader
 */
export const createMockFileSystemReader = () => ({
  readFile: jest.fn().mockResolvedValue('test-content'),
  readFileSync: jest.fn().mockReturnValue('test-content'),
  fileExists: jest.fn().mockResolvedValue(true),
  fileExistsSync: jest.fn().mockReturnValue(true),
});

/**
 * Creates a mock app config service
 * @returns {object} Mock app config service
 */
export const createMockAppConfigService = () => ({
  getProxyPort: jest.fn().mockReturnValue(3000),
  getProxyAllowedOrigin: jest.fn().mockReturnValue('http://localhost:3001'),
  getAllowedOriginsArray: jest.fn().mockReturnValue(['http://localhost:3001']),
  getProxyProjectRootPathForApiKeyFiles: jest
    .fn()
    .mockReturnValue('/project/root'),
  isProxyPortDefaulted: jest.fn().mockReturnValue(false),
  getLlmConfigsPath: jest.fn().mockReturnValue('./llm-configs.json'),
});

/**
 * Creates a mock Express response object with request tracking middleware methods
 * This simulates the behavior of the requestTracking middleware which adds
 * commitResponse, isResponseCommitted, and getCommitmentSource methods
 * @returns {object} Mock Express response with middleware methods
 */
export const createMockResponse = () => {
  let responseCommitted = false;
  let commitmentSource = null;

  return {
    status: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    json: jest.fn(),
    send: jest.fn(),
    end: jest.fn(),
    headersSent: false,

    // Request tracking middleware methods
    commitResponse: jest.fn((source) => {
      if (responseCommitted) return false;
      responseCommitted = true;
      commitmentSource = source;
      return true;
    }),
    isResponseCommitted: jest.fn(() => responseCommitted),
    getCommitmentSource: jest.fn(() => commitmentSource),

    // Helper to reset commitment state for testing
    _resetCommitment: () => {
      responseCommitted = false;
      commitmentSource = null;
    },
  };
};
