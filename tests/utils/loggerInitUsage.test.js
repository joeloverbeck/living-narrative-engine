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
  jest.doMock('../../src/utils/loggerUtils.js', () => {
    const actual = jest.requireActual('../../src/utils/loggerUtils.js');
    return { ...actual, initLogger };
  });

  const Mod = require(modulePath).default || require(modulePath);
  new Mod(ctorArgs);
  if (expectOptional) {
    expect(initLogger).toHaveBeenCalledWith(expectedName, mockLogger, {
      optional: true,
    });
  } else {
    expect(initLogger).toHaveBeenCalledWith(expectedName, mockLogger);
  }
  jest.dontMock('../../src/utils/loggerUtils.js');
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
    jest.doMock('../../src/utils/loggerUtils.js', () => {
      const actual = jest.requireActual('../../src/utils/loggerUtils.js');
      return { ...actual, initLogger };
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
  });
});
