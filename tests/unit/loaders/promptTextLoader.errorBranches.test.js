import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PromptTextLoader from '../../../src/loaders/promptTextLoader.js';
import {
  createMockPathResolver,
  createMockDataFetcher,
} from '../../common/mockFactories/index.js';

const createMockConfiguration = () => ({
  getContentTypeSchemaId: jest
    .fn()
    .mockReturnValue('http://example.com/schemas/prompt-text.schema.json'),
});

const createMockSchemaValidator = () => ({
  validate: jest.fn().mockReturnValue({
    isValid: false,
    errors: [{ message: 'bad' }],
  }),
});

const createMockDataRegistry = () => ({
  store: jest.fn(),
});

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

let configuration;
let pathResolver;
let dataFetcher;
let schemaValidator;
let dataRegistry;
let logger;
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
  logger = createMockLogger();

  loader = new PromptTextLoader({
    configuration,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger,
  });
});

describe('PromptTextLoader validation failure branch', () => {
  it('throws ValidationError and does not store data when validation fails', async () => {
    await expect(loader.loadPromptText()).rejects.toThrow(
      'Prompt text validation failed'
    );

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
      'http://example.com/schemas/prompt-text.schema.json',
      { example: true }
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Validation failed'),
      { errors: [{ message: 'bad' }] }
    );
    expect(dataRegistry.store).not.toHaveBeenCalled();
  });
});
