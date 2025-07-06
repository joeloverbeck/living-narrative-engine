import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../src/config/appConfig.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

beforeEach(() => {
  jest.resetModules();
  resetAppConfigServiceInstance();
  process.env = {};
});

describe('AppConfigService uncovered branches', () => {
  test('_logStringEnvVarStatus logs all scenarios', () => {
    const logger = createLogger();
    const service = getAppConfigService(logger);

    service._logStringEnvVarStatus('VAR', '', 'value', 'desc');
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('found in environment but is empty')
    );

    logger.debug.mockClear();
    service._logStringEnvVarStatus('VAR', 'abc', 'abc', 'desc');
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('found in environment:')
    );

    logger.debug.mockClear();
    service._logStringEnvVarStatus('VAR', undefined, null, 'desc');
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('not set in environment')
    );
  });

  test('getAppConfigService returns existing instance without logger', () => {
    const logger = createLogger();
    const instance1 = getAppConfigService(logger);
    const instance2 = getAppConfigService();
    expect(instance2).toBe(instance1);
  });
});
