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

  it('should NOT produce warnings during bootstrap (fixed behavior)', () => {
    // Arrange
    const mockConsoleLogger = testBed.createMockLogger();

    // Simulate early bootstrap condition where eventBus is not available yet
    const dependencies = {
      consoleLogger: mockConsoleLogger,
      // eventBus is intentionally undefined to test that no warnings occur
    };

    // Act - Create LoggerStrategy without eventBus and use it (simulates containerConfig.js:62 → loggerStrategy.js:363)
    const loggerStrategy = new LoggerStrategy({ dependencies });

    // Trigger the actual logger creation that calls #wrapWithSafeLogger by calling a logging method
    loggerStrategy.error('Test message'); // This should NOT produce warnings

    // Assert - Should NOT have logged any warnings (the fix changed warning to debug)
    expect(mockConsoleLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining(
        '[LoggerStrategy] No eventBus available for SafeErrorLogger'
      )
    );

    // Verify that logger strategy still functions properly
    expect(loggerStrategy).toBeDefined();
    expect(typeof loggerStrategy.error).toBe('function');
    expect(typeof loggerStrategy.warn).toBe('function');
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
    const loggerStrategy = new LoggerStrategy({ dependencies });

    // Assert - Should NOT have any warnings about missing eventBus
    const warnCalls = mockConsoleLogger.warn.mock.calls.filter(
      ([msg]) => msg && msg.includes('No eventBus available')
    );

    expect(warnCalls.length).toBe(0);

    // Verify that logger functions properly
    expect(loggerStrategy).toBeDefined();
  });

  it('should handle bootstrap sequence gracefully without warnings (fixed behavior)', () => {
    // Arrange - Simulate the exact sequence from the logs:
    // configureContainer @ containerConfig.js:62 → LoggerStrategy @ loggerStrategy.js:134
    const mockConsoleLogger = testBed.createMockLogger();

    // Act - Simulate container configuration stage where eventBus isn't registered yet
    /**
     *
     */
    function simulateContainerConfigurationStage() {
      // This simulates the state during early bootstrap
      const dependencies = {
        consoleLogger: mockConsoleLogger,
        // eventBus is not available during early container setup
      };

      return new LoggerStrategy({ dependencies });
    }

    const loggerStrategy = simulateContainerConfigurationStage();

    // Trigger the actual logger creation that calls #wrapWithSafeLogger by calling a logging method
    loggerStrategy.info('Test message'); // This should trigger the wrapper method

    // Assert - Should NOT produce any warnings (the fix changed warning to debug)
    expect(mockConsoleLogger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining(
        '[LoggerStrategy] No eventBus available for SafeErrorLogger'
      )
    );

    // Verify the logger still works (degraded mode)
    expect(loggerStrategy).toBeDefined();

    // Test that the logger can still log without throwing errors
    expect(() => {
      loggerStrategy.error('Test error message');
    }).not.toThrow();
  });

  it('should handle multiple logger creations during bootstrap without warnings (fixed behavior)', () => {
    // Arrange
    const mockConsoleLogger = testBed.createMockLogger();
    const dependencies = {
      consoleLogger: mockConsoleLogger,
      // eventBus intentionally undefined
    };

    // Act - Create LoggerStrategy during bootstrap and trigger logger creation (common scenario)
    const loggerStrategy = new LoggerStrategy({ dependencies });

    // Trigger the actual logger creation that calls #wrapWithSafeLogger by calling a logging method
    loggerStrategy.error('Test message'); // This should trigger the wrapper method

    // Assert - Should NOT have any warnings (the fix eliminated warnings during bootstrap)
    const warnCalls = mockConsoleLogger.warn.mock.calls.filter(
      ([msg]) =>
        msg &&
        msg.includes(
          '[LoggerStrategy] No eventBus available for SafeErrorLogger'
        )
    );

    expect(warnCalls.length).toBe(0);

    // Verify logger strategy is functional
    expect(loggerStrategy).toBeDefined();
    expect(() => {
      loggerStrategy.error('Test error from logger strategy');
    }).not.toThrow();
  });
});
