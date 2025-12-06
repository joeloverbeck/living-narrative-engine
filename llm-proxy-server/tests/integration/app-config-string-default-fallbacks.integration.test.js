import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';

import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

const createTestLogger = () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
};

describe('AppConfigService string env default logging integration', () => {
  const originalEnv = { ...process.env };
  let logger;

  beforeEach(() => {
    logger = createTestLogger();
    resetAppConfigServiceInstance();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetAppConfigServiceInstance();
  });

  it('emits the built-in default description when optional detail is omitted', () => {
    delete process.env.CUSTOM_SAMPLE_PATH;

    const appConfig = getAppConfigService(logger);

    appConfig._logStringEnvVarStatus('CUSTOM_SAMPLE_PATH', undefined, null);

    const debugMessages = logger.debug.mock.calls
      .map(([message]) => message)
      .filter(Boolean);

    expect(
      debugMessages.some((message) =>
        message.includes(
          "AppConfigService: CUSTOM_SAMPLE_PATH not set in environment. LlmConfigService will use its default. Effective value: 'null'."
        )
      )
    ).toBe(true);
  });

  it('uses the default description while preserving non-null effective values', () => {
    delete process.env.CUSTOM_OVERRIDDEN_PATH;

    const appConfig = getAppConfigService(logger);

    appConfig._logStringEnvVarStatus(
      'CUSTOM_OVERRIDDEN_PATH',
      undefined,
      '/persisted/location'
    );

    const debugMessages = logger.debug.mock.calls
      .map(([message]) => message)
      .filter(Boolean);

    expect(
      debugMessages.some((message) =>
        message.includes(
          "AppConfigService: CUSTOM_OVERRIDDEN_PATH not set in environment. LlmConfigService will use its default. Effective value: '/persisted/location'."
        )
      )
    ).toBe(true);
  });
});
