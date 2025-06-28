import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { safeDispatchError } from '../../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn((dispatcher, message, details) => {
    dispatcher.dispatch('core:system_error_occurred', { message, details });
  }),
}));

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
  safeDispatchError.mockClear();
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

  test('logs error when perceptible_event dispatch rejects', async () => {
    entityManager.getComponentData.mockImplementation((id, comp) => {
      if (id === 'leader' && comp === LEADING_COMPONENT_ID)
        return { followers: ['f1'] };
      if (id === 'f1' && comp === POSITION_COMPONENT_ID)
        return { locationId: 'oldLoc' };
      return null;
    });

    dispatcher.dispatch
      .mockRejectedValueOnce(new Error('fail1'))
      .mockResolvedValueOnce(true);

    const ctx = {
      logger,
      event: { payload: { previousLocationId: 'oldLoc' } },
    };

    handler.execute({ leader_id: 'leader', destination_id: 'dest' }, ctx);
    await new Promise((r) => setTimeout(r, 0));

    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'AUTO_MOVE_FOLLOWERS: Error moving follower',
      expect.objectContaining({ error: 'fail1', followerId: 'f1' }),
      logger
    );
    expect(safeDispatchError).toHaveBeenCalledTimes(1);
  });

  test('logs error when success message dispatch rejects', async () => {
    entityManager.getComponentData.mockImplementation((id, comp) => {
      if (id === 'leader' && comp === LEADING_COMPONENT_ID)
        return { followers: ['f1'] };
      if (id === 'f1' && comp === POSITION_COMPONENT_ID)
        return { locationId: 'oldLoc' };
      return null;
    });

    dispatcher.dispatch
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('fail2'));

    const ctx = {
      logger,
      event: { payload: { previousLocationId: 'oldLoc' } },
    };

    handler.execute({ leader_id: 'leader', destination_id: 'dest' }, ctx);
    await new Promise((r) => setTimeout(r, 0));

    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'AUTO_MOVE_FOLLOWERS: Error moving follower',
      expect.objectContaining({ error: 'fail2', followerId: 'f1' }),
      logger
    );
    expect(safeDispatchError).toHaveBeenCalledTimes(1);
  });

  test('dispatches error when destination_id is invalid', () => {
    handler.execute({ leader_id: 'leader', destination_id: '' }, {});
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('destination_id'),
      })
    );
    expect(moveHandler.execute).not.toHaveBeenCalled();
  });

  test('skips follower if previous location does not match', () => {
    entityManager.getComponentData.mockImplementation((id, comp) => {
      if (id === 'leader' && comp === LEADING_COMPONENT_ID)
        return { followers: ['f1'] };
      if (id === 'f1' && comp === POSITION_COMPONENT_ID)
        return { locationId: 'wrongLoc' };
      return null;
    });

    const ctx = {
      logger,
      event: { payload: { previousLocationId: 'oldLoc' } },
    };

    handler.execute({ leader_id: 'leader', destination_id: 'dest' }, ctx);

    expect(moveHandler.execute).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  test('handles non-promise dispatch results', async () => {
    entityManager.getComponentData.mockImplementation((id, comp) => {
      if (id === 'leader' && comp === LEADING_COMPONENT_ID)
        return { followers: ['f1'] };
      if (id === 'f1' && comp === POSITION_COMPONENT_ID)
        return { locationId: 'oldLoc' };
      return null;
    });

    dispatcher.dispatch.mockReturnValueOnce(undefined).mockReturnValueOnce(42);

    const ctx = {
      logger,
      event: { payload: { previousLocationId: 'oldLoc' } },
    };

    handler.execute({ leader_id: 'leader', destination_id: 'dest' }, ctx);
    await new Promise((r) => setTimeout(r, 0));

    expect(safeDispatchError).not.toHaveBeenCalled();
  });

  test('handles errors thrown by move handler', async () => {
    entityManager.getComponentData.mockImplementation((id, comp) => {
      if (id === 'leader' && comp === LEADING_COMPONENT_ID)
        return { followers: ['f1'] };
      if (id === 'f1' && comp === POSITION_COMPONENT_ID)
        return { locationId: 'oldLoc' };
      return null;
    });

    moveHandler.execute.mockImplementation(() => {
      throw new Error('move fail');
    });

    const ctx = {
      logger,
      event: { payload: { previousLocationId: 'oldLoc' } },
    };

    handler.execute({ leader_id: 'leader', destination_id: 'dest' }, ctx);
    await new Promise((r) => setTimeout(r, 0));

    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'AUTO_MOVE_FOLLOWERS: Error moving follower',
      expect.objectContaining({ error: 'move fail', followerId: 'f1' }),
      logger
    );
  });
});
