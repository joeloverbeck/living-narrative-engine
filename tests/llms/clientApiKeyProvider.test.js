// tests/llms/clientApiKeyProvider.test.js
// --- FILE START ---

import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import { ClientApiKeyProvider } from '../../src/llms/clientApiKeyProvider.js';
import { EnvironmentContext } from '../../src/llms/environmentContext.js';

/**
 * @typedef {import('../../src/llms/interfaces/ILogger.js').ILogger} ILogger
 * @typedef {import('../../src/llms/services/llmConfigLoader.js').LLMModelConfig} LLMModelConfig
 */

/**
 * @returns {jest.Mocked<ILogger>}
 */
const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('ClientApiKeyProvider', () => {
  /** @type {jest.Mocked<ILogger>} */
  let logger;
  /** @type {ClientApiKeyProvider} */
  let provider;

  // Helper to create EnvironmentContext with spies
  const createMockEnvironmentContext = (
    isClientVal,
    executionEnvVal = 'unknown'
  ) => {
    const ecLogger = mockLogger(); // Separate logger for EC if needed for its internal logs
    const contextParams = {
      logger: ecLogger,
      executionEnvironment: executionEnvVal,
    };
    if (executionEnvVal === 'server') {
      contextParams.projectRootPath = '/fake/project/root';
    }
    const ec = new EnvironmentContext(contextParams);
    jest.spyOn(ec, 'isClient').mockReturnValue(isClientVal);
    jest.spyOn(ec, 'getExecutionEnvironment').mockReturnValue(executionEnvVal);
    return ec;
  };

  beforeEach(() => {
    logger = mockLogger();
    provider = new ClientApiKeyProvider({ logger });
  });

  describe('Constructor', () => {
    test('should store injected logger and log creation', () => {
      expect(provider).toBeInstanceOf(ClientApiKeyProvider);
      expect(logger.debug).toHaveBeenCalledWith(
        'ClientApiKeyProvider: Instance created.'
      );
    });

    test('should throw error if logger is invalid or missing', () => {
      expect(() => new ClientApiKeyProvider({ logger: null })).toThrow(
        'ClientApiKeyProvider: Constructor requires a valid logger instance.'
      );
      expect(() => new ClientApiKeyProvider({ logger: {} })).toThrow(
        'ClientApiKeyProvider: Constructor requires a valid logger instance.'
      );
    });
  });

  describe('getKey Method', () => {
    /** @type {LLMModelConfig} */
    let llmConfig;
    /** @type {EnvironmentContext} */
    let environmentContext;

    beforeEach(() => {
      // MODIFICATION START: Change 'id' to 'configId' to match the corrected provider logic
      llmConfig = {
        configId: 'test-llm', // Changed from id to configId
        displayName: 'Test LLM',
        endpointUrl: 'http://localhost/api',
        modelIdentifier: 'test-model',
        apiType: 'openai', // Default to a cloud service for many tests
        // Ensure all required fields from LLMModelConfig are present if stricter validation occurs
        apiKeyEnvVar: undefined,
        apiKeyFileName: undefined,
        jsonOutputStrategy: { method: 'native_json_mode' },
        promptElements: [], // Added to match LLMModelConfig more closely
        promptAssemblyOrder: [], // Added to match LLMModelConfig more closely
      };
      // MODIFICATION END
      // Default to a client environment for most tests
      environmentContext = createMockEnvironmentContext(true, 'client');
    });

    test('should return null and log warning if not in client environment', async () => {
      environmentContext = createMockEnvironmentContext(false, 'server');
      const key = await provider.getKey(llmConfig, environmentContext);

      expect(key).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'ClientApiKeyProvider.getKey (test-llm): Attempted to use in a non-client environment. This provider is only for client-side execution. Environment: server'
      );
      // Ensure no other checks (like api key var) are made if not client
      expect(logger.error).not.toHaveBeenCalledWith(
        expect.stringContaining('missing both')
      );
    });

    test('should return null and log error if environmentContext is invalid', async () => {
      const key = await provider.getKey(llmConfig, null);
      expect(key).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'ClientApiKeyProvider.getKey (test-llm): Invalid environmentContext provided.'
      );
    });

    test('should return null and log error if environmentContext.isClient is not a function', async () => {
      const invalidEc = {
        // isClient: 'not-a-function' // or missing
        getExecutionEnvironment: jest.fn().mockReturnValue('client'),
      };
      const key = await provider.getKey(
        llmConfig,
        /** @type {any} */ (invalidEc)
      );
      expect(key).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'ClientApiKeyProvider.getKey (test-llm): Invalid environmentContext provided.'
      );
    });

    test('should return null and log error if llmConfig is null', async () => {
      const key = await provider.getKey(null, environmentContext);
      expect(key).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'ClientApiKeyProvider.getKey (UnknownLLM): llmConfig is null or undefined.'
      );
    });

    describe('Cloud Service Validation', () => {
      const cloudApiTypes = ['openai', 'openrouter', 'anthropic'];

      cloudApiTypes.forEach((apiType) => {
        test(`should return null and NOT log error for cloud service '${apiType}' when apiKeyEnvVar is present`, async () => {
          llmConfig.apiType = apiType;
          llmConfig.apiKeyEnvVar = 'TEST_API_KEY_ENV';
          llmConfig.apiKeyFileName = undefined; // Ensure only one is set

          const key = await provider.getKey(llmConfig, environmentContext);
          expect(key).toBeNull();
          expect(logger.error).not.toHaveBeenCalledWith(
            expect.stringContaining('missing both')
          );
          expect(logger.debug).toHaveBeenCalledWith(
            expect.stringContaining(
              `ClientApiKeyProvider.getKey (test-llm): Configuration for cloud service '${apiType}' has required key identifier(s)`
            )
          );
        });

        test(`should return null and NOT log error for cloud service '${apiType}' when apiKeyFileName is present`, async () => {
          llmConfig.apiType = apiType;
          llmConfig.apiKeyEnvVar = undefined;
          llmConfig.apiKeyFileName = 'keyfile.txt';

          const key = await provider.getKey(llmConfig, environmentContext);
          expect(key).toBeNull();
          expect(logger.error).not.toHaveBeenCalledWith(
            expect.stringContaining('missing both')
          );
          expect(logger.debug).toHaveBeenCalledWith(
            expect.stringContaining(
              `ClientApiKeyProvider.getKey (test-llm): Configuration for cloud service '${apiType}' has required key identifier(s)`
            )
          );
        });

        test(`should return null and NOT log error for cloud service '${apiType}' when BOTH apiKeyEnvVar and apiKeyFileName are present`, async () => {
          llmConfig.apiType = apiType;
          llmConfig.apiKeyEnvVar = 'TEST_API_KEY_ENV';
          llmConfig.apiKeyFileName = 'keyfile.txt';

          const key = await provider.getKey(llmConfig, environmentContext);
          expect(key).toBeNull();
          expect(logger.error).not.toHaveBeenCalledWith(
            expect.stringContaining('missing both')
          );
          expect(logger.debug).toHaveBeenCalledWith(
            expect.stringContaining(
              `ClientApiKeyProvider.getKey (test-llm): Configuration for cloud service '${apiType}' has required key identifier(s)`
            )
          );
        });

        test(`should return null and log error for cloud service '${apiType}' when BOTH apiKeyEnvVar and apiKeyFileName are missing`, async () => {
          llmConfig.apiType = apiType;
          llmConfig.apiKeyEnvVar = undefined;
          llmConfig.apiKeyFileName = undefined;

          const key = await provider.getKey(llmConfig, environmentContext);
          expect(key).toBeNull();
          expect(logger.error).toHaveBeenCalledWith(
            `ClientApiKeyProvider.getKey (test-llm): Configuration for cloud service '${apiType}' is missing both 'apiKeyEnvVar' and 'apiKeyFileName'. The proxy server will be unable to retrieve the API key. This is a configuration issue.`
          );
        });

        test(`should return null and log error for cloud service '${apiType}' when apiKeyEnvVar is empty string`, async () => {
          llmConfig.apiType = apiType;
          llmConfig.apiKeyEnvVar = '   '; // whitespace
          llmConfig.apiKeyFileName = undefined;

          const key = await provider.getKey(llmConfig, environmentContext);
          expect(key).toBeNull();
          expect(logger.error).toHaveBeenCalledWith(
            `ClientApiKeyProvider.getKey (test-llm): Configuration for cloud service '${apiType}' is missing both 'apiKeyEnvVar' and 'apiKeyFileName'. The proxy server will be unable to retrieve the API key. This is a configuration issue.`
          );
        });

        test(`should return null and log error for cloud service '${apiType}' when apiKeyFileName is empty string`, async () => {
          llmConfig.apiType = apiType;
          llmConfig.apiKeyEnvVar = undefined;
          llmConfig.apiKeyFileName = '   '; // whitespace

          const key = await provider.getKey(llmConfig, environmentContext);
          expect(key).toBeNull();
          expect(logger.error).toHaveBeenCalledWith(
            `ClientApiKeyProvider.getKey (test-llm): Configuration for cloud service '${apiType}' is missing both 'apiKeyEnvVar' and 'apiKeyFileName'. The proxy server will be unable to retrieve the API key. This is a configuration issue.`
          );
        });
      });
    });

    describe('Non-Cloud (Local) Service Behavior', () => {
      const localApiTypes = ['ollama', 'local-llm', 'custom_server'];
      localApiTypes.forEach((apiType) => {
        test(`should return null and NOT log error for local service '${apiType}' even if key identifiers are missing`, async () => {
          llmConfig.apiType = apiType;
          llmConfig.apiKeyEnvVar = undefined;
          llmConfig.apiKeyFileName = undefined;

          const key = await provider.getKey(llmConfig, environmentContext);
          expect(key).toBeNull();
          expect(logger.error).not.toHaveBeenCalledWith(
            expect.stringContaining('missing both')
          );
          expect(logger.debug).toHaveBeenCalledWith(
            `ClientApiKeyProvider.getKey (test-llm): LLM apiType '${apiType}' is not listed as a cloud service requiring proxy key identifier validation. Skipping checks.`
          );
        });

        test(`should return null and NOT log error for local service '${apiType}' even if key identifiers are present`, async () => {
          llmConfig.apiType = apiType;
          llmConfig.apiKeyEnvVar = 'SOME_ENV_VAR'; // Present but shouldn't matter
          llmConfig.apiKeyFileName = 'some_file.txt'; // Present but shouldn't matter

          const key = await provider.getKey(llmConfig, environmentContext);
          expect(key).toBeNull();
          expect(logger.error).not.toHaveBeenCalledWith(
            expect.stringContaining('missing both')
          );
          expect(logger.debug).toHaveBeenCalledWith(
            `ClientApiKeyProvider.getKey (test-llm): LLM apiType '${apiType}' is not listed as a cloud service requiring proxy key identifier validation. Skipping checks.`
          );
        });
      });
    });

    test('should return null and log debug if apiType is missing in llmConfig', async () => {
      llmConfig.apiType = undefined;
      const key = await provider.getKey(llmConfig, environmentContext);
      expect(key).toBeNull();
      expect(logger.error).not.toHaveBeenCalled(); // No error for missing identifiers in this case
      expect(logger.debug).toHaveBeenCalledWith(
        'ClientApiKeyProvider.getKey (test-llm): LLM apiType is missing or not a string. Assuming non-cloud or misconfigured. Skipping key identifier checks.'
      );
    });

    test('should return null and log debug if apiType is not a string in llmConfig', async () => {
      // @ts-ignore
      llmConfig.apiType = 123; // Invalid type
      const key = await provider.getKey(llmConfig, environmentContext);
      expect(key).toBeNull();
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'ClientApiKeyProvider.getKey (test-llm): LLM apiType is missing or not a string. Assuming non-cloud or misconfigured. Skipping key identifier checks.'
      );
    });

    test('getKey always resolves to null in all execution paths tested', async () => {
      // This test is more of a meta-assertion based on the design and other tests.
      // Path 1: Not client
      environmentContext = createMockEnvironmentContext(false, 'server');
      let key = await provider.getKey(llmConfig, environmentContext);
      expect(key).toBeNull();

      // Path 2: Client, cloud service, with key identifier
      environmentContext = createMockEnvironmentContext(true, 'client');
      llmConfig.apiType = 'openai';
      llmConfig.apiKeyEnvVar = 'KEY_VAR';
      key = await provider.getKey(llmConfig, environmentContext);
      expect(key).toBeNull();

      // Path 3: Client, cloud service, missing key identifiers
      llmConfig.apiKeyEnvVar = undefined;
      key = await provider.getKey(llmConfig, environmentContext);
      expect(key).toBeNull();

      // Path 4: Client, local service
      llmConfig.apiType = 'ollama';
      key = await provider.getKey(llmConfig, environmentContext);
      expect(key).toBeNull();
    });
  });
});

// --- FILE END ---
