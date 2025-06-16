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
 * @param useHelper
 */
function setup(
  modulePath,
  ctorArgs,
  expectedName,
  expectOptional = false,
  useHelper = true
) {
  jest.resetModules();
  const setupService = jest.fn(() => mockLogger);
  const baseInitLogger = jest.fn(() => mockLogger);
  jest.doMock('../../src/utils/serviceInitializer.js', () => {
    const actual = jest.requireActual('../../src/utils/serviceInitializer.js');
    return { ...actual, setupService };
  });
  jest.doMock('../../src/utils/loggerUtils.js', () => {
    const actual = jest.requireActual('../../src/utils/loggerUtils.js');
    return { ...actual, initLogger: baseInitLogger };
  });

  const Mod = require(modulePath).default || require(modulePath);
  new Mod(ctorArgs);
  if (useHelper) {
    expect(setupService).toHaveBeenCalled();
    const call = setupService.mock.calls[0];
    expect(call[0]).toBe(expectedName);
    expect(call[1]).toBe(mockLogger);
  } else {
    expect(baseInitLogger).toHaveBeenCalledWith(
      expectedName,
      mockLogger,
      expect.objectContaining({ optional: expectOptional || false })
    );
  }
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

  it('OperationRegistry uses setupService', () => {
    setup(
      '../../src/logic/operationRegistry.js',
      { logger: mockLogger },
      'OperationRegistry'
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
    const setupService = jest.fn(() => mockLogger);
    jest.doMock('../../src/utils/serviceInitializer.js', () => {
      const actual = jest.requireActual(
        '../../src/utils/serviceInitializer.js'
      );
      return { ...actual, setupService };
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
    expect(setupService).toHaveBeenCalled();
    const call = setupService.mock.calls[0];
    expect(call[0]).toBe('createJsonLogicContext');
    expect(call[1]).toBe(mockLogger);
    jest.dontMock('../../src/utils/loggerUtils.js');
    jest.dontMock('../../src/utils/serviceInitializer.js');
  });

  it('AddComponentHandler uses initHandlerLogger', () => {
    jest.resetModules();
    const initHandlerLogger = jest.fn(() => mockLogger);
    jest.doMock('../../src/utils/handlerUtils/service.js', () => {
      const actual = jest.requireActual(
        '../../src/utils/handlerUtils/service.js'
      );
      return { ...actual, initHandlerLogger };
    });
    const AddComponentHandler =
      require('../../src/logic/operationHandlers/addComponentHandler.js').default;
    new AddComponentHandler({
      entityManager: { addComponent: jest.fn() },
      logger: mockLogger,
      safeEventDispatcher: { dispatch: jest.fn() },
    });
    expect(initHandlerLogger).toHaveBeenCalledWith(
      'AddComponentHandler',
      mockLogger
    );
    jest.dontMock('../../src/utils/handlerUtils/service.js');
  });
});
