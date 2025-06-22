import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import MergeClosenessCircleHandler from '../../../../src/logic/operationHandlers/mergeClosenessCircleHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});
const makeDispatcher = () => ({ dispatch: jest.fn() });

describe('MergeClosenessCircleHandler', () => {
  let logger;
  let dispatcher;
  let em;
  let handler;
  let execCtx;

  beforeEach(() => {
    logger = makeLogger();
    dispatcher = makeDispatcher();
    em = {
      getComponentData: jest.fn(() => ({ locked: false })),
      addComponent: jest.fn(),
    };
    handler = new MergeClosenessCircleHandler({
      logger,
      entityManager: em,
      safeEventDispatcher: dispatcher,
    });
    execCtx = { logger, evaluationContext: { context: {} } };
    jest.clearAllMocks();
  });

  test('forms new circle and locks movement', async () => {
    em.getComponentData
      .mockReturnValueOnce(null) // actor closeness
      .mockReturnValueOnce(null) // target closeness
      .mockReturnValue({ locked: false }); // movement

    await handler.execute({ actor_id: 'a1', target_id: 't1' }, execCtx);

    expect(em.addComponent).toHaveBeenCalledWith('a1', 'intimacy:closeness', {
      partners: ['t1'],
    });
    expect(em.addComponent).toHaveBeenCalledWith('t1', 'intimacy:closeness', {
      partners: ['a1'],
    });
    expect(em.addComponent).toHaveBeenCalledWith('a1', 'core:movement', {
      locked: true,
    });
    expect(em.addComponent).toHaveBeenCalledWith('t1', 'core:movement', {
      locked: true,
    });
  });

  test('stores result variable when provided', async () => {
    em.getComponentData.mockReturnValue(null);

    await handler.execute(
      { actor_id: 'a', target_id: 'b', result_variable: 'affected' },
      execCtx
    );

    expect(execCtx.evaluationContext.context.affected.sort()).toEqual([
      'a',
      'b',
    ]);
  });

  test('validates parameters', async () => {
    await handler.execute({}, execCtx);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({ message: expect.stringContaining('actor_id') })
    );
  });
});
