import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

import {
  validateServiceDeps,
  setupService,
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
});
