import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { loadLoggerConfig } from '../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import { LoggerConfigLoader } from '../../src/configuration/loggerConfigLoader.js';

describe('loadLoggerConfig', () => {
  /** @type {AppContainer} */
  let container;
  let logger;
  let loadConfigSpy;

  beforeEach(() => {
    container = new AppContainer();
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
    };
    container.register(tokens.ILogger, logger);
    container.register(tokens.ISafeEventDispatcher, { dispatch: jest.fn() });
    loadConfigSpy = jest.spyOn(LoggerConfigLoader.prototype, 'loadConfig');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('applies log level when configuration specifies a string', async () => {
    loadConfigSpy.mockResolvedValue({ logLevel: 'WARN' });
    await loadLoggerConfig(container, logger);
    expect(logger.setLogLevel).toHaveBeenCalledWith('WARN');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs error when loading configuration throws', async () => {
    loadConfigSpy.mockRejectedValue(new Error('network'));
    await loadLoggerConfig(container, logger);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL ERROR'),
      expect.any(Object)
    );
  });
});
