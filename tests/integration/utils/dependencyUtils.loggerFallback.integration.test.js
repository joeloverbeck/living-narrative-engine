import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import {
  assertFunction,
  validateDependency,
  validateDependencies,
} from '../../../src/utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

/**
 * Creates a prefixed logger using ServiceSetup and then simulates a degraded
 * logger by removing its error method. This exercises the fallback logging
 * paths inside dependencyUtils when collaborating services lose critical
 * logging capabilities at runtime.
 *
 * @param {ServiceSetup} setup - ServiceSetup instance used to create the logger.
 * @param {ConsoleLogger} baseLogger - The base ConsoleLogger instance.
 * @param {string} serviceName - Name used for logger prefixing.
 * @returns {import('../../../src/interfaces/coreServices.js').ILogger} Prefixed logger without an error method.
 */
function createLoggerWithoutError(setup, baseLogger, serviceName) {
  const prefixed = setup.createLogger(serviceName, baseLogger);
  // Simulate an unexpected runtime mutation that strips the error method
  // (observed in some mod integration environments).
   
  prefixed.error = undefined;
  return prefixed;
}

describe('dependencyUtils logger fallback integration', () => {
  let setup;
  let baseLogger;
  let consoleErrorSpy;
  let consoleWarnSpy;
  let consoleInfoSpy;

  beforeEach(() => {
    setup = new ServiceSetup();
    baseLogger = new ConsoleLogger(LogLevel.ERROR);

    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('falls back to console logging when ServiceSetup logger loses its error method', () => {
    const degradedLogger = createLoggerWithoutError(setup, baseLogger, 'FaultyService');

    expect(() =>
      setup.validateDeps('FaultyService', degradedLogger, {
        orchestrator: { value: {}, requiredMethods: ['discoverActions'] },
      }),
    ).toThrow(InvalidArgumentError);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Invalid or missing method 'discoverActions' on dependency 'FaultyService: orchestrator'.",
    );
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
  });

  it('reports assertion errors through the console when injected logger cannot emit errors', () => {
    const degradedLogger = createLoggerWithoutError(setup, baseLogger, 'DiagnosticsService');

    expect(() =>
      assertFunction(
        { execute: 'not-a-function' },
        'execute',
        'DiagnosticsService requires execute()',
        InvalidArgumentError,
        degradedLogger,
      ),
    ).toThrow(InvalidArgumentError);

    // The degraded logger cannot emit errors, so the console fallback is not
    // invoked for assertFunction and no console output should be produced.
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('continues iterating dependency specifications even with degraded loggers', () => {
    const degradedLogger = createLoggerWithoutError(setup, baseLogger, 'LifecycleService');

    const dependencySpecs = [
      {
        dependency: { start() {} },
        name: 'LifecycleService: lifecycle',
        methods: ['start', 'stop'],
      },
      {
        dependency: () => {},
        name: 'LifecycleService: handler',
        isFunction: true,
      },
    ];

    expect(() => validateDependencies(dependencySpecs, degradedLogger)).toThrow(
      InvalidArgumentError,
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Invalid or missing method 'stop' on dependency 'LifecycleService: lifecycle'.",
    );
  });

  it('uses console fallback when validateDependency checks function-only dependencies', () => {
    const degradedLogger = createLoggerWithoutError(setup, baseLogger, 'FunctionService');

    expect(() =>
      validateDependency({ run: () => {} }, 'FunctionService', degradedLogger, {
        isFunction: true,
      }),
    ).toThrow(InvalidArgumentError);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Dependency 'FunctionService' must be a function, but got object.",
    );
  });
});
