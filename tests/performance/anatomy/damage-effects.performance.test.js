/**
 * @file Performance tests for Damage Effects Systems
 * Tests tick system throughput on large anatomies, duplicate event prevention,
 * and cleanup on entity destruction.
 * @see specs/damage-types-and-special-effects.md
 * @see tickets/DAMTYPANDSPEEFF-005-testing-and-performance-coverage.md
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import BleedingTickSystem from '../../../src/anatomy/services/bleedingTickSystem.js';
import BurningTickSystem from '../../../src/anatomy/services/burningTickSystem.js';
import PoisonTickSystem from '../../../src/anatomy/services/poisonTickSystem.js';
import {
  BLEEDING_COMPONENT_ID,
  BLEEDING_STOPPED_EVENT,
  BURNING_COMPONENT_ID,
  BURNING_STOPPED_EVENT,
  POISONED_COMPONENT_ID,
  POISONED_STOPPED_EVENT,
} from '../../../src/anatomy/services/damageTypeEffectsService.js';

const PART_COMPONENT_ID = 'anatomy:part';
const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';

/**
 * Performance thresholds in milliseconds
 */
const PERFORMANCE_THRESHOLDS = {
  LARGE_ANATOMY_TICK: 200, // 200ms budget for ticking 100 parts with effects
  SINGLE_TICK_OVERHEAD: 50, // 50ms max overhead per individual tick
  CLEANUP_BUDGET: 100, // 100ms to cleanup all components on destruction
};

/**
 * Creates a mock entity manager with bulk part support for performance testing
 *
 * @returns {object} Mock entity manager with helper methods
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
    _setComponent: (entityId, componentId, data) => {
      const key = `${entityId}:${componentId}`;
      components.set(key, data);
    },
    _clearComponents: () => {
      components.clear();
    },
    _getComponentCount: () => components.size,
    _getAllKeys: () => [...components.keys()],
  };
}

/**
 * Creates a mock logger for testing
 *
 * @returns {object} Mock logger
 */
function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

describe('Damage Effects - Performance Tests', () => {
  let entityManager;
  let logger;
  let dispatcher;
  let eventSubscriber;
  let systems;

  beforeEach(() => {
    entityManager = createMockEntityManager();
    logger = createMockLogger();
    dispatcher = { dispatch: jest.fn() };
    eventSubscriber = { subscribe: jest.fn().mockReturnValue(() => {}) };

    systems = {
      bleeding: new BleedingTickSystem({
        logger,
        entityManager,
        safeEventDispatcher: dispatcher,
        validatedEventDispatcher: eventSubscriber,
      }),
      burning: new BurningTickSystem({
        logger,
        entityManager,
        safeEventDispatcher: dispatcher,
        validatedEventDispatcher: eventSubscriber,
      }),
      poison: new PoisonTickSystem({
        logger,
        entityManager,
        safeEventDispatcher: dispatcher,
        validatedEventDispatcher: eventSubscriber,
      }),
    };
  });

  afterEach(() => {
    systems.bleeding.destroy();
    systems.burning.destroy();
    systems.poison.destroy();
    jest.clearAllMocks();
  });

  /**
   * Sets up a large anatomy with the specified number of parts
   *
   * @param {number} partCount - Number of parts to create
   * @param {string} entityId - Owner entity ID
   * @returns {string[]} Array of part IDs
   */
  function setupLargeAnatomy(partCount, entityId = 'entity-1') {
    const partIds = [];
    for (let i = 0; i < partCount; i++) {
      const partId = `part-${i}`;
      partIds.push(partId);

      entityManager._setComponent(partId, PART_COMPONENT_ID, {
        ownerEntityId: entityId,
        subType: i % 5 === 0 ? 'vital' : 'limb',
      });
      entityManager._setComponent(partId, PART_HEALTH_COMPONENT_ID, {
        currentHealth: 100,
        maxHealth: 100,
        state: 'healthy',
      });
    }
    return partIds;
  }

  /**
   * Adds bleeding effects to all parts
   *
   * @param {string[]} partIds - Array of part IDs
   * @param {number} remainingTurns - Initial remaining turns
   */
  function addBleedingToAllParts(partIds, remainingTurns = 3) {
    for (const partId of partIds) {
      entityManager._setComponent(partId, BLEEDING_COMPONENT_ID, {
        severity: 'moderate',
        remainingTurns,
        tickDamage: 3,
      });
    }
  }

  /**
   * Adds burning effects to all parts
   *
   * @param {string[]} partIds - Array of part IDs
   * @param {number} remainingTurns - Initial remaining turns
   */
  function addBurningToAllParts(partIds, remainingTurns = 3) {
    for (const partId of partIds) {
      entityManager._setComponent(partId, BURNING_COMPONENT_ID, {
        remainingTurns,
        tickDamage: 2,
        stackedCount: 1,
      });
    }
  }

  /**
   * Adds poison effects to all parts
   *
   * @param {string[]} partIds - Array of part IDs
   * @param {number} remainingTurns - Initial remaining turns
   */
  function addPoisonToAllParts(partIds, remainingTurns = 3) {
    for (const partId of partIds) {
      entityManager._setComponent(partId, POISONED_COMPONENT_ID, {
        remainingTurns,
        tickDamage: 2,
      });
    }
  }

  describe('Large Anatomy Tick Performance', () => {
    it('should process BleedingTickSystem on 100 parts within budget', async () => {
      // Arrange - large anatomy with bleeding on all parts
      const partIds = setupLargeAnatomy(100);
      addBleedingToAllParts(partIds, 5);

      // Act - measure tick time
      const startTime = performance.now();
      await systems.bleeding.processTick();
      const endTime = performance.now();
      const tickTime = endTime - startTime;

      // Assert - within performance budget
      expect(tickTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_ANATOMY_TICK);
      console.log(`BleedingTickSystem 100 parts: ${tickTime.toFixed(2)}ms`);

      // Verify effects were processed (health reduced)
      const firstPartHealth = entityManager.getComponentData(
        partIds[0],
        PART_HEALTH_COMPONENT_ID
      );
      expect(firstPartHealth.currentHealth).toBe(97); // 100 - 3 tickDamage
    });

    it('should process BurningTickSystem on 100 parts within budget', async () => {
      // Arrange
      const partIds = setupLargeAnatomy(100);
      addBurningToAllParts(partIds, 5);

      // Act
      const startTime = performance.now();
      await systems.burning.processTick();
      const endTime = performance.now();
      const tickTime = endTime - startTime;

      // Assert
      expect(tickTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_ANATOMY_TICK);
      console.log(`BurningTickSystem 100 parts: ${tickTime.toFixed(2)}ms`);

      const firstPartHealth = entityManager.getComponentData(
        partIds[0],
        PART_HEALTH_COMPONENT_ID
      );
      expect(firstPartHealth.currentHealth).toBe(98); // 100 - 2 tickDamage
    });

    it('should process PoisonTickSystem on 100 parts within budget', async () => {
      // Arrange
      const partIds = setupLargeAnatomy(100);
      addPoisonToAllParts(partIds, 5);

      // Act
      const startTime = performance.now();
      await systems.poison.processTick();
      const endTime = performance.now();
      const tickTime = endTime - startTime;

      // Assert
      expect(tickTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_ANATOMY_TICK);
      console.log(`PoisonTickSystem 100 parts: ${tickTime.toFixed(2)}ms`);
    });

    it('should handle all three systems concurrently on large anatomy', async () => {
      // Arrange - 100 parts with all three effects
      const partIds = setupLargeAnatomy(100);
      addBleedingToAllParts(partIds, 5);
      addBurningToAllParts(partIds, 5);
      addPoisonToAllParts(partIds, 5);

      // Act - run all systems
      const startTime = performance.now();
      await Promise.all([
        systems.bleeding.processTick(),
        systems.burning.processTick(),
        systems.poison.processTick(),
      ]);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Assert - combined should still be within reasonable budget
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_ANATOMY_TICK * 2);
      console.log(`All three systems on 100 parts: ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('No Duplicate Events', () => {
    it('should emit exactly one bleeding_stopped event per expiring part', async () => {
      // Arrange - multiple parts expiring on same tick
      const partIds = setupLargeAnatomy(10);
      addBleedingToAllParts(partIds, 1); // Will expire on first tick

      // Act
      await systems.bleeding.processTick();

      // Assert - exactly 10 stopped events
      const stoppedEvents = dispatcher.dispatch.mock.calls.filter(
        ([eventId]) => eventId === BLEEDING_STOPPED_EVENT
      );
      expect(stoppedEvents).toHaveLength(10);

      // Each part should have exactly one event
      const partIdsWithEvents = new Set(
        stoppedEvents.map(([, payload]) => payload.partId)
      );
      expect(partIdsWithEvents.size).toBe(10);
    });

    it('should emit exactly one burning_stopped event per expiring part', async () => {
      // Arrange
      const partIds = setupLargeAnatomy(10);
      addBurningToAllParts(partIds, 1);

      // Act
      await systems.burning.processTick();

      // Assert
      const stoppedEvents = dispatcher.dispatch.mock.calls.filter(
        ([eventId]) => eventId === BURNING_STOPPED_EVENT
      );
      expect(stoppedEvents).toHaveLength(10);

      const partIdsWithEvents = new Set(
        stoppedEvents.map(([, payload]) => payload.partId)
      );
      expect(partIdsWithEvents.size).toBe(10);
    });

    it('should emit exactly one poisoned_stopped event per expiring part', async () => {
      // Arrange
      const partIds = setupLargeAnatomy(10);
      addPoisonToAllParts(partIds, 1);

      // Act
      await systems.poison.processTick();

      // Assert
      const stoppedEvents = dispatcher.dispatch.mock.calls.filter(
        ([eventId]) => eventId === POISONED_STOPPED_EVENT
      );
      expect(stoppedEvents).toHaveLength(10);

      const partIdsWithEvents = new Set(
        stoppedEvents.map(([, payload]) => payload.partId)
      );
      expect(partIdsWithEvents.size).toBe(10);
    });

    it('should not emit duplicate events when multiple effects expire simultaneously', async () => {
      // Arrange - same parts with multiple effects expiring at once
      const partIds = setupLargeAnatomy(5);
      addBleedingToAllParts(partIds, 1);
      addBurningToAllParts(partIds, 1);
      addPoisonToAllParts(partIds, 1);

      // Act - process all systems
      await systems.bleeding.processTick();
      await systems.burning.processTick();
      await systems.poison.processTick();

      // Assert - exactly 5 events per system type
      const bleedingEvents = dispatcher.dispatch.mock.calls.filter(
        ([eventId]) => eventId === BLEEDING_STOPPED_EVENT
      );
      const burningEvents = dispatcher.dispatch.mock.calls.filter(
        ([eventId]) => eventId === BURNING_STOPPED_EVENT
      );
      const poisonEvents = dispatcher.dispatch.mock.calls.filter(
        ([eventId]) => eventId === POISONED_STOPPED_EVENT
      );

      expect(bleedingEvents).toHaveLength(5);
      expect(burningEvents).toHaveLength(5);
      expect(poisonEvents).toHaveLength(5);

      // Total events should be 15 (5 parts * 3 effect types)
      const totalStoppedEvents = dispatcher.dispatch.mock.calls.filter(([eventId]) =>
        eventId.endsWith('_stopped')
      );
      expect(totalStoppedEvents).toHaveLength(15);
    });
  });

  describe('Entity Cleanup', () => {
    it('should remove bleeding components when part is destroyed', async () => {
      // Arrange
      const partIds = setupLargeAnatomy(10);
      addBleedingToAllParts(partIds, 5);

      // Mark all parts as destroyed (health = 0)
      for (const partId of partIds) {
        entityManager._setComponent(partId, PART_HEALTH_COMPONENT_ID, {
          currentHealth: 0,
          maxHealth: 100,
          state: 'destroyed',
        });
      }

      // Act
      const startTime = performance.now();
      await systems.bleeding.processTick();
      const cleanupTime = performance.now() - startTime;

      // Assert - cleanup within budget
      expect(cleanupTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CLEANUP_BUDGET);
      console.log(`Bleeding cleanup 10 destroyed parts: ${cleanupTime.toFixed(2)}ms`);

      // All bleeding components should be removed
      expect(entityManager.removeComponent).toHaveBeenCalledTimes(10);

      // All stopped events should have part_destroyed reason
      const stoppedEvents = dispatcher.dispatch.mock.calls.filter(
        ([eventId]) => eventId === BLEEDING_STOPPED_EVENT
      );
      expect(stoppedEvents).toHaveLength(10);
      for (const [, payload] of stoppedEvents) {
        expect(payload.reason).toBe('part_destroyed');
      }
    });

    it('should remove burning components when part is destroyed', async () => {
      // Arrange
      const partIds = setupLargeAnatomy(10);
      addBurningToAllParts(partIds, 5);

      // Mark all parts as destroyed
      for (const partId of partIds) {
        entityManager._setComponent(partId, PART_HEALTH_COMPONENT_ID, {
          currentHealth: 0,
          maxHealth: 100,
          state: 'destroyed',
        });
      }

      // Act
      await systems.burning.processTick();

      // Assert
      expect(entityManager.removeComponent).toHaveBeenCalledTimes(10);

      const stoppedEvents = dispatcher.dispatch.mock.calls.filter(
        ([eventId]) => eventId === BURNING_STOPPED_EVENT
      );
      expect(stoppedEvents).toHaveLength(10);
      for (const [, payload] of stoppedEvents) {
        expect(payload.reason).toBe('part_destroyed');
      }
    });

    it('should handle mixed destroyed and active parts correctly', async () => {
      // Arrange - 10 parts, 5 destroyed
      const partIds = setupLargeAnatomy(10);
      addBleedingToAllParts(partIds, 3);

      // Mark only odd-indexed parts as destroyed
      for (let i = 0; i < partIds.length; i++) {
        if (i % 2 === 1) {
          entityManager._setComponent(partIds[i], PART_HEALTH_COMPONENT_ID, {
            currentHealth: 0,
            maxHealth: 100,
            state: 'destroyed',
          });
        }
      }

      // Act
      await systems.bleeding.processTick();

      // Assert - 5 removed (destroyed), 5 still active (decremented)
      expect(entityManager.removeComponent).toHaveBeenCalledTimes(5);

      // Check destroyed parts emitted stopped events
      const stoppedEvents = dispatcher.dispatch.mock.calls.filter(
        ([eventId]) => eventId === BLEEDING_STOPPED_EVENT
      );
      expect(stoppedEvents).toHaveLength(5);

      // Check active parts still have bleeding with decremented turns
      const activeParts = partIds.filter((_, i) => i % 2 === 0);
      activeParts.forEach((partId) => {
        const bleeding = entityManager.getComponentData(
          partId,
          BLEEDING_COMPONENT_ID
        );
        expect(bleeding).not.toBeNull();
        expect(bleeding.remainingTurns).toBe(2); // 3 - 1
      });
    });
  });

  describe('Performance Stability', () => {
    it('should maintain stable performance across multiple ticks', async () => {
      // Arrange
      const partIds = setupLargeAnatomy(50);
      addBleedingToAllParts(partIds, 10);

      const tickTimes = [];

      // Act - perform multiple ticks
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        await systems.bleeding.processTick();
        tickTimes.push(performance.now() - startTime);
      }

      // Assert - no tick should be dramatically slower than others
      const avgTime = tickTimes.reduce((a, b) => a + b, 0) / tickTimes.length;
      const maxTime = Math.max(...tickTimes);

      console.log(
        `5 ticks on 50 parts - avg: ${avgTime.toFixed(2)}ms, max: ${maxTime.toFixed(2)}ms`
      );

      // Max should not exceed 3x the average (allowing for variance)
      expect(maxTime).toBeLessThan(avgTime * 3 + 10); // +10ms grace period
    });

    it('should scale linearly with part count', async () => {
      const sizes = [10, 25, 50, 100];
      const times = [];

      for (const size of sizes) {
        entityManager._clearComponents();
        const partIds = setupLargeAnatomy(size);
        addBleedingToAllParts(partIds, 5);

        const startTime = performance.now();
        await systems.bleeding.processTick();
        const tickTime = performance.now() - startTime;
        times.push(tickTime);
      }

      console.log(`Scaling test - sizes: ${sizes.join(', ')}, times: ${times.map((t) => t.toFixed(2)).join(', ')}ms`);

      // Time should scale roughly linearly (with some overhead)
      // The ratio between sizes should roughly match ratio between times
      // 100 parts should not take more than 15x as long as 10 parts
      // (allowing for fixed overhead and variance)
      expect(times[3]).toBeLessThan(times[0] * 15 + 50);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak component references after expiration', async () => {
      // Arrange
      const partIds = setupLargeAnatomy(20);
      addBleedingToAllParts(partIds, 1); // Will expire immediately

      const initialComponentCount = entityManager._getComponentCount();

      // Act
      await systems.bleeding.processTick();

      // Assert - bleeding components should be removed
      const remainingBleedingComponents = entityManager
        ._getAllKeys()
        .filter((key) => key.endsWith(`:${BLEEDING_COMPONENT_ID}`));

      expect(remainingBleedingComponents).toHaveLength(0);

      // Should have fewer components after cleanup
      const finalComponentCount = entityManager._getComponentCount();
      expect(finalComponentCount).toBeLessThan(initialComponentCount);
    });

    it('should properly clean up all effect types simultaneously', async () => {
      // Arrange - all effects expiring at once
      const partIds = setupLargeAnatomy(10);
      addBleedingToAllParts(partIds, 1);
      addBurningToAllParts(partIds, 1);
      addPoisonToAllParts(partIds, 1);

      // Act
      await systems.bleeding.processTick();
      await systems.burning.processTick();
      await systems.poison.processTick();

      // Assert - no effect components should remain
      const allKeys = entityManager._getAllKeys();
      const effectComponents = allKeys.filter(
        (key) =>
          key.endsWith(`:${BLEEDING_COMPONENT_ID}`) ||
          key.endsWith(`:${BURNING_COMPONENT_ID}`) ||
          key.endsWith(`:${POISONED_COMPONENT_ID}`)
      );

      expect(effectComponents).toHaveLength(0);
    });
  });
});
