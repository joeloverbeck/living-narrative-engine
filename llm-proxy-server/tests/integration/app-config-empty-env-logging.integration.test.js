/**
 * @file app-config-empty-env-logging.integration.test.js
 * @description Ensures AppConfigService logs detailed status when string environment variables
 *              are defined but empty, exercising formatting branches that only fire in that
 *              scenario while using real configuration loading logic.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

function createCapturingLogger() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
}

const originalEnv = { ...process.env };

function restoreEnvironment() {
  const currentKeys = Object.keys(process.env);
  for (const key of currentKeys) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    process.env[key] = value;
  }
}

describe('AppConfigService empty environment value logging integration', () => {
  let logger;

  beforeEach(() => {
    resetAppConfigServiceInstance();
    logger = createCapturingLogger();
  });

  afterEach(() => {
    restoreEnvironment();
    resetAppConfigServiceInstance();
  });

  it('logs explicit status when string-based env vars are present but empty', () => {
    process.env.LLM_CONFIG_PATH = '';
    process.env.PROXY_ALLOWED_ORIGIN = '';
    process.env.PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES = '';

    const appConfig = getAppConfigService(logger);

    expect(appConfig.getLlmConfigPath()).toBe('');
    expect(appConfig.getProxyAllowedOrigin()).toBe('');
    expect(appConfig.getProxyProjectRootPathForApiKeyFiles()).toBe('');

    const debugMessages = logger.debug.mock.calls.map(([message]) => message);

    expect(debugMessages).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'AppConfigService: LLM_CONFIG_PATH found in environment but is empty.'
        ),
        expect.stringContaining(
          'AppConfigService: PROXY_ALLOWED_ORIGIN found in environment but is empty.'
        ),
        expect.stringContaining(
          'AppConfigService: PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES found in environment but is empty.'
        ),
      ])
    );

    expect(
      debugMessages.filter((message) =>
        message.includes("Current effective value: ''")
      ).length
    ).toBeGreaterThanOrEqual(3);
  });
});
