/**
 * @file Integration tests for movement while in a closeness circle.
 * @description Tests that actors in closeness circles can move together while
 * maintaining proximity relationships, following the "movement-while-close" specification.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import AutoMoveClosenessPartnersHandler from '../../../src/logic/operationHandlers/autoMoveClosenessPartnersHandler.js';
import SystemMoveEntityHandler from '../../../src/logic/operationHandlers/systemMoveEntityHandler.js';
import { POSITION_COMPONENT_ID } from '../../../src/constants/componentIds.js';

const CLOSENESS_COMPONENT_ID = 'positioning:closeness';
const MOVEMENT_COMPONENT_ID = 'core:movement';

describe('Movement While Close - Integration', () => {
  let handler;
  let mockLogger;
  let mockEntityManager;
  let mockEventDispatcher;
  let mockMoveHandler;
  let entityData;

  beforeEach(() => {
    entityData = new Map();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn((entityId, componentId) => {
        const key = `${entityId}:${componentId}`;
        return entityData.get(key) || null;
      }),
      addComponent: jest.fn((entityId, componentId, data) => {
        const key = `${entityId}:${componentId}`;
        entityData.set(key, data);
      }),
      modifyComponent: jest.fn((entityId, componentId, updates) => {
        const key = `${entityId}:${componentId}`;
        const existing = entityData.get(key) || {};
        entityData.set(key, { ...existing, ...updates });
      }),
    };

    mockEventDispatcher = {
      dispatch: jest.fn(),
    };

    mockMoveHandler = new SystemMoveEntityHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
      safeEventDispatcher: mockEventDispatcher,
    });

    handler = new AutoMoveClosenessPartnersHandler({
      logger: mockLogger,
      entityManager: mockEntityManager,
      systemMoveEntityHandler: mockMoveHandler,
      safeEventDispatcher: mockEventDispatcher,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    entityData.clear();
  });

  describe('Basic auto-move functionality', () => {
    it('moves single partner when actor moves', async () => {
      const actorId = 'alice';
      const partnerId = 'bob';
      const oldLocation = 'room1';
      const newLocation = 'room2';

      // Set up initial positions
      mockEntityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
        locationId: oldLocation,
      });
      mockEntityManager.addComponent(partnerId, POSITION_COMPONENT_ID, {
        locationId: oldLocation,
      });

      // Establish closeness
      mockEntityManager.addComponent(actorId, CLOSENESS_COMPONENT_ID, {
        partners: [partnerId],
      });

      // Execute auto-move
      const result = await handler.execute(
        {
          actor_id: actorId,
          destination_id: newLocation,
          previous_location_id: oldLocation,
        },
        { logger: mockLogger }
      );

      // Verify success
      expect(result.success).toBe(true);
      expect(result.partnersMoved).toBe(1);

      // Verify partner position updated
      const partnerPosition = mockEntityManager.getComponentData(
        partnerId,
        POSITION_COMPONENT_ID
      );
      expect(partnerPosition.locationId).toBe(newLocation);
    });
  });

  describe('Multiple partners movement', () => {
    it('moves all partners in a multi-person closeness circle', async () => {
      const actorId = 'alice';
      const partnerId1 = 'bob';
      const partnerId2 = 'charlie';
      const oldLocation = 'room1';
      const newLocation = 'room2';

      // Set up initial positions
      mockEntityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
        locationId: oldLocation,
      });
      mockEntityManager.addComponent(partnerId1, POSITION_COMPONENT_ID, {
        locationId: oldLocation,
      });
      mockEntityManager.addComponent(partnerId2, POSITION_COMPONENT_ID, {
        locationId: oldLocation,
      });

      // Establish closeness
      mockEntityManager.addComponent(actorId, CLOSENESS_COMPONENT_ID, {
        partners: [partnerId1, partnerId2],
      });

      // Execute auto-move
      const result = await handler.execute(
        {
          actor_id: actorId,
          destination_id: newLocation,
          previous_location_id: oldLocation,
        },
        { logger: mockLogger }
      );

      // Verify all partners moved
      expect(result.success).toBe(true);
      expect(result.partnersMoved).toBe(2);

      const partner1Pos = mockEntityManager.getComponentData(
        partnerId1,
        POSITION_COMPONENT_ID
      );
      const partner2Pos = mockEntityManager.getComponentData(
        partnerId2,
        POSITION_COMPONENT_ID
      );

      expect(partner1Pos.locationId).toBe(newLocation);
      expect(partner2Pos.locationId).toBe(newLocation);
    });
  });

  describe('Event dispatching', () => {
    it('dispatches entity_moved events for each partner', async () => {
      const actorId = 'alice';
      const partnerId = 'bob';
      const oldLocation = 'room1';
      const newLocation = 'room2';

      mockEntityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
        locationId: oldLocation,
      });
      mockEntityManager.addComponent(partnerId, POSITION_COMPONENT_ID, {
        locationId: oldLocation,
      });
      mockEntityManager.addComponent(actorId, CLOSENESS_COMPONENT_ID, {
        partners: [partnerId],
      });

      await handler.execute(
        {
          actor_id: actorId,
          destination_id: newLocation,
          previous_location_id: oldLocation,
        },
        { logger: mockLogger }
      );

      // Verify entity_moved event
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:entity_moved',
        expect.objectContaining({
          entityId: partnerId,
          currentLocationId: newLocation,
          previousLocationId: oldLocation,
          movedBy: actorId,
          reason: 'closeness_auto_move',
        })
      );
    });

    it('dispatches exit and enter location events', async () => {
      const actorId = 'alice';
      const partnerId = 'bob';
      const oldLocation = 'room1';
      const newLocation = 'room2';

      mockEntityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
        locationId: oldLocation,
      });
      mockEntityManager.addComponent(partnerId, POSITION_COMPONENT_ID, {
        locationId: oldLocation,
      });
      mockEntityManager.addComponent(actorId, CLOSENESS_COMPONENT_ID, {
        partners: [partnerId],
      });

      await handler.execute(
        {
          actor_id: actorId,
          destination_id: newLocation,
          previous_location_id: oldLocation,
        },
        { logger: mockLogger }
      );

      // Verify exit event
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        'positioning:entity_exited_location',
        expect.objectContaining({
          entityId: partnerId,
          locationId: oldLocation,
          newLocationId: newLocation,
        })
      );

      // Verify enter event
      expect(mockEventDispatcher.dispatch).toHaveBeenCalledWith(
        'positioning:entity_entered_location',
        expect.objectContaining({
          entityId: partnerId,
          locationId: newLocation,
          previousLocationId: oldLocation,
        })
      );
    });
  });

  describe('Partner validation', () => {
    it('skips partner already at destination', async () => {
      const actorId = 'alice';
      const partnerId = 'bob';
      const newLocation = 'room2';

      mockEntityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
        locationId: 'room1',
      });
      // Partner already at destination
      mockEntityManager.addComponent(partnerId, POSITION_COMPONENT_ID, {
        locationId: newLocation,
      });
      mockEntityManager.addComponent(actorId, CLOSENESS_COMPONENT_ID, {
        partners: [partnerId],
      });

      const result = await handler.execute(
        {
          actor_id: actorId,
          destination_id: newLocation,
        },
        { logger: mockLogger }
      );

      // Partner was skipped but operation succeeded
      expect(result.success).toBe(true);
      expect(result.partnersMoved).toBe(0);

      // Verify debug log
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('already at destination'),
        expect.objectContaining({ partnerId })
      );
    });

    it('handles mixed scenarios - some partners move, some skip', async () => {
      const actorId = 'alice';
      const partnerId1 = 'bob';
      const partnerId2 = 'charlie';
      const oldLocation = 'room1';
      const newLocation = 'room2';

      mockEntityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
        locationId: oldLocation,
      });
      mockEntityManager.addComponent(partnerId1, POSITION_COMPONENT_ID, {
        locationId: oldLocation,
      });
      // Partner2 already at destination
      mockEntityManager.addComponent(partnerId2, POSITION_COMPONENT_ID, {
        locationId: newLocation,
      });
      mockEntityManager.addComponent(actorId, CLOSENESS_COMPONENT_ID, {
        partners: [partnerId1, partnerId2],
      });

      const result = await handler.execute(
        {
          actor_id: actorId,
          destination_id: newLocation,
          previous_location_id: oldLocation,
        },
        { logger: mockLogger }
      );

      // Only one partner moved
      expect(result.success).toBe(true);
      expect(result.partnersMoved).toBe(1);

      const partner1Pos = mockEntityManager.getComponentData(
        partnerId1,
        POSITION_COMPONENT_ID
      );
      expect(partner1Pos.locationId).toBe(newLocation);
    });
  });

  describe('Error handling', () => {
    it('continues moving remaining partners after one move fails', async () => {
      const actorId = 'alice';
      const partnerId1 = 'bob';
      const partnerId2 = 'charlie';
      const oldLocation = 'room1';
      const newLocation = 'room2';

      mockEntityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
        locationId: oldLocation,
      });
      mockEntityManager.addComponent(partnerId1, POSITION_COMPONENT_ID, {
        locationId: oldLocation,
      });
      mockEntityManager.addComponent(partnerId2, POSITION_COMPONENT_ID, {
        locationId: oldLocation,
      });
      mockEntityManager.addComponent(actorId, CLOSENESS_COMPONENT_ID, {
        partners: [partnerId1, partnerId2],
      });

      // Make first move fail
      const originalExecute = mockMoveHandler.execute;
      mockMoveHandler.execute = jest
        .fn()
        .mockRejectedValueOnce(new Error('Move failed'))
        .mockImplementation(originalExecute);

      const result = await handler.execute(
        {
          actor_id: actorId,
          destination_id: newLocation,
          previous_location_id: oldLocation,
        },
        { logger: mockLogger }
      );

      // Operation succeeds even though one partner failed
      expect(result.success).toBe(true);
      expect(result.partnersMoved).toBe(1); // Only second partner moved

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to move closeness partner'),
        expect.objectContaining({ error: 'Move failed' })
      );
    });
  });
});
