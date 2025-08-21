/**
 * @file Unit tests for NoOpLogger
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import NoOpLogger from '../../../src/logging/noOpLogger.js';

describe('NoOpLogger', () => {
  let logger;

  beforeEach(() => {
    logger = new NoOpLogger();
  });

  describe('ILogger interface methods', () => {
    it('should have info method that does nothing', () => {
      expect(() => logger.info('test message')).not.toThrow();
      expect(() => logger.info('test', 'arg1', 'arg2')).not.toThrow();

      // Verify it returns undefined
      expect(logger.info('test')).toBeUndefined();
    });

    it('should have warn method that does nothing', () => {
      expect(() => logger.warn('warning message')).not.toThrow();
      expect(() => logger.warn('warning', { data: 'test' })).not.toThrow();

      // Verify it returns undefined
      expect(logger.warn('test')).toBeUndefined();
    });

    it('should have error method that does nothing', () => {
      const error = new Error('test error');
      expect(() => logger.error('error message', error)).not.toThrow();
      expect(() => logger.error('error')).not.toThrow();

      // Verify it returns undefined
      expect(logger.error('test')).toBeUndefined();
    });

    it('should have debug method that does nothing', () => {
      expect(() => logger.debug('debug message')).not.toThrow();
      expect(() => logger.debug('debug', 123, true, null)).not.toThrow();

      // Verify it returns undefined
      expect(logger.debug('test')).toBeUndefined();
    });
  });

  describe('ConsoleLogger compatibility methods', () => {
    it('should have groupCollapsed method that does nothing', () => {
      expect(() => logger.groupCollapsed('Group Label')).not.toThrow();
      expect(() => logger.groupCollapsed()).not.toThrow();

      // Verify it returns undefined
      expect(logger.groupCollapsed('test')).toBeUndefined();
    });

    it('should have groupEnd method that does nothing', () => {
      expect(() => logger.groupEnd()).not.toThrow();

      // Verify it returns undefined
      expect(logger.groupEnd()).toBeUndefined();
    });

    it('should have table method that does nothing', () => {
      const data = [{ id: 1, name: 'test' }];
      const columns = ['id', 'name'];

      expect(() => logger.table(data, columns)).not.toThrow();
      expect(() => logger.table(data)).not.toThrow();
      expect(() => logger.table()).not.toThrow();

      // Verify it returns undefined
      expect(logger.table(data)).toBeUndefined();
    });

    it('should have setLogLevel method that does nothing', () => {
      expect(() => logger.setLogLevel('DEBUG')).not.toThrow();
      expect(() => logger.setLogLevel('INFO')).not.toThrow();
      expect(() => logger.setLogLevel(0)).not.toThrow();
      expect(() => logger.setLogLevel(4)).not.toThrow();
      expect(() => logger.setLogLevel('invalid')).not.toThrow();

      // Verify it returns undefined
      expect(logger.setLogLevel('DEBUG')).toBeUndefined();
    });
  });

  describe('No-op verification', () => {
    it('should not produce any console output', () => {
      // Spy on all console methods to ensure they are never called
      const consoleSpies = {
        log: jest.spyOn(console, 'log').mockImplementation(() => {}),
        info: jest.spyOn(console, 'info').mockImplementation(() => {}),
        warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
        error: jest.spyOn(console, 'error').mockImplementation(() => {}),
        debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
        groupCollapsed: jest
          .spyOn(console, 'groupCollapsed')
          .mockImplementation(() => {}),
        groupEnd: jest.spyOn(console, 'groupEnd').mockImplementation(() => {}),
        table: jest.spyOn(console, 'table').mockImplementation(() => {}),
      };

      // Call all logger methods
      logger.info('info test');
      logger.warn('warn test');
      logger.error('error test');
      logger.debug('debug test');
      logger.groupCollapsed('group test');
      logger.groupEnd();
      logger.table([{ test: 'data' }]);
      logger.setLogLevel('DEBUG');

      // Verify no console methods were called
      Object.values(consoleSpies).forEach((spy) => {
        expect(spy).not.toHaveBeenCalled();
      });

      // Restore all spies
      Object.values(consoleSpies).forEach((spy) => spy.mockRestore());
    });
  });

  describe('Performance characteristics', () => {
    it('should have minimal performance impact', () => {
      const iterations = 10000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        logger.info('test message', i);
        logger.debug('debug message', { iteration: i });
        logger.warn('warning', i);
        logger.error('error', new Error('test'));
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // No-op logger should be very fast - less than 100ms for 10k iterations
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined and null arguments gracefully', () => {
      expect(() => logger.info(undefined)).not.toThrow();
      expect(() => logger.info(null)).not.toThrow();
      expect(() => logger.warn(undefined, null)).not.toThrow();
      expect(() => logger.error(null, undefined)).not.toThrow();
      expect(() => logger.debug()).not.toThrow();
      expect(() => logger.table(undefined, null)).not.toThrow();
      expect(() => logger.setLogLevel(undefined)).not.toThrow();
      expect(() => logger.setLogLevel(null)).not.toThrow();
    });

    it('should handle complex objects without errors', () => {
      const circularRef = { name: 'test' };
      circularRef.self = circularRef;

      expect(() => logger.info('circular', circularRef)).not.toThrow();
      expect(() => logger.debug('function', () => {})).not.toThrow();
      expect(() => logger.error('symbol', Symbol('test'))).not.toThrow();
      expect(() => logger.table(circularRef)).not.toThrow();
    });
  });
});
