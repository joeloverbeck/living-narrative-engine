import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import AutoMoveFollowersHandler from '../../../../src/logic/operationHandlers/autoMoveFollowersHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';
import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  LEADING_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

// Mocks
let entityManager;
let moveHandler;
let dispatcher;
let logger;
let handler;

beforeEach(() => {
  entityManager = {
    getEntitiesWithComponent: jest.fn(),
    getComponentData: jest.fn(),
  };
  moveHandler = { execute: jest.fn() };
  dispatcher = { dispatch: jest.fn() };
  logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  handler = new AutoMoveFollowersHandler({
    logger,
    entityManager,
    systemMoveEntityHandler: moveHandler,
    safeEventDispatcher: dispatcher,
  });
});

describe('AutoMoveFollowersHandler.execute', () => {
  test('dispatches error when leader_id is invalid', () => {
    handler.execute({ leader_id: '', destination_id: 'dest' }, {});
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({ message: expect.stringContaining('leader_id') })
    );
    expect(moveHandler.execute).not.toHaveBeenCalled();
  });

  test('moves followers and dispatches events', () => {
    entityManager.getComponentData.mockImplementation((id, comp) => {
      if (id === 'leader' && comp === LEADING_COMPONENT_ID)
        return { followers: ['f1'] };
      if (id === 'f1' && comp === POSITION_COMPONENT_ID)
        return { locationId: 'oldLoc' };
      if (id === 'f1' && comp === NAME_COMPONENT_ID)
        return { text: 'Follower' };
      if (id === 'leader' && comp === NAME_COMPONENT_ID)
        return { text: 'Leader' };
      if (id === 'dest' && comp === NAME_COMPONENT_ID)
        return { text: 'Destination' };
      return null;
    });

    const ctx = {
      logger,
      event: { payload: { previousLocationId: 'oldLoc' } },
    };

    handler.execute({ leader_id: 'leader', destination_id: 'dest' }, ctx);

    expect(moveHandler.execute).toHaveBeenCalledWith(
      { entity_ref: { entityId: 'f1' }, target_location_id: 'dest' },
      ctx
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:perceptible_event',
      expect.objectContaining({ actorId: 'f1', targetId: 'leader' })
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:display_successful_action_result',
      expect.objectContaining({ message: expect.any(String) })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('moved 1 follower')
    );
  });
});
