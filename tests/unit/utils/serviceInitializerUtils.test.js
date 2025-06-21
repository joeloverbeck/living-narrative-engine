import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

import {
  initPrefixedLogger,
  validateServiceDeps,
  setupService,
} from '../../../src/utils/serviceInitializerUtils.js';
import {
  createPrefixedLogger,
  initLogger as baseInitLogger,
  ensureValidLogger,
} from '../../../src/utils/loggerUtils.js';
import { validateDependencies } from '../../../src/utils/validationUtils.js';

jest.mock('../../../src/utils/validationUtils.js', () => ({
  validateDependencies: jest.fn(),
}));

jest.mock('../../../src/utils/loggerUtils.js', () => ({
  createPrefixedLogger: jest.fn(),
  ensureValidLogger: jest.fn(),
  initLogger: jest.fn(),
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
    createPrefixedLogger.mockImplementation((logger, prefix) => ({
      prefix,
      logger,
    }));
    ensureValidLogger.mockImplementation((l) => l);
    baseInitLogger.mockImplementation((service, l) => l);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('initPrefixedLogger', () => {
    it('validates and returns a prefixed logger', () => {
      const logger = initPrefixedLogger('MyService', baseLogger);
      expect(baseInitLogger).toHaveBeenCalledWith('MyService', baseLogger);
      expect(createPrefixedLogger).toHaveBeenCalledWith(
        baseLogger,
        'MyService: '
      );
      expect(logger).toEqual({ prefix: 'MyService: ', logger: baseLogger });
    });

    it('throws when validation fails', () => {
      baseInitLogger.mockImplementation(() => {
        throw new Error('bad');
      });
      expect(() => initPrefixedLogger('FailService', null)).toThrow('bad');
    });
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
      expect(baseInitLogger).toHaveBeenCalledWith('Svc', baseLogger);
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
});
