/**
 * @file Tests for BreakFollowRelationHandler.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import BreakFollowRelationHandler from '../../../../src/logic/operationHandlers/breakFollowRelationHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';
import { FOLLOWING_COMPONENT_ID } from '../../../../src/constants/componentIds.js';

const makeMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});
const makeMockEntityManager = () => ({
  removeComponent: jest.fn(),
  getComponentData: jest.fn(),
});
const makeMockDispatcher = () => ({ dispatch: jest.fn() });
const makeMockRebuild = () => ({ execute: jest.fn() });

describe('BreakFollowRelationHandler', () => {
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
    handler = new BreakFollowRelationHandler({
      logger,
      entityManager: em,
      rebuildLeaderListCacheHandler: rebuild,
      safeEventDispatcher: dispatcher,
    });
    execCtx = { logger };
    jest.clearAllMocks();
  });

  test('removes following component and rebuilds old leader', () => {
    em.getComponentData.mockReturnValue({ leaderId: 'L1' });
    handler.execute({ follower_id: 'A' }, execCtx);
    expect(em.removeComponent).toHaveBeenCalledWith(
      'A',
      FOLLOWING_COMPONENT_ID
    );
    expect(rebuild.execute).toHaveBeenCalledWith(
      { leaderIds: ['L1'] },
      execCtx
    );
  });

  test('skips when not following', () => {
    em.getComponentData.mockReturnValue(null);
    handler.execute({ follower_id: 'A' }, execCtx);
    expect(em.removeComponent).not.toHaveBeenCalled();
    expect(rebuild.execute).not.toHaveBeenCalled();
  });

  test('validates parameters', () => {
    handler.execute({}, execCtx);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('follower_id'),
      })
    );
  });
});
