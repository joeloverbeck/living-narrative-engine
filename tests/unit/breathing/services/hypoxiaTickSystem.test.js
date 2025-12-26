import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import HypoxiaTickSystem from '../../../../src/breathing/services/hypoxiaTickSystem.js';
import { TURN_ENDED_ID } from '../../../../src/constants/eventIds.js';

// Component IDs from the implementation
const HYPOXIC_COMPONENT_ID = 'breathing:hypoxic';
const UNCONSCIOUS_ANOXIA_COMPONENT_ID = 'breathing:unconscious_anoxia';
const PART_COMPONENT_ID = 'anatomy:part';
const VITAL_ORGAN_COMPONENT_ID = 'anatomy:vital_organ';
const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';

// Event IDs from the implementation
const ANOXIC_UNCONSCIOUSNESS_STARTED_EVENT =
  'breathing:anoxic_unconsciousness_started';
const BRAIN_DAMAGE_STARTED_EVENT = 'breathing:brain_damage_started';

describe('HypoxiaTickSystem', () => {
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

    system = new HypoxiaTickSystem({
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
          new HypoxiaTickSystem({
            entityManager: mockEntityManager,
            safeEventDispatcher: mockDispatcher,
            validatedEventDispatcher: mockEventSubscriber,
          })
      ).toThrow();
    });

    it('should throw if entityManager is missing', () => {
      expect(
        () =>
          new HypoxiaTickSystem({
            logger: mockLogger,
            safeEventDispatcher: mockDispatcher,
            validatedEventDispatcher: mockEventSubscriber,
          })
      ).toThrow();
    });

    it('should throw if safeEventDispatcher is missing', () => {
      expect(
        () =>
          new HypoxiaTickSystem({
            logger: mockLogger,
            entityManager: mockEntityManager,
            validatedEventDispatcher: mockEventSubscriber,
          })
      ).toThrow();
    });

    it('should throw if validatedEventDispatcher is missing', () => {
      expect(
        () =>
          new HypoxiaTickSystem({
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
          new HypoxiaTickSystem({
            logger: mockLogger,
            entityManager: invalidEntityManager,
            safeEventDispatcher: mockDispatcher,
            validatedEventDispatcher: mockEventSubscriber,
          })
      ).toThrow();
    });
  });

  describe('processTick', () => {
    it('should do nothing when no entities have hypoxic component', async () => {
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      await system.processTick();

      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should do nothing when getEntitiesWithComponent returns null', async () => {
      mockEntityManager.getEntitiesWithComponent.mockReturnValue(null);

      await system.processTick();

      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    it('should increment turnsInState each tick', async () => {
      const entityId = 'entity:actor1';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([entityId]);
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === HYPOXIC_COMPONENT_ID) {
            return { severity: 'mild', turnsInState: 1, actionPenalty: 0 };
          }
          return null;
        }
      );

      await system.processTick();

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        HYPOXIC_COMPONENT_ID,
        expect.objectContaining({ turnsInState: 2 })
      );
    });

    it('should handle missing turnsInState gracefully (default to 0)', async () => {
      const entityId = 'entity:actor1';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([entityId]);
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === HYPOXIC_COMPONENT_ID) {
            return { severity: 'mild' }; // No turnsInState
          }
          return null;
        }
      );

      await system.processTick();

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        HYPOXIC_COMPONENT_ID,
        expect.objectContaining({ turnsInState: 1 })
      );
    });

    it('should escalate from mild to moderate at turn 3', async () => {
      const entityId = 'entity:actor1';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([entityId]);
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === HYPOXIC_COMPONENT_ID) {
            return { severity: 'mild', turnsInState: 2, actionPenalty: 0 };
          }
          return null;
        }
      );

      await system.processTick();

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        HYPOXIC_COMPONENT_ID,
        {
          severity: 'moderate',
          turnsInState: 3,
          actionPenalty: 2,
        }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('escalated to moderate')
      );
    });

    it('should escalate from moderate to severe at turn 5', async () => {
      const entityId = 'entity:actor1';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([entityId]);
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === HYPOXIC_COMPONENT_ID) {
            return { severity: 'moderate', turnsInState: 4, actionPenalty: 2 };
          }
          return null;
        }
      );

      await system.processTick();

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        HYPOXIC_COMPONENT_ID,
        {
          severity: 'severe',
          turnsInState: 5,
          actionPenalty: 4,
        }
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('escalated to severe')
      );
    });

    it('should not re-escalate if already at moderate or higher', async () => {
      const entityId = 'entity:actor1';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([entityId]);
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === HYPOXIC_COMPONENT_ID) {
            // Already moderate at turn 3, should stay moderate
            return { severity: 'moderate', turnsInState: 3, actionPenalty: 2 };
          }
          return null;
        }
      );

      await system.processTick();

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        HYPOXIC_COMPONENT_ID,
        {
          severity: 'moderate',
          turnsInState: 4,
          actionPenalty: 2,
        }
      );
    });

    it('should apply unconsciousness at turn 7', async () => {
      const entityId = 'entity:actor1';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([entityId]);
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === HYPOXIC_COMPONENT_ID) {
            return { severity: 'severe', turnsInState: 6, actionPenalty: 4 };
          }
          return null;
        }
      );
      mockEntityManager.hasComponent.mockReturnValue(false);

      await system.processTick();

      // Should add unconscious component
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        UNCONSCIOUS_ANOXIA_COMPONENT_ID,
        {
          turnsUnconscious: 0,
          brainDamageStarted: false,
        }
      );

      // Should dispatch event
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        ANOXIC_UNCONSCIOUSNESS_STARTED_EVENT,
        expect.objectContaining({
          entityId,
          timestamp: expect.any(Number),
        })
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('lost consciousness')
      );
    });

    it('should not apply unconsciousness if already unconscious', async () => {
      const entityId = 'entity:actor1';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([entityId]);
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === HYPOXIC_COMPONENT_ID) {
            return { severity: 'severe', turnsInState: 7, actionPenalty: 4 };
          }
          if (componentId === UNCONSCIOUS_ANOXIA_COMPONENT_ID) {
            return { turnsUnconscious: 1, brainDamageStarted: false };
          }
          return null;
        }
      );
      mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
        return componentId === UNCONSCIOUS_ANOXIA_COMPONENT_ID;
      });

      await system.processTick();

      // Should NOT dispatch unconsciousness started event again
      expect(mockDispatcher.dispatch).not.toHaveBeenCalledWith(
        ANOXIC_UNCONSCIOUSNESS_STARTED_EVENT,
        expect.anything()
      );
    });

    it('should handle missing hypoxic data gracefully', async () => {
      const entityId = 'entity:actor1';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([entityId]);
      mockEntityManager.getComponentData.mockReturnValue(null);

      await system.processTick();

      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should process multiple hypoxic entities in one tick', async () => {
      const entities = ['entity:actor1', 'entity:actor2'];
      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === HYPOXIC_COMPONENT_ID) {
            return { severity: 'mild', turnsInState: 1, actionPenalty: 0 };
          }
          return null;
        }
      );

      await system.processTick();

      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(2);
    });
  });

  describe('brain damage processing', () => {
    it('should apply brain damage after 2 turns unconscious', async () => {
      const entityId = 'entity:actor1';
      const brainPartId = 'part:brain1';
      mockEntityManager.getEntitiesWithComponent.mockImplementation(
        (componentId) => {
          if (componentId === HYPOXIC_COMPONENT_ID) {
            return [entityId];
          }
          if (componentId === VITAL_ORGAN_COMPONENT_ID) {
            return [brainPartId];
          }
          return [];
        }
      );
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === entityId && componentId === HYPOXIC_COMPONENT_ID) {
            return { severity: 'severe', turnsInState: 8, actionPenalty: 4 };
          }
          if (
            id === entityId &&
            componentId === UNCONSCIOUS_ANOXIA_COMPONENT_ID
          ) {
            return { turnsUnconscious: 1, brainDamageStarted: false };
          }
          if (id === brainPartId && componentId === PART_COMPONENT_ID) {
            return { ownerEntityId: entityId };
          }
          if (id === brainPartId && componentId === VITAL_ORGAN_COMPONENT_ID) {
            return { organType: 'brain' };
          }
          if (id === brainPartId && componentId === PART_HEALTH_COMPONENT_ID) {
            return { currentHealth: 100, maxHealth: 100 };
          }
          return null;
        }
      );
      mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
        if (
          id === entityId &&
          componentId === UNCONSCIOUS_ANOXIA_COMPONENT_ID
        ) {
          return true;
        }
        if (id === brainPartId && componentId === PART_HEALTH_COMPONENT_ID) {
          return true;
        }
        return false;
      });

      await system.processTick();

      // Should apply brain damage (5 damage)
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        brainPartId,
        PART_HEALTH_COMPONENT_ID,
        { currentHealth: 95, maxHealth: 100 }
      );

      // Should dispatch brain damage started event
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        BRAIN_DAMAGE_STARTED_EVENT,
        expect.objectContaining({
          entityId,
          timestamp: expect.any(Number),
        })
      );

      // Should update unconscious component with brainDamageStarted: true
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        UNCONSCIOUS_ANOXIA_COMPONENT_ID,
        {
          turnsUnconscious: 2,
          brainDamageStarted: true,
        }
      );
    });

    it('should only dispatch brain_damage_started once', async () => {
      const entityId = 'entity:actor1';
      const brainPartId = 'part:brain1';
      mockEntityManager.getEntitiesWithComponent.mockImplementation(
        (componentId) => {
          if (componentId === HYPOXIC_COMPONENT_ID) {
            return [entityId];
          }
          if (componentId === VITAL_ORGAN_COMPONENT_ID) {
            return [brainPartId];
          }
          return [];
        }
      );
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === entityId && componentId === HYPOXIC_COMPONENT_ID) {
            return { severity: 'severe', turnsInState: 9, actionPenalty: 4 };
          }
          if (
            id === entityId &&
            componentId === UNCONSCIOUS_ANOXIA_COMPONENT_ID
          ) {
            // Brain damage already started
            return { turnsUnconscious: 2, brainDamageStarted: true };
          }
          if (id === brainPartId && componentId === PART_COMPONENT_ID) {
            return { ownerEntityId: entityId };
          }
          if (id === brainPartId && componentId === VITAL_ORGAN_COMPONENT_ID) {
            return { organType: 'brain' };
          }
          if (id === brainPartId && componentId === PART_HEALTH_COMPONENT_ID) {
            return { currentHealth: 95, maxHealth: 100 };
          }
          return null;
        }
      );
      mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
        if (
          id === entityId &&
          componentId === UNCONSCIOUS_ANOXIA_COMPONENT_ID
        ) {
          return true;
        }
        if (id === brainPartId && componentId === PART_HEALTH_COMPONENT_ID) {
          return true;
        }
        return false;
      });

      await system.processTick();

      // Should NOT dispatch brain damage started event again
      expect(mockDispatcher.dispatch).not.toHaveBeenCalledWith(
        BRAIN_DAMAGE_STARTED_EVENT,
        expect.anything()
      );

      // Should still apply damage
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        brainPartId,
        PART_HEALTH_COMPONENT_ID,
        { currentHealth: 90, maxHealth: 100 }
      );
    });

    it('should clamp brain health to 0 minimum', async () => {
      const entityId = 'entity:actor1';
      const brainPartId = 'part:brain1';
      mockEntityManager.getEntitiesWithComponent.mockImplementation(
        (componentId) => {
          if (componentId === HYPOXIC_COMPONENT_ID) {
            return [entityId];
          }
          if (componentId === VITAL_ORGAN_COMPONENT_ID) {
            return [brainPartId];
          }
          return [];
        }
      );
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === entityId && componentId === HYPOXIC_COMPONENT_ID) {
            return { severity: 'severe', turnsInState: 8, actionPenalty: 4 };
          }
          if (
            id === entityId &&
            componentId === UNCONSCIOUS_ANOXIA_COMPONENT_ID
          ) {
            return { turnsUnconscious: 1, brainDamageStarted: false };
          }
          if (id === brainPartId && componentId === PART_COMPONENT_ID) {
            return { ownerEntityId: entityId };
          }
          if (id === brainPartId && componentId === VITAL_ORGAN_COMPONENT_ID) {
            return { organType: 'brain' };
          }
          if (id === brainPartId && componentId === PART_HEALTH_COMPONENT_ID) {
            return { currentHealth: 3, maxHealth: 100 }; // Less than damage amount
          }
          return null;
        }
      );
      mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
        if (
          id === entityId &&
          componentId === UNCONSCIOUS_ANOXIA_COMPONENT_ID
        ) {
          return true;
        }
        if (id === brainPartId && componentId === PART_HEALTH_COMPONENT_ID) {
          return true;
        }
        return false;
      });

      await system.processTick();

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        brainPartId,
        PART_HEALTH_COMPONENT_ID,
        { currentHealth: 0, maxHealth: 100 }
      );
    });

    it('should handle missing brain organ gracefully', async () => {
      const entityId = 'entity:actor1';
      mockEntityManager.getEntitiesWithComponent.mockImplementation(
        (componentId) => {
          if (componentId === HYPOXIC_COMPONENT_ID) {
            return [entityId];
          }
          if (componentId === VITAL_ORGAN_COMPONENT_ID) {
            return []; // No vital organs
          }
          return [];
        }
      );
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === entityId && componentId === HYPOXIC_COMPONENT_ID) {
            return { severity: 'severe', turnsInState: 8, actionPenalty: 4 };
          }
          if (
            id === entityId &&
            componentId === UNCONSCIOUS_ANOXIA_COMPONENT_ID
          ) {
            return { turnsUnconscious: 1, brainDamageStarted: false };
          }
          return null;
        }
      );
      mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
        return (
          id === entityId && componentId === UNCONSCIOUS_ANOXIA_COMPONENT_ID
        );
      });

      await system.processTick();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not find brain organ')
      );
    });

    it('should handle brain with no health component gracefully', async () => {
      const entityId = 'entity:actor1';
      const brainPartId = 'part:brain1';
      mockEntityManager.getEntitiesWithComponent.mockImplementation(
        (componentId) => {
          if (componentId === HYPOXIC_COMPONENT_ID) {
            return [entityId];
          }
          if (componentId === VITAL_ORGAN_COMPONENT_ID) {
            return [brainPartId];
          }
          return [];
        }
      );
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === entityId && componentId === HYPOXIC_COMPONENT_ID) {
            return { severity: 'severe', turnsInState: 8, actionPenalty: 4 };
          }
          if (
            id === entityId &&
            componentId === UNCONSCIOUS_ANOXIA_COMPONENT_ID
          ) {
            return { turnsUnconscious: 1, brainDamageStarted: false };
          }
          if (id === brainPartId && componentId === PART_COMPONENT_ID) {
            return { ownerEntityId: entityId };
          }
          if (id === brainPartId && componentId === VITAL_ORGAN_COMPONENT_ID) {
            return { organType: 'brain' };
          }
          // No health component
          return null;
        }
      );
      mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
        if (
          id === entityId &&
          componentId === UNCONSCIOUS_ANOXIA_COMPONENT_ID
        ) {
          return true;
        }
        // Brain has no health component
        return false;
      });

      await system.processTick();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('has no health component')
      );
    });

    it('should not apply brain damage if unconscious for less than 2 turns', async () => {
      const entityId = 'entity:actor1';
      mockEntityManager.getEntitiesWithComponent.mockImplementation(
        (componentId) => {
          if (componentId === HYPOXIC_COMPONENT_ID) {
            return [entityId];
          }
          return [];
        }
      );
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === entityId && componentId === HYPOXIC_COMPONENT_ID) {
            return { severity: 'severe', turnsInState: 8, actionPenalty: 4 };
          }
          if (
            id === entityId &&
            componentId === UNCONSCIOUS_ANOXIA_COMPONENT_ID
          ) {
            return { turnsUnconscious: 0, brainDamageStarted: false };
          }
          return null;
        }
      );
      mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
        return (
          id === entityId && componentId === UNCONSCIOUS_ANOXIA_COMPONENT_ID
        );
      });

      await system.processTick();

      // Should not dispatch brain damage event
      expect(mockDispatcher.dispatch).not.toHaveBeenCalledWith(
        BRAIN_DAMAGE_STARTED_EVENT,
        expect.anything()
      );
    });

    it('should skip non-brain vital organs when finding brain', async () => {
      const entityId = 'entity:actor1';
      const heartPartId = 'part:heart1';
      const brainPartId = 'part:brain1';
      mockEntityManager.getEntitiesWithComponent.mockImplementation(
        (componentId) => {
          if (componentId === HYPOXIC_COMPONENT_ID) {
            return [entityId];
          }
          if (componentId === VITAL_ORGAN_COMPONENT_ID) {
            return [heartPartId, brainPartId];
          }
          return [];
        }
      );
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === entityId && componentId === HYPOXIC_COMPONENT_ID) {
            return { severity: 'severe', turnsInState: 8, actionPenalty: 4 };
          }
          if (
            id === entityId &&
            componentId === UNCONSCIOUS_ANOXIA_COMPONENT_ID
          ) {
            return { turnsUnconscious: 1, brainDamageStarted: false };
          }
          if (id === heartPartId && componentId === PART_COMPONENT_ID) {
            return { ownerEntityId: entityId };
          }
          if (id === heartPartId && componentId === VITAL_ORGAN_COMPONENT_ID) {
            return { organType: 'heart' }; // Not a brain
          }
          if (id === brainPartId && componentId === PART_COMPONENT_ID) {
            return { ownerEntityId: entityId };
          }
          if (id === brainPartId && componentId === VITAL_ORGAN_COMPONENT_ID) {
            return { organType: 'brain' };
          }
          if (id === brainPartId && componentId === PART_HEALTH_COMPONENT_ID) {
            return { currentHealth: 100, maxHealth: 100 };
          }
          return null;
        }
      );
      mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
        if (
          id === entityId &&
          componentId === UNCONSCIOUS_ANOXIA_COMPONENT_ID
        ) {
          return true;
        }
        if (id === brainPartId && componentId === PART_HEALTH_COMPONENT_ID) {
          return true;
        }
        return false;
      });

      await system.processTick();

      // Should apply damage to brain, not heart
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        brainPartId,
        PART_HEALTH_COMPONENT_ID,
        expect.anything()
      );
    });

    it('should skip organs belonging to other entities', async () => {
      const entityId = 'entity:actor1';
      const otherBrainPartId = 'part:brain_other';
      mockEntityManager.getEntitiesWithComponent.mockImplementation(
        (componentId) => {
          if (componentId === HYPOXIC_COMPONENT_ID) {
            return [entityId];
          }
          if (componentId === VITAL_ORGAN_COMPONENT_ID) {
            return [otherBrainPartId];
          }
          return [];
        }
      );
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (id === entityId && componentId === HYPOXIC_COMPONENT_ID) {
            return { severity: 'severe', turnsInState: 8, actionPenalty: 4 };
          }
          if (
            id === entityId &&
            componentId === UNCONSCIOUS_ANOXIA_COMPONENT_ID
          ) {
            return { turnsUnconscious: 1, brainDamageStarted: false };
          }
          if (id === otherBrainPartId && componentId === PART_COMPONENT_ID) {
            return { ownerEntityId: 'entity:other_actor' }; // Different owner
          }
          if (
            id === otherBrainPartId &&
            componentId === VITAL_ORGAN_COMPONENT_ID
          ) {
            return { organType: 'brain' };
          }
          return null;
        }
      );
      mockEntityManager.hasComponent.mockImplementation((id, componentId) => {
        return (
          id === entityId && componentId === UNCONSCIOUS_ANOXIA_COMPONENT_ID
        );
      });

      await system.processTick();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not find brain organ')
      );
    });
  });

  describe('turn ended event handling', () => {
    it('should process tick when turn ended event fires', async () => {
      const entityId = 'entity:actor1';
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([entityId]);
      mockEntityManager.getComponentData.mockImplementation(
        (id, componentId) => {
          if (componentId === HYPOXIC_COMPONENT_ID) {
            return { severity: 'mild', turnsInState: 1, actionPenalty: 0 };
          }
          return null;
        }
      );

      // Trigger the turn ended callback
      await turnEndedCallback();

      expect(mockEntityManager.addComponent).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should unsubscribe from events', () => {
      const mockUnsubscribe = jest.fn();
      mockEventSubscriber.subscribe.mockReturnValue(mockUnsubscribe);

      const testSystem = new HypoxiaTickSystem({
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

      const testSystem = new HypoxiaTickSystem({
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
