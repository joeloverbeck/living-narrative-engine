/**
 * @file Integration tests that exercise dependencyUtils through the WorldInitializer
 *       to ensure dependency validation paths are fully covered in realistic setups.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import InitializationService from '../../../src/initializers/services/initializationService.js';
import {
  WorldInitializationError,
  SystemInitializationError,
} from '../../../src/errors/InitializationError.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

/**
 * Builds a minimal but valid dependency graph for WorldInitializer instances.
 * Each dependency mirrors the production collaborators closely to exercise
 * the behaviour inside dependencyUtils without resorting to mocks of the
 * functions under test themselves.
 *
 * @param {Partial<Parameters<typeof WorldInitializer>[0]>} overrides - Optional dependency overrides.
 * @returns {Parameters<typeof WorldInitializer>[0]} Fully configured dependency map.
 */
function createWorldInitializerDeps(overrides = {}) {
  const baseDependencies = {
    entityManager: {
      createEntityInstance: jest.fn(),
      hasBatchSupport: jest.fn().mockReturnValue(false),
    },
    worldContext: { id: 'world-ctx' },
    gameDataRepository: {
      getWorld: jest.fn(),
      getEntityInstanceDefinition: jest.fn(),
      get: jest.fn(),
    },
    validatedEventDispatcher: {
      dispatch: jest.fn(),
    },
    eventDispatchService: {
      dispatchWithLogging: jest.fn(),
    },
    scopeRegistry: {
      initialize: jest.fn(),
    },
    config: {
      isFeatureEnabled: jest.fn().mockReturnValue(true),
      getValue: jest.fn().mockReturnValue(undefined),
    },
  };

  const merged = {
    ...baseDependencies,
    ...overrides,
  };

  if (!merged.logger) {
    merged.logger = new ConsoleLogger(LogLevel.ERROR);
  }

  return merged;
}

describe('dependencyUtils integration via service initializers', () => {
  let consoleInfoSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('surfaces dependency failures even when the provided logger lacks an error channel', () => {
    const partialLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      // Intentionally omit debug and error to trigger assertFunction failure.
    };

    const dependencies = createWorldInitializerDeps({ logger: partialLogger });

    expect(() => new WorldInitializer(dependencies)).toThrow(
      WorldInitializationError
    );

    // The fallback branch avoids calling logger.error, so the stub should remain untouched.
    expect(partialLogger.warn).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('logs descriptive errors through InitializationService when dependency checks fail with a real logger', () => {
    const logger = new ConsoleLogger(LogLevel.ERROR);
    const dependencies = {
      log: { logger },
      events: {
        validatedEventDispatcher: {},
        safeEventDispatcher: {
          subscribe: jest.fn(),
          dispatchWithLogging: jest.fn(),
        },
      },
    };

    // Discard ConsoleLogger setup chatter so the assertion only captures validation output.
    consoleInfoSpy.mockClear();
    consoleWarnSpy.mockClear();
    consoleErrorSpy.mockClear();

    expect(() => new InitializationService(dependencies)).toThrow(
      SystemInitializationError
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "InitializationService: Missing or invalid required dependency 'validatedEventDispatcher'."
    );
  });
});
