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
    expect(result.failures).toEqual([]);
  });

  it('categorizes UI files correctly', () => {
    const files = ['icons.json', 'labels.json', 'extra.txt'];
    const result = loader.categorizeUiFilesForTest(files);

    expect(result.iconFiles).toEqual(['icons.json']);
    expect(result.labelFiles).toEqual(['labels.json']);
    expect(result.unknownFiles).toEqual(['extra.txt']);
  });

  it('warns on unknown filenames without throwing', async () => {
    const manifest = { content: { ui: ['unknown.json'] } };
    const result = await loader.loadUiAssetsForMod('ModX', manifest);

    expect(logger.warn).toHaveBeenCalledWith(
      'UiAssetsLoader [ModX]: Unknown file unknown.json'
    );
    expect(result.count).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.failures).toEqual([]);
  });

  it('handles fetch failures correctly', async () => {
    const iconsPath = '/mods/TestMod/ui/icons.json';
    const fetchError = new Error('Network error');
    fetcher = createMockFetcher({});
    fetcher.fetch.mockRejectedValue(fetchError);

    loader = new UiAssetsLoader(
      config,
      resolver,
      fetcher,
      validator,
      registry,
      logger
    );

    const manifest = { content: { ui: ['icons.json'] } };
    const result = await loader.loadIconsForMod('TestMod', manifest);

    expect(result.count).toBe(0);
    expect(result.errors).toBe(1);
    expect(result.failures).toEqual([{ file: 'icons.json', reason: 'fetch' }]);
    expect(logger.error).toHaveBeenCalledWith(
      'UiAssetsLoader [TestMod]: Failed to fetch icons.json: Network error'
    );
  });

  it('handles validation exceptions correctly', async () => {
    const iconsPath = '/mods/TestMod/ui/icons.json';
    const validationError = new Error('Invalid schema');
    fetcher = createMockFetcher({
      [iconsPath]: { heart: '<svg>h</svg>' },
    });
    validator = createMockValidator();
    validator.validate.mockImplementation(() => {
      throw validationError;
    });

    loader = new UiAssetsLoader(
      config,
      resolver,
      fetcher,
      validator,
      registry,
      logger
    );

    const manifest = { content: { ui: ['icons.json'] } };
    const result = await loader.loadIconsForMod('TestMod', manifest);

    expect(result.count).toBe(0);
    expect(result.errors).toBe(1);
    expect(result.failures).toEqual([
      { file: 'icons.json', reason: 'validation' },
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      'UiAssetsLoader [TestMod]: Failed to validate icons.json: Invalid schema'
    );
  });

  it('handles validation failure results correctly', async () => {
    const iconsPath = '/mods/TestMod/ui/icons.json';
    fetcher = createMockFetcher({
      [iconsPath]: { heart: '<svg>h</svg>' },
    });
    validator = createMockValidator();
    validator.validate.mockReturnValue({ isValid: false });

    loader = new UiAssetsLoader(
      config,
      resolver,
      fetcher,
      validator,
      registry,
      logger
    );

    const manifest = { content: { ui: ['icons.json'] } };
    const result = await loader.loadIconsForMod('TestMod', manifest);

    expect(result.count).toBe(0);
    expect(result.errors).toBe(1);
    expect(result.failures).toEqual([
      { file: 'icons.json', reason: 'validation' },
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      'UiAssetsLoader [TestMod]: Failed to process icons.json: Asset schema validation failed'
    );
  });

  it('detects registry overrides correctly', async () => {
    const iconsPath = '/mods/TestMod/ui/icons.json';
    fetcher = createMockFetcher({
      [iconsPath]: { heart: '<svg>h</svg>' },
    });
    registry = createMockRegistry();
    registry.get.mockReturnValue({ markup: '<svg>existing</svg>' }); // Simulate existing icon

    loader = new UiAssetsLoader(
      config,
      resolver,
      fetcher,
      validator,
      registry,
      logger
    );

    const manifest = { content: { ui: ['icons.json'] } };
    const result = await loader.loadIconsForMod('TestMod', manifest);

    expect(result.count).toBe(1);
    expect(result.overrides).toBe(1);
    expect(result.errors).toBe(0);
    expect(registry.store).toHaveBeenCalledWith('ui-icons', 'heart', {
      markup: '<svg>h</svg>',
    });
  });

  it('handles loadAssetGroup exceptions correctly', async () => {
    const mockLoader = jest.fn().mockRejectedValue(new Error('Loader failed'));

    const result = await loader.loadAssetGroup(['test.json'], {
      modId: 'TestMod',
      loader: mockLoader,
    });

    expect(result.count).toBe(0);
    expect(result.errors).toBe(1);
    expect(result.failures).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      'UiAssetsLoader [TestMod]: Failed to process test.json: Loader failed'
    );
  });

  it('handles loadAssetGroup with loader failures in results', async () => {
    const mockLoader = jest.fn().mockResolvedValue({
      count: 0,
      overrides: 0,
      errors: 1,
      failures: [{ file: 'test.json', reason: 'test-failure' }],
    });

    const result = await loader.loadAssetGroup(['test.json'], {
      modId: 'TestMod',
      loader: mockLoader,
    });

    expect(result.count).toBe(0);
    expect(result.errors).toBe(1);
    expect(result.failures).toEqual([
      { file: 'test.json', reason: 'test-failure' },
    ]);
    expect(logger.warn).toHaveBeenCalledWith(
      'UiAssetsLoader [TestMod]: test.json failed due to test-failure'
    );
  });

  it('handles loadAssetGroup with non-array failures correctly', async () => {
    const mockLoader = jest.fn().mockResolvedValue({
      count: 0,
      overrides: 0,
      errors: 1,
      failures: null, // Non-array failures
    });

    const result = await loader.loadAssetGroup(['test.json'], {
      modId: 'TestMod',
      loader: mockLoader,
    });

    expect(result.count).toBe(0);
    expect(result.errors).toBe(1);
    expect(result.failures).toEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('handles manifest without content section', async () => {
    const manifest = {}; // No content section
    const result = await loader.loadUiAssetsForMod('TestMod', manifest);

    expect(result.count).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.failures).toEqual([]);
  });

  it('handles manifest without ui section', async () => {
    const manifest = { content: {} }; // No ui section
    const result = await loader.loadUiAssetsForMod('TestMod', manifest);

    expect(result.count).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.failures).toEqual([]);
  });

  it('handles loadUiAssetsForMod with failures from both icon and label results', async () => {
    const iconsPath = '/mods/TestMod/ui/icons.json';
    const labelsPath = '/mods/TestMod/ui/labels.json';

    // Setup fetcher to fail for both files
    fetcher = createMockFetcher({});
    fetcher.fetch.mockRejectedValue(new Error('Network error'));

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

    expect(result.count).toBe(0);
    expect(result.errors).toBe(2);
    expect(result.failures).toHaveLength(2);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        { file: 'icons.json', reason: 'fetch' },
        { file: 'labels.json', reason: 'fetch' },
      ])
    );
  });

  it('handles empty failures arrays correctly in loadUiAssetsForMod', async () => {
    const manifest = { content: { ui: [] } }; // Empty ui array
    const result = await loader.loadUiAssetsForMod('TestMod', manifest);

    expect(result.count).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.failures).toEqual([]);
  });
});
