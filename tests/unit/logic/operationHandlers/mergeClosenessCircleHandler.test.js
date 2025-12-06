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
const makeClosenessCircleService = () => ({
  merge: jest.fn((...arrays) => {
    const flattened = arrays.flat();
    return [...new Set(flattened)];
  }),
});

describe('MergeClosenessCircleHandler', () => {
  let logger;
  let dispatcher;
  let em;
  let handler;
  let execCtx;
  let closenessCircleService;

  beforeEach(() => {
    logger = makeLogger();
    dispatcher = makeDispatcher();
    closenessCircleService = makeClosenessCircleService();
    em = {
      getComponentData: jest.fn(() => ({ locked: false })),
      addComponent: jest.fn(),
    };
    handler = new MergeClosenessCircleHandler({
      logger,
      entityManager: em,
      safeEventDispatcher: dispatcher,
      closenessCircleService,
    });
    execCtx = { logger, evaluationContext: { context: {} } };
    jest.clearAllMocks();
  });

  test('forms new circle (movement lock no longer applied)', async () => {
    em.getComponentData
      .mockReturnValueOnce(null) // actor closeness
      .mockReturnValueOnce(null); // target closeness

    await handler.execute({ actor_id: 'a1', target_id: 't1' }, execCtx);

    expect(em.addComponent).toHaveBeenCalledWith(
      'a1',
      'positioning:closeness',
      {
        partners: ['t1'],
      }
    );
    expect(em.addComponent).toHaveBeenCalledWith(
      't1',
      'positioning:closeness',
      {
        partners: ['a1'],
      }
    );
    // Movement lock no longer applied when establishing closeness
  });

  test('forms new circle and locks movement on anatomy-based entities', async () => {
    em.getComponentData = jest.fn((id, componentId) => {
      // Actor closeness check
      if (id === 'hero1' && componentId === 'positioning:closeness')
        return null;
      // Target closeness check
      if (id === 'hero2' && componentId === 'positioning:closeness')
        return null;
      // Anatomy structure for hero1
      if (id === 'hero1' && componentId === 'anatomy:body') {
        return {
          body: {
            root: 'body1',
            parts: {
              torso: 'body1',
              leg_left: 'left-leg1',
              leg_right: 'right-leg1',
            },
          },
        };
      }
      if (id === 'left-leg1' && componentId === 'core:movement') {
        return { locked: false, forcedOverride: false };
      }
      if (id === 'right-leg1' && componentId === 'core:movement') {
        return { locked: false, forcedOverride: false };
      }
      // Anatomy structure for hero2
      if (id === 'hero2' && componentId === 'anatomy:body') {
        return {
          body: {
            root: 'body2',
            parts: {
              torso: 'body2',
              leg_left: 'left-leg2',
              leg_right: 'right-leg2',
            },
          },
        };
      }
      if (id === 'left-leg2' && componentId === 'core:movement') {
        return { locked: false, forcedOverride: false };
      }
      if (id === 'right-leg2' && componentId === 'core:movement') {
        return { locked: false, forcedOverride: false };
      }
      return undefined;
    });

    await handler.execute({ actor_id: 'hero1', target_id: 'hero2' }, execCtx);

    expect(em.addComponent).toHaveBeenCalledWith(
      'hero1',
      'positioning:closeness',
      {
        partners: ['hero2'],
      }
    );
    expect(em.addComponent).toHaveBeenCalledWith(
      'hero2',
      'positioning:closeness',
      {
        partners: ['hero1'],
      }
    );
    // Movement lock no longer applied when establishing closeness
  });

  test('stores result variable when provided', async () => {
    em.getComponentData = jest.fn((id, componentId) => {
      if (componentId === 'positioning:closeness') return null;
      if (componentId === 'anatomy:body') return null;
      if (componentId === 'core:movement') return { locked: false };
      return null;
    });

    await handler.execute(
      { actor_id: 'a', target_id: 'b', result_variable: 'affected' },
      execCtx
    );

    expect(execCtx.evaluationContext.context.affected.sort()).toEqual([
      'a',
      'b',
    ]);
  });

  test('handles mixed legacy and anatomy entities', async () => {
    em.getComponentData = jest.fn((id, componentId) => {
      // Legacy entity 'a1' has no anatomy
      if (id === 'a1' && componentId === 'positioning:closeness') return null;
      if (id === 'a1' && componentId === 'anatomy:body') return null;
      if (id === 'a1' && componentId === 'core:movement') {
        return { locked: false };
      }
      // Anatomy entity 'hero1'
      if (id === 'hero1' && componentId === 'positioning:closeness')
        return null;
      if (id === 'hero1' && componentId === 'anatomy:body') {
        return {
          body: {
            root: 'body1',
            parts: {
              torso: 'body1',
              leg_left: 'left-leg1',
            },
          },
        };
      }
      if (id === 'left-leg1' && componentId === 'core:movement') {
        return { locked: false, forcedOverride: false };
      }
      return undefined;
    });

    await handler.execute({ actor_id: 'a1', target_id: 'hero1' }, execCtx);

    expect(em.addComponent).toHaveBeenCalledWith(
      'a1',
      'positioning:closeness',
      {
        partners: ['hero1'],
      }
    );
    expect(em.addComponent).toHaveBeenCalledWith(
      'hero1',
      'positioning:closeness',
      {
        partners: ['a1'],
      }
    );
    // Movement lock no longer applied when establishing closeness
  });

  test('validates parameters - missing actor_id', async () => {
    await handler.execute({}, execCtx);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({ message: expect.stringContaining('actor_id') })
    );
  });

  test('validates parameters - invalid target_id', async () => {
    await handler.execute({ actor_id: 'valid_actor', target_id: '' }, execCtx);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({ message: expect.stringContaining('target_id') })
    );
  });

  test('validates parameters - target_id not a string', async () => {
    await handler.execute({ actor_id: 'valid_actor', target_id: 123 }, execCtx);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({ message: expect.stringContaining('target_id') })
    );
  });

  test('validates parameters - invalid result_variable as empty string', async () => {
    await handler.execute(
      {
        actor_id: 'valid_actor',
        target_id: 'valid_target',
        result_variable: '',
      },
      execCtx
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('result_variable'),
      })
    );
  });

  test('validates parameters - invalid result_variable as non-string', async () => {
    await handler.execute(
      {
        actor_id: 'valid_actor',
        target_id: 'valid_target',
        result_variable: 123,
      },
      execCtx
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('result_variable'),
      })
    );
  });

  test('handles addComponent error during partner update', async () => {
    em.getComponentData = jest.fn(() => null);
    em.addComponent = jest
      .fn()
      .mockRejectedValueOnce(new Error('Component update failed'));

    await handler.execute({ actor_id: 'a1', target_id: 't1' }, execCtx);

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('failed updating closeness'),
        details: expect.objectContaining({
          error: 'Component update failed',
        }),
      })
    );
  });

  test('handles invalid evaluation context when result_variable provided', async () => {
    em.getComponentData = jest.fn(() => null);

    // Create context without evaluationContext to trigger the error
    const invalidExecCtx = { logger };

    await handler.execute(
      {
        actor_id: 'a1',
        target_id: 't1',
        result_variable: 'test_var',
      },
      invalidExecCtx
    );

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('evaluationContext'),
        details: expect.any(Object),
      })
    );
  });

  test('handles null params and non-array partners', async () => {
    // Test null params destructuring fallback (line 70)
    await handler.execute(null, execCtx);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({ message: expect.stringContaining('actor_id') })
    );

    jest.clearAllMocks();

    // Test non-array partners fallback (lines 130-131)
    em.getComponentData = jest.fn((id, componentId) => {
      if (componentId === 'positioning:closeness') {
        // Return object with partners as non-array to test fallback
        return { partners: 'not-an-array' };
      }
      if (componentId === 'anatomy:body') return null;
      if (componentId === 'core:movement') return { locked: false };
      return null;
    });

    await handler.execute({ actor_id: 'a1', target_id: 't1' }, execCtx);

    // Verify the merge was called with empty arrays as fallback
    expect(closenessCircleService.merge).toHaveBeenCalledWith(
      ['a1', 't1'],
      [], // Should be empty array due to fallback
      [] // Should be empty array due to fallback
    );
  });
});
