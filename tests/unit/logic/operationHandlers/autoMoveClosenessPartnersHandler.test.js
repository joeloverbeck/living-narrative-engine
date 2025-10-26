import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { safeDispatchError } from '../../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn((dispatcher, message, details) => {
    dispatcher.dispatch('core:system_error_occurred', { message, details });
  }),
}));

import AutoMoveClosenessPartnersHandler from '../../../../src/logic/operationHandlers/autoMoveClosenessPartnersHandler.js';

const POSITION_COMPONENT_ID = 'core:position';
const CLOSENESS_COMPONENT_ID = 'positioning:closeness';

// Mocks
let entityManager;
let moveHandler;
let dispatcher;
let logger;
let handler;

beforeEach(() => {
  entityManager = {
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
  handler = new AutoMoveClosenessPartnersHandler({
    logger,
    entityManager,
    systemMoveEntityHandler: moveHandler,
    safeEventDispatcher: dispatcher,
  });
});

describe('AutoMoveClosenessPartnersHandler.execute - Parameter Validation', () => {
  test('returns error when actor_id is missing', async () => {
    const result = await handler.execute(
      { destination_id: 'dest' },
      { logger }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('actor_id');
    expect(safeDispatchError).toHaveBeenCalled();
  });

  test('returns error when actor_id is empty string', async () => {
    const result = await handler.execute(
      { actor_id: '', destination_id: 'dest' },
      { logger }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('actor_id');
  });

  test('returns error when destination_id is missing', async () => {
    const result = await handler.execute({ actor_id: 'actor1' }, { logger });
    expect(result.success).toBe(false);
    expect(result.error).toContain('destination_id');
  });

  test('returns error when destination_id is empty string', async () => {
    const result = await handler.execute(
      { actor_id: 'actor1', destination_id: '' },
      { logger }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('destination_id');
  });

  test('accepts optional previous_location_id as string', async () => {
    entityManager.getComponentData.mockReturnValue(null);
    const result = await handler.execute(
      {
        actor_id: 'actor1',
        destination_id: 'dest',
        previous_location_id: 'prev',
      },
      { logger }
    );
    expect(result.success).toBe(true);
  });

  test('returns error when previous_location_id is not a string', async () => {
    const result = await handler.execute(
      {
        actor_id: 'actor1',
        destination_id: 'dest',
        previous_location_id: 123,
      },
      { logger }
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain('previous_location_id');
  });
});

describe('AutoMoveClosenessPartnersHandler.execute - Closeness Component Fetching', () => {
  test('returns success with 0 moved when actor has no closeness component', async () => {
    entityManager.getComponentData.mockReturnValue(null);

    const result = await handler.execute(
      { actor_id: 'actor1', destination_id: 'dest' },
      { logger }
    );

    expect(result.success).toBe(true);
    expect(result.partnersMoved).toBe(0);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('no closeness partners'),
      expect.objectContaining({ actorId: 'actor1' })
    );
    expect(moveHandler.execute).not.toHaveBeenCalled();
  });

  test('returns success with 0 moved when partners is not an array', async () => {
    entityManager.getComponentData.mockReturnValue({ partners: 'invalid' });

    const result = await handler.execute(
      { actor_id: 'actor1', destination_id: 'dest' },
      { logger }
    );

    expect(result.success).toBe(true);
    expect(result.partnersMoved).toBe(0);
    expect(moveHandler.execute).not.toHaveBeenCalled();
  });

  test('returns success with 0 moved when partners array is empty', async () => {
    entityManager.getComponentData.mockReturnValue({ partners: [] });

    const result = await handler.execute(
      { actor_id: 'actor1', destination_id: 'dest' },
      { logger }
    );

    expect(result.success).toBe(true);
    expect(result.partnersMoved).toBe(0);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('empty partners array'),
      expect.objectContaining({ actorId: 'actor1' })
    );
  });
});

describe('AutoMoveClosenessPartnersHandler.execute - Partner Movement', () => {
  test('moves single partner and dispatches events', async () => {
    entityManager.getComponentData.mockImplementation((id, comp) => {
      if (id === 'actor1' && comp === CLOSENESS_COMPONENT_ID)
        return { partners: ['partner1'] };
      if (id === 'partner1' && comp === POSITION_COMPONENT_ID)
        return { locationId: 'oldLoc' };
      return null;
    });

    const result = await handler.execute(
      {
        actor_id: 'actor1',
        destination_id: 'dest',
        previous_location_id: 'oldLoc',
      },
      { logger }
    );

    expect(result.success).toBe(true);
    expect(result.partnersMoved).toBe(1);
    expect(moveHandler.execute).toHaveBeenCalledWith(
      { entity_ref: { entityId: 'partner1' }, target_location_id: 'dest' },
      { logger }
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith('core:entity_moved', {
      entityId: 'partner1',
      previousLocationId: 'oldLoc',
      currentLocationId: 'dest',
      movedBy: 'actor1',
      reason: 'closeness_auto_move',
    });
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'positioning:entity_exited_location',
      {
        entityId: 'partner1',
        locationId: 'oldLoc',
        newLocationId: 'dest',
      }
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'positioning:entity_entered_location',
      {
        entityId: 'partner1',
        locationId: 'dest',
        previousLocationId: 'oldLoc',
      }
    );
  });

  test('moves multiple partners successfully', async () => {
    entityManager.getComponentData.mockImplementation((id, comp) => {
      if (id === 'actor1' && comp === CLOSENESS_COMPONENT_ID)
        return { partners: ['p1', 'p2', 'p3'] };
      if (comp === POSITION_COMPONENT_ID)
        return { locationId: 'oldLoc' };
      return null;
    });

    const result = await handler.execute(
      { actor_id: 'actor1', destination_id: 'dest' },
      { logger }
    );

    expect(result.success).toBe(true);
    expect(result.partnersMoved).toBe(3);
    expect(moveHandler.execute).toHaveBeenCalledTimes(3);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(9); // 3 partners × 3 events each
  });

  test('logs completion with partner count', async () => {
    entityManager.getComponentData.mockImplementation((id, comp) => {
      if (id === 'actor1' && comp === CLOSENESS_COMPONENT_ID)
        return { partners: ['p1', 'p2'] };
      if (comp === POSITION_COMPONENT_ID)
        return { locationId: 'oldLoc' };
      return null;
    });

    await handler.execute(
      { actor_id: 'actor1', destination_id: 'dest' },
      { logger }
    );

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Moving closeness partners'),
      expect.objectContaining({ partnerCount: 2 })
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('moved successfully'),
      expect.objectContaining({ movedCount: 2 })
    );
  });
});

describe('AutoMoveClosenessPartnersHandler.execute - Partner Validation', () => {
  test('skips partner without position component', async () => {
    entityManager.getComponentData.mockImplementation((id, comp) => {
      if (id === 'actor1' && comp === CLOSENESS_COMPONENT_ID)
        return { partners: ['p1'] };
      if (id === 'p1' && comp === POSITION_COMPONENT_ID) return null;
      return null;
    });

    const result = await handler.execute(
      { actor_id: 'actor1', destination_id: 'dest' },
      { logger }
    );

    expect(result.success).toBe(true);
    expect(result.partnersMoved).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('no position component'),
      expect.objectContaining({ partnerId: 'p1' })
    );
    expect(moveHandler.execute).not.toHaveBeenCalled();
  });

  test('skips partner not at expected previous location', async () => {
    entityManager.getComponentData.mockImplementation((id, comp) => {
      if (id === 'actor1' && comp === CLOSENESS_COMPONENT_ID)
        return { partners: ['p1'] };
      if (id === 'p1' && comp === POSITION_COMPONENT_ID)
        return { locationId: 'wrongLoc' };
      return null;
    });

    const result = await handler.execute(
      {
        actor_id: 'actor1',
        destination_id: 'dest',
        previous_location_id: 'oldLoc',
      },
      { logger }
    );

    expect(result.success).toBe(true);
    expect(result.partnersMoved).toBe(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('not at expected location'),
      expect.objectContaining({
        partnerId: 'p1',
        expectedLocation: 'oldLoc',
        actualLocation: 'wrongLoc',
      })
    );
    expect(moveHandler.execute).not.toHaveBeenCalled();
  });

  test('skips partner already at destination', async () => {
    entityManager.getComponentData.mockImplementation((id, comp) => {
      if (id === 'actor1' && comp === CLOSENESS_COMPONENT_ID)
        return { partners: ['p1'] };
      if (id === 'p1' && comp === POSITION_COMPONENT_ID)
        return { locationId: 'dest' };
      return null;
    });

    const result = await handler.execute(
      { actor_id: 'actor1', destination_id: 'dest' },
      { logger }
    );

    expect(result.success).toBe(true);
    expect(result.partnersMoved).toBe(0);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('already at destination'),
      expect.objectContaining({ partnerId: 'p1' })
    );
    expect(moveHandler.execute).not.toHaveBeenCalled();
  });
});

describe('AutoMoveClosenessPartnersHandler.execute - Error Handling', () => {
  test('handles move handler error gracefully', async () => {
    entityManager.getComponentData.mockImplementation((id, comp) => {
      if (id === 'actor1' && comp === CLOSENESS_COMPONENT_ID)
        return { partners: ['p1'] };
      if (id === 'p1' && comp === POSITION_COMPONENT_ID)
        return { locationId: 'oldLoc' };
      return null;
    });

    moveHandler.execute.mockRejectedValue(new Error('Move failed'));

    const result = await handler.execute(
      { actor_id: 'actor1', destination_id: 'dest' },
      { logger }
    );

    expect(result.success).toBe(true);
    expect(result.partnersMoved).toBe(0);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to move closeness partner'),
      expect.objectContaining({ error: 'Move failed' })
    );
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'Failed to move closeness partner',
      expect.objectContaining({ partnerId: 'p1', error: 'Move failed' }),
      logger
    );
  });

  test('continues moving remaining partners after one fails', async () => {
    entityManager.getComponentData.mockImplementation((id, comp) => {
      if (id === 'actor1' && comp === CLOSENESS_COMPONENT_ID)
        return { partners: ['p1', 'p2'] };
      if (comp === POSITION_COMPONENT_ID)
        return { locationId: 'oldLoc' };
      return null;
    });

    moveHandler.execute
      .mockRejectedValueOnce(new Error('Move failed'))
      .mockResolvedValueOnce();

    const result = await handler.execute(
      { actor_id: 'actor1', destination_id: 'dest' },
      { logger }
    );

    expect(result.success).toBe(true);
    expect(result.partnersMoved).toBe(1); // Only p2 moved
    expect(moveHandler.execute).toHaveBeenCalledTimes(2);
  });

  test('returns error result for handler-level exceptions', async () => {
    entityManager.getComponentData.mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    const result = await handler.execute(
      { actor_id: 'actor1', destination_id: 'dest' },
      { logger }
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unexpected error');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Auto-move closeness partners failed'),
      expect.objectContaining({ error: 'Unexpected error' })
    );
  });
});

describe('AutoMoveClosenessPartnersHandler.execute - Mixed Scenarios', () => {
  test('handles mix of successful and skipped partners', async () => {
    entityManager.getComponentData.mockImplementation((id, comp) => {
      if (id === 'actor1' && comp === CLOSENESS_COMPONENT_ID)
        return { partners: ['p1', 'p2', 'p3'] };
      if (id === 'p1' && comp === POSITION_COMPONENT_ID) return null; // Skip: no position
      if (id === 'p2' && comp === POSITION_COMPONENT_ID)
        return { locationId: 'dest' }; // Skip: already there
      if (id === 'p3' && comp === POSITION_COMPONENT_ID)
        return { locationId: 'oldLoc' }; // Move this one
      return null;
    });

    const result = await handler.execute(
      { actor_id: 'actor1', destination_id: 'dest' },
      { logger }
    );

    expect(result.success).toBe(true);
    expect(result.partnersMoved).toBe(1);
    expect(moveHandler.execute).toHaveBeenCalledTimes(1);
    expect(moveHandler.execute).toHaveBeenCalledWith(
      { entity_ref: { entityId: 'p3' }, target_location_id: 'dest' },
      { logger }
    );
  });
});
