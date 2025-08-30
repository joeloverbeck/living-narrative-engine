/**
 * @file Test helpers for ActionTraceConfigLoader integration tests
 * Performance-optimized container configuration for testing
 */

/* global process */

import { jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import LoggerStrategy from '../../../src/logging/loggerStrategy.js';
import { Registrar } from '../../../src/utils/registrarHelpers.js';

/**
 * Creates a lightweight container optimized for ActionTraceConfigLoader testing
 * Includes only essential dependencies without heavy file I/O operations
 *
 * @returns {Promise<AppContainer>} Configured test container
 */
export async function createActionTraceConfigTestContainer() {
  const container = new AppContainer();
  const registrar = new Registrar(container);

  // Mock essential UI elements (required by some registrations but unused in this optimized setup)
  const _mockOutputDiv = document.createElement('div');
  const _mockInputElement = document.createElement('input');
  const _mockTitleElement = document.createElement('h1');
  const _mockDocument = document;

  // Register mocked event dispatchers (lightweight, no file I/O)
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

  // Create lightweight logger (no remote logging, no file I/O)
  const appLogger = new LoggerStrategy({
    config: {}, // Let it auto-detect mode (will default to console mode in test environment)
    dependencies: {
      consoleLogger: new ConsoleLogger(LogLevel.WARN), // Reduced verbosity for tests
    },
  });
  registrar.instance(tokens.ILogger, appLogger);

  // Register minimal schema validator with all required methods
  const mockSchemaValidator = {
    validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    addSchema: jest.fn().mockReturnValue(true),
    removeSchema: jest.fn().mockReturnValue(true),
    isValidationEnabled: jest.fn().mockReturnValue(true),
  };
  registrar.instance(tokens.ISchemaValidator, mockSchemaValidator);

  // Register mocked trace config loader (no file I/O)
  const mockTraceConfigLoader = {
    loadConfig: jest.fn().mockResolvedValue({
      traceAnalysisEnabled: false,
      outputDirectory: './trace-output',
      maxTraceFiles: 10,
      rotationPolicy: 'age',
      maxFileAge: 86400,
    }),
  };
  registrar.instance(tokens.ITraceConfigLoader, mockTraceConfigLoader);

  // Register ActionTraceConfigLoader (the service under test)
  const { default: ActionTraceConfigLoader } = await import(
    '../../../src/configuration/actionTraceConfigLoader.js'
  );

  container.register(
    tokens.IActionTraceConfigLoader,
    (container) =>
      new ActionTraceConfigLoader({
        traceConfigLoader: container.resolve(tokens.ITraceConfigLoader),
        logger: container.resolve(tokens.ILogger),
        validator: container.resolve(tokens.ISchemaValidator),
        cacheTtl: 60000, // 1 minute cache for tests
      }),
    { lifecycle: 'singleton' }
  );

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
 * Resets container state between tests without full recreation
 * Much faster than creating a new container
 *
 * @param {AppContainer} container - Container to reset
 */
export function resetContainerForNextTest(container) {
  // Reset mock call counts
  const safeDispatcher = container.resolve(tokens.ISafeEventDispatcher);
  const validatedDispatcher = container.resolve(
    tokens.IValidatedEventDispatcher
  );
  const schemaValidator = container.resolve(tokens.ISchemaValidator);
  const traceConfigLoader = container.resolve(tokens.ITraceConfigLoader);

  if (safeDispatcher.dispatch?.mockClear) {
    safeDispatcher.dispatch.mockClear();
  }
  if (validatedDispatcher.dispatch?.mockClear) {
    validatedDispatcher.dispatch.mockClear();
  }
  if (schemaValidator.validate?.mockClear) {
    schemaValidator.validate.mockClear();
  }
  if (traceConfigLoader.loadConfig?.mockClear) {
    traceConfigLoader.loadConfig.mockClear();
  }

  // Reset ActionTraceConfigLoader internal state if it has reset methods
  try {
    const actionTraceConfigLoader = container.resolve(
      tokens.IActionTraceConfigLoader
    );
    if (actionTraceConfigLoader.resetStatistics) {
      actionTraceConfigLoader.resetStatistics();
    }
  } catch {
    // Ignore if not yet resolved or doesn't have reset method
  }
}

/**
 * Test configuration constants for performance thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  CONTAINER_SETUP_MS: 100, // Container setup should be under 100ms
  SINGLE_TEST_MS: 50, // Individual tests should be under 50ms
  TOTAL_SUITE_MS: 3000, // Total suite should be under 3s
  SERVICE_RESOLUTION_MS: 10, // Service resolution should be under 10ms
};

/**
 * Validates that essential ActionTraceConfigLoader functionality works
 * Used as a smoke test after optimization changes
 *
 * @param {AppContainer} container - Container to validate
 */
export function validateActionTraceConfigLoaderBasics(container) {
  const actionTraceConfigLoader = container.resolve(
    tokens.IActionTraceConfigLoader
  );

  // Verify core interface
  if (!actionTraceConfigLoader) {
    throw new Error('ActionTraceConfigLoader not resolved');
  }

  const requiredMethods = [
    'loadConfig',
    'isEnabled',
    'shouldTraceAction',
    'getStatistics',
    'resetStatistics',
    'testPattern',
  ];

  for (const method of requiredMethods) {
    if (typeof actionTraceConfigLoader[method] !== 'function') {
      throw new Error(`ActionTraceConfigLoader missing method: ${method}`);
    }
  }

  // Verify basic functionality
  const stats = actionTraceConfigLoader.getStatistics();
  if (!stats || typeof stats.totalLookups !== 'number') {
    throw new Error('ActionTraceConfigLoader statistics not working');
  }
}
