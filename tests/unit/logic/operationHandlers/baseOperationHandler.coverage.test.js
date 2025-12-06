import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  jest,
} from '@jest/globals';

jest.mock('../../../../src/utils/serviceInitializerUtils.js', () => ({
  initHandlerLogger: jest.fn(),
  validateServiceDeps: jest.fn(),
  resolveExecutionLogger: jest.fn(),
}));

const { initHandlerLogger, validateServiceDeps, resolveExecutionLogger } =
  jest.requireMock('../../../../src/utils/serviceInitializerUtils.js');

let BaseOperationHandler;

beforeAll(async () => {
  ({ default: BaseOperationHandler } = await import(
    '../../../../src/logic/operationHandlers/baseOperationHandler.js'
  ));
});

describe('BaseOperationHandler dependency wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires a non-empty handler name', () => {
    expect(() => new BaseOperationHandler('')).toThrow(
      'BaseOperationHandler requires a non-empty name.'
    );
    expect(() => new BaseOperationHandler('   ')).toThrow(
      'BaseOperationHandler requires a non-empty name.'
    );
    expect(initHandlerLogger).not.toHaveBeenCalled();
    expect(validateServiceDeps).not.toHaveBeenCalled();
  });

  it('initialises the scoped logger and normalises dependency specs', () => {
    const scopedLogger = { info: jest.fn() };
    initHandlerLogger.mockReturnValue(scopedLogger);

    const rawLogger = { debug: jest.fn() };
    const tracker = { record: jest.fn() };

    const deps = {
      logger: { value: rawLogger },
      tracker: { value: tracker },
      passthrough: 'raw-value',
    };

    const handler = new BaseOperationHandler('InventoryHandler', deps);

    expect(initHandlerLogger).toHaveBeenCalledWith(
      'InventoryHandler',
      rawLogger,
      deps
    );
    expect(validateServiceDeps).toHaveBeenCalledWith(
      'InventoryHandler',
      scopedLogger,
      deps
    );
    expect(handler.logger).toBe(scopedLogger);
    expect(handler.deps).toEqual({
      logger: rawLogger,
      tracker,
      passthrough: 'raw-value',
    });
  });

  it('supports direct logger injections and resolves execution-scoped loggers', () => {
    const scopedLogger = { info: jest.fn() };
    initHandlerLogger.mockReturnValue(scopedLogger);

    const rawLogger = { debug: jest.fn() };
    const handler = new BaseOperationHandler('ContextualHandler', {
      logger: rawLogger,
      other: { value: 42 },
    });

    resolveExecutionLogger
      .mockReturnValueOnce(scopedLogger)
      .mockReturnValueOnce({ context: 'logger' });

    const defaultResult = handler.getLogger();
    expect(resolveExecutionLogger).toHaveBeenNthCalledWith(
      1,
      scopedLogger,
      undefined
    );
    expect(defaultResult).toBe(scopedLogger);

    const executionContext = { logger: { debug: jest.fn() } };
    const contextualResult = handler.getLogger(executionContext);
    expect(resolveExecutionLogger).toHaveBeenLastCalledWith(
      scopedLogger,
      executionContext
    );
    expect(contextualResult).toEqual({ context: 'logger' });

    expect(handler.deps).toEqual({ logger: rawLogger, other: 42 });
  });

  it('handles missing dependency maps by exposing an empty dependency object', () => {
    initHandlerLogger.mockReturnValueOnce('scoped-logger');

    const handler = new BaseOperationHandler('MinimalHandler');

    expect(initHandlerLogger).toHaveBeenCalledWith(
      'MinimalHandler',
      undefined,
      undefined
    );
    expect(validateServiceDeps).toHaveBeenCalledWith(
      'MinimalHandler',
      'scoped-logger',
      undefined
    );
    expect(handler.deps).toEqual({});
    expect(handler.logger).toBe('scoped-logger');
  });
});
