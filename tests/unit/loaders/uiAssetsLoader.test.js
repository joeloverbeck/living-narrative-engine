import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import UiAssetsLoader from '../../../src/loaders/uiAssetsLoader.js';

const createMockConfig = () => ({
  getContentTypeSchemaId: jest.fn((type) => {
    if (type === 'ui-icons') return 'http://example.com/ui-icons.schema.json';
    if (type === 'ui-labels') return 'http://example.com/ui-labels.schema.json';
    return '';
  }),
});

const createMockResolver = () => ({
  resolveModContentPath: jest.fn(
    (modId, dir, file) => `/mods/${modId}/${dir}/${file}`
  ),
});

const createMockFetcher = (map) => ({
  fetch: jest.fn((p) => Promise.resolve(map[p])),
});

const createMockValidator = () => ({
  validate: jest.fn(() => ({ isValid: true })),
});

const createMockRegistry = () => ({
  store: jest.fn(),
  get: jest.fn(() => undefined),
});

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

let config;
let resolver;
let fetcher;
let validator;
let registry;
let logger;
let loader;

beforeEach(() => {
  config = createMockConfig();
  resolver = createMockResolver();
  fetcher = createMockFetcher({});
  validator = createMockValidator();
  registry = createMockRegistry();
  logger = createMockLogger();
  loader = new UiAssetsLoader(
    config,
    resolver,
    fetcher,
    validator,
    registry,
    logger
  );
});

describe('UiAssetsLoader', () => {
  it('loads icons and labels files', async () => {
    const iconsPath = '/mods/TestMod/ui/icons.json';
    const labelsPath = '/mods/TestMod/ui/labels.json';
    fetcher = createMockFetcher({
      [iconsPath]: { heart: '<svg>h</svg>' },
      [labelsPath]: { save: 'Save' },
    });
    loader = new UiAssetsLoader(
      config,
      resolver,
      fetcher,
      validator,
      registry,
      logger
    );

    const manifest = { content: { ui: ['icons.json', 'labels.json'] } };
    const result = await loader.loadUiAssetsForMod('TestMod', manifest);

    expect(resolver.resolveModContentPath).toHaveBeenCalledWith(
      'TestMod',
      'ui',
      'icons.json'
    );
    expect(resolver.resolveModContentPath).toHaveBeenCalledWith(
      'TestMod',
      'ui',
      'labels.json'
    );
    expect(fetcher.fetch).toHaveBeenCalledWith(iconsPath);
    expect(fetcher.fetch).toHaveBeenCalledWith(labelsPath);
    expect(config.getContentTypeSchemaId).toHaveBeenCalledWith('ui-icons');
    expect(config.getContentTypeSchemaId).toHaveBeenCalledWith('ui-labels');
    expect(validator.validate).toHaveBeenCalledWith(
      'http://example.com/ui-icons.schema.json',
      { heart: '<svg>h</svg>' }
    );
    expect(validator.validate).toHaveBeenCalledWith(
      'http://example.com/ui-labels.schema.json',
      { save: 'Save' }
    );
    expect(registry.store).toHaveBeenCalledWith('ui-icons', 'heart', {
      markup: '<svg>h</svg>',
    });
    expect(registry.store).toHaveBeenCalledWith('ui-labels', 'save', 'Save');
    expect(result.count).toBe(2);
    expect(result.errors).toBe(0);
  });

  it('throws and warns on unknown filenames', async () => {
    const manifest = { content: { ui: ['unknown.json'] } };
    await expect(loader.loadUiAssetsForMod('ModX', manifest)).rejects.toThrow(
      'Unknown UI asset file: unknown.json'
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'UiAssetsLoader [ModX]: Unknown file unknown.json'
    );
  });
});
