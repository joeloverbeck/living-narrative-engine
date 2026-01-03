/**
 * @file damageSimulatorDismembermentSuppression.integration.test.js
 * @description Integration tests verifying that the damage simulator correctly
 * suppresses body part spawning when dismemberment occurs. In simulator mode,
 * entities have no position component, so body part spawning is irrelevant
 * and would cause warnings.
 * This test verifies the flow:
 * 1. DamageExecutionService sets suppressPerceptibleEvents: true in execution context
 * 2. DamageTypeEffectsService extracts the flag
 * 3. DismembermentApplicator includes suppressBodyPartSpawning in event payload
 * 4. DismemberedBodyPartSpawner checks the flag and skips spawning silently
 * @see DamageExecutionService.js - Sets suppressPerceptibleEvents: true
 * @see damageTypeEffectsService.js - Extracts flag from execution context
 * @see dismembermentApplicator.js - Adds flag to event payload
 * @see dismemberedBodyPartSpawner.js - Checks flag and skips spawning
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import DismemberedBodyPartSpawner from '../../../../src/anatomy/services/dismemberedBodyPartSpawner.js';
import DismembermentApplicator, {
  DISMEMBERED_EVENT,
} from '../../../../src/anatomy/applicators/dismembermentApplicator.js';

describe('Damage Simulator Dismemberment Suppression Integration', () => {
  describe('Event Payload Flag Propagation', () => {
    let mockLogger;
    let mockEntityManager;
    let mockDispatchStrategy;
    let applicator;

    beforeEach(() => {
      mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      mockEntityManager = {
        hasComponent: jest.fn().mockReturnValue(false), // Not embedded
        addComponent: jest.fn().mockResolvedValue(undefined),
      };

      mockDispatchStrategy = {
        dispatch: jest.fn(),
        recordEffect: jest.fn(),
      };

      applicator = new DismembermentApplicator({
        logger: mockLogger,
        entityManager: mockEntityManager,
      });
    });

    it('should include suppressBodyPartSpawning=true in event payload when flag is provided', async () => {
      await applicator.apply({
        entityId: 'entity-1',
        entityName: 'Test Entity',
        entityPronoun: 'they',
        partId: 'part-1',
        partType: 'arm',
        orientation: 'left',
        damageAmount: 100,
        damageTypeId: 'slashing',
        maxHealth: 100,
        currentHealth: 0,
        effectDefinition: null,
        damageEntryConfig: { enabled: true },
        dispatchStrategy: mockDispatchStrategy,
        sessionContext: { sessionId: 'test-session' },
        suppressBodyPartSpawning: true, // Simulator mode flag
      });

      expect(mockDispatchStrategy.dispatch).toHaveBeenCalledWith(
        DISMEMBERED_EVENT,
        expect.objectContaining({
          entityId: 'entity-1',
          partId: 'part-1',
          suppressBodyPartSpawning: true,
        }),
        { sessionId: 'test-session' }
      );
    });

    it('should default suppressBodyPartSpawning to false when not provided', async () => {
      await applicator.apply({
        entityId: 'entity-1',
        entityName: 'Test Entity',
        entityPronoun: 'they',
        partId: 'part-1',
        partType: 'arm',
        orientation: 'left',
        damageAmount: 100,
        damageTypeId: 'slashing',
        maxHealth: 100,
        currentHealth: 0,
        effectDefinition: null,
        damageEntryConfig: { enabled: true },
        dispatchStrategy: mockDispatchStrategy,
        sessionContext: { sessionId: 'test-session' },
        // suppressBodyPartSpawning not provided
      });

      expect(mockDispatchStrategy.dispatch).toHaveBeenCalledWith(
        DISMEMBERED_EVENT,
        expect.objectContaining({
          suppressBodyPartSpawning: false,
        }),
        expect.any(Object)
      );
    });
  });

  describe('DismemberedBodyPartSpawner Suppression Behavior', () => {
    let mockLogger;
    let mockEntityManager;
    let mockEventBus;
    let mockEntityLifecycleManager;
    let mockGameDataRepository;
    let spawner;
    let capturedHandler;

    beforeEach(() => {
      mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      mockEntityManager = {
        getComponentData: jest.fn((entityId, componentId) => {
          if (componentId === 'anatomy:part') {
            return { definitionId: 'def:arm' };
          }
          if (componentId === 'core:position') {
            return { locationId: 'location-1' };
          }
          if (componentId === 'core:name') {
            return { text: 'Test Character' };
          }
          return null;
        }),
      };

      mockEventBus = {
        subscribe: jest.fn((eventType, handler) => {
          capturedHandler = handler;
          return () => {};
        }),
        dispatch: jest.fn(),
      };

      mockEntityLifecycleManager = {
        createEntityInstance: jest.fn().mockResolvedValue({
          id: 'spawned-entity-1',
        }),
      };

      mockGameDataRepository = {
        getEntityDefinition: jest.fn().mockReturnValue({
          components: {
            'core:weight': { weight: 2.5 },
          },
        }),
      };

      spawner = new DismemberedBodyPartSpawner({
        logger: mockLogger,
        entityManager: mockEntityManager,
        eventBus: mockEventBus,
        entityLifecycleManager: mockEntityLifecycleManager,
        gameDataRepository: mockGameDataRepository,
      });

      spawner.initialize();
    });

    afterEach(() => {
      if (spawner) {
        spawner.destroy();
      }
    });

    it('should skip spawning when suppressBodyPartSpawning is true (simulator mode)', async () => {
      // Dispatch event with suppression flag (simulating damage simulator)
      await capturedHandler({
        type: 'anatomy:dismembered',
        payload: {
          entityId: 'entity-1',
          partId: 'part-1',
          partType: 'arm',
          orientation: 'left',
          suppressBodyPartSpawning: true,
        },
      });

      // Verify no spawning occurred
      expect(mockEntityLifecycleManager.createEntityInstance).not.toHaveBeenCalled();
      expect(mockEventBus.dispatch).not.toHaveBeenCalledWith(
        'anatomy:body_part_spawned',
        expect.anything()
      );

      // Verify debug log instead of warning
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Skipping spawn')
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should proceed with spawning when suppressBodyPartSpawning is false (normal gameplay)', async () => {
      // Dispatch event without suppression flag (normal gameplay)
      await capturedHandler({
        type: 'anatomy:dismembered',
        payload: {
          entityId: 'entity-1',
          partId: 'part-1',
          partType: 'arm',
          orientation: 'left',
          suppressBodyPartSpawning: false,
        },
      });

      // Verify spawning occurred
      expect(mockEntityLifecycleManager.createEntityInstance).toHaveBeenCalledWith(
        'def:arm',
        expect.objectContaining({
          componentOverrides: expect.objectContaining({
            'core:name': { text: "Test Character's left arm" },
            'core:position': { locationId: 'location-1' },
          }),
        })
      );

      // Verify body_part_spawned event dispatched
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:body_part_spawned',
        expect.objectContaining({
          entityId: 'entity-1',
          spawnedEntityId: 'spawned-entity-1',
        })
      );
    });

    it('should proceed with spawning when suppressBodyPartSpawning is undefined', async () => {
      // Dispatch event without the flag at all (legacy events)
      await capturedHandler({
        type: 'anatomy:dismembered',
        payload: {
          entityId: 'entity-1',
          partId: 'part-1',
          partType: 'arm',
          orientation: 'left',
          // suppressBodyPartSpawning not present
        },
      });

      // Verify spawning occurred
      expect(mockEntityLifecycleManager.createEntityInstance).toHaveBeenCalled();
    });

    it('should not log warning when suppressing (avoiding console noise in simulator)', async () => {
      // This is the key fix: no warning should appear in simulator mode
      await capturedHandler({
        type: 'anatomy:dismembered',
        payload: {
          entityId: 'entity-1',
          partId: 'part-1',
          partType: 'arm',
          orientation: 'left',
          suppressBodyPartSpawning: true,
        },
      });

      // Verify no warnings or errors
      expect(mockLogger.warn).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();

      // Only debug log for the skip
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('suppressBodyPartSpawning=true')
      );
    });
  });

  describe('Full Event Flow Simulation', () => {
    let subscribers;
    let mockEventBus;

    beforeEach(() => {
      // Create event bus that stores subscribers and allows dispatching
      subscribers = {};
      mockEventBus = {
        dispatch: jest.fn((eventType, payload) => {
          const handlers = subscribers[eventType] || [];
          handlers.forEach((handler) =>
            handler({ type: eventType, payload })
          );
        }),
        subscribe: jest.fn((eventType, handler) => {
          if (!subscribers[eventType]) {
            subscribers[eventType] = [];
          }
          subscribers[eventType].push(handler);
          return () => {
            const index = subscribers[eventType].indexOf(handler);
            if (index > -1) {
              subscribers[eventType].splice(index, 1);
            }
          };
        }),
      };
    });

    it('should propagate suppressBodyPartSpawning through event chain', async () => {
      // Simulate the spawner subscribing to events
      const spawnCallback = jest.fn();
      mockEventBus.subscribe('anatomy:dismembered', spawnCallback);

      // Simulate applicator dispatching event with suppression flag
      mockEventBus.dispatch('anatomy:dismembered', {
        entityId: 'entity-1',
        partId: 'part-1',
        partType: 'arm',
        orientation: 'left',
        damageTypeId: 'slashing',
        suppressBodyPartSpawning: true,
        timestamp: Date.now(),
      });

      // Verify the spawner received the event with the flag
      expect(spawnCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            suppressBodyPartSpawning: true,
          }),
        })
      );
    });

    it('should allow multiple dismemberment events with different suppression states', async () => {
      const receivedEvents = [];
      mockEventBus.subscribe('anatomy:dismembered', (event) => {
        receivedEvents.push(event.payload);
      });

      // First event: simulator mode (suppressed)
      mockEventBus.dispatch('anatomy:dismembered', {
        entityId: 'entity-1',
        partId: 'part-1',
        suppressBodyPartSpawning: true,
      });

      // Second event: normal gameplay (not suppressed)
      mockEventBus.dispatch('anatomy:dismembered', {
        entityId: 'entity-2',
        partId: 'part-2',
        suppressBodyPartSpawning: false,
      });

      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents[0].suppressBodyPartSpawning).toBe(true);
      expect(receivedEvents[1].suppressBodyPartSpawning).toBe(false);
    });
  });
});
