// src/tests/core/services/consoleLogger.test.js

import {describe, it, expect, beforeEach, afterEach, jest} from '@jest/globals';
import ConsoleLogger from '../../../src/services/consoleLogger.js'; // Adjust path relative to your test file location

describe('ConsoleLogger', () => {
  let logger;
  let infoSpy;
  let warnSpy;
  let errorSpy;
  let debugSpy;

  // --- Task: Setup Spies ---
  beforeEach(() => {
    // Instantiate the logger for each test to ensure isolation
    logger = new ConsoleLogger();

    // Set up spies on console methods before each test.
    // Mock implementation prevents actual console output during tests.
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {
    });
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
    });
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
    });
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {
    });
  });

  // --- Task: Restore Spies ---
  afterEach(() => {
    // Restore the original console methods after each test
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    debugSpy.mockRestore();
  });

  // --- Task: Test info Method ---
  describe('info method', () => {
    it('should call console.info once with the correct message', () => {
      const message = 'This is an informational message.';
      logger.info(message);

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith(message);
      // Verify no interference
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('should call console.info once with the correct message and additional arguments', () => {
      const message = 'User logged in:';
      const userId = 123;
      const sessionData = {token: 'abc', expires: 3600};
      logger.info(message, userId, sessionData);

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith(message, userId, sessionData);
      // Verify no interference
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });
  });

  // --- Task: Test warn Method ---
  describe('warn method', () => {
    it('should call console.warn once with the correct message and arguments', () => {
      const message = 'Configuration value deprecated:';
      const configKey = 'old_api_key';
      const details = {newValue: 'new_token_format', deadline: '2025-12-31'};
      logger.warn(message, configKey, details);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(message, configKey, details);
      // Verify no interference
      expect(infoSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('should call console.warn once with only a message', () => {
      const message = 'Low disk space warning.';
      logger.warn(message);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(message);
      // Verify no interference
      expect(infoSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });
  });

  // --- Task: Test error Method ---
  describe('error method', () => {
    it('should call console.error once with the correct message and an Error object argument', () => {
      const message = 'Failed to process request:';
      const errorObject = new Error('Network timeout');
      logger.error(message, errorObject);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(message, errorObject);
      // Verify no interference
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('should call console.error once with the correct message and multiple arguments', () => {
      const message = 'Validation failed for user:';
      const userId = 456;
      const validationErrors = [{field: 'email', code: 'INVALID_FORMAT'}];
      logger.error(message, userId, validationErrors);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(message, userId, validationErrors);
      // Verify no interference
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });
  });

  // --- Task: Test debug Method ---
  describe('debug method', () => {
    it('should call console.debug once with the correct message and arguments', () => {
      const message = 'Entering function calculateTotal:';
      const input = [1, 2, 3];
      const context = {userRole: 'admin'};
      logger.debug(message, input, context);

      expect(debugSpy).toHaveBeenCalledTimes(1);
      expect(debugSpy).toHaveBeenCalledWith(message, input, context);
      // Verify no interference
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should call console.debug once with only a message', () => {
      const message = 'Component initialized.';
      logger.debug(message);

      expect(debugSpy).toHaveBeenCalledTimes(1);
      expect(debugSpy).toHaveBeenCalledWith(message);
      // Verify no interference
      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  // --- Task: Verify No Interference (Covered within each method's tests) ---
  // The tests above already include checks to ensure that calling one log level
  // does not trigger spies for other log levels.
});

// JSDoc type import (optional but good practice for clarity if using interfaces)
/**
 * @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger
 */