import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import GameConfigLoader from '../../../src/loaders/gameConfigLoader.js';
import { CORE_MOD_ID } from '../../../src/constants/core.js';
import { validateAgainstSchema } from '../../../src/utils/schemaValidationUtils.js';
import { formatAjvErrors } from '../../../src/utils/ajvUtils.js';

jest.mock('../../../src/utils/schemaValidationUtils.js', () => ({
  validateAgainstSchema: jest.fn(),
}));

jest.mock('../../../src/utils/ajvUtils.js', () => ({
  formatAjvErrors: jest.fn(() => 'formatted errors'),
}));

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
  schemaValidator = {};
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
  jest.clearAllMocks();
});

describe('GameConfigLoader helper methods', () => {
  describe('fetchConfigForTest', () => {
    it('fetches config and returns parsed content', async () => {
      dataFetcher.fetch.mockResolvedValue({ mods: ['a'] });

      const result = await loader.fetchConfigForTest();

      expect(result).toEqual({
        path: '/game.json',
        filename: 'game.json',
        config: { mods: ['a'] },
      });
      expect(pathResolver.resolveGameConfigPath).toHaveBeenCalled();
      expect(configuration.getGameConfigFilename).toHaveBeenCalled();
      expect(dataFetcher.fetch).toHaveBeenCalledWith('/game.json');
    });

    it('logs and throws when fetch fails', async () => {
      dataFetcher.fetch.mockRejectedValue(new Error('net'));

      await expect(loader.fetchConfigForTest()).rejects.toThrow(
        'Failed to fetch game configuration'
      );
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('validateConfigForTest', () => {
    it('validates config and returns mods array', () => {
      const config = { mods: ['one', 'two'] };
      validateAgainstSchema.mockReturnValue(undefined);

      const mods = loader.validateConfigForTest(
        config,
        '/game.json',
        'game.json'
      );

      expect(validateAgainstSchema).toHaveBeenCalled();
      expect(mods).toEqual(['one', 'two']);
    });

    it('throws when schema id is missing', () => {
      configuration.getContentTypeSchemaId.mockReturnValue(undefined);

      expect(() =>
        loader.validateConfigForTest(
          { mods: ['one'] },
          '/game.json',
          'game.json'
        )
      ).toThrow('Schema ID for ‘game’ configuration type not configured.');
      expect(logger.error).toHaveBeenCalledWith(
        "FATAL: Schema ID for 'game' configuration type not found in IConfiguration."
      );
    });

    it('throws when mods array missing', () => {
      const config = {};
      validateAgainstSchema.mockReturnValue(undefined);

      expect(() =>
        loader.validateConfigForTest(config, '/game.json', 'game.json')
      ).toThrow(/mods/);
      expect(logger.error).toHaveBeenCalled();
    });

    it('throws when mods array contains non-strings', () => {
      const config = { mods: ['one', 2] };
      validateAgainstSchema.mockReturnValue(undefined);

      expect(() =>
        loader.validateConfigForTest(config, '/game.json', 'game.json')
      ).toThrow(
        "Validated game config 'game.json' 'mods' array contains non-string elements."
      );
      expect(logger.error).toHaveBeenCalledWith(
        "FATAL: Validated game config 'game.json' 'mods' array contains non-string elements. Path: /game.json."
      );
    });

    it('formats ajv errors when validation fails', () => {
      const config = { mods: ['one'] };
      validateAgainstSchema.mockReturnValue(undefined);

      loader.validateConfigForTest(config, '/game.json', 'game.json');

      const options = validateAgainstSchema.mock.calls[0][4];
      const message = options.failureMessage([{ instancePath: '/mods/0' }]);

      expect(formatAjvErrors).toHaveBeenCalledWith(
        [{ instancePath: '/mods/0' }],
        config
      );
      expect(message).toContain('formatted errors');
    });
  });

  describe('ensureCoreModFirstForTest', () => {
    it('adds core mod when missing', () => {
      const result = loader.ensureCoreModFirstForTest(['modA']);
      expect(result).toEqual([CORE_MOD_ID, 'modA']);
    });

    it('moves core mod to front when not first', () => {
      const result = loader.ensureCoreModFirstForTest([
        'modA',
        CORE_MOD_ID,
        'modB',
      ]);
      expect(result).toEqual([CORE_MOD_ID, 'modA', 'modB']);
    });

    it('returns same list when core already first', () => {
      const mods = [CORE_MOD_ID, 'modX'];
      const result = loader.ensureCoreModFirstForTest([...mods]);
      expect(result).toEqual(mods);
    });
  });
});
