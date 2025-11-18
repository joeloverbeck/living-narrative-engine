import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ConfigurableLLMAdapter } from '../../../src/turns/adapters/configurableLLMAdapter.js';
import { EnvironmentContext } from '../../../src/llms/environmentContext.js';
import { LLMConfigurationManager } from '../../../src/llms/services/llmConfigurationManager.js';
import { LlmConfigLoader } from '../../../src/llms/services/llmConfigLoader.js';
import { LLMRequestExecutor } from '../../../src/llms/services/llmRequestExecutor.js';
import { LLMStrategyFactory } from '../../../src/llms/LLMStrategyFactory.js';
import { LLMErrorMapper } from '../../../src/llms/services/llmErrorMapper.js';
import { TokenEstimator } from '../../../src/llms/services/tokenEstimator.js';
import PromptTooLongError from '../../../src/errors/promptTooLongError.js';
import { ConfigurationError } from '../../../src/errors/configurationError.js';

class TestLogger {
  constructor(label = 'TestLogger') {
    this.label = label;
    this.entries = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  #push(level, message, context) {
    const normalizedMessage =
      typeof message === 'string' ? message : String(message);
    this.entries[level].push({ message: normalizedMessage, context });
  }

  debug(message, context) {
    this.#push('debug', message, context);
  }

  info(message, context) {
    this.#push('info', message, context);
  }

  warn(message, context) {
    this.#push('warn', message, context);
  }

  error(message, context) {
    this.#push('error', message, context);
  }

  has(level, expectedSubstring) {
    return this.entries[level].some((entry) =>
      entry.message.includes(expectedSubstring)
    );
  }
}

class PassthroughSchemaValidator {
  validate() {
    return { isValid: true, errors: [] };
  }
}

class InMemoryDataFetcher {
  #responses;

  constructor(responses) {
    this.#responses = responses;
  }

  async fetch(identifier) {
    if (!Object.prototype.hasOwnProperty.call(this.#responses, identifier)) {
      throw new Error(`No fixture available for ${identifier}`);
    }
    return this.#responses[identifier];
  }
}

class TestApiKeyProvider {
  constructor(keys = {}) {
    this.keys = keys;
  }

  async getKey(llmConfig) {
    if (!llmConfig) return null;
    if (Object.prototype.hasOwnProperty.call(this.keys, llmConfig.configId)) {
      return this.keys[llmConfig.configId];
    }
    return this.keys.default ?? null;
  }
}

class TestHttpClient {
  constructor(responder) {
    this.responder = responder;
    this.requests = [];
  }

  async request(url, options) {
    this.requests.push({ url, options });
    return this.responder(url, options);
  }
}

const SCHEMA_ID = 'schema://living-narrative-engine/llm-configs.schema.json';
const FIXTURE_PATH = 'config/llm-configs.json';

const baseFixtureConfig = {
  defaultConfigId: 'openrouter-primary',
  configs: {
    'openrouter-primary': {
      configId: 'openrouter-primary',
      displayName: 'OpenRouter Primary',
      modelIdentifier: 'anthropic/claude-3-sonnet',
      endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiType: 'openrouter',
      jsonOutputStrategy: {
        method: 'openrouter_tool_calling',
        toolName: 'function_call',
      },
      defaultParameters: {
        temperature: 0.7,
        max_tokens: 32,
      },
      providerSpecificHeaders: {
        'HTTP-Referer': 'https://living-narrative.test',
      },
      contextTokenLimit: 512,
      promptElements: [{ key: 'system', prefix: '', suffix: '' }],
      promptAssemblyOrder: ['system'],
    },
    'openrouter-limited': {
      configId: 'openrouter-limited',
      displayName: 'OpenRouter Limited Context',
      modelIdentifier: 'anthropic/claude-3-haiku',
      endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiType: 'openrouter',
      jsonOutputStrategy: {
        method: 'openrouter_tool_calling',
        toolName: 'function_call',
      },
      defaultParameters: {
        temperature: 0.6,
        max_tokens: 8,
      },
      contextTokenLimit: 20,
      promptElements: [{ key: 'system', prefix: '', suffix: '' }],
      promptAssemblyOrder: ['system'],
    },
    unsupported: {
      configId: 'unsupported',
      displayName: 'Unsupported Provider',
      modelIdentifier: 'experimental/provider-x',
      endpointUrl: 'https://unsupported.example.com/api',
      apiType: 'unsupported',
      jsonOutputStrategy: {
        method: 'openrouter_tool_calling',
        toolName: 'function_call',
      },
      promptElements: [{ key: 'system', prefix: '', suffix: '' }],
      promptAssemblyOrder: ['system'],
    },
  },
};

/**
 *
 * @param fixtures
 * @param overrides
 */
function createLoaderWithFixtures(fixtures, overrides = {}) {
  return new LlmConfigLoader({
    logger: overrides.logger ?? new TestLogger('Loader'),
    schemaValidator:
      overrides.schemaValidator ?? new PassthroughSchemaValidator(),
    configuration:
      overrides.configuration ??
      {
        getContentTypeSchemaId: (key) =>
          key === 'llm-configs' ? SCHEMA_ID : undefined,
      },
    safeEventDispatcher:
      overrides.safeEventDispatcher ?? {
        async dispatch() {
          return true;
        },
      },
    dataFetcher:
      overrides.dataFetcher ?? new InMemoryDataFetcher(fixtures),
  });
}

/**
 *
 * @param root0
 * @param root0.fixtureConfig
 * @param root0.httpResponder
 * @param root0.apiKeys
 * @param root0.initialLlmId
 * @param root0.executionEnvironment
 * @param root0.overrides
 */
function createAdapterDependencies({
  fixtureConfig = baseFixtureConfig,
  httpResponder,
  apiKeys = { default: 'integration-test-api-key' },
  initialLlmId = undefined,
  executionEnvironment = 'server',
  overrides = {},
} = {}) {
  const loader =
    overrides.loader ??
    createLoaderWithFixtures({
      [FIXTURE_PATH]: fixtureConfig,
    });

  const httpClient =
    overrides.httpClient ??
    new TestHttpClient((url, options) => {
      if (httpResponder) {
        return httpResponder(url, options);
      }
      const payload = JSON.parse(options.body);
      const toolName =
        payload?.tool_choice?.function?.name ?? 'function_call';
      return {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  type: 'function',
                  function: {
                    name: toolName,
                    arguments: JSON.stringify({
                      action: 'advance',
                      target: 'integration-default',
                    }),
                  },
                },
              ],
            },
          },
        ],
      };
    });

  const strategyFactory =
    overrides.strategyFactory ??
    new LLMStrategyFactory({
      httpClient,
      logger: new TestLogger('StrategyFactory'),
    });

  const environmentContext =
    overrides.environmentContext ??
    new EnvironmentContext({
      logger: new TestLogger('EnvironmentContext'),
      executionEnvironment,
      projectRootPath:
        executionEnvironment === 'server' ? process.cwd() : undefined,
      proxyServerUrl: 'https://proxy.integration.test',
    });

  const configurationManager =
    overrides.configurationManager ??
    new LLMConfigurationManager({
      logger: new TestLogger('ConfigurationManager'),
      initialLlmId,
    });

  const errorMapper =
    overrides.errorMapper ??
    new LLMErrorMapper({
      logger: new TestLogger('ErrorMapper'),
    });

  const tokenEstimator =
    overrides.tokenEstimator ??
    new TokenEstimator({
      logger: new TestLogger('TokenEstimator'),
    });

  const apiKeyProvider =
    overrides.apiKeyProvider ?? new TestApiKeyProvider(apiKeys);
  const adapterLogger = overrides.adapterLogger ?? new TestLogger('Adapter');
  const requestExecutor =
    overrides.requestExecutor ??
    new LLMRequestExecutor({
      logger: new TestLogger('RequestExecutor'),
    });

  return {
    loader,
    httpClient,
    strategyFactory,
    environmentContext,
    configurationManager,
    errorMapper,
    tokenEstimator,
    apiKeyProvider,
    adapterLogger,
    requestExecutor,
  };
}

/**
 *
 * @param options
 */
function createAdapterHarness(options = {}) {
  const {
    loader,
    httpClient,
    strategyFactory,
    environmentContext,
    configurationManager,
    errorMapper,
    tokenEstimator,
    apiKeyProvider,
    adapterLogger,
    requestExecutor,
  } = createAdapterDependencies(options);

  const adapter = new ConfigurableLLMAdapter({
    logger: adapterLogger,
    environmentContext,
    apiKeyProvider,
    llmStrategyFactory: strategyFactory,
    configurationManager,
    requestExecutor,
    errorMapper,
    tokenEstimator,
    initialLlmId: options.initialLlmId,
  });

  return {
    adapter,
    loader,
    httpClient,
    configurationManager,
    environmentContext,
    errorMapper,
    tokenEstimator,
    apiKeyProvider,
    strategyFactory,
    adapterLogger,
    requestExecutor,
  };
}

describe('ConfigurableLLMAdapter integration with real services', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('initializes and executes decisions end-to-end with production collaborators', async () => {
    const expectedArguments = { action: 'open', target: 'ancient-door' };
    const harness = createAdapterHarness({
      httpResponder: (_url, options) => {
        const parsed = JSON.parse(options.body);
        const toolName = parsed?.tool_choice?.function?.name ?? 'function_call';
        return {
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    type: 'function',
                    function: {
                      name: toolName,
                      arguments: JSON.stringify(expectedArguments),
                    },
                  },
                ],
              },
            },
          ],
        };
      },
    });

    await harness.adapter.init({ llmConfigLoader: harness.loader });

    expect(harness.adapter.isInitialized()).toBe(true);
    expect(harness.adapter.isOperational()).toBe(true);

    const options = await harness.adapter.getAvailableLlmOptions();
    expect(options).toEqual(
      expect.arrayContaining([
        {
          configId: 'openrouter-primary',
          displayName: 'OpenRouter Primary',
        },
        {
          configId: 'openrouter-limited',
          displayName: 'OpenRouter Limited Context',
        },
      ])
    );

    const activeConfig = await harness.adapter.getCurrentActiveLlmConfig();
    expect(activeConfig?.configId).toBe('openrouter-primary');

    const requestOptions = {
      toolSchema: {
        type: 'object',
        properties: {
          action: { type: 'string' },
          target: { type: 'string' },
        },
        required: ['action', 'target'],
      },
      toolName: 'custom_tool',
      toolDescription: 'Integration custom command executor',
    };

    const result = await harness.adapter.getAIDecision(
      'You stand before an ancient door guarded by riddles.',
      undefined,
      requestOptions
    );

    expect(result).toBe(JSON.stringify(expectedArguments));
    expect(harness.httpClient.requests).toHaveLength(1);

    const [{ options: sentOptions }] = harness.httpClient.requests;
    expect(sentOptions.headers.Authorization).toBe(
      'Bearer integration-test-api-key'
    );

    const parsedBody = JSON.parse(sentOptions.body);
    expect(parsedBody.tool_choice.function.name).toBe('custom_tool');
    expect(parsedBody.tools[0].function.description).toBe(
      'Integration custom command executor'
    );

    const loadedConfigs = await harness.adapter.getLoadedConfigs_FOR_TESTING_ONLY();
    expect(loadedConfigs?.defaultConfigId).toBe('openrouter-primary');

    const testActiveId = await harness.adapter.getActiveLlmId_FOR_TESTING_ONLY();
    expect(testActiveId).toBe('openrouter-primary');

    expect(harness.adapter.getEnvironmentContext_FOR_TESTING_ONLY()).toBe(
      harness.environmentContext
    );
    expect(harness.adapter.getProjectRootPath_FOR_TESTING_ONLY()).toBe(
      process.cwd()
    );
    expect(harness.adapter.getProxyServerUrl_FOR_TESTING_ONLY()).toBe(
      'https://proxy.integration.test'
    );
    expect(harness.adapter.getApiKeyProvider_FOR_TESTING_ONLY()).toBe(
      harness.apiKeyProvider
    );
    expect(harness.adapter.getLlmStrategyFactory_FOR_TESTING_ONLY()).toBe(
      harness.strategyFactory
    );

    const tokenCount = await harness.adapter.estimateTokenCount_FOR_TESTING_ONLY(
      'short prompt',
      activeConfig
    );
    expect(tokenCount).toBeGreaterThan(0);
  });

  it('wraps strategy factory failures as configuration errors', async () => {
    const harness = createAdapterHarness();
    await harness.adapter.init({ llmConfigLoader: harness.loader });
    await harness.adapter.setActiveLlm('unsupported');

    const errorMapperSpy = jest.spyOn(harness.errorMapper, 'mapHttpError');

    await expect(
      harness.adapter.getAIDecision('Attempt unsupported strategy.')
    ).rejects.toThrow(
      /Failed to get strategy from factory for LLM 'unsupported'/
    );

    expect(errorMapperSpy).toHaveBeenCalled();
  });

  it('validates request options eagerly', async () => {
    const harness = createAdapterHarness();
    await harness.adapter.init({ llmConfigLoader: harness.loader });

    await expect(
      harness.adapter.getAIDecision('Invalid schema request', undefined, {
        toolSchema: 'not-an-object',
      })
    ).rejects.toThrow('toolSchema must be an object');

    await expect(
      harness.adapter.getAIDecision('Invalid tool name', undefined, {
        toolSchema: {},
        toolName: 123,
      })
    ).rejects.toThrow('toolName must be a string');

    await expect(
      harness.adapter.getAIDecision('Invalid tool description', undefined, {
        toolSchema: {},
        toolName: 'valid',
        toolDescription: 42,
      })
    ).rejects.toThrow('toolDescription must be a string');
  });

  it('enforces prompt token budgets by throwing PromptTooLongError', async () => {
    const harness = createAdapterHarness();
    await harness.adapter.init({ llmConfigLoader: harness.loader });
    await harness.adapter.setActiveLlm('openrouter-limited');

    const longPrompt = 'long prompt '.repeat(200);

    await expect(
      harness.adapter.getAIDecision(longPrompt)
    ).rejects.toThrow(PromptTooLongError);

    expect(
      harness.adapterLogger.has(
        'error',
        'Estimated prompt tokens'
      )
    ).toBe(true);
  });

  it('marks the adapter non-operational when initialization fails', async () => {
    const harness = createAdapterHarness();

    await expect(
      harness.adapter.init({ llmConfigLoader: { loadConfigs: null } })
    ).rejects.toThrow('Initialization requires a valid LlmConfigLoader instance.');

    expect(harness.adapter.isInitialized()).toBe(true);
    expect(harness.adapter.isOperational()).toBe(false);

    const activeId = await harness.adapter.getCurrentActiveLlmId();
    expect(activeId).toBeNull();

    expect(
      harness.adapterLogger.has(
        'error',
        'Adapter initialized but is not operational'
      )
    ).toBe(true);
  });

  it('returns safe fallbacks when configuration manager operations fail', async () => {
    const harness = createAdapterHarness();
    await harness.adapter.init({ llmConfigLoader: harness.loader });

    jest
      .spyOn(harness.configurationManager, 'getAvailableOptions')
      .mockRejectedValue(new Error('simulated failure'));
    const options = await harness.adapter.getAvailableLlmOptions();
    expect(options).toEqual([]);
    expect(
      harness.adapterLogger.has(
        'warn',
        'ConfigurableLLMAdapter.getAvailableLlmOptions: Error retrieving options'
      )
    ).toBe(true);

    jest
      .spyOn(harness.configurationManager, 'getActiveConfigId')
      .mockRejectedValue(new Error('simulated id failure'));
    const id = await harness.adapter.getCurrentActiveLlmId();
    expect(id).toBeNull();
    expect(
      harness.adapterLogger.has(
        'warn',
        'ConfigurableLLMAdapter.getCurrentActiveLlmId: Error retrieving ID'
      )
    ).toBe(true);
  });

  it('requires API keys for server-side cloud configurations', async () => {
    const harness = createAdapterHarness({ apiKeys: {} });
    await harness.adapter.init({ llmConfigLoader: harness.loader });

    await expect(
      harness.adapter.getAIDecision('Request without API key')
    ).rejects.toThrow(
      /API key missing for server-side cloud LLM 'openrouter-primary'/
    );
  });

  it('surfaces missing active configuration as a configuration error', async () => {
    const harness = createAdapterHarness();
    await harness.adapter.init({ llmConfigLoader: harness.loader });

    jest
      .spyOn(harness.configurationManager, 'getActiveConfiguration')
      .mockResolvedValue(null);

    await expect(
      harness.adapter.getAIDecision('No active configuration available')
    ).rejects.toThrow(ConfigurationError);

    expect(
      harness.adapterLogger.has(
        'error',
        'No active LLM configuration is set'
      )
    ).toBe(true);
  });

  it('warns when prompt tokens approach the configured limit but still proceeds', async () => {
    const harness = createAdapterHarness();
    await harness.adapter.init({ llmConfigLoader: harness.loader });

    const budgetSpy = jest.spyOn(harness.tokenEstimator, 'getTokenBudget');
    const validateSpy = jest
      .spyOn(harness.tokenEstimator, 'validateTokenLimit')
      .mockImplementation(async () => ({
        isValid: true,
        estimatedTokens: 18,
        availableTokens: 20,
        isNearLimit: true,
      }));

    const response = await harness.adapter.getAIDecision('Prompt near limit');
    expect(response).toContain('integration-default');
    expect(budgetSpy).toHaveBeenCalled();
    expect(validateSpy).toHaveBeenCalled();
    expect(
      harness.adapterLogger.has(
        'warn',
        'Estimated prompt token count (18) is nearing the limit'
      )
    ).toBe(true);

    budgetSpy.mockRestore();
    validateSpy.mockRestore();
  });

  it('normalizes invalid initialLlmId values and logs helpful warnings', async () => {
    const invalidTypeHarness = createAdapterHarness({ initialLlmId: 123 });
    expect(
      invalidTypeHarness.adapterLogger.has(
        'warn',
        'invalid type for initialLlmId'
      )
    ).toBe(true);

    await invalidTypeHarness.adapter.init({
      llmConfigLoader: invalidTypeHarness.loader,
    });
    expect(
      await invalidTypeHarness.adapter.getActiveLlmId_FOR_TESTING_ONLY()
    ).toBe('openrouter-primary');

    const emptyValueHarness = createAdapterHarness({ initialLlmId: '   ' });
    expect(
      emptyValueHarness.adapterLogger.has(
        'warn',
        'empty string for initialLlmId'
      )
    ).toBe(true);

    await emptyValueHarness.adapter.init({
      llmConfigLoader: emptyValueHarness.loader,
    });
    expect(
      await emptyValueHarness.adapter.getActiveLlmId_FOR_TESTING_ONLY()
    ).toBe('openrouter-primary');
  });

  it('skips redundant initialization attempts once ready', async () => {
    const harness = createAdapterHarness();
    await harness.adapter.init({ llmConfigLoader: harness.loader });

    await harness.adapter.init({ llmConfigLoader: harness.loader });

    expect(
      harness.adapterLogger.has(
        'debug',
        'Already initialized. Skipping re-initialization.'
      )
    ).toBe(true);
  });

  it('captures configuration manager failures during initialization', async () => {
    const harness = createAdapterHarness();
    const initError = new Error('configuration explosion');
    const initSpy = jest
      .spyOn(harness.configurationManager, 'init')
      .mockRejectedValue(initError);

    await expect(
      harness.adapter.init({ llmConfigLoader: harness.loader })
    ).rejects.toThrow('configuration explosion');

    expect(harness.adapter.isOperational()).toBe(false);
    expect(
      harness.adapterLogger.has(
        'error',
        'ConfigurableLLMAdapter: Initialization failed.'
      )
    ).toBe(true);

    initSpy.mockRestore();
  });

  it('logs prompt details on clients and tolerates missing API keys when safe', async () => {
    const harness = createAdapterHarness({
      executionEnvironment: 'client',
      apiKeys: {},
    });

    await harness.adapter.init({ llmConfigLoader: harness.loader });

    const response = await harness.adapter.getAIDecision(
      'Client-side prompt logging scenario'
    );

    expect(response).toContain('integration-default');
    expect(
      harness.adapterLogger.has('info', 'Final prompt sent to proxy')
    ).toBe(true);
    expect(
      harness.adapterLogger.has(
        'debug',
        'API key not required or not found for LLM'
      )
    ).toBe(true);
  });

  it('surfaces validation failures for malformed active configurations', async () => {
    const invalidFixture = {
      defaultConfigId: 'broken-config',
      configs: {
        'broken-config': {
          configId: 'broken-config',
          displayName: 'Broken Config',
          modelIdentifier: '',
          endpointUrl: '',
          apiType: '',
          jsonOutputStrategy: null,
        },
      },
    };

    const harness = createAdapterHarness({ fixtureConfig: invalidFixture });
    await harness.adapter.init({ llmConfigLoader: harness.loader });

    await expect(
      harness.adapter.getAIDecision('Invalid configuration prompt')
    ).rejects.toThrow(/Active LLM config 'broken-config' is invalid/);
  });

  it('throws a configuration error when no strategy can be created', async () => {
    const harness = createAdapterHarness();
    await harness.adapter.init({ llmConfigLoader: harness.loader });

    const strategySpy = jest
      .spyOn(harness.strategyFactory, 'getStrategy')
      .mockReturnValue(null);

    await expect(
      harness.adapter.getAIDecision('Missing strategy scenario')
    ).rejects.toThrow(/No suitable LLM strategy could be created/);

    strategySpy.mockRestore();
  });

  it('requires initialization before issuing decisions', async () => {
    const harness = createAdapterHarness();

    await expect(
      harness.adapter.getAIDecision('Uninitialized usage')
    ).rejects.toThrow(
      'ConfigurableLLMAdapter: Initialization was never started. Call init() before using the adapter.'
    );
  });

  it('returns null from testing helper when configuration retrieval fails', async () => {
    const harness = createAdapterHarness();
    await harness.adapter.init({ llmConfigLoader: harness.loader });

    const configsSpy = jest
      .spyOn(harness.configurationManager, 'getAllConfigurations')
      .mockRejectedValue(new Error('boom configs'));

    await expect(
      harness.adapter.getLoadedConfigs_FOR_TESTING_ONLY()
    ).resolves.toBeNull();

    configsSpy.mockRestore();
  });

  it('supports synchronous fallbacks from the active LLM helper', async () => {
    const harness = createAdapterHarness();
    await harness.adapter.init({ llmConfigLoader: harness.loader });

    const idSpy = jest
      .spyOn(harness.configurationManager, 'getActiveConfigId')
      .mockReturnValue('sync-config');

    expect(harness.adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBe(
      'sync-config'
    );

    idSpy.mockRestore();
  });

  it('validates critical dependencies during construction', () => {
    const missingLoggerDeps = createAdapterDependencies();
    expect(() => {
      return new ConfigurableLLMAdapter({
        logger: null,
        environmentContext: missingLoggerDeps.environmentContext,
        apiKeyProvider: missingLoggerDeps.apiKeyProvider,
        llmStrategyFactory: missingLoggerDeps.strategyFactory,
        configurationManager: missingLoggerDeps.configurationManager,
        requestExecutor: missingLoggerDeps.requestExecutor,
        errorMapper: missingLoggerDeps.errorMapper,
        tokenEstimator: missingLoggerDeps.tokenEstimator,
      });
    }).toThrow(
      'ConfigurableLLMAdapter: Constructor requires a valid ILogger instance.'
    );

    const {
      environmentContext,
      apiKeyProvider,
      strategyFactory,
      configurationManager,
      requestExecutor,
      errorMapper,
      tokenEstimator,
    } = createAdapterDependencies();

    /**
     * @param {object} overrides
     * @param {string} expectedMessage
     * @param {string} [loggedSubstring]
     */
    const expectFailure = (
      overrides,
      expectedMessage,
      loggedSubstring = expectedMessage
    ) => {
      const failureLogger = new TestLogger('Adapter');
      expect(() => {
        return new ConfigurableLLMAdapter({
          logger:
            Object.prototype.hasOwnProperty.call(overrides, 'logger')
              ? overrides.logger
              : failureLogger,
          environmentContext,
          apiKeyProvider,
          llmStrategyFactory: strategyFactory,
          configurationManager,
          requestExecutor,
          errorMapper,
          tokenEstimator,
          ...overrides,
        });
      }).toThrow(expectedMessage);

      if (loggedSubstring) {
        expect(failureLogger.has('error', loggedSubstring)).toBe(true);
      }
    };

    expectFailure(
      { environmentContext: null },
      'ConfigurableLLMAdapter: Constructor requires a valid EnvironmentContext instance.'
    );
    expectFailure(
      { apiKeyProvider: {} },
      'ConfigurableLLMAdapter: Constructor requires a valid IApiKeyProvider instance.'
    );
    expectFailure(
      { llmStrategyFactory: {} },
      'ConfigurableLLMAdapter: Constructor requires a valid LLMStrategyFactory instance.'
    );
    expectFailure(
      { configurationManager: {} },
      'ConfigurableLLMAdapter: Constructor requires a valid ILLMConfigurationManager instance.'
    );
    expectFailure(
      { requestExecutor: {} },
      'ConfigurableLLMAdapter: Constructor requires a valid ILLMRequestExecutor instance.'
    );
    expectFailure(
      { errorMapper: null },
      'ConfigurableLLMAdapter: Constructor requires a valid ILLMErrorMapper instance.',
      'requires a valid ILLMErrorMapper instance'
    );
    expectFailure(
      { tokenEstimator: null },
      'ConfigurableLLMAdapter: Constructor requires a valid ITokenEstimator instance.',
      'requires a valid ITokenEstimator instance'
    );
  });

  it('gracefully handles testing helpers when dependencies fail post-init', async () => {
    const harness = createAdapterHarness();
    await harness.adapter.init({ llmConfigLoader: harness.loader });

    jest
      .spyOn(harness.configurationManager, 'getActiveConfigId')
      .mockImplementation(() => {
        throw new Error('sync failure');
      });

    expect(harness.adapter.getActiveLlmId_FOR_TESTING_ONLY()).toBeNull();

    expect(harness.adapter.getExecutionEnvironment_FOR_TESTING_ONLY()).toBe(
      harness.environmentContext.getExecutionEnvironment()
    );
  });
});
