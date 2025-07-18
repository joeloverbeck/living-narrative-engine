// tests/loaders/promptTextLoader.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import PromptTextLoader from '../../../src/loaders/promptTextLoader.js';
import {
  createMockPathResolver,
  createMockDataFetcher,
} from '../../common/mockFactories/index.js';

/** @typedef {import('../../../src/interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../../src/interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../../src/interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../../src/interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../../src/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/interfaces/IPathConfiguration.js').IPathConfiguration} IPathConfiguration */

const createMockConfiguration = (overrides = {}) => ({
  getContentTypeSchemaId: jest
    .fn()
    .mockReturnValue(
      'schema://living-narrative-engine/prompt-text.schema.json'
    ),
  ...overrides,
});

const createMockSchemaValidator = (overrides = {}) => ({
  validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
  ...overrides,
});

const createMockDataRegistry = (overrides = {}) => ({
  store: jest.fn(),
  ...overrides,
});

const createMockLogger = (overrides = {}) => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  ...overrides,
});

const createMockPathConfiguration = (overrides = {}) => ({
  getPromptTextFilename: jest.fn().mockReturnValue('corePromptText.json'),
  getLLMConfigPath: jest.fn().mockReturnValue('./config/llm-configs.json'),
  getConfigDirectory: jest.fn().mockReturnValue('./config'),
  getPromptsDirectory: jest.fn().mockReturnValue('./data/prompts'),
  ...overrides,
});

/** @type {IConfiguration} */
let configuration;
/** @type {IPathResolver} */
let pathResolver;
/** @type {IDataFetcher} */
let dataFetcher;
/** @type {ISchemaValidator} */
let schemaValidator;
/** @type {IDataRegistry} */
let dataRegistry;
/** @type {IPathConfiguration} */
let pathConfiguration;
/** @type {ILogger} */
let logger;
/** @type {PromptTextLoader} */
let loader;

beforeEach(() => {
  configuration = createMockConfiguration();
  pathResolver = createMockPathResolver();
  dataFetcher = createMockDataFetcher({
    pathToResponse: {
      '/path/prompts/corePromptText.json': { example: true },
    },
  });
  schemaValidator = createMockSchemaValidator();
  dataRegistry = createMockDataRegistry();
  pathConfiguration = createMockPathConfiguration();
  logger = createMockLogger();

  loader = new PromptTextLoader({
    configuration,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    pathConfiguration,
    logger,
  });
});

describe('PromptTextLoader', () => {
  it('loads, validates, stores, and returns the prompt text', async () => {
    const result = await loader.loadPromptText();

    expect(pathConfiguration.getPromptTextFilename).toHaveBeenCalled();
    expect(pathResolver.resolveContentPath).toHaveBeenCalledWith(
      'prompts',
      'corePromptText.json'
    );
    expect(dataFetcher.fetch).toHaveBeenCalledWith(
      '/path/prompts/corePromptText.json'
    );
    expect(configuration.getContentTypeSchemaId).toHaveBeenCalledWith(
      'prompt-text'
    );
    expect(schemaValidator.validate).toHaveBeenCalledWith(
      'schema://living-narrative-engine/prompt-text.schema.json',
      { example: true }
    );
    expect(dataRegistry.store).toHaveBeenCalledWith('prompt_text', 'core', {
      example: true,
    });
    expect(result).toEqual({ example: true });
  });

  it('should use the correct schema ID from StaticConfiguration', async () => {
    // Arrange: Use the real StaticConfiguration to test the integration
    const StaticConfiguration = (
      await import('../../../src/configuration/staticConfiguration.js')
    ).default;
    const realConfig = new StaticConfiguration();

    // Create a new loader with the real configuration
    const realConfigLoader = new PromptTextLoader({
      configuration: realConfig,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      pathConfiguration,
      logger,
    });

    // Act
    await realConfigLoader.loadPromptText();

    // Assert: Verify that the real configuration returns the correct schema ID
    expect(schemaValidator.validate).toHaveBeenCalledWith(
      'schema://living-narrative-engine/prompt-text.schema.json',
      { example: true }
    );
  });
});
