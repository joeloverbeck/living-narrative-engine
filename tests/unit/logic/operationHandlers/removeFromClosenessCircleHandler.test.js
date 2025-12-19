import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import RemoveFromClosenessCircleHandler from '../../../../src/logic/operationHandlers/removeFromClosenessCircleHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';

const makeLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeDispatcher = () => ({ dispatch: jest.fn() });

const makeClosenessCircleService = () => ({
  repair: jest.fn((partners) => {
    if (!Array.isArray(partners)) return [];
    const uniquePartners = [...new Set(partners)];
    return uniquePartners.sort();
  }),
});

const makeEntityManager = (store) => ({
  getComponentData: jest.fn((id, type) => store[id]?.[type] ?? null),
  addComponent: jest.fn((id, type, data) => {
    if (!store[id]) store[id] = {};
    store[id][type] = JSON.parse(JSON.stringify(data));
    return true;
  }),
  removeComponent: jest.fn((id, type) => {
    if (store[id]) delete store[id][type];
    return true;
  }),
});

describe('RemoveFromClosenessCircleHandler', () => {
  let logger;
  let dispatcher;
  let store;
  let em;
  let handler;
  let execCtx;
  let closenessCircleService;

  beforeEach(() => {
    logger = makeLogger();
    dispatcher = makeDispatcher();
    closenessCircleService = makeClosenessCircleService();
    store = {};
    em = makeEntityManager(store);
    handler = new RemoveFromClosenessCircleHandler({
      logger,
      entityManager: em,
      safeEventDispatcher: dispatcher,
      closenessCircleService,
    });
    execCtx = { logger, evaluationContext: { context: {} } };
  });

  test('validates parameters', async () => {
    await handler.execute({}, execCtx);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({ message: expect.stringContaining('actor_id') })
    );
  });

  test('removes actor from circle and unlocks movement on legacy entities', async () => {
    store = {
      actor: {
        'personal-space-states:closeness': { partners: ['p1', 'p2'] },
        'core:movement': { locked: true },
      },
      p1: {
        'personal-space-states:closeness': { partners: ['actor', 'p2'] },
        'core:movement': { locked: true },
      },
      p2: {
        'personal-space-states:closeness': { partners: ['actor', 'p1'] },
        'core:movement': { locked: true },
      },
    };
    em = makeEntityManager(store);
    // Mock anatomy checks to return null (legacy entities)
    const originalGetComponentData = em.getComponentData;
    em.getComponentData = jest.fn((id, type) => {
      if (type === 'anatomy:body') return null;
      return originalGetComponentData(id, type);
    });
    handler = new RemoveFromClosenessCircleHandler({
      logger,
      entityManager: em,
      safeEventDispatcher: dispatcher,
      closenessCircleService,
    });
    execCtx = { logger, evaluationContext: { context: {} } };

    await handler.execute(
      { actor_id: 'actor', result_variable: 'remain' },
      execCtx
    );

    expect(store.actor['personal-space-states:closeness']).toBeUndefined();
    expect(store.actor['core:movement']).toEqual({ locked: false });
    expect(store.p1['personal-space-states:closeness']).toEqual({ partners: ['p2'] });
    expect(store.p2['personal-space-states:closeness']).toEqual({ partners: ['p1'] });
    expect(execCtx.evaluationContext.context.remain).toEqual(['p1', 'p2']);
  });

  test('removes actor from circle and unlocks movement on anatomy-based entities', async () => {
    // Create complex mock for anatomy entities
    const mockGetComponentData = jest.fn((id, componentId) => {
      // Hero1 setup
      if (id === 'hero1' && componentId === 'personal-space-states:closeness') {
        return { partners: ['hero2', 'hero3'] };
      }
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
        return { locked: true, forcedOverride: false };
      }
      if (id === 'right-leg1' && componentId === 'core:movement') {
        return { locked: true, forcedOverride: false };
      }
      // Hero2 setup
      if (id === 'hero2' && componentId === 'personal-space-states:closeness') {
        return { partners: ['hero1', 'hero3'] };
      }
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
        return { locked: true, forcedOverride: false };
      }
      if (id === 'right-leg2' && componentId === 'core:movement') {
        return { locked: true, forcedOverride: false };
      }
      // Hero3 setup
      if (id === 'hero3' && componentId === 'personal-space-states:closeness') {
        return { partners: ['hero1', 'hero2'] };
      }
      if (id === 'hero3' && componentId === 'anatomy:body') {
        return {
          body: {
            root: 'body3',
            parts: {
              torso: 'body3',
              leg_left: 'left-leg3',
              leg_right: 'right-leg3',
            },
          },
        };
      }
      if (id === 'left-leg3' && componentId === 'core:movement') {
        return { locked: true, forcedOverride: false };
      }
      if (id === 'right-leg3' && componentId === 'core:movement') {
        return { locked: true, forcedOverride: false };
      }
      return undefined;
    });

    const mockAddComponent = jest.fn();
    const mockRemoveComponent = jest.fn();

    em = {
      getComponentData: mockGetComponentData,
      addComponent: mockAddComponent,
      removeComponent: mockRemoveComponent,
    };

    handler = new RemoveFromClosenessCircleHandler({
      logger,
      entityManager: em,
      safeEventDispatcher: dispatcher,
      closenessCircleService,
    });
    execCtx = { logger, evaluationContext: { context: {} } };

    await handler.execute(
      { actor_id: 'hero1', result_variable: 'remain' },
      execCtx
    );

    // Check hero1 closeness removed
    expect(mockRemoveComponent).toHaveBeenCalledWith(
      'hero1',
      'personal-space-states:closeness'
    );

    // Check hero1's body parts movement unlocked
    expect(mockAddComponent).toHaveBeenCalledWith(
      'left-leg1',
      'core:movement',
      {
        locked: false,
        forcedOverride: false,
      }
    );
    expect(mockAddComponent).toHaveBeenCalledWith(
      'right-leg1',
      'core:movement',
      {
        locked: false,
        forcedOverride: false,
      }
    );

    // Check other heroes' closeness updated
    expect(mockAddComponent).toHaveBeenCalledWith(
      'hero2',
      'personal-space-states:closeness',
      {
        partners: ['hero3'],
      }
    );
    expect(mockAddComponent).toHaveBeenCalledWith(
      'hero3',
      'personal-space-states:closeness',
      {
        partners: ['hero2'],
      }
    );

    expect(execCtx.evaluationContext.context.remain).toEqual([
      'hero2',
      'hero3',
    ]);
  });

  test('removes partner component when last member', async () => {
    store = {
      actor: { 'personal-space-states:closeness': { partners: ['p1'] } },
      p1: {
        'personal-space-states:closeness': { partners: ['actor'] },
        'core:movement': { locked: true },
      },
    };
    em = makeEntityManager(store);
    // Mock anatomy checks to return null (legacy entities)
    const originalGetComponentData = em.getComponentData;
    em.getComponentData = jest.fn((id, type) => {
      if (type === 'anatomy:body') return null;
      return originalGetComponentData(id, type);
    });
    handler = new RemoveFromClosenessCircleHandler({
      logger,
      entityManager: em,
      safeEventDispatcher: dispatcher,
      closenessCircleService,
    });
    execCtx = { logger, evaluationContext: { context: {} } };

    await handler.execute({ actor_id: 'actor' }, execCtx);

    expect(store.actor['personal-space-states:closeness']).toBeUndefined();
    expect(store.p1['personal-space-states:closeness']).toBeUndefined();
    expect(store.p1['core:movement']).toEqual({ locked: false });
  });

  test('handles mixed legacy and anatomy entities when removing', async () => {
    const mockGetComponentData = jest.fn((id, componentId) => {
      // Legacy entity 'legacy1'
      if (id === 'legacy1' && componentId === 'personal-space-states:closeness') {
        return { partners: ['hero1'] };
      }
      if (id === 'legacy1' && componentId === 'anatomy:body') return null;
      if (id === 'legacy1' && componentId === 'core:movement') {
        return { locked: true };
      }
      // Anatomy entity 'hero1'
      if (id === 'hero1' && componentId === 'personal-space-states:closeness') {
        return { partners: ['legacy1'] };
      }
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
        return { locked: true, forcedOverride: false };
      }
      return undefined;
    });

    const mockAddComponent = jest.fn();
    const mockRemoveComponent = jest.fn();

    em = {
      getComponentData: mockGetComponentData,
      addComponent: mockAddComponent,
      removeComponent: mockRemoveComponent,
    };

    handler = new RemoveFromClosenessCircleHandler({
      logger,
      entityManager: em,
      safeEventDispatcher: dispatcher,
      closenessCircleService,
    });
    execCtx = { logger, evaluationContext: { context: {} } };

    await handler.execute({ actor_id: 'legacy1' }, execCtx);

    // Check legacy1 closeness removed and movement unlocked
    expect(mockRemoveComponent).toHaveBeenCalledWith(
      'legacy1',
      'personal-space-states:closeness'
    );
    expect(mockAddComponent).toHaveBeenCalledWith('legacy1', 'core:movement', {
      locked: false,
    });

    // Check hero1 closeness removed and body part movement unlocked
    expect(mockRemoveComponent).toHaveBeenCalledWith(
      'hero1',
      'personal-space-states:closeness'
    );
    expect(mockAddComponent).toHaveBeenCalledWith(
      'left-leg1',
      'core:movement',
      {
        locked: false,
        forcedOverride: false,
      }
    );
  });
});
