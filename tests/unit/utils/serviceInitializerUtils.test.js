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
import { validateDependencies } from '../../../src/utils/dependencyUtils.js';

jest.mock('../../../src/utils/dependencyUtils.js', () => ({
  validateDependencies: jest.fn(),
}));

describe('serviceInitializer utilities', () => {
  /** @type {import('../../../src/interfaces/coreServices.js').ILogger} */
  let baseLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    baseLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    };
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
      logger.info('msg');
      expect(baseLogger.info).toHaveBeenCalledWith('Svc: msg');
    });
  });

  describe('ServiceSetup class helpers', () => {
    it('createLogger applies prefix to logger output', () => {
      const setup = new ServiceSetup();
      const logger = setup.createLogger('Component', baseLogger);

      logger.warn('notice');
      expect(baseLogger.warn).toHaveBeenCalledWith('Component: notice');
    });

    it('createLogger throws when logger dependency missing', () => {
      const setup = new ServiceSetup();
      expect(() => setup.createLogger('Component')).toThrow(
        'Missing required dependency: logger.'
      );
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

      logger.debug('legacy');
      expect(baseLogger.debug).toHaveBeenCalledWith('LegacySvc: legacy');
      expect(validateDependencies).not.toHaveBeenCalled();
    });

    it('initHandlerLogger delegates to the shared setupService implementation', () => {
      const deps = {
        dep: { value: { run: jest.fn() }, requiredMethods: ['run'] },
      };

      const logger = initHandlerLogger('Handler', baseLogger, deps);

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
      logger.error('boom');
      expect(baseLogger.error).toHaveBeenCalledWith('Handler: boom');
    });

    it('initializeServiceLogger mirrors setupService behavior', () => {
      const deps = {
        foo: { value: () => {}, isFunction: true },
      };

      const logger = initializeServiceLogger('InitSvc', baseLogger, deps);

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
      logger.debug('init');
      expect(baseLogger.debug).toHaveBeenCalledWith('InitSvc: init');
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
