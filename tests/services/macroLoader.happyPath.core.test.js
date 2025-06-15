import MacroLoader from '../../src/loaders/macroLoader.js';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { CORE_MOD_ID } from '../../src/constants/core';

const createMockConfiguration = (overrides = {}) => ({
  getModsBasePath: jest.fn(() => './data/mods'),
  getContentTypeSchemaId: jest.fn((typeName) => {
    if (typeName === 'macros') {
      return 'http://example.com/schemas/macro.schema.json';
    }
    return undefined;
  }),
  ...overrides,
});

const createMockPathResolver = (overrides = {}) => ({
  resolveModContentPath: jest.fn(
    (modId, dir, filename) => `./data/mods/${modId}/${dir}/${filename}`
  ),
  ...overrides,
});

const createMockDataFetcher = (map) => ({
  fetch: jest.fn(async (path) => {
    if (path in map) return JSON.parse(JSON.stringify(map[path]));
    throw new Error(`Unexpected fetch path: ${path}`);
  }),
});

const createMockSchemaValidator = (overrides = {}) => ({
  isSchemaLoaded: jest.fn(() => true),
  getValidator: jest.fn(() => () => ({ isValid: true, errors: null })),
  validate: jest.fn(() => ({ isValid: true, errors: null })),
  addSchema: jest.fn(),
  removeSchema: jest.fn(),
  ...overrides,
});

const createMockDataRegistry = () => ({
  store: jest.fn(),
  get: jest.fn(),
  clear: jest.fn(),
});

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
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

  const logSuccess = require('../../data/mods/core/macros/logSuccessAndEndTurn.macro.json');
  const logFailure = require('../../data/mods/core/macros/logFailureAndEndTurn.macro.json');

  beforeEach(() => {
    mockRegistry = createMockDataRegistry();
    mockLogger = createMockLogger();
    macroLoader = new MacroLoader(
      createMockConfiguration(),
      createMockPathResolver(),
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
      expect.objectContaining({ id: 'core:logSuccessAndEndTurn' })
    );
    expect(mockRegistry.store).toHaveBeenCalledWith(
      'macros',
      'core:logFailureAndEndTurn',
      expect.objectContaining({ id: 'core:logFailureAndEndTurn' })
    );

    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
