/**
 * @file app-config-initialization-guards.integration.test.js
 * @description Integration tests validating AppConfigService initialization guard rails.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  jest,
} from '@jest/globals';
import { ConsoleLogger } from '../../src/consoleLogger.js';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../src/config/appConfig.js';

describe('AppConfigService initialization safeguards', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    resetAppConfigServiceInstance();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    resetAppConfigServiceInstance();
  });

  test('throws a descriptive error when first instantiation lacks a logger', () => {
    expect(() => getAppConfigService()).toThrow(
      'AppConfigService: Logger must be provided for the first instantiation.'
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'AppConfigService: Critical - Logger must be provided for the first instantiation of AppConfigService.'
    );
  });

  test('allows subsequent calls without logger once initialized with a real logger', () => {
    const logger = new ConsoleLogger();
    const initialized = getAppConfigService(logger);

    const retrieved = getAppConfigService();

    expect(retrieved).toBe(initialized);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
