import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import path from 'path';
import UiAssetsLoader from '../../src/loaders/uiAssetsLoader.js';
import InMemoryDataRegistry from '../../src/data/inMemoryDataRegistry.js';

/**
 * Creates a minimal mock configuration service.
 *
 * @returns {IConfiguration}
 */
const createMockConfig = () => ({
  getContentTypeSchemaId: jest
    .fn()
    .mockImplementation((type) =>
      type === 'ui-icons' ? 'http://example.com/ui-icons.schema.json' : ''
    ),
});

/**
 * Creates a mock path resolver service.
 *
 * @returns {IPathResolver}
 */
const createMockResolver = () => ({
  resolveModContentPath: jest.fn((modId, dir, file) =>
    path.join('/mods', modId, dir, file)
  ),
});

/**
 * Creates a mock data fetcher service from a map of path->data.
 *
 * @param {Record<string,any>} dataMap
 * @returns {IDataFetcher}
 */
const createMockFetcher = (dataMap) => ({
  fetch: jest.fn((p) => Promise.resolve(dataMap[p])),
});

/**
 * Creates a simple schema validator mock always returning valid.
 *
 * @returns {ISchemaValidator}
 */
const createMockValidator = () => ({
  validate: jest.fn(() => ({ isValid: true })),
});

const createMockLogger = () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
});

describe('UiAssetsLoader integration - overrides', () => {
  let registry;
  let loader;
  let resolver;
  let fetcher;

  const baseModId = 'BaseMod';
  const overrideModId = 'OverrideMod';
  const iconFile = 'icons.json';
  const basePath = path.join('/mods', baseModId, 'ui', iconFile);
  const overridePath = path.join('/mods', overrideModId, 'ui', iconFile);

  const baseData = { heart: '<svg>base</svg>' };
  const overrideData = { heart: '<svg>override</svg>' };

  beforeEach(() => {
    registry = new InMemoryDataRegistry();
    resolver = createMockResolver();
    fetcher = createMockFetcher({
      [basePath]: baseData,
      [overridePath]: overrideData,
    });
    loader = new UiAssetsLoader(
      createMockConfig(),
      resolver,
      fetcher,
      createMockValidator(),
      registry,
      createMockLogger()
    );
  });

  it('last loaded icon wins when mods define the same name', async () => {
    await loader.loadIconsForMod(baseModId, {
      id: baseModId,
      content: { ui: [iconFile] },
    });
    await loader.loadIconsForMod(overrideModId, {
      id: overrideModId,
      content: { ui: [iconFile] },
    });

    const stored = registry.get('ui-icons', 'heart');
    expect(stored).toEqual({ markup: '<svg>override</svg>' });
    expect(resolver.resolveModContentPath).toHaveBeenCalledTimes(2);
    expect(fetcher.fetch).toHaveBeenCalledTimes(2);
  });
});
