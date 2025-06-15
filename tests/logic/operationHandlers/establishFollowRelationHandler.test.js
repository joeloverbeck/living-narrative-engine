/**
 * @file Tests for EstablishFollowRelationHandler.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import EstablishFollowRelationHandler from '../../../src/logic/operationHandlers/establishFollowRelationHandler.js';
import { DISPLAY_ERROR_ID } from '../../../src/constants/eventIds.js';
import { FOLLOWING_COMPONENT_ID } from '../../../src/constants/componentIds.js';

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

jest.mock('../../../src/utils/followUtils.js', () => ({
  wouldCreateCycle: jest.fn(() => false),
}));
import { wouldCreateCycle } from '../../../src/utils/followUtils.js';

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

  test('adds following component and rebuilds cache', () => {
    em.getComponentData.mockReturnValue(null);
    handler.execute({ follower_id: 'A', leader_id: 'B' }, execCtx);
    expect(em.addComponent).toHaveBeenCalledWith('A', FOLLOWING_COMPONENT_ID, {
      leaderId: 'B',
    });
    expect(rebuild.execute).toHaveBeenCalledWith({ leaderIds: ['B'] }, execCtx);
  });

  test('rebuilds old and new leaders when switching', () => {
    em.getComponentData.mockReturnValue({ leaderId: 'old' });
    handler.execute({ follower_id: 'A', leader_id: 'new' }, execCtx);
    expect(rebuild.execute).toHaveBeenCalledWith(
      { leaderIds: ['new', 'old'] },
      execCtx
    );
  });

  test('dispatches error on cycle', () => {
    wouldCreateCycle.mockReturnValueOnce(true);
    handler.execute({ follower_id: 'A', leader_id: 'B' }, execCtx);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      DISPLAY_ERROR_ID,
      expect.objectContaining({ message: expect.stringContaining('cycle') })
    );
    expect(em.addComponent).not.toHaveBeenCalled();
  });

  test('validates parameters', () => {
    handler.execute({}, execCtx);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      DISPLAY_ERROR_ID,
      expect.objectContaining({
        message: expect.stringContaining('follower_id'),
      })
    );
  });
});
