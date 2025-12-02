import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PoisonTickSystem from '../../../../src/anatomy/services/poisonTickSystem.js';
import {
  POISONED_COMPONENT_ID,
  POISONED_STOPPED_EVENT,
} from '../../../../src/anatomy/services/damageTypeEffectsService.js';
import { TURN_ENDED_ID } from '../../../../src/constants/eventIds.js';

describe('PoisonTickSystem', () => {
  let system;
  let mockLogger;
  let mockEntityManager;
  let mockDispatcher;
  let mockEventSubscriber;
  let turnEndedCallback;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      addComponent: jest.fn().mockResolvedValue(undefined),
      removeComponent: jest.fn().mockResolvedValue(undefined),
      hasComponent: jest.fn().mockReturnValue(false),
      getEntitiesWithComponent: jest.fn().mockReturnValue([]),
    };

    mockDispatcher = {
      dispatch: jest.fn(),
    };

    turnEndedCallback = null;
    mockEventSubscriber = {
      subscribe: jest.fn((eventId, callback) => {
        if (eventId === TURN_ENDED_ID) {
          turnEndedCallback = callback;
        }
        return jest.fn(); // unsubscribe function
      }),
    };

    system = new PoisonTickSystem({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockDispatcher,
      validatedEventDispatcher: mockEventSubscriber,
    });
  });

  describe('constructor', () => {
    it('should initialize with all dependencies', () => {
      expect(system).toBeDefined();
    });

    it('should subscribe to turn ended events', () => {
      expect(mockEventSubscriber.subscribe).toHaveBeenCalledWith(
        TURN_ENDED_ID,
        expect.any(Function)
      );
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new PoisonTickSystem({
            entityManager: mockEntityManager,
            safeEventDispatcher: mockDispatcher,
            validatedEventDispatcher: mockEventSubscriber,
          })
      ).toThrow();
    });

    it('should throw if entityManager is missing', () => {
      expect(
        () =>
          new PoisonTickSystem({
            logger: mockLogger,
            safeEventDispatcher: mockDispatcher,
            validatedEventDispatcher: mockEventSubscriber,
          })
      ).toThrow();
    });

    it('should throw if safeEventDispatcher is missing', () => {
      expect(
        () =>
          new PoisonTickSystem({
            logger: mockLogger,
            entityManager: mockEntityManager,
            validatedEventDispatcher: mockEventSubscriber,
          })
      ).toThrow();
    });

    it('should throw if validatedEventDispatcher is missing', () => {
      expect(
        () =>
          new PoisonTickSystem({
            logger: mockLogger,
            entityManager: mockEntityManager,
            safeEventDispatcher: mockDispatcher,
          })
      ).toThrow();
    });

    it('should throw if entityManager missing required methods', () => {
      const invalidEntityManager = { getComponentData: jest.fn() };
      expect(
        () =>
          new PoisonTickSystem({
            logger: mockLogger,
            entityManager: invalidEntityManager,
            safeEventDispatcher: mockDispatcher,
            validatedEventDispatcher: mockEventSubscriber,
          })
      ).toThrow();
    });
  });

  describe('processTick', () => {
    it('should do nothing when no entities have poison', async () => {
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      await system.processTick();

      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    describe('part-scoped poison', () => {
      it('should apply tick damage to poisoned part', async () => {
        const partId = 'part:arm';
        mockEntityManager.getEntitiesWithComponent.mockReturnValue([partId]);
        mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
          if (componentId === POISONED_COMPONENT_ID) {
            return { remainingTurns: 3, tickDamage: 2 };
          }
          if (componentId === 'anatomy:part_health') {
            return { currentHealth: 50, maxHealth: 100 };
          }
          return null;
        });
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          return componentId === 'anatomy:part_health';
        });

        await system.processTick();

        // Should update health
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          partId,
          'anatomy:part_health',
          { currentHealth: 48, maxHealth: 100 }
        );
        // Should update poisoned component with decremented turns
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          partId,
          POISONED_COMPONENT_ID,
          { remainingTurns: 2, tickDamage: 2 }
        );
      });

      it('should remove poison and emit stopped event with part scope when duration expires', async () => {
        const partId = 'part:arm';
        mockEntityManager.getEntitiesWithComponent.mockReturnValue([partId]);
        mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
          if (componentId === POISONED_COMPONENT_ID) {
            return { remainingTurns: 1, tickDamage: 1 };
          }
          if (componentId === 'anatomy:part_health') {
            return { currentHealth: 50, maxHealth: 100 };
          }
          return null;
        });
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          return componentId === 'anatomy:part_health';
        });

        await system.processTick();

        expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
          partId,
          POISONED_COMPONENT_ID
        );
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          POISONED_STOPPED_EVENT,
          expect.objectContaining({
            partId,
            scope: 'part',
            reason: 'duration_expired',
          })
        );
      });

      it('should remove poison when part is destroyed', async () => {
        const partId = 'part:arm';
        mockEntityManager.getEntitiesWithComponent.mockReturnValue([partId]);
        mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
          if (componentId === POISONED_COMPONENT_ID) {
            return { remainingTurns: 5, tickDamage: 3 };
          }
          if (componentId === 'anatomy:part_health') {
            return { currentHealth: 0, maxHealth: 100 }; // Destroyed
          }
          return null;
        });
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          return componentId === 'anatomy:part_health';
        });

        await system.processTick();

        expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
          partId,
          POISONED_COMPONENT_ID
        );
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          POISONED_STOPPED_EVENT,
          expect.objectContaining({
            partId,
            scope: 'part',
            reason: 'target_destroyed',
          })
        );
      });
    });

    describe('entity-scoped poison', () => {
      it('should apply tick damage to poisoned entity', async () => {
        const entityId = 'entity:goblin';
        mockEntityManager.getEntitiesWithComponent.mockReturnValue([entityId]);
        mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
          if (componentId === POISONED_COMPONENT_ID) {
            return { remainingTurns: 3, tickDamage: 5 };
          }
          if (componentId === 'core:health') {
            return { currentHealth: 100, maxHealth: 100 };
          }
          return null;
        });
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          return componentId === 'core:health';
        });

        await system.processTick();

        // Should update entity health
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          entityId,
          'core:health',
          { currentHealth: 95, maxHealth: 100 }
        );
        // Should update poisoned component
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          entityId,
          POISONED_COMPONENT_ID,
          { remainingTurns: 2, tickDamage: 5 }
        );
      });

      it('should remove poison and emit stopped event with entity scope when duration expires', async () => {
        const entityId = 'entity:goblin';
        mockEntityManager.getEntitiesWithComponent.mockReturnValue([entityId]);
        mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
          if (componentId === POISONED_COMPONENT_ID) {
            return { remainingTurns: 1, tickDamage: 2 };
          }
          if (componentId === 'core:health') {
            return { currentHealth: 50, maxHealth: 100 };
          }
          return null;
        });
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          return componentId === 'core:health';
        });

        await system.processTick();

        expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
          entityId,
          POISONED_COMPONENT_ID
        );
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          POISONED_STOPPED_EVENT,
          expect.objectContaining({
            entityId,
            scope: 'entity',
            reason: 'duration_expired',
          })
        );
      });

      it('should remove poison when entity is destroyed', async () => {
        const entityId = 'entity:goblin';
        mockEntityManager.getEntitiesWithComponent.mockReturnValue([entityId]);
        mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
          if (componentId === POISONED_COMPONENT_ID) {
            return { remainingTurns: 5, tickDamage: 3 };
          }
          if (componentId === 'core:health') {
            return { currentHealth: 0, maxHealth: 100 }; // Destroyed
          }
          return null;
        });
        mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
          return componentId === 'core:health';
        });

        await system.processTick();

        expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
          entityId,
          POISONED_COMPONENT_ID
        );
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          POISONED_STOPPED_EVENT,
          expect.objectContaining({
            entityId,
            scope: 'entity',
            reason: 'target_destroyed',
          })
        );
      });
    });

    it('should handle target with no health component as destroyed', async () => {
      const targetId = 'entity:something';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([targetId]);
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === POISONED_COMPONENT_ID) {
          return { remainingTurns: 2, tickDamage: 1 };
        }
        return null;
      });
      mockEntityManager.hasComponent.mockReturnValue(false);

      await system.processTick();

      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        targetId,
        POISONED_COMPONENT_ID
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        POISONED_STOPPED_EVENT,
        expect.objectContaining({
          reason: 'target_destroyed',
        })
      );
    });

    it('should process multiple poisoned targets in one tick', async () => {
      const targets = ['part:arm', 'entity:goblin'];
      mockEntityManager.getEntitiesWithComponent.mockReturnValue(targets);
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === POISONED_COMPONENT_ID) {
          return { remainingTurns: 2, tickDamage: 1 };
        }
        if (componentId === 'anatomy:part_health' && id === 'part:arm') {
          return { currentHealth: 50, maxHealth: 100 };
        }
        if (componentId === 'core:health' && id === 'entity:goblin') {
          return { currentHealth: 50, maxHealth: 100 };
        }
        return null;
      });
      mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
        if (id === 'part:arm') return componentId === 'anatomy:part_health';
        if (id === 'entity:goblin') return componentId === 'core:health';
        return false;
      });

      await system.processTick();

      // Should have updated both targets (2 health + 2 poisoned components)
      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(4);
    });

    it('should handle missing poison data gracefully', async () => {
      const targetId = 'entity:something';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([targetId]);
      mockEntityManager.getComponentData.mockReturnValue(null);

      await system.processTick();

      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should clamp health to 0 minimum', async () => {
      const entityId = 'entity:goblin';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([entityId]);
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === POISONED_COMPONENT_ID) {
          return { remainingTurns: 2, tickDamage: 15 };
        }
        if (componentId === 'core:health') {
          return { currentHealth: 10, maxHealth: 100 };
        }
        return null;
      });
      mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
        return componentId === 'core:health';
      });

      await system.processTick();

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        'core:health',
        { currentHealth: 0, maxHealth: 100 }
      );
    });
  });

  describe('turn ended event handling', () => {
    it('should process tick when turn ended event fires', async () => {
      const entityId = 'entity:goblin';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([entityId]);
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === POISONED_COMPONENT_ID) {
          return { remainingTurns: 2, tickDamage: 1 };
        }
        if (componentId === 'core:health') {
          return { currentHealth: 50, maxHealth: 100 };
        }
        return null;
      });
      mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
        return componentId === 'core:health';
      });

      // Trigger the turn ended callback
      await turnEndedCallback();

      expect(mockEntityManager.addComponent).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should unsubscribe from events', () => {
      const mockUnsubscribe = jest.fn();
      mockEventSubscriber.subscribe.mockReturnValue(mockUnsubscribe);

      const testSystem = new PoisonTickSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        safeEventDispatcher: mockDispatcher,
        validatedEventDispatcher: mockEventSubscriber,
      });

      testSystem.destroy();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should handle multiple destroy calls gracefully', () => {
      const mockUnsubscribe = jest.fn();
      mockEventSubscriber.subscribe.mockReturnValue(mockUnsubscribe);

      const testSystem = new PoisonTickSystem({
        logger: mockLogger,
        entityManager: mockEntityManager,
        safeEventDispatcher: mockDispatcher,
        validatedEventDispatcher: mockEventSubscriber,
      });

      testSystem.destroy();
      testSystem.destroy();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});
