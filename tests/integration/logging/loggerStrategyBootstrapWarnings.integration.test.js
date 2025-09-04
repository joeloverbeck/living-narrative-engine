/**
 * Integration tests that reproduce the LoggerStrategy bootstrap warnings
 * Related to "No eventBus available for SafeErrorLogger" during container setup
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import LoggerStrategy from '../../../src/logging/loggerStrategy.js';

describe('LoggerStrategy - Bootstrap Warnings Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should reproduce "No eventBus available for SafeErrorLogger" warning during bootstrap', () => {
    // Arrange
    const mockConsoleLogger = testBed.createMockLogger();
    
    // Simulate early bootstrap condition where eventBus is not available yet
    const dependencies = {
      consoleLogger: mockConsoleLogger,
      // eventBus is intentionally undefined to reproduce the warning
    };

    // Act - Create LoggerStrategy without eventBus (simulates containerConfig.js:62 → loggerStrategy.js:363)
    const loggerStrategy = new LoggerStrategy(dependencies);
    const safeErrorLogger = loggerStrategy.createLogger('SafeErrorLogger');

    // Assert - Should have logged the warning about missing eventBus
    expect(mockConsoleLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('[LoggerStrategy] No eventBus available for SafeErrorLogger, using original logger')
    );

    // Verify that logger still functions despite the warning
    expect(safeErrorLogger).toBeDefined();
    expect(typeof safeErrorLogger.error).toBe('function');
    expect(typeof safeErrorLogger.warn).toBe('function');
  });

  it('should not produce warnings when eventBus is available', () => {
    // Arrange
    const mockConsoleLogger = testBed.createMockLogger();
    const mockEventBus = {
      dispatch: jest.fn(),
    };
    
    const dependencies = {
      consoleLogger: mockConsoleLogger,
      eventBus: mockEventBus,
    };

    // Act - Create LoggerStrategy with eventBus available
    const loggerStrategy = new LoggerStrategy(dependencies);
    const safeErrorLogger = loggerStrategy.createLogger('SafeErrorLogger');

    // Assert - Should NOT have any warnings about missing eventBus
    const warnCalls = mockConsoleLogger.warn.mock.calls.filter(
      ([msg]) => msg && msg.includes('No eventBus available')
    );
    
    expect(warnCalls.length).toBe(0);

    // Verify that logger functions properly
    expect(safeErrorLogger).toBeDefined();
  });

  it('should reproduce the specific bootstrap sequence that causes the warning', () => {
    // Arrange - Simulate the exact sequence from the logs:
    // configureContainer @ containerConfig.js:62 → LoggerStrategy @ loggerStrategy.js:134
    const mockConsoleLogger = testBed.createMockLogger();
    
    // Act - Simulate container configuration stage where eventBus isn't registered yet
    function simulateContainerConfigurationStage() {
      // This simulates the state during early bootstrap
      const dependencies = {
        consoleLogger: mockConsoleLogger,
        // eventBus is not available during early container setup
      };
      
      return new LoggerStrategy(dependencies);
    }

    const loggerStrategy = simulateContainerConfigurationStage();
    
    // Simulate the createLogger call that happens during setupDIContainerStage
    const safeErrorLogger = loggerStrategy.createLogger('SafeErrorLogger');

    // Assert - Should reproduce the exact warning from the logs
    expect(mockConsoleLogger.warn).toHaveBeenCalledWith(
      '[LoggerStrategy] No eventBus available for SafeErrorLogger, using original logger'
    );

    // Verify the logger still works (degraded mode)
    expect(safeErrorLogger).toBeDefined();
    
    // Test that the logger can still log without throwing errors
    expect(() => {
      safeErrorLogger.error('Test error message');
    }).not.toThrow();
  });

  it('should handle multiple logger creations during bootstrap gracefully', () => {
    // Arrange
    const mockConsoleLogger = testBed.createMockLogger();
    const dependencies = {
      consoleLogger: mockConsoleLogger,
      // eventBus intentionally undefined
    };

    // Act - Create multiple loggers during bootstrap (common scenario)
    const loggerStrategy = new LoggerStrategy(dependencies);
    const loggers = [
      loggerStrategy.createLogger('SafeErrorLogger'),
      loggerStrategy.createLogger('BaseManifestItemLoader'),
      loggerStrategy.createLogger('ModProcessor'),
      loggerStrategy.createLogger('ContentLoadManager'),
    ];

    // Assert - Should have warnings for each logger creation
    const warnCalls = mockConsoleLogger.warn.mock.calls.filter(
      ([msg]) => msg && msg.includes('No eventBus available')
    );
    
    expect(warnCalls.length).toBe(4);

    // Verify all loggers are functional
    loggers.forEach((logger, index) => {
      expect(logger).toBeDefined();
      expect(() => {
        logger.error(`Test error from logger ${index}`);
      }).not.toThrow();
    });
  });
});