/**
 * @file Tests for EstablishFollowRelationHandler.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import EstablishFollowRelationHandler from '../../../../src/logic/operationHandlers/establishFollowRelationHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';
import { FOLLOWING_COMPONENT_ID } from '../../../../src/constants/componentIds.js';

const makeMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});
const makeMockEntityManager = () => ({
  addComponent: jest.fn(),
  getComponentData: jest.fn(),
});
const makeMockDispatcher = () => ({ dispatch: jest.fn() });
const makeMockRebuild = () => ({ execute: jest.fn() });

jest.mock('../../../../src/utils/followUtils.js', () => ({
  wouldCreateCycle: jest.fn(() => false),
}));
import { wouldCreateCycle } from '../../../../src/utils/followUtils.js';

describe('EstablishFollowRelationHandler', () => {
  let logger;
  let em;
  let dispatcher;
  let rebuild;
  let handler;
  let execCtx;

  beforeEach(() => {
    logger = makeMockLogger();
    em = makeMockEntityManager();
    dispatcher = makeMockDispatcher();
    rebuild = makeMockRebuild();
    handler = new EstablishFollowRelationHandler({
      logger,
      entityManager: em,
      rebuildLeaderListCacheHandler: rebuild,
      safeEventDispatcher: dispatcher,
    });
    execCtx = { logger };
    jest.clearAllMocks();
  });

  test('adds following component and rebuilds cache', async () => {
    em.getComponentData.mockReturnValue(null);
    await handler.execute({ follower_id: 'A', leader_id: 'B' }, execCtx);
    expect(em.addComponent).toHaveBeenCalledWith('A', FOLLOWING_COMPONENT_ID, {
      leaderId: 'B',
    });
    expect(rebuild.execute).toHaveBeenCalledWith({ leaderIds: ['B'] }, execCtx);
  });

  test('rebuilds old and new leaders when switching', async () => {
    em.getComponentData.mockReturnValue({ leaderId: 'old' });
    await handler.execute({ follower_id: 'A', leader_id: 'new' }, execCtx);
    expect(rebuild.execute).toHaveBeenCalledWith(
      { leaderIds: ['new', 'old'] },
      execCtx
    );
  });

  test('dispatches error on cycle', async () => {
    wouldCreateCycle.mockReturnValueOnce(true);
    await handler.execute({ follower_id: 'A', leader_id: 'B' }, execCtx);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({ message: expect.stringContaining('cycle') })
    );
    expect(em.addComponent).not.toHaveBeenCalled();
  });

  test('validates parameters', async () => {
    await handler.execute({}, execCtx);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('follower_id'),
      })
    );
  });

  test('returns early when params are missing', async () => {
    await handler.execute(null, execCtx);
    expect(logger.warn).toHaveBeenCalledWith(
      'ESTABLISH_FOLLOW_RELATION: params missing or invalid.',
      { params: null }
    );
    expect(em.addComponent).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  test('dispatches error when leader id is invalid', async () => {
    await handler.execute({ follower_id: 'A', leader_id: '' }, execCtx);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('leader_id'),
      })
    );
    expect(em.addComponent).not.toHaveBeenCalled();
  });

  test('dispatches error when updating follower component fails', async () => {
    const error = new Error('nope');
    em.addComponent.mockRejectedValueOnce(error);
    await handler.execute({ follower_id: 'A', leader_id: 'B' }, execCtx);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('Failed updating follower component'),
        details: expect.objectContaining({
          error: error.message,
          follower_id: 'A',
          leader_id: 'B',
        }),
      })
    );
    expect(rebuild.execute).not.toHaveBeenCalled();
  });
});
