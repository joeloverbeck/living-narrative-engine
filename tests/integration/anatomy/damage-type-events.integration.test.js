/**
 * Integration tests for damage type event payloads.
 * Verifies that all damage-related events emit correct payloads per spec.
 *
 * @see specs/damage-types-and-special-effects.md
 * @see tickets/DAMTYPANDSPEEFF-004-event-and-propagation-integration.md
 */

import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import BleedingTickSystem from '../../../src/anatomy/services/bleedingTickSystem.js';
import BurningTickSystem from '../../../src/anatomy/services/burningTickSystem.js';
import DamageTypeEffectsService from '../../../src/anatomy/services/damageTypeEffectsService.js';

// Event constants from the service
import {
  BLEEDING_STOPPED_EVENT,
  BURNING_STOPPED_EVENT,
  BLEEDING_COMPONENT_ID,
  BURNING_COMPONENT_ID,
} from '../../../src/anatomy/services/damageTypeEffectsService.js';

const PART_COMPONENT_ID = 'anatomy:part';
const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';

const ids = {
  entity: 'entity-1',
  part: 'part-1',
};

/**
 * Creates a mock entity manager that returns entity IDs (strings) from getEntitiesWithComponent,
 * matching the expected behavior of the real EntityManager when used with tick systems.
 */
function createMockEntityManager() {
  const components = new Map();

  return {
    getComponentData: jest.fn((entityId, componentId) => {
      const key = `${entityId}:${componentId}`;
      return components.get(key) ?? null;
    }),
    addComponent: jest.fn(async (entityId, componentId, data) => {
      const key = `${entityId}:${componentId}`;
      components.set(key, data);
    }),
    removeComponent: jest.fn(async (entityId, componentId) => {
      const key = `${entityId}:${componentId}`;
      components.delete(key);
    }),
    hasComponent: jest.fn((entityId, componentId) => {
      const key = `${entityId}:${componentId}`;
      return components.has(key);
    }),
    getEntitiesWithComponent: jest.fn((componentId) => {
      // Return entity IDs (strings) that have the component
      const result = [];
      for (const key of components.keys()) {
        if (key.endsWith(`:${componentId}`)) {
          const entityId = key.substring(0, key.length - componentId.length - 1);
          if (!result.includes(entityId)) {
            result.push(entityId);
          }
        }
      }
      return result;
    }),
    // Helper to set up component data directly
    _setComponent: (entityId, componentId, data) => {
      const key = `${entityId}:${componentId}`;
      components.set(key, data);
    },
    _clearComponents: () => {
      components.clear();
    },
  };
}

describe('Damage Type Event Payloads', () => {
  /** @type {ReturnType<typeof createMockEntityManager>} */
  let entityManager;
  /** @type {import('../../../src/interfaces/coreServices.js').ILogger} */
  let logger;
  /** @type {{ dispatch: jest.Mock }} */
  let dispatcher;
  /** @type {{ subscribe: jest.Mock }} */
  let eventSubscriber;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    dispatcher = { dispatch: jest.fn() };
    eventSubscriber = { subscribe: jest.fn().mockReturnValue(() => {}) };
    entityManager = createMockEntityManager();

    // Set up basic part with owner entity
    entityManager._setComponent(ids.part, PART_COMPONENT_ID, {
      ownerEntityId: ids.entity,
      subType: 'torso',
    });
    entityManager._setComponent(ids.part, PART_HEALTH_COMPONENT_ID, {
      currentHealth: 100,
      maxHealth: 100,
      state: 'healthy',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('BleedingTickSystem stopped events', () => {
    /** @type {BleedingTickSystem} */
    let bleedingSystem;

    beforeEach(() => {
      bleedingSystem = new BleedingTickSystem({
        logger,
        entityManager,
        safeEventDispatcher: dispatcher,
        validatedEventDispatcher: eventSubscriber,
      });
    });

    afterEach(() => {
      bleedingSystem.destroy();
    });

    test('should include entityId in bleeding_stopped event when duration expires', async () => {
      // Arrange - add bleeding component with 1 turn remaining
      await entityManager.addComponent(ids.part, BLEEDING_COMPONENT_ID, {
        severity: 'moderate',
        remainingTurns: 1,
        tickDamage: 3,
      });

      // Act - process tick (should expire and emit stopped event)
      await bleedingSystem.processTick();

      // Assert
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        BLEEDING_STOPPED_EVENT,
        expect.objectContaining({
          entityId: ids.entity,
          partId: ids.part,
          severity: 'moderate',
          reason: 'duration_expired',
          timestamp: expect.any(Number),
        })
      );
    });

    test('should include entityId in bleeding_stopped event when part is destroyed', async () => {
      // Arrange - set part health to 0 (destroyed)
      await entityManager.addComponent(ids.part, PART_HEALTH_COMPONENT_ID, {
        currentHealth: 0,
        maxHealth: 100,
        state: 'destroyed',
      });
      await entityManager.addComponent(ids.part, BLEEDING_COMPONENT_ID, {
        severity: 'severe',
        remainingTurns: 5,
        tickDamage: 5,
      });

      // Act
      await bleedingSystem.processTick();

      // Assert
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        BLEEDING_STOPPED_EVENT,
        expect.objectContaining({
          entityId: ids.entity,
          partId: ids.part,
          severity: 'severe',
          reason: 'part_destroyed',
        })
      );
    });

    test('should handle missing part component gracefully (entityId as null)', async () => {
      // Arrange - part without anatomy:part component
      const orphanPartId = 'orphan-part';
      await entityManager.addComponent(orphanPartId, PART_HEALTH_COMPONENT_ID, {
        currentHealth: 100,
        maxHealth: 100,
      });
      await entityManager.addComponent(orphanPartId, BLEEDING_COMPONENT_ID, {
        severity: 'minor',
        remainingTurns: 1,
        tickDamage: 1,
      });

      // Act
      await bleedingSystem.processTick();

      // Assert - should still emit event with null entityId
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        BLEEDING_STOPPED_EVENT,
        expect.objectContaining({
          entityId: null,
          partId: orphanPartId,
          severity: 'minor',
        })
      );
    });
  });

  describe('BurningTickSystem stopped events', () => {
    /** @type {BurningTickSystem} */
    let burningSystem;

    beforeEach(() => {
      burningSystem = new BurningTickSystem({
        logger,
        entityManager,
        safeEventDispatcher: dispatcher,
        validatedEventDispatcher: eventSubscriber,
      });
    });

    afterEach(() => {
      burningSystem.destroy();
    });

    test('should include entityId in burning_stopped event when duration expires', async () => {
      // Arrange - add burning component with 1 turn remaining
      await entityManager.addComponent(ids.part, BURNING_COMPONENT_ID, {
        remainingTurns: 1,
        tickDamage: 2,
        stackedCount: 3,
      });

      // Act
      await burningSystem.processTick();

      // Assert
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        BURNING_STOPPED_EVENT,
        expect.objectContaining({
          entityId: ids.entity,
          partId: ids.part,
          stackedCount: 3,
          reason: 'duration_expired',
          timestamp: expect.any(Number),
        })
      );
    });

    test('should include entityId in burning_stopped event when part is destroyed', async () => {
      // Arrange - set part health to 0 (destroyed)
      await entityManager.addComponent(ids.part, PART_HEALTH_COMPONENT_ID, {
        currentHealth: 0,
        maxHealth: 100,
        state: 'destroyed',
      });
      await entityManager.addComponent(ids.part, BURNING_COMPONENT_ID, {
        remainingTurns: 5,
        tickDamage: 10,
        stackedCount: 2,
      });

      // Act
      await burningSystem.processTick();

      // Assert
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        BURNING_STOPPED_EVENT,
        expect.objectContaining({
          entityId: ids.entity,
          partId: ids.part,
          stackedCount: 2,
          reason: 'part_destroyed',
        })
      );
    });

    test('should handle missing part component gracefully (entityId as null)', async () => {
      // Arrange - part without anatomy:part component
      const orphanPartId = 'orphan-part';
      await entityManager.addComponent(orphanPartId, PART_HEALTH_COMPONENT_ID, {
        currentHealth: 100,
        maxHealth: 100,
      });
      await entityManager.addComponent(orphanPartId, BURNING_COMPONENT_ID, {
        remainingTurns: 1,
        tickDamage: 1,
        stackedCount: 1,
      });

      // Act
      await burningSystem.processTick();

      // Assert - should still emit event with null entityId
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        BURNING_STOPPED_EVENT,
        expect.objectContaining({
          entityId: null,
          partId: orphanPartId,
          stackedCount: 1,
        })
      );
    });
  });

  describe('DamageTypeEffectsService started events', () => {
    /** @type {DamageTypeEffectsService} */
    let effectsService;
    /** @type {{ get: jest.Mock }} */
    let dataRegistry;

    beforeEach(() => {
      dataRegistry = { get: jest.fn() };
      effectsService = new DamageTypeEffectsService({
        logger,
        entityManager,
        dataRegistry,
        safeEventDispatcher: dispatcher,
        rngProvider: () => 0.5, // Deterministic RNG
      });
    });

    test('should emit bleeding_started event with entityId and partId', async () => {
      // Arrange
      dataRegistry.get.mockReturnValue({
        id: 'slashing',
        bleed: { enabled: true, severity: 'moderate', baseDurationTurns: 3 },
      });

      // Act
      await effectsService.applyEffectsForDamage({
        entityId: ids.entity,
        partId: ids.part,
        amount: 20,
        damageType: 'slashing',
        maxHealth: 100,
        currentHealth: 80,
      });

      // Assert
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'anatomy:bleeding_started',
        expect.objectContaining({
          entityId: ids.entity,
          partId: ids.part,
          severity: 'moderate',
          timestamp: expect.any(Number),
        })
      );
    });

    test('should emit burning_started event with entityId, partId, and stackedCount', async () => {
      // Arrange
      dataRegistry.get.mockReturnValue({
        id: 'fire',
        burn: { enabled: true, dps: 5, durationTurns: 2, canStack: false },
      });

      // Act
      await effectsService.applyEffectsForDamage({
        entityId: ids.entity,
        partId: ids.part,
        amount: 15,
        damageType: 'fire',
        maxHealth: 100,
        currentHealth: 85,
      });

      // Assert
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'anatomy:burning_started',
        expect.objectContaining({
          entityId: ids.entity,
          partId: ids.part,
          stackedCount: 1,
          timestamp: expect.any(Number),
        })
      );
    });

    test('should emit poisoned_started event with scope-based fields', async () => {
      // Arrange - entity-scoped poison
      dataRegistry.get.mockReturnValue({
        id: 'poison',
        poison: { enabled: true, tick: 2, durationTurns: 4, scope: 'entity' },
      });

      // Act
      await effectsService.applyEffectsForDamage({
        entityId: ids.entity,
        partId: ids.part,
        amount: 10,
        damageType: 'poison',
        maxHealth: 100,
        currentHealth: 90,
      });

      // Assert
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'anatomy:poisoned_started',
        expect.objectContaining({
          entityId: ids.entity,
          partId: undefined, // Entity-scoped, no partId
          scope: 'entity',
          timestamp: expect.any(Number),
        })
      );
    });

    test('should emit poisoned_started event with partId when part-scoped', async () => {
      // Arrange - part-scoped poison
      dataRegistry.get.mockReturnValue({
        id: 'venom',
        poison: { enabled: true, tick: 3, durationTurns: 3, scope: 'part' },
      });

      // Act
      await effectsService.applyEffectsForDamage({
        entityId: ids.entity,
        partId: ids.part,
        amount: 12,
        damageType: 'venom',
        maxHealth: 100,
        currentHealth: 88,
      });

      // Assert
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'anatomy:poisoned_started',
        expect.objectContaining({
          entityId: ids.entity,
          partId: ids.part,
          scope: 'part',
        })
      );
    });

    test('should log warning and skip effects for unknown damage type', async () => {
      // Arrange - dataRegistry returns undefined
      dataRegistry.get.mockReturnValue(undefined);

      // Act
      await effectsService.applyEffectsForDamage({
        entityId: ids.entity,
        partId: ids.part,
        amount: 25,
        damageType: 'unknown_damage',
        maxHealth: 100,
        currentHealth: 75,
      });

      // Assert - no events dispatched, warning logged
      expect(dispatcher.dispatch).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown damage type'),
        expect.objectContaining({ damageType: 'unknown_damage' })
      );
    });
  });

  describe('Event payload consistency', () => {
    test('stopped events should always have timestamp field', async () => {
      // Arrange
      const burningSystem = new BurningTickSystem({
        logger,
        entityManager,
        safeEventDispatcher: dispatcher,
        validatedEventDispatcher: eventSubscriber,
      });

      await entityManager.addComponent(ids.part, BURNING_COMPONENT_ID, {
        remainingTurns: 1,
        tickDamage: 1,
        stackedCount: 1,
      });

      // Act
      await burningSystem.processTick();

      // Assert
      const call = dispatcher.dispatch.mock.calls.find(
        (c) => c[0] === BURNING_STOPPED_EVENT
      );
      expect(call).toBeDefined();
      expect(call[1].timestamp).toBeGreaterThan(0);

      burningSystem.destroy();
    });
  });
});
