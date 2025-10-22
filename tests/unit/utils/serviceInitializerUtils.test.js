import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

import {
  ServiceSetup,
  validateServiceDeps,
  setupService,
  setupServiceLogger,
  initHandlerLogger,
  initializeServiceLogger,
  resolveExecutionLogger as resolveExecutionLoggerFn,
} from '../../../src/utils/serviceInitializerUtils.js';
import { setupPrefixedLogger } from '../../../src/utils/loggerUtils.js';
import { validateDependencies } from '../../../src/utils/dependencyUtils.js';

jest.mock('../../../src/utils/dependencyUtils.js', () => ({
  validateDependencies: jest.fn(),
}));

jest.mock('../../../src/utils/loggerUtils.js', () => ({
  setupPrefixedLogger: jest.fn(),
}));

describe('serviceInitializer utilities', () => {
  const baseLogger = {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setupPrefixedLogger.mockImplementation((logger, prefix) => ({
      prefix,
      logger,
    }));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('validateServiceDeps', () => {
    it('runs validateDependencies with specs built from map', () => {
      const deps = {
        fnA: { value: () => {}, isFunction: true },
        objB: { value: {}, requiredMethods: ['x'] },
      };
      validateServiceDeps('Svc', baseLogger, deps);
      expect(validateDependencies).toHaveBeenCalledTimes(1);
      expect(validateDependencies).toHaveBeenCalledWith(
        [
          {
            dependency: deps.fnA.value,
            name: 'Svc: fnA',
            methods: undefined,
            isFunction: true,
          },
          {
            dependency: deps.objB.value,
            name: 'Svc: objB',
            methods: ['x'],
            isFunction: undefined,
          },
        ],
        baseLogger
      );
    });

    it('does nothing when deps is falsy', () => {
      validateServiceDeps('Svc', baseLogger, null);
      expect(validateDependencies).not.toHaveBeenCalled();
    });

    it('skips entries with falsy spec objects', () => {
      const deps = {
        a: null,
        b: { value: {} },
      };
      validateServiceDeps('Svc', baseLogger, deps);
      expect(validateDependencies).toHaveBeenCalledTimes(1);
      expect(validateDependencies).toHaveBeenCalledWith(
        [
          {
            dependency: deps.b.value,
            name: 'Svc: b',
            methods: undefined,
            isFunction: undefined,
          },
        ],
        baseLogger
      );
    });
  });

  describe('setupService', () => {
    it('initializes logger then validates deps', () => {
      const deps = {
        depA: { value: {}, requiredMethods: ['a'] },
      };
      const logger = setupService('Svc', baseLogger, deps);
      expect(setupPrefixedLogger).toHaveBeenCalledWith(baseLogger, 'Svc: ');
      expect(validateDependencies).toHaveBeenCalledWith(
        [
          {
            dependency: deps.depA.value,
            name: 'Svc: depA',
            methods: ['a'],
            isFunction: undefined,
          },
        ],
        expect.any(Object)
      );
      expect(logger).toEqual({ prefix: 'Svc: ', logger: baseLogger });
    });
  });

  describe('ServiceSetup class helpers', () => {
    it('createLogger delegates to setupPrefixedLogger with prefix', () => {
      const setup = new ServiceSetup();
      const logger = setup.createLogger('Component', baseLogger);

      expect(setupPrefixedLogger).toHaveBeenCalledWith(baseLogger, 'Component: ');
      expect(logger).toEqual({ prefix: 'Component: ', logger: baseLogger });
    });

    it('resolveExecutionLogger prioritizes execution context logger when available', () => {
      const setup = new ServiceSetup();
      const defaultLogger = { id: 'default' };
      const contextLogger = { id: 'context' };

      const resolved = setup.resolveExecutionLogger(defaultLogger, {
        logger: contextLogger,
      });
      const fallback = setup.resolveExecutionLogger(defaultLogger, {});

      expect(resolved).toBe(contextLogger);
      expect(fallback).toBe(defaultLogger);
    });
  });

  describe('legacy export helpers', () => {
    it('setupServiceLogger uses the shared ServiceSetup instance', () => {
      const logger = setupServiceLogger('LegacySvc', baseLogger);

      expect(setupPrefixedLogger).toHaveBeenCalledWith(baseLogger, 'LegacySvc: ');
      expect(logger).toEqual({ prefix: 'LegacySvc: ', logger: baseLogger });
      expect(validateDependencies).not.toHaveBeenCalled();
    });

    it('initHandlerLogger delegates to the shared setupService implementation', () => {
      const deps = {
        dep: { value: { run: jest.fn() }, requiredMethods: ['run'] },
      };

      const logger = initHandlerLogger('Handler', baseLogger, deps);

      expect(setupPrefixedLogger).toHaveBeenCalledWith(baseLogger, 'Handler: ');
      expect(validateDependencies).toHaveBeenCalledWith(
        [
          {
            dependency: deps.dep.value,
            name: 'Handler: dep',
            methods: ['run'],
            isFunction: undefined,
          },
        ],
        expect.any(Object)
      );
      expect(logger).toEqual({ prefix: 'Handler: ', logger: baseLogger });
    });

    it('initializeServiceLogger mirrors setupService behavior', () => {
      const deps = {
        foo: { value: () => {}, isFunction: true },
      };

      const logger = initializeServiceLogger('InitSvc', baseLogger, deps);

      expect(setupPrefixedLogger).toHaveBeenCalledWith(baseLogger, 'InitSvc: ');
      expect(validateDependencies).toHaveBeenCalledWith(
        [
          {
            dependency: deps.foo.value,
            name: 'InitSvc: foo',
            methods: undefined,
            isFunction: true,
          },
        ],
        expect.any(Object)
      );
      expect(logger).toEqual({ prefix: 'InitSvc: ', logger: baseLogger });
    });

    it('resolveExecutionLogger falls back to the default logger when no override exists', () => {
      const defaultLogger = { id: 'default' };
      const overrideLogger = { id: 'override' };

      expect(
        resolveExecutionLoggerFn(defaultLogger, { logger: overrideLogger })
      ).toBe(overrideLogger);
      expect(resolveExecutionLoggerFn(defaultLogger, { logger: null })).toBe(
        defaultLogger
      );
      expect(resolveExecutionLoggerFn(defaultLogger)).toBe(defaultLogger);
    });
  });
});
