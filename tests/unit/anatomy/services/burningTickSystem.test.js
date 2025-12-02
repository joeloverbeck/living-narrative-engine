import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BurningTickSystem from '../../../../src/anatomy/services/burningTickSystem.js';
import {
  BURNING_COMPONENT_ID,
  BURNING_STOPPED_EVENT,
} from '../../../../src/anatomy/services/damageTypeEffectsService.js';
import { TURN_ENDED_ID } from '../../../../src/constants/eventIds.js';

describe('BurningTickSystem', () => {
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

    system = new BurningTickSystem({
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
          new BurningTickSystem({
            entityManager: mockEntityManager,
            safeEventDispatcher: mockDispatcher,
            validatedEventDispatcher: mockEventSubscriber,
          })
      ).toThrow();
    });

    it('should throw if entityManager is missing', () => {
      expect(
        () =>
          new BurningTickSystem({
            logger: mockLogger,
            safeEventDispatcher: mockDispatcher,
            validatedEventDispatcher: mockEventSubscriber,
          })
      ).toThrow();
    });

    it('should throw if safeEventDispatcher is missing', () => {
      expect(
        () =>
          new BurningTickSystem({
            logger: mockLogger,
            entityManager: mockEntityManager,
            validatedEventDispatcher: mockEventSubscriber,
          })
      ).toThrow();
    });

    it('should throw if validatedEventDispatcher is missing', () => {
      expect(
        () =>
          new BurningTickSystem({
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
          new BurningTickSystem({
            logger: mockLogger,
            entityManager: invalidEntityManager,
            safeEventDispatcher: mockDispatcher,
            validatedEventDispatcher: mockEventSubscriber,
          })
      ).toThrow();
    });
  });

  describe('processTick', () => {
    it('should do nothing when no entities have burning', async () => {
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      await system.processTick();

      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should apply tick damage to burning part', async () => {
      const partId = 'part:arm';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([partId]);
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === BURNING_COMPONENT_ID) {
          return { remainingTurns: 3, tickDamage: 4, stackedCount: 2 };
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
        { currentHealth: 46, maxHealth: 100 }
      );
      // Should update burning component with decremented turns
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        partId,
        BURNING_COMPONENT_ID,
        { remainingTurns: 2, tickDamage: 4, stackedCount: 2 }
      );
    });

    it('should remove burning and emit stopped event when duration expires', async () => {
      const partId = 'part:arm';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([partId]);
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === BURNING_COMPONENT_ID) {
          return { remainingTurns: 1, tickDamage: 2, stackedCount: 3 };
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
        BURNING_COMPONENT_ID
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        BURNING_STOPPED_EVENT,
        expect.objectContaining({
          partId,
          stackedCount: 3,
          reason: 'duration_expired',
        })
      );
    });

    it('should remove burning when part is destroyed', async () => {
      const partId = 'part:arm';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([partId]);
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === BURNING_COMPONENT_ID) {
          return { remainingTurns: 5, tickDamage: 5, stackedCount: 2 };
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
        BURNING_COMPONENT_ID
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        BURNING_STOPPED_EVENT,
        expect.objectContaining({
          partId,
          stackedCount: 2,
          reason: 'part_destroyed',
        })
      );
    });

    it('should handle part with no health component as destroyed', async () => {
      const partId = 'part:arm';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([partId]);
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === BURNING_COMPONENT_ID) {
          return { remainingTurns: 2, tickDamage: 1, stackedCount: 1 };
        }
        return null;
      });
      mockEntityManager.hasComponent.mockReturnValue(false);

      await system.processTick();

      expect(mockEntityManager.removeComponent).toHaveBeenCalledWith(
        partId,
        BURNING_COMPONENT_ID
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        BURNING_STOPPED_EVENT,
        expect.objectContaining({
          reason: 'part_destroyed',
        })
      );
    });

    it('should process multiple burning parts in one tick', async () => {
      const parts = ['part:arm', 'part:leg'];
      mockEntityManager.getEntitiesWithComponent.mockReturnValue(parts);
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === BURNING_COMPONENT_ID) {
          return { remainingTurns: 2, tickDamage: 1, stackedCount: 1 };
        }
        if (componentId === 'anatomy:part_health') {
          return { currentHealth: 50, maxHealth: 100 };
        }
        return null;
      });
      mockEntityManager.hasComponent.mockReturnValue(true);

      await system.processTick();

      // Should have updated both parts (2 health + 2 burning components)
      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(4);
    });

    it('should handle missing burning data gracefully', async () => {
      const partId = 'part:arm';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([partId]);
      mockEntityManager.getComponentData.mockReturnValue(null);

      await system.processTick();

      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should clamp health to 0 minimum', async () => {
      const partId = 'part:arm';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([partId]);
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === BURNING_COMPONENT_ID) {
          return { remainingTurns: 2, tickDamage: 10, stackedCount: 1 };
        }
        if (componentId === 'anatomy:part_health') {
          return { currentHealth: 5, maxHealth: 100 };
        }
        return null;
      });
      mockEntityManager.hasComponent.mockReturnValue(true);

      await system.processTick();

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        partId,
        'anatomy:part_health',
        { currentHealth: 0, maxHealth: 100 }
      );
    });

    it('should default stackedCount to 1 when not provided', async () => {
      const partId = 'part:arm';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([partId]);
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === BURNING_COMPONENT_ID) {
          return { remainingTurns: 1, tickDamage: 2 }; // No stackedCount
        }
        if (componentId === 'anatomy:part_health') {
          return { currentHealth: 50, maxHealth: 100 };
        }
        return null;
      });
      mockEntityManager.hasComponent.mockReturnValue(true);

      await system.processTick();

      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        BURNING_STOPPED_EVENT,
        expect.objectContaining({
          stackedCount: 1,
          reason: 'duration_expired',
        })
      );
    });
  });

  describe('turn ended event handling', () => {
    it('should process tick when turn ended event fires', async () => {
      const partId = 'part:arm';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([partId]);
      mockEntityManager.getComponentData.mockImplementation((id, componentId) => {
        if (componentId === BURNING_COMPONENT_ID) {
          return { remainingTurns: 2, tickDamage: 1, stackedCount: 1 };
        }
        if (componentId === 'anatomy:part_health') {
          return { currentHealth: 50, maxHealth: 100 };
        }
        return null;
      });
      mockEntityManager.hasComponent.mockReturnValue(true);

      // Trigger the turn ended callback
      await turnEndedCallback();

      expect(mockEntityManager.addComponent).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should unsubscribe from events', () => {
      const mockUnsubscribe = jest.fn();
      mockEventSubscriber.subscribe.mockReturnValue(mockUnsubscribe);

      const testSystem = new BurningTickSystem({
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

      const testSystem = new BurningTickSystem({
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
