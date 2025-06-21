import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import GameConfigLoader from '../../../src/loaders/gameConfigLoader.js';
import { CORE_MOD_ID } from '../../../src/constants/core.js';

let configuration;
let pathResolver;
let dataFetcher;
let schemaValidator;
let logger;
let loader;

beforeEach(() => {
  configuration = {
    getGameConfigFilename: jest.fn().mockReturnValue('game.json'),
    getContentTypeSchemaId: jest.fn().mockReturnValue('gameSchema'),
  };
  pathResolver = {
    resolveGameConfigPath: jest.fn().mockReturnValue('/game.json'),
  };
  dataFetcher = { fetch: jest.fn() };
  schemaValidator = {
    isSchemaLoaded: jest.fn().mockReturnValue(true),
    getValidator: jest.fn(),
    validate: jest.fn().mockReturnValue({ isValid: true, errors: null }),
  };
  logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  loader = new GameConfigLoader({
    configuration,
    pathResolver,
    dataFetcher,
    schemaValidator,
    logger,
  });
});

describe('GameConfigLoader.loadConfig', () => {
  test('throws when mods array missing', async () => {
    dataFetcher.fetch.mockResolvedValue({});
    await expect(loader.loadConfig()).rejects.toThrow(/mods/);
    expect(logger.error).toHaveBeenCalled();
  });

  test('prepends core mod when not first', async () => {
    dataFetcher.fetch.mockResolvedValue({
      mods: ['modA', CORE_MOD_ID, 'modB'],
    });
    const mods = await loader.loadConfig();
    expect(mods).toEqual([CORE_MOD_ID, 'modA', 'modB']);
  });

  test('returns mods unchanged when core already first', async () => {
    dataFetcher.fetch.mockResolvedValue({ mods: [CORE_MOD_ID, 'modX'] });
    const mods = await loader.loadConfig();
    expect(mods).toEqual([CORE_MOD_ID, 'modX']);
  });
});
