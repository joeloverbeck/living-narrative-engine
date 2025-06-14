import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

import {
  initLogger,
  validateServiceDeps,
} from '../../src/utils/serviceInitializer.js';
import { validateDependency } from '../../src/utils/validationUtils.js';
import { createPrefixedLogger } from '../../src/utils/loggerUtils.js';

jest.mock('../../src/utils/validationUtils.js', () => ({
  validateDependency: jest.fn(),
}));

jest.mock('../../src/utils/loggerUtils.js', () => ({
  createPrefixedLogger: jest.fn(),
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
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('initLogger', () => {
    it('validates and returns a prefixed logger', () => {
      const logger = initLogger('MyService', baseLogger, ['debug']);
      expect(validateDependency).toHaveBeenCalledWith(
        baseLogger,
        'MyService: logger',
        console,
        { requiredMethods: ['debug'] }
      );
      expect(createPrefixedLogger).toHaveBeenCalledWith(
        baseLogger,
        'MyService: '
      );
      expect(logger).toEqual({ prefix: 'MyService: ', logger: baseLogger });
    });

    it('throws when validation fails', () => {
      validateDependency.mockImplementation(() => {
        throw new Error('bad');
      });
      expect(() => initLogger('FailService', null)).toThrow('bad');
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
  });
});
