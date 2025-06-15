import { describe, it, expect, jest } from '@jest/globals';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

/**
 *
 * @param modulePath
 * @param ctorArgs
 * @param expectedName
 * @param expectOptional
 */
function setup(modulePath, ctorArgs, expectedName, expectOptional = false) {
  jest.resetModules();
  const initLogger = jest.fn(() => mockLogger);
  const baseInitLogger = jest.fn(() => mockLogger);
  jest.doMock('../../src/utils/serviceInitializer.js', () => {
    const actual = jest.requireActual('../../src/utils/serviceInitializer.js');
    return { ...actual, initLogger };
  });
  jest.doMock('../../src/utils/loggerUtils.js', () => {
    const actual = jest.requireActual('../../src/utils/loggerUtils.js');
    return { ...actual, initLogger: baseInitLogger };
  });

  const Mod = require(modulePath).default || require(modulePath);
  new Mod(ctorArgs);
  if (expectOptional) {
    expect(baseInitLogger).toHaveBeenCalledWith(expectedName, mockLogger, {
      optional: true,
    });
  }
  expect(initLogger).toHaveBeenCalledWith(expectedName, mockLogger);
  jest.dontMock('../../src/utils/loggerUtils.js');
  jest.dontMock('../../src/utils/serviceInitializer.js');
}

describe('initLogger usage in constructors', () => {
  it('OperationInterpreter uses initLogger', () => {
    setup(
      '../../src/logic/operationInterpreter.js',
      { logger: mockLogger, operationRegistry: { getHandler: jest.fn() } },
      'OperationInterpreter'
    );
  });

  it('OperationRegistry uses initLogger', () => {
    setup(
      '../../src/logic/operationRegistry.js',
      { logger: mockLogger },
      'OperationRegistry',
      true
    );
  });

  it('JsonLogicEvaluationService uses initLogger', () => {
    setup(
      '../../src/logic/jsonLogicEvaluationService.js',
      { logger: mockLogger },
      'JsonLogicEvaluationService'
    );
  });

  it('createJsonLogicContext uses initLogger', () => {
    jest.resetModules();
    const initLogger = jest.fn(() => mockLogger);
    jest.doMock('../../src/utils/serviceInitializer.js', () => {
      const actual = jest.requireActual(
        '../../src/utils/serviceInitializer.js'
      );
      return { ...actual, initLogger };
    });
    jest.doMock('../../src/utils/loggerUtils.js', () => {
      const actual = jest.requireActual('../../src/utils/loggerUtils.js');
      return { ...actual, initLogger: jest.fn(() => mockLogger) };
    });
    const {
      createJsonLogicContext,
    } = require('../../src/logic/contextAssembler.js');
    createJsonLogicContext(
      { type: 'TEST' },
      null,
      null,
      {
        getComponentData: jest.fn(),
        getEntityInstance: jest.fn(),
        hasComponent: jest.fn(),
      },
      mockLogger
    );
    expect(initLogger).toHaveBeenCalledWith(
      'createJsonLogicContext',
      mockLogger
    );
    jest.dontMock('../../src/utils/loggerUtils.js');
    jest.dontMock('../../src/utils/serviceInitializer.js');
  });
});
