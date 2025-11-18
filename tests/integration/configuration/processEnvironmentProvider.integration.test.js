/**
 * @file Integration tests for ProcessEnvironmentProvider coordinating with EntityConfigProvider.
 * @jest-environment node
 */
import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import EntityConfigProvider from '../../../src/entities/config/EntityConfigProvider.js';
import { ProcessEnvironmentProvider } from '../../../src/configuration/ProcessEnvironmentProvider.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

/**
 * Creates an EntityConfigProvider instance wired with the real ProcessEnvironmentProvider.
 *
 * @returns {EntityConfigProvider}
 */
function createEntityConfigProvider() {
  return new EntityConfigProvider({
    logger: new ConsoleLogger(LogLevel.NONE),
  });
}

describe('ProcessEnvironmentProvider integration', () => {
  /** @type {string | undefined} */
  let originalNodeEnv;
  /** @type {jest.SpyInstance[]} */
  let consoleSpies;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    consoleSpies = [
      jest.spyOn(console, 'info').mockImplementation(() => {}),
      jest.spyOn(console, 'warn').mockImplementation(() => {}),
      jest.spyOn(console, 'error').mockImplementation(() => {}),
      jest.spyOn(console, 'debug').mockImplementation(() => {}),
    ];
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    consoleSpies.forEach((spy) => spy.mockRestore());
  });

  it.each([
    {
      title: 'production environment toggles production safeguards',
      nodeEnv: 'production',
      expectedFlags: {
        NODE_ENV: 'production',
        IS_PRODUCTION: true,
        IS_DEVELOPMENT: false,
        IS_TEST: false,
      },
      assertConfig(config) {
        expect(config.logging.ENABLE_DEBUG_LOGGING).toBe(false);
        expect(config.performance.ENABLE_OPERATION_TRACING).toBe(false);
        expect(config.validation.STRICT_MODE).toBe(true);
      },
    },
    {
      title: 'development environment enables debug-friendly settings',
      nodeEnv: 'development',
      expectedFlags: {
        NODE_ENV: 'development',
        IS_PRODUCTION: false,
        IS_DEVELOPMENT: true,
        IS_TEST: false,
      },
      assertConfig(config) {
        expect(config.logging.ENABLE_DEBUG_LOGGING).toBe(true);
        expect(config.performance.ENABLE_OPERATION_TRACING).toBe(true);
        expect(config.validation.STRICT_MODE).toBe(false);
      },
    },
    {
      title: 'test environment disables caches and monitoring',
      nodeEnv: 'test',
      expectedFlags: {
        NODE_ENV: 'test',
        IS_PRODUCTION: false,
        IS_DEVELOPMENT: false,
        IS_TEST: true,
      },
      assertConfig(config) {
        expect(config.performance.ENABLE_MONITORING).toBe(false);
        expect(config.cache.ENABLE_VALIDATION_CACHE).toBe(false);
        expect(config.cache.ENABLE_DEFINITION_CACHE).toBe(false);
      },
    },
    {
      title: 'unrecognized environment leaves defaults intact',
      nodeEnv: 'staging',
      expectedFlags: {
        NODE_ENV: 'staging',
        IS_PRODUCTION: false,
        IS_DEVELOPMENT: false,
        IS_TEST: false,
      },
      assertConfig(config) {
        expect(config.logging.ENABLE_DEBUG_LOGGING).toBe(false);
        expect(config.performance.ENABLE_OPERATION_TRACING).toBe(false);
        expect(config.validation.STRICT_MODE).toBe(true);
      },
    },
    {
      title: 'missing NODE_ENV defaults to development profile',
      nodeEnv: undefined,
      expectedFlags: {
        NODE_ENV: 'development',
        IS_PRODUCTION: false,
        IS_DEVELOPMENT: true,
        IS_TEST: false,
      },
      assertConfig(config) {
        expect(config.logging.ENABLE_DEBUG_LOGGING).toBe(true);
        expect(config.performance.ENABLE_OPERATION_TRACING).toBe(true);
        expect(config.validation.STRICT_MODE).toBe(false);
      },
    },
  ])('$title', ({ nodeEnv, expectedFlags, assertConfig }) => {
    if (nodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = nodeEnv;
    }

    const configProvider = createEntityConfigProvider();
    const envProvider = new ProcessEnvironmentProvider();

    const envInfo = envProvider.getEnvironment();
    expect(envInfo).toEqual(expectedFlags);

    const config = configProvider.getConfig();
    expect(config.environment).toEqual(expectedFlags);
    assertConfig(config);

    expect(envProvider.isProduction()).toBe(expectedFlags.IS_PRODUCTION);
    expect(envProvider.isDevelopment()).toBe(expectedFlags.IS_DEVELOPMENT);
    expect(envProvider.isTest()).toBe(expectedFlags.IS_TEST);
  });
});
