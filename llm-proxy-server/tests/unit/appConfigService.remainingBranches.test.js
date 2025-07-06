import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

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

describe('AppConfigService remaining branch coverage', () => {
  test('uses default message when env var undefined and finalValue provided', () => {
    const logger = createLogger();
    const service = getAppConfigService(logger);

    service._logStringEnvVarStatus('VAR', undefined, 'actual');

    const last = logger.debug.mock.calls.at(-1)[0];
    expect(last).toContain('not set in environment');
    expect(last).toContain('actual');
    expect(last).toContain('LlmConfigService will use its default');
  });

  test('logs null final value when env var is empty string', () => {
    const logger = createLogger();
    const service = getAppConfigService(logger);

    service._logStringEnvVarStatus('VAR', '', null, 'desc');

    const msg = logger.debug.mock.calls.at(-1)[0];
    expect(msg).toContain('found in environment but is empty');
    expect(msg).toContain('null');
  });
});
