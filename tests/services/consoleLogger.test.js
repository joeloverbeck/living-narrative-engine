// tests/services/consoleLogger.test.js

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ConsoleLogger, { LogLevel } from '../../src/services/consoleLogger.js';

describe('ConsoleLogger', () => {
  let logger;
  let infoSpy;
  let warnSpy;
  let errorSpy;
  let debugSpy;

  beforeEach(() => {
    logger = new ConsoleLogger(); // Initializes with LogLevel.INFO by default

    // Spies are attached. The constructor's own console.info for initialization
    // would have hit the real console.info before these spies are attached.
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    debugSpy.mockRestore();
  });

  // ... tests for info, warn, error methods (they should remain the same and pass) ...

  describe('info method', () => {
    it('should call console.info once with the correct message', () => {
      const message = 'This is an informational message.';
      logger.info(message);

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith(message);
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('should call console.info once with the correct message and additional arguments', () => {
      const message = 'User logged in:';
      const userId = 123;
      const sessionData = { token: 'abc', expires: 3600 };
      logger.info(message, userId, sessionData);

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith(message, userId, sessionData);
    });
  });

  describe('warn method', () => {
    it('should call console.warn once with the correct message and arguments', () => {
      const message = 'Configuration value deprecated:';
      const configKey = 'old_api_key';
      const details = { newValue: 'new_token_format', deadline: '2025-12-31' };
      logger.warn(message, configKey, details);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(message, configKey, details);
    });

    it('should call console.warn once with only a message', () => {
      const message = 'Low disk space warning.';
      logger.warn(message);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(message);
    });
  });

  describe('error method', () => {
    it('should call console.error once with the correct message and an Error object argument', () => {
      const message = 'Failed to process request:';
      const errorObject = new Error('Network timeout');
      logger.error(message, errorObject);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(message, errorObject);
    });

    it('should call console.error once with the correct message and multiple arguments', () => {
      const message = 'Validation failed for user:';
      const userId = 456;
      const validationErrors = [{ field: 'email', code: 'INVALID_FORMAT' }];
      logger.error(message, userId, validationErrors);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(message, userId, validationErrors);
    });
  });

  describe('debug method', () => {
    it('should call console.debug once with the correct message and arguments', () => {
      logger.setLogLevel(LogLevel.DEBUG); // This call will trigger console.info via infoSpy

      // Clear the infoSpy (and others for safety) AFTER setLogLevel has done its logging,
      // so we only check calls made by logger.debug itself.
      infoSpy.mockClear();
      warnSpy.mockClear();
      errorSpy.mockClear();
      // Do NOT clear debugSpy here as we are about to check its calls from logger.debug

      const message = 'Entering function calculateTotal:';
      const input = [1, 2, 3];
      const context = { userRole: 'admin' };
      logger.debug(message, input, context); // This should call console.debug

      expect(debugSpy).toHaveBeenCalledTimes(1);
      expect(debugSpy).toHaveBeenCalledWith(message, input, context);

      // These assertions now correctly check that logger.debug itself didn't call other console methods
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should call console.debug once with only a message', () => {
      logger.setLogLevel(LogLevel.DEBUG); // This call will trigger console.info via infoSpy

      // Clear spies after setLogLevel
      infoSpy.mockClear();
      warnSpy.mockClear();
      errorSpy.mockClear();

      const message = 'Component initialized.';
      logger.debug(message); // This should call console.debug

      expect(debugSpy).toHaveBeenCalledTimes(1);
      expect(debugSpy).toHaveBeenCalledWith(message);

      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should NOT call console.debug if log level is INFO', () => {
      logger.setLogLevel(LogLevel.INFO);
      // Clear infoSpy if setLogLevel logged anything (it wouldn't if already INFO, but good practice)
      infoSpy.mockClear();

      const message = 'This debug message should not appear.';
      logger.debug(message);
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('should NOT call console.debug if log level is WARN', () => {
      logger.setLogLevel(LogLevel.WARN);
      // Clear infoSpy as setLogLevel would have logged the change
      infoSpy.mockClear();

      const message = 'This debug message should not appear.';
      logger.debug(message);
      expect(debugSpy).not.toHaveBeenCalled();
    });
  });
});

/**
 * @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger
 */
