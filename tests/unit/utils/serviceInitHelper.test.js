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
} from '../../../src/utils/serviceInitializerUtils.js';
import { setupPrefixedLogger } from '../../../src/utils/loggerUtils.js';
import { validateDependencies } from '../../../src/utils/dependencyUtils.js';

jest.mock('../../../src/utils/dependencyUtils.js', () => ({
  validateDependencies: jest.fn(),
}));

jest.mock('../../../src/utils/loggerUtils.js', () => ({
  setupPrefixedLogger: jest.fn(),
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
    setupPrefixedLogger.mockImplementation((logger, prefix) => ({
      prefix,
      logger,
    }));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('setupServiceLogger creates prefixed logger', () => {
    const logger = setupServiceLogger('Svc', baseLogger);
    expect(setupPrefixedLogger).toHaveBeenCalledWith(baseLogger, 'Svc: ');
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
});
