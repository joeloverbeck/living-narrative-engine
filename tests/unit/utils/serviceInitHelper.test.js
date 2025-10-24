import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

import {
  setupServiceLogger,
  validateServiceDependencies,
  initHandlerLogger,
  initializeServiceLogger,
  resolveExecutionLogger,
} from '../../../src/utils/serviceInitializerUtils.js';
import { createPrefixedLogger, initLogger } from '../../../src/utils/loggerUtils.js';
import { validateDependencies } from '../../../src/utils/dependencyUtils.js';

jest.mock('../../../src/utils/dependencyUtils.js', () => ({
  validateDependencies: jest.fn(),
}));

jest.mock('../../../src/utils/loggerUtils.js', () => ({
  initLogger: jest.fn((serviceName, logger) => logger),
  createPrefixedLogger: jest.fn((logger, prefix) => ({ prefix, logger })),
}));

describe('serviceInitializerUtils helper functions', () => {
  const baseLogger = {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    initLogger.mockImplementation((serviceName, logger) => logger);
    createPrefixedLogger.mockImplementation((logger, prefix) => ({
      prefix,
      logger,
    }));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('setupServiceLogger creates prefixed logger', () => {
    const logger = setupServiceLogger('Svc', baseLogger);
    expect(initLogger).toHaveBeenCalledWith('Svc', baseLogger);
    expect(createPrefixedLogger).toHaveBeenCalledWith(baseLogger, 'Svc: ');
    expect(logger).toEqual({ prefix: 'Svc: ', logger: baseLogger });
  });

  it('validateServiceDependencies delegates to validateDependencies', () => {
    const deps = {
      fnA: { value: () => {}, isFunction: true },
    };
    validateServiceDependencies('Svc', baseLogger, deps);
    expect(validateDependencies).toHaveBeenCalledWith(
      [
        {
          dependency: deps.fnA.value,
          name: 'Svc: fnA',
          methods: undefined,
          isFunction: true,
        },
      ],
      baseLogger
    );
  });

  it('initHandlerLogger initializes prefixed logger and validates deps', () => {
    const deps = {
      handlerDep: { value: { handle: jest.fn() }, requiredMethods: ['handle'] },
    };

    const logger = initHandlerLogger('Handler', baseLogger, deps);

    expect(initLogger).toHaveBeenCalledWith('Handler', baseLogger);
    expect(createPrefixedLogger).toHaveBeenCalledWith(baseLogger, 'Handler: ');
    expect(validateDependencies).toHaveBeenCalledWith(
      [
        {
          dependency: deps.handlerDep.value,
          name: 'Handler: handlerDep',
          methods: ['handle'],
          isFunction: undefined,
        },
      ],
      expect.objectContaining({ prefix: 'Handler: ', logger: baseLogger })
    );
    expect(logger).toEqual({ prefix: 'Handler: ', logger: baseLogger });
  });

  it('initializeServiceLogger reuses setup logic', () => {
    const deps = {
      serviceDep: { value: () => {}, isFunction: true },
    };

    const logger = initializeServiceLogger('InitSvc', baseLogger, deps);

    expect(initLogger).toHaveBeenCalledWith('InitSvc', baseLogger);
    expect(createPrefixedLogger).toHaveBeenCalledWith(baseLogger, 'InitSvc: ');
    expect(validateDependencies).toHaveBeenCalledWith(
      [
        {
          dependency: deps.serviceDep.value,
          name: 'InitSvc: serviceDep',
          methods: undefined,
          isFunction: true,
        },
      ],
      expect.objectContaining({ prefix: 'InitSvc: ', logger: baseLogger })
    );
    expect(logger).toEqual({ prefix: 'InitSvc: ', logger: baseLogger });
  });

  describe('resolveExecutionLogger', () => {
    it('prefers execution context logger when available', () => {
      const execLogger = { custom: true };
      const resolved = resolveExecutionLogger(baseLogger, { logger: execLogger });
      expect(resolved).toBe(execLogger);
    });

    it('falls back to default logger when context missing logger', () => {
      expect(resolveExecutionLogger(baseLogger, { logger: null })).toBe(
        baseLogger
      );
      expect(resolveExecutionLogger(baseLogger)).toBe(baseLogger);
    });
  });
});
