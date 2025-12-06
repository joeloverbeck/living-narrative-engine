import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ProcessEnvironmentProvider } from '../../../src/configuration/ProcessEnvironmentProvider.js';

describe('ProcessEnvironmentProvider', () => {
  let provider;
  let originalNodeEnv;

  beforeEach(() => {
    provider = new ProcessEnvironmentProvider();
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    jest.restoreAllMocks();
  });

  describe('getEnvironment', () => {
    it('returns development defaults when NODE_ENV is not defined', () => {
      delete process.env.NODE_ENV;

      const result = provider.getEnvironment();

      expect(result).toEqual({
        NODE_ENV: 'development',
        IS_PRODUCTION: false,
        IS_DEVELOPMENT: true,
        IS_TEST: false,
      });
    });

    it.each([
      [
        'production',
        { IS_PRODUCTION: true, IS_DEVELOPMENT: false, IS_TEST: false },
      ],
      [
        'development',
        { IS_PRODUCTION: false, IS_DEVELOPMENT: true, IS_TEST: false },
      ],
      ['test', { IS_PRODUCTION: false, IS_DEVELOPMENT: false, IS_TEST: true }],
      [
        'staging',
        { IS_PRODUCTION: false, IS_DEVELOPMENT: false, IS_TEST: false },
      ],
    ])('returns correct flags for %s environment', (env, expectedFlags) => {
      process.env.NODE_ENV = env;

      const result = provider.getEnvironment();

      expect(result).toMatchObject({ NODE_ENV: env, ...expectedFlags });
    });
  });

  describe('environment checks', () => {
    it('delegates helper methods to getEnvironment', () => {
      const spy = jest
        .spyOn(provider, 'getEnvironment')
        .mockReturnValueOnce({
          NODE_ENV: 'production',
          IS_PRODUCTION: true,
          IS_DEVELOPMENT: false,
          IS_TEST: false,
        })
        .mockReturnValueOnce({
          NODE_ENV: 'development',
          IS_PRODUCTION: false,
          IS_DEVELOPMENT: true,
          IS_TEST: false,
        })
        .mockReturnValueOnce({
          NODE_ENV: 'test',
          IS_PRODUCTION: false,
          IS_DEVELOPMENT: false,
          IS_TEST: true,
        });

      expect(provider.isProduction()).toBe(true);
      expect(provider.isDevelopment()).toBe(true);
      expect(provider.isTest()).toBe(true);
      expect(spy).toHaveBeenCalledTimes(3);
    });
  });
});
