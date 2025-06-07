// tests/turns/adapters/configurableLLMAdapter.getAIDecision.test.js
// --- FILE START ---

import { jest, beforeEach, describe, expect, it } from '@jest/globals';
import {
  ConfigurableLLMAdapter,
  ConfigurationError,
} from '../../../src/turns/adapters/configurableLLMAdapter.js'; // Adjust path as needed
import { CLOUD_API_TYPES } from '../../../src/llms/constants/llmConstants.js'; // Adjust path as needed

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockEnvironmentContext = {
  getExecutionEnvironment: jest.fn(),
  getProjectRootPath: jest.fn(),
  getProxyServerUrl: jest.fn(),
  isClient: jest.fn(),
  isServer: jest.fn(),
};

const mockApiKeyProvider = {
  getKey: jest.fn(),
};

const mockLlmStrategyFactory = {
  getStrategy: jest.fn(),
};

const mockLlmConfigLoader = {
  loadConfigs: jest.fn(),
};

const mockLlmStrategy = {
  execute: jest.fn(),
};

// Base sample LLM dependencyInjection with all required fields for LLMModelConfig
const createBaseModelConfig = (id, overrides = {}) => ({
  configId: id,
  displayName: `Display ${id}`,
  apiType: 'test-api',
  modelIdentifier: `model-for-${id}`,
  endpointUrl: `https://example.com/${id}`,
  jsonOutputStrategy: { method: 'native_json' },
  promptElements: [{ key: 'sys', prefix: '', suffix: '' }],
  promptAssemblyOrder: ['sys'],
  ...overrides,
});

describe('ConfigurableLLMAdapter', () => {
  let adapter;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnvironmentContext.getExecutionEnvironment.mockReturnValue('server');
    mockEnvironmentContext.isServer.mockReturnValue(true);
    mockEnvironmentContext.isClient.mockReturnValue(false);
    mockLlmStrategyFactory.getStrategy.mockReturnValue(mockLlmStrategy);
  });

  describe('getAIDecision() Method', () => {
    const gameSummary = 'The game is afoot!';
    const mockSuccessDecision = JSON.stringify({
      action: 'proceed',
      speech: "Let's go!",
    });

    const operationalConfigsStructure = {
      defaultConfigId: 'test-llm-operational',
      configs: {
        'test-llm-operational': createBaseModelConfig('test-llm-operational', {
          displayName: 'Operational LLM',
          apiType: 'openai',
          modelIdentifier: 'gpt-op',
          endpointUrl: 'https://api.example.com/operational',
        }),
        'test-llm-cloud-server-requires-key': createBaseModelConfig(
          'test-llm-cloud-server-requires-key',
          {
            displayName: 'Cloud LLM For Key Test',
            apiType: CLOUD_API_TYPES[0] || 'some-cloud-api',
            modelIdentifier: 'cloud-model-key',
            endpointUrl: 'https://api.cloud.example.com/keytest',
            apiKeyEnvVar: 'TEST_CLOUD_KEY_VAR',
          }
        ),
        'test-llm-local-no-key-needed': createBaseModelConfig(
          'test-llm-local-no-key-needed',
          {
            displayName: 'Local LLM No Key',
            apiType: 'local-ollama',
            modelIdentifier: 'local-model',
            endpointUrl: 'http://localhost:11434/api/generate',
          }
        ),
      },
    };

    const getOperationalConfigs = () =>
      JSON.parse(JSON.stringify(operationalConfigsStructure));

    beforeEach(async () => {
      adapter = new ConfigurableLLMAdapter({
        logger: mockLogger,
        environmentContext: mockEnvironmentContext,
        apiKeyProvider: mockApiKeyProvider,
        llmStrategyFactory: mockLlmStrategyFactory,
      });
      mockLogger.info.mockClear();
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();
      mockLogger.debug.mockClear();

      mockApiKeyProvider.getKey.mockReset();
      mockLlmStrategyFactory.getStrategy
        .mockReset()
        .mockReturnValue(mockLlmStrategy);
      mockLlmStrategy.execute.mockReset();
      mockLlmConfigLoader.loadConfigs.mockReset();

      mockLlmConfigLoader.loadConfigs.mockResolvedValue(
        getOperationalConfigs()
      );
      await adapter.init({ llmConfigLoader: mockLlmConfigLoader });
      expect(adapter.isOperational()).toBe(true);

      mockLogger.info.mockClear();
      mockLogger.warn.mockClear();
      mockLogger.error.mockClear();
      mockLogger.debug.mockClear();

      mockLlmStrategy.execute.mockResolvedValue(mockSuccessDecision);
      mockApiKeyProvider.getKey.mockResolvedValue('test-api-key-retrieved');
      mockEnvironmentContext.isServer.mockReturnValue(true);
      mockEnvironmentContext.isClient.mockReturnValue(false);
    });

    describe('Initial State Checks', () => {
      it('should throw Error if called before init()', async () => {
        const uninitializedAdapter = new ConfigurableLLMAdapter({
          logger: mockLogger,
          environmentContext: mockEnvironmentContext,
          apiKeyProvider: mockApiKeyProvider,
          llmStrategyFactory: mockLlmStrategyFactory,
        });
        mockLogger.error.mockClear();
        await expect(
          uninitializedAdapter.getAIDecision(gameSummary)
        ).rejects.toThrow(
          new Error(
            'ConfigurableLLMAdapter: Initialization was never started. Call init() before using the adapter.'
          )
        );
      });

      it('should throw Error if called when not operational', async () => {
        const nonOperationalAdapter = new ConfigurableLLMAdapter({
          logger: mockLogger,
          environmentContext: mockEnvironmentContext,
          apiKeyProvider: mockApiKeyProvider,
          llmStrategyFactory: mockLlmStrategyFactory,
        });
        mockLlmConfigLoader.loadConfigs.mockResolvedValue({
          error: true,
          message: 'Failed to load',
          stage: 'test',
        });
        await nonOperationalAdapter.init({
          llmConfigLoader: mockLlmConfigLoader,
        });
        expect(nonOperationalAdapter.isOperational()).toBe(false);
        mockLogger.error.mockClear();
        await expect(
          nonOperationalAdapter.getAIDecision(gameSummary)
        ).rejects.toThrow(
          new Error(
            'ConfigurableLLMAdapter: Adapter initialized but is not operational. Check configuration and logs.'
          )
        );
      });

      it('should throw ConfigurationError if no activeConfig is set', async () => {
        const adapterWithNoActiveLLM = new ConfigurableLLMAdapter({
          logger: mockLogger,
          environmentContext: mockEnvironmentContext,
          apiKeyProvider: mockApiKeyProvider,
          llmStrategyFactory: mockLlmStrategyFactory,
        });
        const configsWithUnmatchableDefault = {
          ...getOperationalConfigs(),
          defaultConfigId: 'completely-unmatchable-default-id',
        };
        mockLlmConfigLoader.loadConfigs.mockResolvedValue(
          configsWithUnmatchableDefault
        );
        await adapterWithNoActiveLLM.init({
          llmConfigLoader: mockLlmConfigLoader,
        });

        expect(adapterWithNoActiveLLM.isOperational()).toBe(true);
        expect(
          await adapterWithNoActiveLLM.getCurrentActiveLlmConfig()
        ).toBeNull();

        mockLogger.error.mockClear();
        const expectedErrorMessage =
          'No active LLM configuration is set. Use setActiveLlm() or ensure a valid defaultConfigId is in the dependencyInjection file.';
        await expect(
          adapterWithNoActiveLLM.getAIDecision(gameSummary)
        ).rejects.toThrow(
          new ConfigurationError(expectedErrorMessage, { llmId: null })
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            `ConfigurableLLMAdapter.getAIDecision: ${expectedErrorMessage}`
          )
        );
      });
    });

    describe('Active Configuration Validation (Ticket 21)', () => {
      const createInvalidTestSetup = async (invalidFieldOverride) => {
        const baseConfigId = 'dependencyInjection-under-test';
        // The configId that will be in the map key.
        // If invalidFieldOverride contains 'configId', that's the property inside the object.
        const internalConfigId = invalidFieldOverride.hasOwnProperty('configId')
          ? invalidFieldOverride.configId
          : baseConfigId;

        const baseConfig = createBaseModelConfig(baseConfigId, {
          displayName: 'Config For Validation',
        });
        // Ensure internal configId is set by override or base correctly to what internalConfigId holds
        const invalidConfig = {
          ...baseConfig,
          ...invalidFieldOverride,
          configId: internalConfigId,
        };

        const tempConfigPayload = {
          defaultConfigId: baseConfigId, // This key points to the object in the map
          configs: {
            [baseConfigId]: invalidConfig, // The object stored here has configId = internalConfigId
            'some-other-valid-config': createBaseModelConfig(
              'some-other-valid-config'
            ),
          },
        };

        const testAdapter = new ConfigurableLLMAdapter({
          logger: mockLogger,
          environmentContext: mockEnvironmentContext,
          apiKeyProvider: mockApiKeyProvider,
          llmStrategyFactory: mockLlmStrategyFactory,
        });

        mockLlmConfigLoader.loadConfigs.mockResolvedValue(tempConfigPayload);
        await testAdapter.init({ llmConfigLoader: mockLlmConfigLoader });
        expect(testAdapter.isOperational()).toBe(true);

        // This assertion should check the configId *property* of the loaded active dependencyInjection
        const activeConfig = await testAdapter.getCurrentActiveLlmConfig();
        // Corrected Assertion: The active dependencyInjection's internal configId should be what we set it to via invalidFieldOverride
        expect(activeConfig?.configId).toBe(internalConfigId);

        mockLogger.error.mockClear();
        return testAdapter;
      };

      // Test cases now check for configId, not id
      it.each([
        [{ configId: null }, 'configId: Missing or invalid'],
        [{ endpointUrl: null }, 'endpointUrl: Missing or invalid'],
        [{ endpointUrl: '  ' }, 'endpointUrl: Missing or invalid'],
        [{ modelIdentifier: null }, 'modelIdentifier: Missing or invalid'],
        [{ modelIdentifier: '  ' }, 'modelIdentifier: Missing or invalid'],
        [{ apiType: null }, 'apiType: Missing or invalid'],
        [{ apiType: '  ' }, 'apiType: Missing or invalid'],
      ])(
        'should throw ConfigurationError if activeConfig field is invalid: %p',
        async (invalidFieldOverride, expectedMsgPart) => {
          const testAdapter =
            await createInvalidTestSetup(invalidFieldOverride);

          await expect(testAdapter.getAIDecision(gameSummary)).rejects.toThrow(
            ConfigurationError
          );

          try {
            await testAdapter.getAIDecision(gameSummary);
          } catch (e) {
            // The ID used in the error message for "Active LLM dependencyInjection '...' is invalid" should be the configId property of the active dependencyInjection
            const actualConfigIdInError = invalidFieldOverride.hasOwnProperty(
              'configId'
            )
              ? invalidFieldOverride.configId
              : 'dependencyInjection-under-test';
            const displayIdInErrorMessage =
              actualConfigIdInError === null ||
              String(actualConfigIdInError).trim() === ''
                ? 'unknown'
                : actualConfigIdInError;

            expect(e.message).toContain(
              `Active LLM config '${displayIdInErrorMessage}' is invalid:`
            );
            expect(e.message).toContain(expectedMsgPart);
            expect(e.llmId).toBe(actualConfigIdInError); // The llmId in the error object should be the problematic configId
            expect(
              e.problematicFields.some(
                (f) =>
                  f.reason === 'Missing or invalid' &&
                  expectedMsgPart.startsWith(f.field)
              )
            ).toBe(true);
          }
        }
      );

      it('should throw ConfigurationError if jsonOutputStrategy is not an object when provided', async () => {
        const testAdapter = await createInvalidTestSetup({
          jsonOutputStrategy: 'not-an-object',
        });
        await expect(testAdapter.getAIDecision(gameSummary)).rejects.toThrow(
          ConfigurationError
        );
        try {
          await testAdapter.getAIDecision(gameSummary);
        } catch (e) {
          expect(e.message).toContain(
            'jsonOutputStrategy: Is required and must be an object.'
          );
        }
      });

      it('should throw ConfigurationError if jsonOutputStrategy.method is invalid when provided', async () => {
        const testAdapter = await createInvalidTestSetup({
          jsonOutputStrategy: { method: '  ' },
        });
        await expect(testAdapter.getAIDecision(gameSummary)).rejects.toThrow(
          ConfigurationError
        );
        try {
          await testAdapter.getAIDecision(gameSummary);
        } catch (e) {
          expect(e.message).toContain(
            'jsonOutputStrategy.method: Is required and must be a non-empty string.'
          );
        }
      });
    });

    describe('API Key Retrieval', () => {
      it('should call IApiKeyProvider.getKey with correct activeConfig and environmentContext', async () => {
        await adapter.setActiveLlm('test-llm-operational');
        mockLogger.info.mockClear();
        await adapter.getAIDecision(gameSummary);
        const expectedActiveConfig =
          operationalConfigsStructure.configs['test-llm-operational'];
        expect(mockApiKeyProvider.getKey).toHaveBeenCalledWith(
          expectedActiveConfig,
          mockEnvironmentContext
        );
      });

      it('should throw ConfigurationError if API key is required (cloud API on server) but getKey returns null', async () => {
        const llmId = 'test-llm-cloud-server-requires-key';
        await adapter.setActiveLlm(llmId);
        mockApiKeyProvider.getKey.mockResolvedValue(null);
        mockEnvironmentContext.isServer.mockReturnValue(true);
        mockLogger.error.mockClear();

        const expectedErrorMessage = `API key missing for server-side cloud LLM '${llmId}'. Key is required in this context.`;
        await expect(adapter.getAIDecision(gameSummary)).rejects.toThrow(
          new ConfigurationError(expectedErrorMessage, {
            llmId: llmId,
            problematicField: 'apiKey',
          })
        );
      });

      it('should proceed with null API key if not strictly required (local LLM)', async () => {
        await adapter.setActiveLlm('test-llm-local-no-key-needed');
        mockApiKeyProvider.getKey.mockResolvedValue(null);
        mockLogger.info.mockClear();

        await adapter.getAIDecision(gameSummary);
        expect(mockLlmStrategy.execute).toHaveBeenCalledWith(
          expect.objectContaining({ apiKey: null })
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          expect.stringContaining(
            "API key not required or not found for LLM 'test-llm-local-no-key-needed'"
          )
        );
      });

      it('should proceed with null API key if not strictly required (cloud API on client - assuming proxy handles key)', async () => {
        await adapter.setActiveLlm('test-llm-cloud-server-requires-key');
        mockApiKeyProvider.getKey.mockResolvedValue(null);
        mockEnvironmentContext.isServer.mockReturnValue(false);
        mockEnvironmentContext.isClient.mockReturnValue(true);
        mockLogger.info.mockClear();

        await adapter.getAIDecision(gameSummary);
        expect(mockLlmStrategy.execute).toHaveBeenCalledWith(
          expect.objectContaining({ apiKey: null })
        );
      });
    });

    describe('Strategy Factory Interaction', () => {
      it('should call LLMStrategyFactory.getStrategy with the correct activeConfig', async () => {
        await adapter.setActiveLlm('test-llm-operational');
        await adapter.getAIDecision(gameSummary);
        const expectedActiveConfig =
          operationalConfigsStructure.configs['test-llm-operational'];
        expect(mockLlmStrategyFactory.getStrategy).toHaveBeenCalledWith(
          expectedActiveConfig
        );
      });

      it('should throw ConfigurationError if factory.getStrategy throws an error', async () => {
        const llmId = 'test-llm-operational';
        await adapter.setActiveLlm(llmId);
        const factoryError = new Error('Factory failed to create strategy');
        mockLlmStrategyFactory.getStrategy.mockImplementation(() => {
          throw factoryError;
        });
        mockLogger.error.mockClear();

        const expectedWrappedErrorMessage = `Failed to get strategy from factory for LLM '${llmId}': ${factoryError.message}`;
        await expect(adapter.getAIDecision(gameSummary)).rejects.toThrow(
          new ConfigurationError(expectedWrappedErrorMessage, {
            llmId: llmId,
            originalError: factoryError,
          })
        );
      });

      it('should throw ConfigurationError if factory.getStrategy returns null/undefined', async () => {
        const llmId = 'test-llm-operational';
        await adapter.setActiveLlm(llmId);
        mockLlmStrategyFactory.getStrategy.mockReturnValue(null);
        mockLogger.error.mockClear();

        const expectedErrorMessage = `No suitable LLM strategy could be created for the active configuration '${llmId}'. Check factory logic and LLM config apiType.`;
        await expect(adapter.getAIDecision(gameSummary)).rejects.toThrow(
          new ConfigurationError(expectedErrorMessage, { llmId: llmId })
        );
      });
    });

    describe('Strategy Execution', () => {
      it('should call strategy.execute with correct parameters', async () => {
        const apiKeyToUse = 'key-for-strategy';
        mockApiKeyProvider.getKey.mockResolvedValue(apiKeyToUse);
        const llmId = 'test-llm-operational';
        await adapter.setActiveLlm(llmId);
        mockLogger.info.mockClear();

        await adapter.getAIDecision(gameSummary);
        const expectedActiveConfig = operationalConfigsStructure.configs[llmId];
        expect(mockLlmStrategy.execute).toHaveBeenCalledWith({
          gameSummary,
          llmConfig: expectedActiveConfig,
          apiKey: apiKeyToUse,
          environmentContext: mockEnvironmentContext,
        });
      });

      it('should return the JSON string from strategy.execute', async () => {
        const strategyResponse = JSON.stringify({ strategy: 'response' });
        mockLlmStrategy.execute.mockResolvedValue(strategyResponse);
        const result = await adapter.getAIDecision(gameSummary);
        expect(result).toBe(strategyResponse);
      });
    });

    describe('Error Propagation', () => {
      const llmId = 'test-llm-operational';
      beforeEach(async () => {
        await adapter.setActiveLlm(llmId);
        expect((await adapter.getCurrentActiveLlmConfig())?.configId).toBe(
          llmId
        );
        mockLogger.info.mockClear();
        mockLogger.error.mockClear();
      });

      it('should catch, log, and re-throw errors from IApiKeyProvider.getKey', async () => {
        const apiKeyError = new Error('API Key Provider Error');
        mockApiKeyProvider.getKey.mockRejectedValue(apiKeyError);

        await expect(adapter.getAIDecision(gameSummary)).rejects.toThrow(
          apiKeyError
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            `Error during getAIDecision for LLM '${llmId}': ${apiKeyError.message}`
          ),
          expect.objectContaining({ llmId: llmId, errorName: apiKeyError.name })
        );
      });

      it('should catch, log, and re-throw ConfigurationError when LLMStrategyFactory.getStrategy throws non-ConfigurationError', async () => {
        const factoryGenericError = new Error('Factory generic meltdown');
        mockLlmStrategyFactory.getStrategy.mockImplementation(() => {
          throw factoryGenericError;
        });

        const expectedWrappedMessage = `Failed to get strategy from factory for LLM '${llmId}': ${factoryGenericError.message}`;
        await expect(adapter.getAIDecision(gameSummary)).rejects.toThrow(
          new ConfigurationError(expectedWrappedMessage, {
            llmId,
            originalError: factoryGenericError,
          })
        );

        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            `Error during getAIDecision for LLM '${llmId}': ${expectedWrappedMessage}`
          ),
          expect.objectContaining({
            llmId: llmId,
            errorName: 'ConfigurationError',
          })
        );
      });

      it('should catch, log, and re-throw errors from strategy.execute', async () => {
        const strategyExecuteError = new Error('Strategy Execution Failed');
        mockLlmStrategy.execute.mockRejectedValue(strategyExecuteError);

        await expect(adapter.getAIDecision(gameSummary)).rejects.toThrow(
          strategyExecuteError
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            `Error during getAIDecision for LLM '${llmId}': ${strategyExecuteError.message}`
          ),
          expect.objectContaining({
            llmId: llmId,
            errorName: strategyExecuteError.name,
          })
        );
      });

      it('should re-throw ConfigurationError from validation steps directly, and log it once via main catch', async () => {
        const configKey = 'invalid-validation-id';
        const invalidConfig = createBaseModelConfig(configKey, {
          configId: null,
        }); // configId property is null
        const tempConfigs = {
          defaultConfigId: configKey,
          configs: { [configKey]: invalidConfig },
        };
        mockLlmConfigLoader.loadConfigs.mockResolvedValue(tempConfigs);

        const testAdapter = new ConfigurableLLMAdapter({
          logger: mockLogger,
          environmentContext: mockEnvironmentContext,
          apiKeyProvider: mockApiKeyProvider,
          llmStrategyFactory: mockLlmStrategyFactory,
        });
        await testAdapter.init({ llmConfigLoader: mockLlmConfigLoader });
        expect(testAdapter.isOperational()).toBe(true);
        expect(
          (await testAdapter.getCurrentActiveLlmConfig())?.configId
        ).toBeNull();

        mockLogger.error.mockClear();

        const expectedValidationErrorMessage = `Active LLM config 'unknown' is invalid: configId: Missing or invalid`;
        await expect(testAdapter.getAIDecision(gameSummary)).rejects.toThrow(
          new ConfigurationError(expectedValidationErrorMessage, {
            llmId: null,
            problematicFields: [
              { field: 'configId', reason: 'Missing or invalid' },
            ],
          })
        );

        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        // The llmIdForLog will be this.#currentActiveLlmId ('invalid-validation-id') because activeConfig.configId is null and error.llmId is null.
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            `Error during getAIDecision for LLM '${configKey}': ${expectedValidationErrorMessage}`
          ),
          expect.objectContaining({
            llmId: configKey,
            errorName: 'ConfigurationError',
          })
        );
      });
    });
  });
});

// --- FILE END ---
