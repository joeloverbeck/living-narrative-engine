/**
 * @file Unit tests for enhanced logger mock functionality
 * @see tests/common/mockFactories/loggerMocks.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  createMockLogger,
  createEnhancedMockLogger,
} from '../../common/mockFactories/loggerMocks.js';
import {
  getAllCallsInOrder,
  getAllLogMessages,
  validateLogSequence,
  getLogStatistics,
  debugLoggerCalls,
  getLogsByCategory,
  getDetectedCategories,
} from '../../common/loggerTestUtils.js';
import '../../common/loggerMatchers.js'; // Import matchers for auto-extension

describe('Enhanced Logger Mock', () => {
  describe('createMockLogger (backward compatibility)', () => {
    let mockLogger;

    beforeEach(() => {
      mockLogger = createMockLogger();
    });

    it('should create a mock logger with all required ILogger methods', () => {
      expect(mockLogger).toHaveProperty('debug');
      expect(mockLogger).toHaveProperty('info');
      expect(mockLogger).toHaveProperty('warn');
      expect(mockLogger).toHaveProperty('error');
      expect(typeof mockLogger.debug).toBe('function');
      expect(typeof mockLogger.info).toBe('function');
      expect(typeof mockLogger.warn).toBe('function');
      expect(typeof mockLogger.error).toBe('function');
    });

    it('should create a mock logger with extended ConsoleLogger methods', () => {
      expect(mockLogger).toHaveProperty('groupCollapsed');
      expect(mockLogger).toHaveProperty('groupEnd');
      expect(mockLogger).toHaveProperty('table');
      expect(mockLogger).toHaveProperty('setLogLevel');
    });

    it('should have jest mock functions that can be called', () => {
      mockLogger.debug('test debug');
      mockLogger.info('test info');
      mockLogger.warn('test warn');
      mockLogger.error('test error');

      expect(mockLogger.debug).toHaveBeenCalledWith('test debug');
      expect(mockLogger.info).toHaveBeenCalledWith('test info');
      expect(mockLogger.warn).toHaveBeenCalledWith('test warn');
      expect(mockLogger.error).toHaveBeenCalledWith('test error');
    });
  });

  describe('createEnhancedMockLogger', () => {
    let enhancedLogger;

    beforeEach(() => {
      enhancedLogger = createEnhancedMockLogger();
    });

    describe('backward compatibility', () => {
      it('should maintain all basic logger functionality', () => {
        expect(enhancedLogger).toHaveProperty('debug');
        expect(enhancedLogger).toHaveProperty('info');
        expect(enhancedLogger).toHaveProperty('warn');
        expect(enhancedLogger).toHaveProperty('error');

        enhancedLogger.debug('test');
        expect(enhancedLogger.debug).toHaveBeenCalledWith('test');
      });

      it('should support defaults parameter', () => {
        const customDefault = jest.fn();
        const logger = createEnhancedMockLogger({
          customMethod: customDefault,
        });

        expect(logger.customMethod).toBe(customDefault);
        expect(logger.debug).toBeDefined();
      });
    });

    describe('utility methods', () => {
      it('should provide getDebugCalls method', () => {
        enhancedLogger.debug('debug message 1');
        enhancedLogger.debug('debug message 2');

        const debugCalls = enhancedLogger.getDebugCalls();
        expect(debugCalls).toHaveLength(2);
        expect(debugCalls[0]).toEqual(['debug message 1']);
        expect(debugCalls[1]).toEqual(['debug message 2']);
      });

      it('should provide getCallsByLevel method', () => {
        enhancedLogger.info('info message');
        enhancedLogger.warn('warn message');

        const infoCalls = enhancedLogger.getCallsByLevel('info');
        const warnCalls = enhancedLogger.getCallsByLevel('warn');
        const errorCalls = enhancedLogger.getCallsByLevel('error');

        expect(infoCalls).toHaveLength(1);
        expect(warnCalls).toHaveLength(1);
        expect(errorCalls).toHaveLength(0);

        expect(infoCalls[0]).toEqual(['info message']);
        expect(warnCalls[0]).toEqual(['warn message']);
      });

      it('should handle getCallsByLevel for non-existent levels gracefully', () => {
        const calls = enhancedLogger.getCallsByLevel('nonexistent');
        expect(calls).toEqual([]);
      });

      it('should provide clearAllCalls method', () => {
        enhancedLogger.debug('debug');
        enhancedLogger.info('info');
        enhancedLogger.warn('warn');
        enhancedLogger.error('error');

        expect(enhancedLogger.debug).toHaveBeenCalled();
        expect(enhancedLogger.info).toHaveBeenCalled();
        expect(enhancedLogger.warn).toHaveBeenCalled();
        expect(enhancedLogger.error).toHaveBeenCalled();

        enhancedLogger.clearAllCalls();

        expect(enhancedLogger.debug).not.toHaveBeenCalled();
        expect(enhancedLogger.info).not.toHaveBeenCalled();
        expect(enhancedLogger.warn).not.toHaveBeenCalled();
        expect(enhancedLogger.error).not.toHaveBeenCalled();
      });
    });

    describe('assertion helpers', () => {
      it('should provide expectDebugMessage method', () => {
        enhancedLogger.debug('This is a debug message');

        expect(() => {
          enhancedLogger.expectDebugMessage('debug message');
        }).not.toThrow();

        expect(() => {
          enhancedLogger.expectDebugMessage('not found');
        }).toThrow();
      });

      it('should provide expectNoDebugCalls method', () => {
        expect(() => {
          enhancedLogger.expectNoDebugCalls();
        }).not.toThrow();

        enhancedLogger.debug('debug message');

        expect(() => {
          enhancedLogger.expectNoDebugCalls();
        }).toThrow();
      });

      it('should provide expectLogSequence method', () => {
        enhancedLogger.info('First message');
        enhancedLogger.debug('Second message');
        enhancedLogger.error('Third message');

        expect(() => {
          enhancedLogger.expectLogSequence([
            { level: 'info', message: 'First' },
            { level: 'debug', message: 'Second' },
            { level: 'error', message: 'Third' },
          ]);
        }).not.toThrow();

        expect(() => {
          enhancedLogger.expectLogSequence([
            { level: 'error', message: 'Wrong' },
          ]);
        }).toThrow();
      });
    });

    describe('category analysis', () => {
      it('should provide getCategories method using LogCategoryDetector', () => {
        // Use messages that match known categories
        enhancedLogger.debug('EntityManager initialization complete');
        enhancedLogger.info('GameEngine starting up');
        enhancedLogger.warn('Schema validation required');

        const categories = enhancedLogger.getCategories();

        expect(Array.isArray(categories)).toBe(true);
        expect(categories).toContain('ecs');
        expect(categories).toContain('engine');
        expect(categories).toContain('validation');
      });

      it('should provide getLogsByCategory method', () => {
        enhancedLogger.debug('EntityManager created entity');
        enhancedLogger.info('Regular info message');
        enhancedLogger.warn('ComponentManager warning');

        const ecsLogs = enhancedLogger.getLogsByCategory('ecs');

        expect(ecsLogs).toHaveLength(2);
        expect(ecsLogs[0]).toBe('EntityManager created entity');
        expect(ecsLogs[1]).toBe('ComponentManager warning');
      });

      it('should return empty array for non-existent categories', () => {
        enhancedLogger.info('Regular message');

        const nonExistentLogs = enhancedLogger.getLogsByCategory('nonexistent');
        expect(nonExistentLogs).toEqual([]);
      });

      it('should handle empty logger gracefully', () => {
        const categories = enhancedLogger.getCategories();
        const logs = enhancedLogger.getLogsByCategory('any');

        expect(categories).toEqual([]);
        expect(logs).toEqual([]);
      });
    });
  });

  describe('custom Jest matchers', () => {
    let logger;

    beforeEach(() => {
      logger = createEnhancedMockLogger();
    });

    it('should support toHaveLoggedDebug matcher', () => {
      logger.debug('This is a debug message');

      expect(logger).toHaveLoggedDebug('debug message');
      expect(logger).not.toHaveLoggedDebug('not found');
    });

    it('should support toHaveLoggedInfo matcher', () => {
      logger.info('This is an info message');

      expect(logger).toHaveLoggedInfo('info message');
      expect(logger).not.toHaveLoggedInfo('not found');
    });

    it('should support toHaveLoggedWarning matcher', () => {
      logger.warn('This is a warning message');

      expect(logger).toHaveLoggedWarning('warning message');
      expect(logger).not.toHaveLoggedWarning('not found');
    });

    it('should support toHaveLoggedError matcher', () => {
      logger.error('This is an error message');

      expect(logger).toHaveLoggedError('error message');
      expect(logger).not.toHaveLoggedError('not found');
    });

    it('should support toHaveLoggedCategory matcher', () => {
      logger.debug('EntityManager processing entity');
      logger.info('GameEngine initialization');

      expect(logger).toHaveLoggedCategory('ecs');
      expect(logger).toHaveLoggedCategory('engine');
      expect(logger).not.toHaveLoggedCategory('network');
    });

    it('should support toNotHaveLoggedAtLevel matcher', () => {
      logger.info('Only info message');

      expect(logger).toNotHaveLoggedAtLevel('debug');
      expect(logger).toNotHaveLoggedAtLevel('warn');
      expect(logger).toNotHaveLoggedAtLevel('error');

      expect(logger).not.toNotHaveLoggedAtLevel('info');
    });

    it('should support toHaveLoggedCountAtLevel matcher', () => {
      logger.debug('First debug');
      logger.debug('Second debug');
      logger.info('One info');

      expect(logger).toHaveLoggedCountAtLevel('debug', 2);
      expect(logger).toHaveLoggedCountAtLevel('info', 1);
      expect(logger).toHaveLoggedCountAtLevel('warn', 0);
    });

    it('should support toHaveLoggedSequence matcher', () => {
      logger.info('First message');
      logger.debug('Second message');
      logger.error('Third message');

      expect(logger).toHaveLoggedSequence([
        { level: 'info', message: 'First' },
        { level: 'debug', message: 'Second' },
        { level: 'error', message: 'Third' },
      ]);

      expect(logger).not.toHaveLoggedSequence([
        { level: 'error', message: 'Wrong order' },
      ]);
    });
  });

  describe('utility functions', () => {
    let logger;

    beforeEach(() => {
      logger = createMockLogger();
    });

    describe('getAllCallsInOrder', () => {
      it('should return calls in chronological order', () => {
        logger.info('First');
        logger.debug('Second');
        logger.warn('Third');

        const calls = getAllCallsInOrder(logger);

        expect(calls).toHaveLength(3);
        expect(calls[0].level).toBe('info');
        expect(calls[0].message).toBe('First');
        expect(calls[1].level).toBe('debug');
        expect(calls[1].message).toBe('Second');
        expect(calls[2].level).toBe('warn');
        expect(calls[2].message).toBe('Third');
      });

      it('should handle empty logger', () => {
        const calls = getAllCallsInOrder(logger);
        expect(calls).toEqual([]);
      });
    });

    describe('getAllLogMessages', () => {
      it('should extract all messages as a flat array', () => {
        logger.debug('Debug msg');
        logger.info('Info msg');
        logger.error('Error msg');

        const messages = getAllLogMessages(logger);

        expect(messages).toEqual(['Debug msg', 'Info msg', 'Error msg']);
      });
    });

    describe('validateLogSequence', () => {
      it('should validate correct sequences', () => {
        logger.info('Start');
        logger.debug('Process');
        logger.info('End');

        const result = validateLogSequence(logger, [
          { level: 'info', message: 'Start' },
          { level: 'debug', message: 'Process' },
          { level: 'info', message: 'End' },
        ]);

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should detect incorrect sequences', () => {
        logger.info('Start');
        logger.error('Error');

        const result = validateLogSequence(logger, [
          { level: 'info', message: 'Start' },
          { level: 'debug', message: 'Expected debug' },
        ]);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(1);
        expect(result.errors[0]).toContain("Expected level 'debug'");
      });
    });

    describe('getLogStatistics', () => {
      it('should provide comprehensive statistics', () => {
        logger.debug('EntityManager debug');
        logger.info('GameEngine info');
        logger.warn('Warning message');
        logger.error('Error occurred');

        const stats = getLogStatistics(logger);

        expect(stats.totalCalls).toBe(4);
        expect(stats.callsByLevel.debug).toBe(1);
        expect(stats.callsByLevel.info).toBe(1);
        expect(stats.callsByLevel.warn).toBe(1);
        expect(stats.callsByLevel.error).toBe(1);
        expect(stats.uniqueMessageCount).toBe(4);
        expect(stats.categoryCounts.ecs).toBe(1);
        expect(stats.categoryCounts.engine).toBe(1);
      });
    });

    describe('debugLoggerCalls', () => {
      it('should create readable debug output', () => {
        logger.info('First message');
        logger.debug('Second message');

        const debug = debugLoggerCalls(logger);

        expect(debug).toContain('1. [INFO] First message');
        expect(debug).toContain('2. [DEBUG] Second message');
      });

      it('should handle empty logger', () => {
        const debug = debugLoggerCalls(logger);
        expect(debug).toBe('No log calls recorded');
      });
    });

    describe('category analysis functions', () => {
      it('should filter logs by category', () => {
        logger.debug('EntityManager operation');
        logger.info('Regular message');
        logger.warn('ComponentManager warning');

        const ecsLogs = getLogsByCategory(logger, 'ecs');

        expect(ecsLogs).toHaveLength(2);
        expect(ecsLogs).toContain('EntityManager operation');
        expect(ecsLogs).toContain('ComponentManager warning');
      });

      it('should detect all categories', () => {
        logger.debug('EntityManager processing');
        logger.info('GameEngine started');
        logger.warn('Schema validation needed');
        logger.info('Performance warning detected');

        const categories = getDetectedCategories(logger);

        expect(categories).toContain('ecs');
        expect(categories).toContain('engine');
        expect(categories).toContain('validation');
        expect(categories).toContain('performance');
      });
    });
  });

  describe('integration with project patterns', () => {
    it('should work with dependency injection validation patterns', () => {
      const logger = createEnhancedMockLogger();

      // This would be used in actual service constructors
      expect(() => {
        if (!logger || typeof logger.debug !== 'function') {
          throw new Error('Invalid logger dependency');
        }
      }).not.toThrow();
    });

    it('should support existing test bed patterns', () => {
      const testConfig = {
        mockLogger: createEnhancedMockLogger(),
      };

      // Simulate service usage
      const service = {
        logger: testConfig.mockLogger,
        doSomething() {
          this.logger.info('Service operation completed');
        },
      };

      service.doSomething();

      expect(service.logger).toHaveLoggedInfo('operation completed');
    });
  });
});
