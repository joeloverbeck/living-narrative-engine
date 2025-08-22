import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import * as loggerConfigUtils from '../../../../src/configuration/utils/loggerConfigUtils.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { LoggerConfigLoader } from '../../../../src/configuration/loggerConfigLoader.js';
import { DebugLogConfigLoader } from '../../../../src/configuration/debugLogConfigLoader.js';

// Mock both config loaders at module level to prevent constructor execution
jest.mock('../../../../src/configuration/loggerConfigLoader.js');
jest.mock('../../../../src/configuration/debugLogConfigLoader.js');

describe('loadAndApplyLoggerConfig', () => {
  /** @type {AppContainer} */
  let container;
  let logger;
  let mockLoggerConfigLoader;
  let mockDebugLogConfigLoader;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

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

    // Setup mock instances
    mockLoggerConfigLoader = {
      loadConfig: jest.fn(),
    };
    mockDebugLogConfigLoader = {
      loadConfig: jest.fn(),
    };

    // Configure the mocked constructors to return our mock instances
    LoggerConfigLoader.mockImplementation(() => mockLoggerConfigLoader);
    DebugLogConfigLoader.mockImplementation(() => mockDebugLogConfigLoader);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('applies log level when configuration specifies a string', async () => {
    // Mock debug config to return null (not available)
    mockDebugLogConfigLoader.loadConfig.mockResolvedValue({ error: true });
    // Mock legacy config to return the log level
    mockLoggerConfigLoader.loadConfig.mockResolvedValue({ logLevel: 'WARN' });

    await loggerConfigUtils.loadAndApplyLoggerConfig(container, logger, tokens);

    expect(logger.setLogLevel).toHaveBeenCalledWith('WARN');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs error when loading configuration throws', async () => {
    // Mock debug config to return error result (not throw)
    mockDebugLogConfigLoader.loadConfig.mockResolvedValue({ error: true });
    // Mock legacy config loader to throw an error
    mockLoggerConfigLoader.loadConfig.mockRejectedValue(new Error('network'));

    await loggerConfigUtils.loadAndApplyLoggerConfig(container, logger, tokens);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('CRITICAL ERROR'),
      expect.any(Object)
    );
  });
});
