import { describe, it, expect, jest } from '@jest/globals';
import { LoggerConfigLoader } from '../../../src/configuration/loggerConfigLoader.js';

describe('LoggerConfigLoader local file handling', () => {
  it('loads config from a relative file path in Node environments', async () => {
    const logger = {
      error: jest.fn(),
      warn: jest.fn(),
    };
    const safeEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(undefined),
    };
    const loader = new LoggerConfigLoader({ logger, safeEventDispatcher });

    const result = await loader.loadConfig('tests/fixtures/logger-config.json');

    expect(result).toEqual({ logLevel: 'WARN' });
    expect(logger.error).not.toHaveBeenCalled();
  });
});
