import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { LlmConfigLoader } from '../../../src/llms/services/llmConfigLoader.js';
import { LLMConfigurationManager } from '../../../src/llms/services/llmConfigurationManager.js';
import { LLMSelectionPersistence } from '../../../src/llms/services/llmSelectionPersistence.js';

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

const SCHEMA_ID = 'schema://living-narrative-engine/llm-configs.schema.json';

/**
 *
 */
function createTestLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 *
 * @param fixtures
 * @param overrides
 */
function createLoaderWithFixtures(fixtures, overrides = {}) {
  return new LlmConfigLoader({
    logger: overrides.logger ?? createTestLogger(),
    schemaValidator: overrides.schemaValidator ?? new PassthroughSchemaValidator(),
    configuration:
      overrides.configuration ??
      {
        getContentTypeSchemaId: (key) => (key === 'llm-configs' ? SCHEMA_ID : undefined),
      },
    safeEventDispatcher:
      overrides.safeEventDispatcher ?? {
        dispatch: jest.fn().mockResolvedValue(true),
      },
    dataFetcher: overrides.dataFetcher ?? new InMemoryDataFetcher(fixtures),
  });
}

const baseFixtureConfig = {
  defaultConfigId: 'primary',
  configs: {
    primary: {
      configId: 'primary',
      displayName: 'Primary Model',
      modelIdentifier: 'model-primary',
      endpointUrl: 'https://example.com/primary',
      apiType: 'custom',
      jsonOutputStrategy: { method: 'manual_prompting' },
      promptElements: [
        { key: 'system', prefix: '<<', suffix: '>>' },
        { key: 'user', prefix: '(', suffix: ')' },
      ],
      promptAssemblyOrder: ['system', 'user'],
    },
    secondary: {
      configId: 'secondary',
      displayName: 'Secondary Model',
      modelIdentifier: 'model-secondary',
      endpointUrl: 'https://example.com/secondary',
      apiType: 'custom',
      jsonOutputStrategy: { method: 'manual_prompting' },
      promptElements: [
        { key: 'system', prefix: '[', suffix: ']' },
        { key: 'user', prefix: '{', suffix: '}' },
      ],
      promptAssemblyOrder: ['system', 'user'],
    },
  },
};

const migrationFixtureConfig = {
  defaultConfigId: 'primary',
  configs: {
    ...baseFixtureConfig.configs,
    'claude-sonnet-4.5': {
      configId: 'claude-sonnet-4.5',
      displayName: 'Claude Sonnet 4.5',
      modelIdentifier: 'claude-sonnet-4.5',
      endpointUrl: 'https://example.com/claude',
      apiType: 'openrouter',
      jsonOutputStrategy: { method: 'manual_prompting' },
      promptElements: [
        { key: 'system', prefix: 'SYS:', suffix: '' },
        { key: 'user', prefix: 'USR:', suffix: '' },
      ],
      promptAssemblyOrder: ['system', 'user'],
    },
  },
};

const FIXTURE_PATH = 'config/llm-configs.json';

describe('LLMConfigurationManager integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prioritizes initial selection, persists changes, and exposes loader-backed operations', async () => {
    const loader = createLoaderWithFixtures({ [FIXTURE_PATH]: baseFixtureConfig });
    const manager = new LLMConfigurationManager({
      logger: createTestLogger(),
      initialLlmId: 'secondary',
    });

    await expect(manager.getActiveConfiguration()).rejects.toThrow(
      'LLMConfigurationManager: Not initialized. Call init() first.'
    );

    localStorage.setItem(LLMSelectionPersistence.STORAGE_KEY, 'primary');

    const initPromise = manager.init({ llmConfigLoader: loader });
    const concurrentInit = manager.init({ llmConfigLoader: loader });
    await Promise.all([initPromise, concurrentInit]);

    await manager.init({ llmConfigLoader: loader });

    expect(await manager.getActiveConfigId()).toBe('secondary');
    expect(localStorage.getItem(LLMSelectionPersistence.STORAGE_KEY)).toBe('secondary');

    const activeConfig = await manager.getActiveConfiguration();
    expect(activeConfig?.configId).toBe('secondary');

    expect(await manager.loadConfiguration('primary')).toEqual(
      baseFixtureConfig.configs.primary
    );
    expect(await manager.loadConfiguration('missing')).toBeNull();

    expect(await manager.setActiveConfiguration('missing')).toBe(false);
    expect(await manager.setActiveConfiguration(' ')).toBe(false);
    expect(await manager.setActiveConfiguration('primary')).toBe(true);
    expect(localStorage.getItem(LLMSelectionPersistence.STORAGE_KEY)).toBe('primary');
    expect(await manager.getActiveConfigId()).toBe('primary');

    const options = await manager.getAvailableOptions();
    expect(options).toEqual([
      { configId: 'primary', displayName: 'Primary Model' },
      { configId: 'secondary', displayName: 'Secondary Model' },
    ]);

    const missingFieldErrors = manager.validateConfiguration({
      configId: '',
      endpointUrl: '',
      modelIdentifier: '',
      apiType: '',
      jsonOutputStrategy: null,
    });
    expect(missingFieldErrors).toEqual(
      expect.arrayContaining([
        { field: 'configId', reason: 'Missing or invalid' },
        { field: 'endpointUrl', reason: 'Missing or invalid' },
        { field: 'modelIdentifier', reason: 'Missing or invalid' },
        { field: 'apiType', reason: 'Missing or invalid' },
        expect.objectContaining({
          field: 'jsonOutputStrategy',
          reason: expect.stringContaining('Is required'),
        }),
      ])
    );

    const toolCallingErrors = manager.validateConfiguration({
      configId: 'tool',
      endpointUrl: 'https://example.com/tool',
      modelIdentifier: 'tool-model',
      apiType: 'custom',
      jsonOutputStrategy: { method: 'tool_calling' },
    });
    expect(toolCallingErrors).toEqual(
      expect.arrayContaining([
        {
          field: 'jsonOutputStrategy.toolName',
          reason: 'Required when jsonOutputStrategy.method is "tool_calling".',
        },
      ])
    );

    const grammarErrors = manager.validateConfiguration({
      configId: 'grammar',
      endpointUrl: 'https://example.com/grammar',
      modelIdentifier: 'grammar-model',
      apiType: 'custom',
      jsonOutputStrategy: { method: 'gbnf_grammar' },
    });
    expect(grammarErrors).toEqual(
      expect.arrayContaining([
        {
          field: 'jsonOutputStrategy.grammar',
          reason: 'Required when jsonOutputStrategy.method is "gbnf_grammar".',
        },
      ])
    );

    const schemaErrors = manager.validateConfiguration({
      configId: 'schema',
      endpointUrl: 'https://example.com/schema',
      modelIdentifier: 'schema-model',
      apiType: 'custom',
      jsonOutputStrategy: { method: 'openrouter_json_schema' },
    });
    expect(schemaErrors).toEqual(
      expect.arrayContaining([
        {
          field: 'jsonOutputStrategy.jsonSchema',
          reason: 'Required when jsonOutputStrategy.method is "openrouter_json_schema".',
        },
      ])
    );
  });

  it('migrates persisted ids and falls back to defaults when stored selections are invalid', async () => {
    const loader = createLoaderWithFixtures({ [FIXTURE_PATH]: migrationFixtureConfig });
    const manager = new LLMConfigurationManager({ logger: createTestLogger() });

    localStorage.setItem(
      LLMSelectionPersistence.STORAGE_KEY,
      'openrouter-claude-sonnet-4-toolcalling'
    );

    await manager.init({ llmConfigLoader: loader });
    expect(await manager.getActiveConfigId()).toBe('claude-sonnet-4.5');
    expect(localStorage.getItem(LLMSelectionPersistence.STORAGE_KEY)).toBe(
      'claude-sonnet-4.5'
    );

    const removeSpy = jest.spyOn(
      Object.getPrototypeOf(localStorage),
      'removeItem'
    );

    localStorage.setItem(LLMSelectionPersistence.STORAGE_KEY, 'unknown-config');
    const fallbackManager = new LLMConfigurationManager({ logger: createTestLogger() });
    const fallbackLoader = createLoaderWithFixtures({
      [FIXTURE_PATH]: migrationFixtureConfig,
    });

    await fallbackManager.init({ llmConfigLoader: fallbackLoader });

    expect(removeSpy).toHaveBeenCalledWith(LLMSelectionPersistence.STORAGE_KEY);
    expect(await fallbackManager.getActiveConfigId()).toBe('primary');
    expect(localStorage.getItem(LLMSelectionPersistence.STORAGE_KEY)).toBe('primary');

    removeSpy.mockRestore();
  });

  it('surfaces loader failures and rejects re-initialization attempts with invalid dependencies', async () => {
    const failingLoader = {
      loadConfigs: jest.fn().mockResolvedValue({
        error: true,
        message: 'Parse failure',
        stage: 'parse',
      }),
    };
    const manager = new LLMConfigurationManager({ logger: createTestLogger() });

    await manager.init({ llmConfigLoader: failingLoader });

    expect(manager.isInitialized()).toBe(true);
    expect(manager.isOperational()).toBe(false);
    await expect(manager.getActiveConfigId()).resolves.toBeNull();
    await expect(manager.getAvailableOptions()).resolves.toEqual([]);
    await expect(manager.getActiveConfiguration()).rejects.toThrow(
      'LLMConfigurationManager: Initialized but not operational.'
    );

    await expect(
      manager.init({ llmConfigLoader: failingLoader })
    ).rejects.toThrow(
      'LLMConfigurationManager: Cannot re-initialize after critical configuration loading failure.'
    );

    const invalidDependencyManager = new LLMConfigurationManager({
      logger: createTestLogger(),
    });
    await expect(
      invalidDependencyManager.init({ llmConfigLoader: { invalid: true } })
    ).rejects.toThrow('Initialization requires valid LlmConfigLoader instance.');
  });
});
