import MacroLoader from '../../../src/loaders/macroLoader.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CORE_MOD_ID } from '../../../src/constants/core';
import StaticConfiguration from '../../../src/configuration/staticConfiguration.js';
import {
  createMockPathResolver,
  createMockDataFetcher,
} from '../../common/mockFactories/index.js';

const createMockConfiguration = (overrides = {}) => ({
  getModsBasePath: jest.fn(() => './data/mods'),
  getContentTypeSchemaId: jest.fn((registryKey) => {
    if (registryKey === 'macros') {
      return 'http://example.com/schemas/macro.schema.json';
    }
    return undefined;
  }),
  ...overrides,
});

const createMockSchemaValidator = (overrides = {}) => ({
  isSchemaLoaded: jest.fn(() => true),
  getValidator: jest.fn(() => () => ({ isValid: true, errors: null })),
  validate: jest.fn(() => ({ isValid: true, errors: null })),
  addSchema: jest.fn(),
  removeSchema: jest.fn(),
  ...overrides,
});

const createMockDataRegistry = (overrides = {}) => ({
  store: jest.fn(),
  get: jest.fn(),
  clear: jest.fn(),
  ...overrides,
});

const createMockLogger = (overrides = {}) => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  ...overrides,
});

describe('MacroLoader (Happy Path - Core Mod)', () => {
  let macroLoader;
  let mockRegistry;
  let mockLogger;

  const manifest = {
    id: CORE_MOD_ID,
    content: {
      macros: [
        'logSuccessAndEndTurn.macro.json',
        'logFailureAndEndTurn.macro.json',
      ],
    },
  };

  const logSuccess = require('../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json');
  const logFailure = require('../../../data/mods/core/macros/logFailureAndEndTurn.macro.json');

  beforeEach(() => {
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();
    macroLoader = new MacroLoader(
      createMockConfiguration(),
      createMockPathResolver({
        resolveModContentPath: jest.fn(
          (modId, dir, filename) => `./data/mods/${modId}/${dir}/${filename}`
        ),
      }),
      createMockDataFetcher({
        [`./data/mods/${CORE_MOD_ID}/macros/logSuccessAndEndTurn.macro.json`]:
          logSuccess,
        [`./data/mods/${CORE_MOD_ID}/macros/logFailureAndEndTurn.macro.json`]:
          logFailure,
      }),
      createMockSchemaValidator(),
      mockRegistry,
      mockLogger
    );
  });

  it('loads macros and stores them in the registry', async () => {
    const result = await macroLoader.loadItemsForMod(
      CORE_MOD_ID,
      manifest,
      'macros',
      'macros',
      'macros'
    );

    expect(result).toEqual({ count: 2, overrides: 0, errors: 0 });

    expect(mockRegistry.store).toHaveBeenCalledWith(
      'macros',
      'core:logSuccessAndEndTurn',
      expect.objectContaining({
        id: 'logSuccessAndEndTurn',
        _fullId: 'core:logSuccessAndEndTurn',
        description: logSuccess.description,
        actions: logSuccess.actions,
        _modId: "core",
      })
    );
    expect(mockRegistry.store).toHaveBeenCalledWith(
      'macros',
      'core:logFailureAndEndTurn',
      expect.objectContaining({
        id: 'logFailureAndEndTurn',
        _fullId: 'core:logFailureAndEndTurn',
        description: logFailure.description,
        actions: logFailure.actions,
        _modId: "core",
      })
    );

    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('uses StaticConfiguration to obtain the macro schema ID', () => {
    const realConfig = new StaticConfiguration();
    const tempLogger = createMockLogger();

    const loader = new MacroLoader(
      realConfig,
      createMockPathResolver(),
      createMockDataFetcher({}),
      createMockSchemaValidator(),
      mockRegistry,
      tempLogger
    );

    const expectedId = realConfig.getContentTypeSchemaId('macros');
    expect(loader._primarySchemaId).toBe(expectedId);
    expect(tempLogger.warn).not.toHaveBeenCalled();
    expect(tempLogger.debug).toHaveBeenCalledWith(
      `MacroLoader: Primary schema ID for content type 'macros' found: '${expectedId}'`
    );
  });
});
