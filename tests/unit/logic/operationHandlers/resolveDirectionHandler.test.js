import ResolveDirectionHandler from '../../../../src/logic/operationHandlers/resolveDirectionHandler.js';
import { EXITS_COMPONENT_ID } from '../../../../src/constants/componentIds.js';
import { tryWriteContextVariable } from '../../../../src/utils/contextVariableUtils.js';
import { assertParamsObject } from '../../../../src/utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../../../src/utils/safeDispatchErrorUtils.js';
import { ensureEvaluationContext } from '../../../../src/utils/evaluationContextUtils.js';

jest.mock('../../../../src/utils/contextVariableUtils.js', () => ({
  tryWriteContextVariable: jest.fn(),
}));

jest.mock('../../../../src/utils/handlerUtils/paramsUtils.js', () => ({
  assertParamsObject: jest.fn(),
}));

jest.mock('../../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

jest.mock('../../../../src/utils/evaluationContextUtils.js', () => ({
  ensureEvaluationContext: jest.fn(),
}));

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createHandler = ({
  entityManager,
  logger,
  dispatcher,
} = {}) => {
  const handler = new ResolveDirectionHandler({
    entityManager:
      entityManager ?? {
        getComponentData: jest.fn(),
      },
    logger: logger ?? createLogger(),
    safeEventDispatcher:
      dispatcher ?? {
        dispatch: jest.fn(),
      },
  });
  return {
    handler,
    entityManager: handler.deps.entityManager,
    dispatcher: handler.deps.safeEventDispatcher,
    logger: handler.logger,
  };
};

describe('ResolveDirectionHandler', () => {
  const executionContext = { evaluationContext: { context: {} } };

  beforeEach(() => {
    jest.clearAllMocks();
    assertParamsObject.mockReturnValue(true);
    ensureEvaluationContext.mockReturnValue(executionContext.evaluationContext.context);
  });

  it('returns early when assertParamsObject fails', () => {
    const { handler, entityManager, dispatcher } = createHandler();
    assertParamsObject.mockReturnValue(false);

    handler.execute(null, executionContext);

    expect(assertParamsObject).toHaveBeenCalledWith(null, dispatcher, 'RESOLVE_DIRECTION');
    expect(entityManager.getComponentData).not.toHaveBeenCalled();
    expect(tryWriteContextVariable).not.toHaveBeenCalled();
  });

  it('dispatches error when current_location_id is invalid', () => {
    const { handler, dispatcher } = createHandler();

    handler.execute(
      {
        current_location_id: '   ',
        direction: 'north',
        result_variable: 'resultVar',
      },
      executionContext
    );

    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'RESOLVE_DIRECTION: "current_location_id" must be a non-empty string.',
      { params: expect.objectContaining({ current_location_id: '   ' }) }
    );
    expect(tryWriteContextVariable).not.toHaveBeenCalled();
  });

  it('dispatches error when direction is invalid', () => {
    const { handler, dispatcher } = createHandler();

    handler.execute(
      {
        current_location_id: 'loc-1',
        direction: '   ',
        result_variable: 'resultVar',
      },
      executionContext
    );

    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'RESOLVE_DIRECTION: "direction" must be a non-empty string.',
      { params: expect.objectContaining({ direction: '   ' }) }
    );
    expect(tryWriteContextVariable).not.toHaveBeenCalled();
  });

  it('dispatches error when result_variable is invalid', () => {
    const { handler, dispatcher } = createHandler();

    handler.execute(
      {
        current_location_id: 'loc-1',
        direction: 'north',
        result_variable: '',
      },
      executionContext
    );

    expect(safeDispatchError).toHaveBeenLastCalledWith(
      dispatcher,
      'RESOLVE_DIRECTION: "result_variable" must be a non-empty string.',
      { params: expect.objectContaining({ result_variable: '' }) }
    );
    expect(tryWriteContextVariable).not.toHaveBeenCalled();
  });

  it('returns early when ensureEvaluationContext fails', () => {
    const { handler, entityManager } = createHandler();
    ensureEvaluationContext.mockReturnValueOnce(null);

    handler.execute(
      {
        current_location_id: 'loc-1',
        direction: 'north',
        result_variable: 'resultVar',
      },
      executionContext
    );

    expect(entityManager.getComponentData).not.toHaveBeenCalled();
    expect(tryWriteContextVariable).not.toHaveBeenCalled();
  });

  it('writes null when exits component retrieval throws', () => {
    const logger = createLogger();
    const entityManager = {
      getComponentData: jest.fn(() => {
        throw new Error('boom');
      }),
    };
    const { handler } = createHandler({ entityManager, logger });

    handler.execute(
      {
        current_location_id: ' location-1 ',
        direction: 'north',
        result_variable: ' resultVar ',
      },
      executionContext
    );

    expect(entityManager.getComponentData).toHaveBeenCalledWith('location-1', EXITS_COMPONENT_ID);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Could not retrieve exits component"),
      { error: 'boom' }
    );
    expect(tryWriteContextVariable).toHaveBeenCalledWith(
      'resultVar',
      null,
      executionContext,
      undefined,
      expect.any(Object)
    );
  });

  it('stores null when exits data is not an array', () => {
    const logger = createLogger();
    const entityManager = {
      getComponentData: jest.fn().mockReturnValue(null),
    };
    const { handler } = createHandler({ entityManager, logger });

    handler.execute(
      {
        current_location_id: 'loc-1',
        direction: 'north',
        result_variable: 'resultVar',
      },
      executionContext
    );

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("has no exits array")
    );
    expect(tryWriteContextVariable).toHaveBeenCalledWith(
      'resultVar',
      null,
      executionContext,
      undefined,
      expect.any(Object)
    );
  });

  it('writes matching target when exit is found', () => {
    const logger = createLogger();
    const exits = [
      { direction: 'north', target: 'loc-2' },
    ];
    const entityManager = {
      getComponentData: jest.fn().mockReturnValue(exits),
    };
    const { handler } = createHandler({ entityManager, logger });

    handler.execute(
      {
        current_location_id: ' location-1 ',
        direction: '  NoRtH  ',
        result_variable: ' resultVar ',
      },
      executionContext
    );

    expect(entityManager.getComponentData).toHaveBeenCalledWith('location-1', EXITS_COMPONENT_ID);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("leads to 'loc-2'")
    );
    expect(tryWriteContextVariable).toHaveBeenCalledWith(
      'resultVar',
      'loc-2',
      executionContext,
      undefined,
      expect.any(Object)
    );
  });

  it('writes null when matching exit has no target', () => {
    const entityManager = {
      getComponentData: jest.fn().mockReturnValue([
        { direction: 'north' },
      ]),
    };
    const logger = createLogger();
    const { handler } = createHandler({ entityManager, logger });

    handler.execute(
      {
        current_location_id: 'loc-1',
        direction: 'north',
        result_variable: 'resultVar',
      },
      executionContext
    );

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("leads to 'null'")
    );
    expect(tryWriteContextVariable).toHaveBeenCalledWith(
      'resultVar',
      null,
      executionContext,
      undefined,
      expect.any(Object)
    );
  });

  it('stores null when no exit matches direction', () => {
    const entityManager = {
      getComponentData: jest.fn().mockReturnValue([
        { direction: 'east', target: 'loc-3' },
      ]),
    };
    const logger = createLogger();
    const { handler } = createHandler({ entityManager, logger });

    handler.execute(
      {
        current_location_id: 'loc-1',
        direction: 'north',
        result_variable: 'resultVar',
      },
      executionContext
    );

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("No exit found")
    );
    expect(tryWriteContextVariable).toHaveBeenCalledWith(
      'resultVar',
      null,
      executionContext,
      undefined,
      expect.any(Object)
    );
  });
});
