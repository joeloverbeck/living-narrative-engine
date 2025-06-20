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

  beforeEach(() => {
    logger = makeLogger();
    dispatcher = makeDispatcher();
    store = {};
    em = makeEntityManager(store);
    handler = new RemoveFromClosenessCircleHandler({
      logger,
      entityManager: em,
      safeEventDispatcher: dispatcher,
    });
    execCtx = { logger, evaluationContext: { context: {} } };
  });

  test('validates parameters', () => {
    handler.execute({}, execCtx);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({ message: expect.stringContaining('actor_id') })
    );
  });

  test('removes actor from circle and unlocks movement', () => {
    store = {
      actor: {
        'intimacy:closeness': { partners: ['p1', 'p2'] },
        'core:movement': { locked: true },
      },
      p1: {
        'intimacy:closeness': { partners: ['actor', 'p2'] },
        'core:movement': { locked: true },
      },
      p2: {
        'intimacy:closeness': { partners: ['actor', 'p1'] },
        'core:movement': { locked: true },
      },
    };
    em = makeEntityManager(store);
    handler = new RemoveFromClosenessCircleHandler({
      logger,
      entityManager: em,
      safeEventDispatcher: dispatcher,
    });
    execCtx = { logger, evaluationContext: { context: {} } };

    handler.execute({ actor_id: 'actor', result_variable: 'remain' }, execCtx);

    expect(store.actor['intimacy:closeness']).toBeUndefined();
    expect(store.actor['core:movement']).toEqual({ locked: false });
    expect(store.p1['intimacy:closeness']).toEqual({ partners: ['p2'] });
    expect(store.p2['intimacy:closeness']).toEqual({ partners: ['p1'] });
    expect(execCtx.evaluationContext.context.remain).toEqual(['p1', 'p2']);
  });

  test('removes partner component when last member', () => {
    store = {
      actor: { 'intimacy:closeness': { partners: ['p1'] } },
      p1: {
        'intimacy:closeness': { partners: ['actor'] },
        'core:movement': { locked: true },
      },
    };
    em = makeEntityManager(store);
    handler = new RemoveFromClosenessCircleHandler({
      logger,
      entityManager: em,
      safeEventDispatcher: dispatcher,
    });
    execCtx = { logger, evaluationContext: { context: {} } };

    handler.execute({ actor_id: 'actor' }, execCtx);

    expect(store.actor['intimacy:closeness']).toBeUndefined();
    expect(store.p1['intimacy:closeness']).toBeUndefined();
    expect(store.p1['core:movement']).toEqual({ locked: false });
  });
});
