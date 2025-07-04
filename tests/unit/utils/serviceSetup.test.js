import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { ServiceSetup } from '../../../src/utils/serviceInitializerUtils.js';
import { setupPrefixedLogger } from '../../../src/utils/loggerUtils.js';
import { validateDependencies } from '../../../src/utils/dependencyUtils.js';

jest.mock('../../../src/utils/dependencyUtils.js', () => ({
  validateDependencies: jest.fn(),
}));

jest.mock('../../../src/utils/loggerUtils.js', () => ({
  setupPrefixedLogger: jest.fn(),
}));

describe('ServiceSetup', () => {
  const baseLogger = {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  };
  let serviceSetup;

  beforeEach(() => {
    jest.clearAllMocks();
    setupPrefixedLogger.mockImplementation((logger, prefix) => ({
      prefix,
      logger,
    }));
    serviceSetup = new ServiceSetup();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('createLogger prefixes via setupPrefixedLogger', () => {
    const logger = serviceSetup.createLogger('Svc', baseLogger);
    expect(setupPrefixedLogger).toHaveBeenCalledWith(baseLogger, 'Svc: ');
    expect(logger).toEqual({ prefix: 'Svc: ', logger: baseLogger });
  });

  it('validateDeps delegates to validateDependencies', () => {
    const deps = {
      fnA: { value: () => {}, isFunction: true },
    };
    serviceSetup.validateDeps('Svc', baseLogger, deps);
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

  it('setupService combines logger creation and validation', () => {
    const deps = { depA: { value: {}, requiredMethods: ['a'] } };
    const logger = serviceSetup.setupService('Svc', baseLogger, deps);
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

  it('resolveExecutionLogger prefers executionContext logger', () => {
    const execLogger = {};
    const result = serviceSetup.resolveExecutionLogger(baseLogger, {
      logger: execLogger,
    });
    expect(result).toBe(execLogger);
  });
});
