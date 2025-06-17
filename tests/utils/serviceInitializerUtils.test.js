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
} from '../../src/utils/serviceInitializerUtils.js';
import {
  createPrefixedLogger,
  initLogger as baseInitLogger,
  ensureValidLogger,
} from '../../src/utils/loggerUtils.js';
import { validateDependency } from '../../src/utils/validationUtils.js';

jest.mock('../../src/utils/validationUtils.js', () => ({
  validateDependency: jest.fn(),
}));

jest.mock('../../src/utils/loggerUtils.js', () => ({
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
    it('runs validateDependency for each spec entry', () => {
      const deps = {
        fnA: { value: () => {}, isFunction: true },
        objB: { value: {}, requiredMethods: ['x'] },
      };
      validateServiceDeps('Svc', baseLogger, deps);
      expect(validateDependency).toHaveBeenCalledTimes(2);
      expect(validateDependency).toHaveBeenNthCalledWith(
        1,
        deps.fnA.value,
        'Svc: fnA',
        baseLogger,
        { requiredMethods: undefined, isFunction: true }
      );
      expect(validateDependency).toHaveBeenNthCalledWith(
        2,
        deps.objB.value,
        'Svc: objB',
        baseLogger,
        { requiredMethods: ['x'], isFunction: undefined }
      );
    });

    it('does nothing when deps is falsy', () => {
      validateServiceDeps('Svc', baseLogger, null);
      expect(validateDependency).not.toHaveBeenCalled();
    });

    it('skips entries with falsy spec objects', () => {
      const deps = {
        a: null,
        b: { value: {} },
      };
      validateServiceDeps('Svc', baseLogger, deps);
      expect(validateDependency).toHaveBeenCalledTimes(1);
      expect(validateDependency).toHaveBeenCalledWith(
        deps.b.value,
        'Svc: b',
        baseLogger,
        { requiredMethods: undefined, isFunction: undefined }
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
      expect(validateDependency).toHaveBeenCalledWith(
        deps.depA.value,
        'Svc: depA',
        expect.any(Object),
        { requiredMethods: ['a'], isFunction: undefined }
      );
      expect(logger).toEqual({ prefix: 'Svc: ', logger: baseLogger });
    });
  });
});
