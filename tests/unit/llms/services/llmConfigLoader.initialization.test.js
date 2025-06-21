// tests/services/LlmConfigLoader.initialization.test.js
// --- FILE START ---

import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import { LlmConfigLoader } from '../../../../src/llms/services/llmConfigLoader.js'; // Adjust path if needed
import { fetchWithRetry } from '../../../../src/utils';

// Mock the fetchWithRetry utility
jest.mock('../../../../src/utils', () => ({
  fetchWithRetry: jest.fn(),
}));

/**
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').ILogger>}
 */
const mockLoggerInstance = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/**
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').ISchemaValidator>}
 */
const mockSchemaValidatorInstance = () => ({
  addSchema: jest.fn().mockResolvedValue(undefined),
  removeSchema: jest.fn().mockReturnValue(true),
  getValidator: jest
    .fn()
    .mockReturnValue(() => ({ isValid: true, errors: null })),
  isSchemaLoaded: jest.fn().mockReturnValue(true),
  validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
});

/**
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').IConfiguration>}
 */
const mockConfigurationInstance = () => ({
  getContentTypeSchemaId: jest.fn((registryKey) => {
    if (registryKey === 'llm-configs') {
      return 'http://example.com/schemas/llm-configs.schema.json';
    }
    return `http://example.com/schemas/${registryKey}.schema.json`;
  }),
  // Add other IConfiguration methods if LlmConfigLoader uses them, otherwise keep minimal
});

const LLM_CONFIG_SCHEMA_ID =
  'http://example.com/schemas/llm-configs.schema.json';
const MOCK_LLM_CONFIG_PATH = 'config/llm-configs.json';
const MOCK_RAW_LLM_CONFIG_DATA = {
  defaultConfigId: 'test-llm',
  configs: {
    'test-llm': {
      configId: 'test-llm',
      displayName: 'Test LLM',
      modelIdentifier: 'test-model',
      endpointUrl: 'http://example.com/api',
      apiType: 'custom',
      jsonOutputStrategy: { method: 'manual_prompting' },
      promptElements: [{ key: 'main', prefix: '', suffix: '' }],
      promptAssemblyOrder: ['main'],
    },
  },
};

describe('LlmConfigLoader - Initialization and Schema Handling', () => {
  /** @type {LlmConfigLoader} */
  let loader;
  /** @type {ReturnType<typeof mockLoggerInstance>} */
  let loggerMock;
  /** @type {ReturnType<typeof mockSchemaValidatorInstance>} */
  let schemaValidatorMock;
  /** @type {ReturnType<typeof mockConfigurationInstance>} */
  let configurationMock;
  let dispatcherMock;

  beforeEach(() => {
    jest.clearAllMocks();
    loggerMock = mockLoggerInstance();
    schemaValidatorMock = mockSchemaValidatorInstance();
    configurationMock = mockConfigurationInstance();
    dispatcherMock = { dispatch: jest.fn().mockResolvedValue(true) };

    // Default successful fetch for most tests
    fetchWithRetry.mockResolvedValue(
      JSON.parse(JSON.stringify(MOCK_RAW_LLM_CONFIG_DATA))
    );
    configurationMock.getContentTypeSchemaId.mockReturnValue(
      LLM_CONFIG_SCHEMA_ID
    );

    loader = new LlmConfigLoader({
      logger: loggerMock,
      schemaValidator: schemaValidatorMock,
      configuration: configurationMock,
      safeEventDispatcher: dispatcherMock,
    });
  });

  test('should return an error result with stage "validation" if schema is not found by validator', async () => {
    // Arrange
    const schemaNotFoundErrorDetail = {
      instancePath: '', // Or appropriate path
      schemaPath: '', // Or appropriate path
      keyword: 'schemaNotFound', // Custom keyword used by AjvSchemaValidator
      params: { schemaId: LLM_CONFIG_SCHEMA_ID },
      message: `Schema with id '${LLM_CONFIG_SCHEMA_ID}' not found, is invalid, or validator could not be retrieved.`,
    };
    schemaValidatorMock.validate.mockReturnValue({
      isValid: false,
      errors: [schemaNotFoundErrorDetail],
    });

    // Act
    const result = await loader.loadConfigs(MOCK_LLM_CONFIG_PATH);

    // Assert
    expect(fetchWithRetry).toHaveBeenCalledWith(
      MOCK_LLM_CONFIG_PATH,
      expect.any(Object),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      dispatcherMock,
      loggerMock
    );
    expect(configurationMock.getContentTypeSchemaId).toHaveBeenCalledWith(
      'llm-configs'
    );
    expect(schemaValidatorMock.validate).toHaveBeenCalledWith(
      LLM_CONFIG_SCHEMA_ID,
      MOCK_RAW_LLM_CONFIG_DATA
    );

    expect(result.error).toBe(true);
    expect(result.message).toBe(
      'LLM Prompt configuration schema validation failed.'
    );
    expect(result.stage).toBe('validation');
    expect(result.path).toBe(MOCK_LLM_CONFIG_PATH);
    expect(result.validationErrors).toBeDefined();
    expect(result.validationErrors.length).toBe(1);

    // Check the standardized error format
    const standardizedError = result.validationErrors[0];
    expect(standardizedError.errorType).toBe('SCHEMA_VALIDATION');
    expect(standardizedError.configId).toBe('N/A (root data)'); // As per #formatAjvErrorToStandardizedError logic for root path
    expect(standardizedError.path).toBe('(root)'); // As per #formatAjvErrorToStandardizedError logic for root path
    expect(standardizedError.message).toBe(schemaNotFoundErrorDetail.message);
    expect(standardizedError.details).toEqual(
      expect.objectContaining(schemaNotFoundErrorDetail)
    );

    expect(loggerMock.error).toHaveBeenCalledWith(
      `LlmConfigLoader: LLM Prompt configuration file from ${MOCK_LLM_CONFIG_PATH} failed schema validation. Count: 1`,
      expect.objectContaining({
        path: MOCK_LLM_CONFIG_PATH,
        schemaId: LLM_CONFIG_SCHEMA_ID,
        validationErrors: expect.arrayContaining([standardizedError]),
      })
    );
    expect(loggerMock.error).toHaveBeenCalledWith(
      `Schema Validation Error: Config ID: '${standardizedError.configId}', Path: '${standardizedError.path}', Message: ${standardizedError.message}`,
      { details: standardizedError.details }
    );
  });

  test('should return an error with stage "validation_setup" if schema ID for "llm-configs" cannot be retrieved', async () => {
    // Arrange
    configurationMock.getContentTypeSchemaId.mockImplementation(
      (registryKey) => {
        if (registryKey === 'llm-configs') {
          return undefined; // Simulate schema ID not found for 'llm-configs'
        }
        return `http://example.com/schemas/${registryKey}.schema.json`;
      }
    );
    // fetchWithRetry will still be called as this check happens after fetch.
    fetchWithRetry.mockResolvedValue(
      JSON.parse(JSON.stringify(MOCK_RAW_LLM_CONFIG_DATA))
    );

    // Act
    const result = await loader.loadConfigs(MOCK_LLM_CONFIG_PATH);

    // Assert
    expect(fetchWithRetry).toHaveBeenCalledTimes(1); // Ensure fetch was attempted
    expect(configurationMock.getContentTypeSchemaId).toHaveBeenCalledWith(
      'llm-configs'
    );
    expect(schemaValidatorMock.validate).not.toHaveBeenCalled(); // Validation should not be attempted

    expect(result.error).toBe(true);
    expect(result.message).toBe(
      "LlmConfigLoader: Schema ID for 'llm-configs' is undefined. Cannot validate."
    );
    expect(result.stage).toBe('validation_setup');
    expect(result.path).toBe(MOCK_LLM_CONFIG_PATH);

    expect(loggerMock.error).toHaveBeenCalledWith(
      "LlmConfigLoader: Could not retrieve schema ID for 'llm-configs' from IConfiguration."
    );
  });
});

// --- FILE END ---
