// tests/services/LlmConfigLoader.test.js
// --- FILE START ---

import { jest, describe, beforeEach, test, expect } from '@jest/globals';
// Using the import path from your test output
import { LlmConfigLoader } from '../../../src/llms/services/llmConfigLoader.js';

/**
 * @returns {jest.Mocked<import('../../../src/interfaces/coreServices.js').ILogger>}
 */
const mockLoggerInstance = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/**
 * @returns {jest.Mocked<import('../../../src/interfaces/coreServices.js').ISchemaValidator>}
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
 * @returns {jest.Mocked<import('../../../src/interfaces/coreServices.js').IConfiguration>}
 */
const mockConfigurationInstance = () => ({
  getBaseDataPath: jest.fn().mockReturnValue('./data'),
  getSchemaBasePath: jest.fn().mockReturnValue('schemas'),
  getContentBasePath: jest.fn().mockReturnValue('content_type'),
  getRuleBasePath: jest.fn().mockReturnValue('rules'),
  getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
  getModManifestFilename: jest.fn().mockReturnValue('mod-manifest.json'),
  getModsBasePath: jest.fn().mockReturnValue('mods'),
  getSchemaFiles: jest.fn().mockReturnValue([]),
  getContentTypeSchemaId: jest.fn((registryKey) => {
    if (registryKey === 'llm-configs') {
      return 'schema://living-narrative-engine/llm-configs.schema.json';
    }
    return `schema://living-narrative-engine/${registryKey}.schema.json`;
  }),
  getRuleSchemaId: jest
    .fn()
    .mockReturnValue('schema://living-narrative-engine/rule.schema.json'),
});

/**
 * @returns {jest.Mocked<import('../../../src/interfaces/coreServices.js').IDataFetcher>}
 */
const mockDataFetcherInstance = () => ({
  fetch: jest.fn(),
});

const defaultLlmConfigPath = 'config/llm-configs.json';

// New: Valid root object content for llm-configs.json
const mockValidRootLLMConfig = {
  defaultConfigId: 'claude_sonnet_adventure_wrappers_v2',
  configs: {
    claude_sonnet_adventure_wrappers_v2: {
      configId: 'claude_sonnet_adventure_wrappers_v2',
      displayName: 'Claude Sonnet Adventure v2',
      modelIdentifier: 'anthropic/claude-3-sonnet-20240229',
      endpointUrl: 'https://api.anthropic.com/v1/messages',
      apiType: 'anthropic_messages',
      jsonOutputStrategy: { method: 'manual_prompting' },
      promptElements: [
        {
          key: 'system_prompt',
          prefix: '<system_prompt>\n',
          suffix: '\n</system_prompt>',
        },
        {
          key: 'user_input',
          prefix: '<user_input>\n',
          suffix: '\n</user_input>',
        },
        {
          key: 'assistant_response_prefix',
          prefix: '{character_name}: ',
          suffix: '',
        },
        {
          key: 'perception_log_wrapper',
          prefix: '<character_perception_log>\n',
          suffix: '\n</character_perception_log>',
        },
        {
          key: 'perception_log_entry',
          prefix: '  <entry type="{entry_type}" timestamp="{timestamp}">\n    ',
          suffix: '\n  </entry>',
        },
      ],
      promptAssemblyOrder: [
        'system_prompt',
        'perception_log_wrapper',
        'user_input',
        'assistant_response_prefix',
      ],
    },
    generic_xml_v1: {
      configId: 'generic_xml_v1',
      displayName: 'Generic XML v1',
      modelIdentifier: 'generic-xml-model-*',
      endpointUrl: 'http://example.com/api/generic',
      apiType: 'custom',
      jsonOutputStrategy: { method: 'manual_prompting' },
      promptElements: [
        {
          key: 'instructions',
          prefix: '<instructions>\n',
          suffix: '\n</instructions>',
        },
        { key: 'context', prefix: '<context>\n', suffix: '\n</context>' },
        { key: 'query', prefix: '<query>\n', suffix: '\n</query>' },
      ],
      promptAssemblyOrder: ['instructions', 'context', 'query'],
    },
  },
};

// Minimal valid root object for constructor/path tests
const minimalValidRootConfigForPathTests = {
  defaultConfigId: 'default',
  configs: {
    default: {
      configId: 'default',
      displayName: 'Default Minimal',
      modelIdentifier: 'minimal-model',
      endpointUrl: 'http://example.com/api',
      apiType: 'custom',
      jsonOutputStrategy: { method: 'manual_prompting' },
      promptElements: [{ key: 'main', prefix: '', suffix: '' }],
      promptAssemblyOrder: ['main'],
    },
  },
};

describe('LlmConfigLoader', () => {
  /** @type {LlmConfigLoader} */
  let loader;
  /** @type {ReturnType<typeof mockLoggerInstance>} */
  let loggerMock;
  /** @type {ReturnType<typeof mockSchemaValidatorInstance>} */
  let schemaValidatorMock;
  /** @type {ReturnType<typeof mockConfigurationInstance>} */
  let configurationMock;
  /** @type {ReturnType<typeof mockDataFetcherInstance>} */
  let dataFetcherMock;
  let dispatcherMock;

  beforeEach(() => {
    jest.clearAllMocks();
    loggerMock = mockLoggerInstance();
    schemaValidatorMock = mockSchemaValidatorInstance();
    configurationMock = mockConfigurationInstance();
    dataFetcherMock = mockDataFetcherInstance();
    dispatcherMock = { dispatch: jest.fn().mockResolvedValue(true) };

    loader = new LlmConfigLoader({
      logger: loggerMock,
      schemaValidator: schemaValidatorMock,
      configuration: configurationMock,
      safeEventDispatcher: dispatcherMock,
      dataFetcher: dataFetcherMock,
    });
  });

  describe('constructor', () => {
    test('should use provided logger', () => {
      const specificLogger = mockLoggerInstance();
      const specificDataFetcher = mockDataFetcherInstance();
      specificDataFetcher.fetch.mockResolvedValueOnce(
        JSON.parse(JSON.stringify(minimalValidRootConfigForPathTests))
      );
      const specificLoader = new LlmConfigLoader({
        logger: specificLogger,
        schemaValidator: schemaValidatorMock,
        configuration: configurationMock,
        safeEventDispatcher: dispatcherMock,
        dataFetcher: specificDataFetcher,
      });
      specificLoader.loadConfigs(); // Call loadConfigs to trigger logger usage
      expect(specificLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Attempting to load LLM Prompt configurations')
      );
    });

    test('should use console if no logger is provided in constructor (and log errors for missing deps)', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      // Test throwing for missing logger
      expect(
        () =>
          new LlmConfigLoader({
            schemaValidator: schemaValidatorMock,
            configuration: configurationMock,
            dataFetcher: dataFetcherMock,
          })
      ).toThrow(
        'LlmConfigLoader: Constructor requires a valid ILogger instance.'
      ); // Now expects "valid"
      consoleErrorSpy.mockRestore();

      const consoleInfoSpy = jest
        .spyOn(console, 'info')
        .mockImplementation(() => {});
      const loaderWithConsoleLogger = new LlmConfigLoader({
        logger: console, // Using actual console
        schemaValidator: schemaValidatorMock,
        configuration: configurationMock,
        safeEventDispatcher: dispatcherMock,
        dataFetcher: dataFetcherMock,
      });
      dataFetcherMock.fetch.mockResolvedValueOnce(
        JSON.parse(JSON.stringify(minimalValidRootConfigForPathTests))
      );
      loaderWithConsoleLogger.loadConfigs();
    });

    test('should use default dependencyInjection path if none provided (verified by loadConfigs call)', async () => {
      dataFetcherMock.fetch.mockResolvedValueOnce(
        JSON.parse(JSON.stringify(minimalValidRootConfigForPathTests))
      );
      await loader.loadConfigs();
      expect(dataFetcherMock.fetch).toHaveBeenCalledWith(defaultLlmConfigPath);
    });

    test('should use provided defaultConfigPath in constructor (verified by loadConfigs call)', async () => {
      const customPath = 'custom/path/to/prompt-configs.json';
      const customDataFetcher = mockDataFetcherInstance();
      const loaderWithCustomPath = new LlmConfigLoader({
        logger: loggerMock,
        schemaValidator: schemaValidatorMock,
        configuration: configurationMock,
        defaultConfigPath: customPath,
        safeEventDispatcher: dispatcherMock,
        dataFetcher: customDataFetcher,
      });
      customDataFetcher.fetch.mockResolvedValueOnce(
        JSON.parse(JSON.stringify(minimalValidRootConfigForPathTests))
      );
      await loaderWithCustomPath.loadConfigs();
      expect(customDataFetcher.fetch).toHaveBeenCalledWith(customPath);
    });

    test('should throw error if schemaValidator is missing', () => {
      expect(
        () =>
          new LlmConfigLoader({
            logger: loggerMock,
            configuration: configurationMock,
            dataFetcher: dataFetcherMock,
          })
      ).toThrow(
        'LlmConfigLoader: Constructor requires a valid ISchemaValidator instance.'
      ); // Now expects "valid"
    });

    test('should throw error if configuration is missing', () => {
      expect(
        () =>
          new LlmConfigLoader({
            logger: loggerMock,
            schemaValidator: schemaValidatorMock,
            dataFetcher: dataFetcherMock,
          })
      ).toThrow(
        'LlmConfigLoader: Constructor requires a valid IConfiguration instance.'
      ); // Now expects "valid"
    });

    test('should throw error if dataFetcher is missing', () => {
      expect(
        () =>
          new LlmConfigLoader({
            logger: loggerMock,
            schemaValidator: schemaValidatorMock,
            configuration: configurationMock,
            safeEventDispatcher: dispatcherMock,
          })
      ).toThrow(
        'LlmConfigLoader: Constructor requires a valid IDataFetcher instance.'
      );
    });
  });

  describe('loadConfigs', () => {
    test('AC1 & AC5 (adapted for prompt configs): should load, parse, schema validate, semantic validate, and return a valid llm-configs.json file successfully', async () => {
      const expectedRootConfig = JSON.parse(
        JSON.stringify(mockValidRootLLMConfig)
      );
      dataFetcherMock.fetch.mockResolvedValueOnce(expectedRootConfig); // Provide the root object
      schemaValidatorMock.validate.mockReturnValueOnce({
        isValid: true,
        errors: null,
      });

      const result = await loader.loadConfigs(defaultLlmConfigPath);

      expect(result.error).toBeUndefined(); // Ensure it's not an error object
      expect(result).toEqual(expectedRootConfig); // Result should be the root object

      expect(dataFetcherMock.fetch).toHaveBeenCalledWith(defaultLlmConfigPath);
      expect(configurationMock.getContentTypeSchemaId).toHaveBeenCalledWith(
        'llm-configs'
      );
      expect(schemaValidatorMock.validate).toHaveBeenCalledWith(
        'schema://living-narrative-engine/llm-configs.schema.json',
        expectedRootConfig
      );
    });

    test('AC2: should handle Workspace network errors (simulated by dataFetcher rejecting)', async () => {
      const networkError = new Error(
        'Simulated Network Error: Failed to fetch'
      );
      dataFetcherMock.fetch.mockRejectedValueOnce(networkError);

      const result = await loader.loadConfigs(defaultLlmConfigPath);

      expect(result).toEqual({
        error: true,
        message: `Failed to load, parse, or validate LLM Prompt configurations from ${defaultLlmConfigPath}: ${networkError.message}`,
        stage: 'fetch_network_error',
        originalError: networkError,
        path: defaultLlmConfigPath,
        validationErrors: undefined,
        semanticErrors: undefined,
      });
      // Check the corrected logger message
      expect(loggerMock.error).toHaveBeenCalledWith(
        `LlmConfigLoader: Failed to load, parse, or validate LLM Prompt configurations from ${defaultLlmConfigPath}. Error: ${networkError.message}`,
        expect.objectContaining({
          path: defaultLlmConfigPath,
          originalErrorDetails: networkError,
        })
      );
      expect(schemaValidatorMock.validate).not.toHaveBeenCalled();
    });

    test('AC3: should handle HTTP errors from Workspace (e.g., 404 Not Found)', async () => {
      const httpError = new Error(
        `API request to ${defaultLlmConfigPath} failed after 1 attempt(s) with status 404: {"error":"Not Found"}`
      );
      dataFetcherMock.fetch.mockRejectedValueOnce(httpError);
      const result = await loader.loadConfigs(defaultLlmConfigPath);
      expect(result.stage).toBe('fetch_not_found');
      // Further assertions as before...
    });

    test('AC3: should handle HTTP errors from Workspace (e.g., 500 Server Error)', async () => {
      const httpError = new Error(
        `API request to ${defaultLlmConfigPath} failed after 3 attempt(s) with status 500: {"error":"Server Issue"}`
      );
      dataFetcherMock.fetch.mockRejectedValueOnce(httpError);
      const result = await loader.loadConfigs(defaultLlmConfigPath);
      expect(result.stage).toBe('fetch_server_error');
      // Further assertions as before...
    });

    test('AC4: should handle invalid JSON content (dataFetcher throws JSON parsing error)', async () => {
      const parsingError = new SyntaxError(
        'Unexpected token i in JSON at position 0'
      );
      dataFetcherMock.fetch.mockRejectedValueOnce(parsingError);
      const result = await loader.loadConfigs(defaultLlmConfigPath);
      expect(result.stage).toBe('parse');
      // Further assertions as before...
    });

    test('should return error if schema ID cannot be retrieved from configuration', async () => {
      dataFetcherMock.fetch.mockResolvedValueOnce(
        JSON.parse(JSON.stringify(minimalValidRootConfigForPathTests))
      );
      configurationMock.getContentTypeSchemaId.mockReturnValueOnce(undefined);
      const result = await loader.loadConfigs(defaultLlmConfigPath);
      expect(result.message).toBe(
        "LlmConfigLoader: Schema ID for 'llm-configs' is undefined. Cannot validate."
      );
      // Check corrected logger message
      expect(loggerMock.error).toHaveBeenCalledWith(
        "LlmConfigLoader: Could not retrieve schema ID for 'llm-configs' from IConfiguration."
      );
    });

    test('should return error if schema validation fails for root object', async () => {
      // Example: Root object is missing 'defaultConfigId'
      const malformedRootData = { configs: {} };
      const mockedAjvError = {
        instancePath: '',
        keyword: 'required',
        params: { missingProperty: 'defaultConfigId' },
        message: "must have required property 'defaultConfigId'",
      };
      dataFetcherMock.fetch.mockResolvedValueOnce(malformedRootData);
      schemaValidatorMock.validate.mockReturnValueOnce({
        isValid: false,
        errors: [mockedAjvError],
      });

      const result = await loader.loadConfigs(defaultLlmConfigPath);

      expect(result.error).toBe(true);
      expect(result.message).toBe(
        'LLM Prompt configuration schema validation failed.'
      );
      expect(result.validationErrors[0]).toEqual(
        expect.objectContaining({
          configId: 'N/A (root data)',
          path: '(root)', // Correct path for root error
          message: "must have required property 'defaultConfigId'",
        })
      );
      // Check corrected logger message
      expect(loggerMock.error).toHaveBeenCalledWith(
        `LlmConfigLoader: LLM Prompt configuration file from ${defaultLlmConfigPath} failed schema validation. Count: 1`,
        expect.objectContaining({
          path: defaultLlmConfigPath,
          validationErrors: expect.arrayContaining([
            expect.objectContaining({
              message: "must have required property 'defaultConfigId'",
            }),
          ]),
        })
      );
    });

    test('should return error if semantic validation fails (e.g. promptAssemblyOrder key mismatch)', async () => {
      const semanticallyInvalidRoot = {
        defaultConfigId: 'bad_config',
        configs: {
          bad_config: {
            configId: 'bad_config',
            displayName: 'Bad Config',
            modelIdentifier: 'test-model',
            endpointUrl: 'http://example.com',
            apiType: 'custom',
            jsonOutputStrategy: { method: 'manual_prompting' },
            promptElements: [{ key: 'system', prefix: '', suffix: '' }],
            promptAssemblyOrder: ['system', 'non_existent_key'],
          },
        },
      };
      dataFetcherMock.fetch.mockResolvedValueOnce(
        JSON.parse(JSON.stringify(semanticallyInvalidRoot))
      );
      schemaValidatorMock.validate.mockReturnValueOnce({
        isValid: true,
        errors: null,
      });

      const result = await loader.loadConfigs(defaultLlmConfigPath);

      expect(result.error).toBe(true);
      expect(result.stage).toBe('semantic_validation');
      expect(result.semanticErrors.length).toBeGreaterThan(0);
      const firstError = result.semanticErrors[0];
      expect(firstError.configId).toBe('bad_config');
      expect(firstError.message).toContain("'non_existent_key'");
      expect(firstError.path).toBe('configs.bad_config.promptAssemblyOrder[1]'); // Absolute path
      expect(firstError.details.problematic_key_ref).toBe('non_existent_key');
    });

    test('should return error if "configs" property is not a valid object map (semantic check)', async () => {
      const rootWithInvalidConfigsType = {
        defaultConfigId: 'test',
        configs: ['this is an array, not an object map'], // Invalid type for configs
      };
      dataFetcherMock.fetch.mockResolvedValueOnce(rootWithInvalidConfigsType);
      // Assume schema validation for the root object passes, but the 'configs' type is wrong
      // This specific scenario tests the semantic validator's robustness against `configs` not being a map
      schemaValidatorMock.validate.mockReturnValueOnce({
        isValid: true,
        errors: null,
      });
      // If schema was stricter, it would catch this.
      // If schema allows `configs` to be any type, semantic check becomes important.
      // Our new schema defines `configs` as object, so schema should ideally catch this.
      // But for this test's original intent (semantic check for type):
      const result = await loader.loadConfigs(defaultLlmConfigPath);

      expect(result.error).toBe(true);
      expect(result.stage).toBe('semantic_validation');
      expect(result.semanticErrors.length).toBeGreaterThan(0);
      expect(result.semanticErrors[0]).toEqual(
        expect.objectContaining({
          errorType: 'SEMANTIC_VALIDATION_INVALID_CONFIGS_STRUCTURE',
          configId: 'N/A (root property)',
          path: 'configs',
          message:
            'The "configs" property is not a valid object map as expected.',
        })
      );
    });

    test('should use custom file path if provided to loadConfigs method', async () => {
      const customPath = 'another/prompt-dependencyInjection.json';
      dataFetcherMock.fetch.mockResolvedValueOnce(
        JSON.parse(JSON.stringify(minimalValidRootConfigForPathTests))
      );
      await loader.loadConfigs(customPath);
      expect(dataFetcherMock.fetch).toHaveBeenCalledWith(customPath);
    });

    test('should use default path if provided filePath to loadConfigs is empty or whitespace', async () => {
      dataFetcherMock.fetch.mockResolvedValueOnce(
        JSON.parse(JSON.stringify(minimalValidRootConfigForPathTests))
      );
      await loader.loadConfigs('   ');
      expect(dataFetcherMock.fetch).toHaveBeenCalledWith(defaultLlmConfigPath);
    });
  });
});

// --- FILE END ---
