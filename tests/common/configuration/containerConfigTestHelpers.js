/**
 * @file Test helpers for containerConfig integration tests
 * Performance-optimized container configuration for testing
 *
 * Optimization Strategy:
 * - Create container ONCE in beforeAll instead of beforeEach
 * - Skip async config loading (loadAndApplyLoggerConfig, loadAndApplyTraceConfig)
 * - These tests only verify service resolution, not config loading behavior
 *
 * @see tests/integration/configuration/OPTIMIZATION.md
 */

/* global process */

import { jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import LoggerStrategy from '../../../src/logging/loggerStrategy.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';

/**
 * Creates a fully-configured container for containerConfig integration testing
 * Uses configureBaseContainer directly but skips the async config loading
 * that causes the performance bottleneck
 *
 * @returns {Promise<AppContainer>} Configured test container
 */
export async function createContainerConfigTestContainer() {
  const container = new AppContainer();
  const registrar = new Registrar(container);

  // Create mock UI elements (required by UI registrations)
  const mockOutputDiv = document.createElement('div');
  const mockInputElement = document.createElement('input');

  // Register mock event dispatchers (required before container configuration)
  container.register(
    tokens.ISafeEventDispatcher,
    {
      dispatch: jest.fn(),
    },
    { lifecycle: 'singleton' }
  );

  container.register(
    tokens.IValidatedEventDispatcher,
    {
      dispatch: jest.fn(),
    },
    { lifecycle: 'singleton' }
  );

  // Create lightweight logger (no remote config loading)
  const appLogger = new LoggerStrategy({
    mode: 'test',
    config: {},
    dependencies: {
      consoleLogger: new ConsoleLogger(LogLevel.WARN), // Reduced verbosity
    },
  });
  registrar.instance(tokens.ILogger, appLogger);

  // Register AppContainer token (required by some services)
  registrar.instance(tokens.AppContainer, container);

  // Configure base container with full services (this is the bulk of the work)
  // This is synchronous registration of factories - actual instantiation is lazy
  await configureBaseContainer(container, {
    includeGameSystems: true,
    includeUI: true,
    includeCharacterBuilder: true,
    uiElements: {
      outputDiv: mockOutputDiv,
      inputElement: mockInputElement,
      document: document,
    },
    logger: appLogger,
  });

  // Skip loadAndApplyLoggerConfig (async HTTP call with retry delays)
  // Skip loadAndApplyTraceConfig (async HTTP call with retry delays)
  // Instead, register default trace configuration directly
  container.register(tokens.ITraceConfiguration, {
    traceAnalysisEnabled: false,
  });

  return container;
}

/**
 * Creates performance monitoring utilities for tracking test execution time
 *
 * @returns {object} Performance monitoring utilities
 */
export function createPerformanceMonitor() {
  let startTime;

  return {
    start() {
      startTime = process.hrtime.bigint();
    },

    end() {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;
      return durationMs;
    },

    assertUnder(maxMs, operation) {
      const duration = this.end();
      if (duration > maxMs) {
        throw new Error(
          `Performance regression: ${operation} took ${duration.toFixed(2)}ms, expected under ${maxMs}ms`
        );
      }
      return duration;
    },
  };
}

/**
 * Resets mock call counts between tests without recreating container
 * Called in beforeEach for test isolation
 *
 * @param {AppContainer} container - Container to reset mocks in
 */
export function resetContainerMocksForNextTest(container) {
  // Reset event dispatcher mocks
  const safeDispatcher = container.resolve(tokens.ISafeEventDispatcher);
  const validatedDispatcher = container.resolve(
    tokens.IValidatedEventDispatcher
  );

  if (safeDispatcher.dispatch?.mockClear) {
    safeDispatcher.dispatch.mockClear();
  }
  if (validatedDispatcher.dispatch?.mockClear) {
    validatedDispatcher.dispatch.mockClear();
  }
}

/**
 * Test configuration constants for performance thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  CONTAINER_SETUP_MS: 3000, // Full container setup should be under 3s (single time)
  SINGLE_TEST_MS: 100, // Individual tests should be under 100ms
  TOTAL_SUITE_MS: 4000, // Total suite should be under 4s (target threshold)
  SERVICE_RESOLUTION_MS: 50, // Service resolution should be under 50ms
};
