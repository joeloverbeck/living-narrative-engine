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

  test('forms new circle and locks movement on legacy entities', async () => {
    em.getComponentData
      .mockReturnValueOnce(null) // actor closeness
      .mockReturnValueOnce(null) // target closeness
      .mockReturnValueOnce(null) // actor anatomy:body
      .mockReturnValueOnce({ locked: false }) // actor movement
      .mockReturnValueOnce(null) // target anatomy:body
      .mockReturnValueOnce({ locked: false }); // target movement

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

  test('forms new circle and locks movement on anatomy-based entities', async () => {
    em.getComponentData = jest.fn((id, componentId) => {
      // Actor closeness check
      if (id === 'hero1' && componentId === 'intimacy:closeness') return null;
      // Target closeness check
      if (id === 'hero2' && componentId === 'intimacy:closeness') return null;
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
      'intimacy:closeness',
      {
        partners: ['hero2'],
      }
    );
    expect(em.addComponent).toHaveBeenCalledWith(
      'hero2',
      'intimacy:closeness',
      {
        partners: ['hero1'],
      }
    );
    // Movement locked on body parts
    expect(em.addComponent).toHaveBeenCalledWith('left-leg1', 'core:movement', {
      locked: true,
      forcedOverride: false,
    });
    expect(em.addComponent).toHaveBeenCalledWith(
      'right-leg1',
      'core:movement',
      {
        locked: true,
        forcedOverride: false,
      }
    );
    expect(em.addComponent).toHaveBeenCalledWith('left-leg2', 'core:movement', {
      locked: true,
      forcedOverride: false,
    });
    expect(em.addComponent).toHaveBeenCalledWith(
      'right-leg2',
      'core:movement',
      {
        locked: true,
        forcedOverride: false,
      }
    );
  });

  test('stores result variable when provided', async () => {
    em.getComponentData = jest.fn((id, componentId) => {
      if (componentId === 'intimacy:closeness') return null;
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
      if (id === 'a1' && componentId === 'intimacy:closeness') return null;
      if (id === 'a1' && componentId === 'anatomy:body') return null;
      if (id === 'a1' && componentId === 'core:movement') {
        return { locked: false };
      }
      // Anatomy entity 'hero1'
      if (id === 'hero1' && componentId === 'intimacy:closeness') return null;
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

    expect(em.addComponent).toHaveBeenCalledWith('a1', 'intimacy:closeness', {
      partners: ['hero1'],
    });
    expect(em.addComponent).toHaveBeenCalledWith(
      'hero1',
      'intimacy:closeness',
      {
        partners: ['a1'],
      }
    );
    // Legacy entity movement locked directly
    expect(em.addComponent).toHaveBeenCalledWith('a1', 'core:movement', {
      locked: true,
    });
    // Anatomy entity movement locked on body part
    expect(em.addComponent).toHaveBeenCalledWith('left-leg1', 'core:movement', {
      locked: true,
      forcedOverride: false,
    });
  });

  test('validates parameters', async () => {
    await handler.execute({}, execCtx);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({ message: expect.stringContaining('actor_id') })
    );
  });
});
