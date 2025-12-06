import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  ServiceSetup,
  setupServiceLogger,
  validateServiceDeps,
  validateServiceDependencies,
  setupService as setupServiceLegacy,
  initHandlerLogger,
  initializeServiceLogger,
  resolveExecutionLogger as resolveExecutionLoggerLegacy,
} from '../../../src/utils/serviceInitializerUtils.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

/**
 * Creates a basic logger implementation with jest spies for all methods.
 *
 * @returns {{ info: jest.Mock, warn: jest.Mock, error: jest.Mock, debug: jest.Mock }}
 */
function createBaseLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

describe('ServiceSetup integration', () => {
  let setup;
  let baseLogger;

  beforeEach(() => {
    setup = new ServiceSetup();
    baseLogger = createBaseLogger();
  });

  it('createLogger wraps the provided logger with a service-specific prefix', () => {
    const prefixed = setup.createLogger('InventoryService', baseLogger);

    prefixed.info('loaded');
    prefixed.warn('low stock', { itemId: 'item-1' });
    prefixed.debug('checking quantities');
    prefixed.error('failed');

    expect(baseLogger.info).toHaveBeenCalledWith('InventoryService: loaded');
    expect(baseLogger.warn).toHaveBeenCalledWith(
      'InventoryService: low stock',
      {
        itemId: 'item-1',
      }
    );
    expect(baseLogger.debug).toHaveBeenCalledWith(
      'InventoryService: checking quantities'
    );
    expect(baseLogger.error).toHaveBeenCalledWith('InventoryService: failed');
  });

  it('validateDeps integrates dependency validation for functions and required methods', () => {
    const prefixed = setup.createLogger('PipelineService', baseLogger);
    const dependencies = {
      orchestrator: {
        value: { discoverActions: jest.fn() },
        requiredMethods: ['discoverActions'],
      },
      traceFactory: {
        value: () => 'trace',
        isFunction: true,
      },
      optional: null,
    };

    expect(() =>
      setup.validateDeps('PipelineService', prefixed, dependencies)
    ).not.toThrow();

    expect(baseLogger.error).not.toHaveBeenCalled();
  });

  it('validateDeps throws InvalidArgumentError and logs with prefixed context when validation fails', () => {
    const prefixed = setup.createLogger('PipelineService', baseLogger);

    expect(() =>
      setup.validateDeps('PipelineService', prefixed, {
        orchestrator: {
          value: {},
          requiredMethods: ['discoverActions'],
        },
      })
    ).toThrow(InvalidArgumentError);

    expect(baseLogger.error).toHaveBeenCalledWith(
      "PipelineService: Invalid or missing method 'discoverActions' on dependency 'PipelineService: orchestrator'."
    );
  });

  it('setupService returns a prefixed logger and tolerates missing dependency maps', () => {
    const orchestrator = { discoverActions: jest.fn() };
    const returnedLogger = setup.setupService('DiscoveryService', baseLogger, {
      orchestrator: {
        value: orchestrator,
        requiredMethods: ['discoverActions'],
      },
      traceFactory: { value: jest.fn(), isFunction: true },
    });

    returnedLogger.info('ready');
    expect(baseLogger.info).toHaveBeenCalledWith('DiscoveryService: ready');

    expect(() =>
      setup.setupService('LoggerOnlyService', baseLogger)
    ).not.toThrow();
  });

  it('resolveExecutionLogger prefers the context logger when provided', () => {
    const contextLogger = createBaseLogger();
    const executionContext = { logger: contextLogger };

    expect(setup.resolveExecutionLogger(baseLogger, executionContext)).toBe(
      contextLogger
    );
    expect(setup.resolveExecutionLogger(baseLogger, {})).toBe(baseLogger);
    expect(setup.resolveExecutionLogger(baseLogger, undefined)).toBe(
      baseLogger
    );
  });
});

describe('serviceInitializerUtils legacy exports', () => {
  let baseLogger;

  beforeEach(() => {
    baseLogger = createBaseLogger();
  });

  it('setupServiceLogger prefixes log output consistently', () => {
    const prefixed = setupServiceLogger('LegacyService', baseLogger);
    prefixed.warn('deprecated');

    expect(baseLogger.warn).toHaveBeenCalledWith('LegacyService: deprecated');
  });

  it('validateServiceDeps and its alias enforce dependency requirements', () => {
    const prefixed = setupServiceLogger('LegacyValidation', baseLogger);

    expect(() =>
      validateServiceDeps('LegacyValidation', prefixed, {
        orchestrator: {
          value: {},
          requiredMethods: ['discoverActions'],
        },
      })
    ).toThrow(InvalidArgumentError);

    expect(() =>
      validateServiceDependencies('LegacyValidation', prefixed, {
        traceFactory: {
          value: null,
          isFunction: true,
        },
      })
    ).toThrow(InvalidArgumentError);
  });

  it('setupService, initHandlerLogger and initializeServiceLogger share behaviour', () => {
    const dependencies = {
      orchestrator: {
        value: { discoverActions: jest.fn() },
        requiredMethods: ['discoverActions'],
      },
    };

    const serviceLogger = setupServiceLegacy(
      'LegacySetup',
      baseLogger,
      dependencies
    );
    serviceLogger.debug('from setup');

    const handlerLogger = initHandlerLogger('HandlerSetup', baseLogger);
    handlerLogger.info('from handler');

    const initializerLogger = initializeServiceLogger(
      'InitializerSetup',
      baseLogger,
      dependencies
    );
    initializerLogger.error('from initializer');

    expect(baseLogger.debug).toHaveBeenCalledWith('LegacySetup: from setup');
    expect(baseLogger.info).toHaveBeenCalledWith('HandlerSetup: from handler');
    expect(baseLogger.error).toHaveBeenCalledWith(
      'InitializerSetup: from initializer'
    );
  });

  it('resolveExecutionLogger legacy export mirrors class implementation', () => {
    const contextLogger = createBaseLogger();

    expect(
      resolveExecutionLoggerLegacy(baseLogger, { logger: contextLogger })
    ).toBe(contextLogger);
    expect(resolveExecutionLoggerLegacy(baseLogger, {})).toBe(baseLogger);
    expect(resolveExecutionLoggerLegacy(baseLogger)).toBe(baseLogger);
  });
});
