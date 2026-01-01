/**
 * @file Shared test fixtures for Damage Simulator integration tests
 * @description Provides common test setup utilities following the pattern from
 * tests/integration/anatomy/damage-application.integration.test.js
 * @see DamageSimulatorUI.js - Main UI controller
 * @see DamageExecutionService.js - Damage execution service
 * @see MultiHitSimulator.js - Multi-hit simulation component
 */

import { jest } from '@jest/globals';
import SimpleEntityManager from '../entities/simpleEntityManager.js';

// Component IDs used across damage simulator tests
export const COMPONENT_IDS = Object.freeze({
  PART: 'anatomy:part',
  PART_HEALTH: 'anatomy:part_health',
  BODY: 'anatomy:body',
  NAME: 'core:name',
});

// Event IDs for damage simulator
export const EVENT_IDS = Object.freeze({
  EXECUTION_STARTED: 'damage-simulator:execution-started',
  EXECUTION_COMPLETE: 'damage-simulator:execution-complete',
  EXECUTION_ERROR: 'damage-simulator:execution-error',
  SIMULATION_PROGRESS: 'damage-simulator:simulation-progress',
  SIMULATION_COMPLETE: 'damage-simulator:simulation-complete',
  SIMULATION_STOPPED: 'damage-simulator:simulation-stopped',
  DAMAGE_APPLIED: 'anatomy:damage_applied',
});

/**
 * Standard test damage entry used across tests.
 * Matches the damage-capability-entry.schema.json format with required 'name' field.
 */
export const SAMPLE_DAMAGE_ENTRY = Object.freeze({
  amount: 15,
  name: 'slashing',
  penetration: 0.3,
});

/**
 * Alternative damage entry for testing variations
 */
export const HIGH_DAMAGE_ENTRY = Object.freeze({
  amount: 50,
  name: 'crushing',
  penetration: 0.0,
});

/**
 * Entity definition ID used in tests
 */
export const SAMPLE_ENTITY_DEF = 'test_humanoid';

/**
 * Standard test entity IDs
 */
export const TEST_ENTITY_IDS = Object.freeze({
  actor: 'test-actor-1',
  torso: 'test-torso-1',
  head: 'test-head-1',
  leftArm: 'test-left-arm-1',
  rightArm: 'test-right-arm-1',
});

/**
 * Creates a mock logger matching the ILogger interface
 * @returns {Object} Mock logger with jest.fn() for each method
 */
export function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 * Creates a mock event dispatcher
 * @returns {Object} Mock dispatcher with jest.fn() dispatch method
 */
export function createMockDispatcher() {
  return {
    dispatch: jest.fn().mockResolvedValue(true),
    subscribe: jest.fn().mockReturnValue(() => {}),
    unsubscribe: jest.fn(),
  };
}

/**
 * Creates mock anatomy data for testing
 * @returns {Object} Anatomy data with parts array
 */
export function createMockAnatomyData() {
  return {
    parts: [
      {
        id: TEST_ENTITY_IDS.torso,
        name: 'Torso',
        currentHealth: 100,
        maxHealth: 100,
        weight: 50,
        component: { subType: 'torso', hit_probability_weight: 50 },
      },
      {
        id: TEST_ENTITY_IDS.head,
        name: 'Head',
        currentHealth: 50,
        maxHealth: 50,
        weight: 30,
        component: { subType: 'head', hit_probability_weight: 30 },
      },
      {
        id: TEST_ENTITY_IDS.leftArm,
        name: 'Left Arm',
        currentHealth: 30,
        maxHealth: 30,
        weight: 10,
        component: { subType: 'arm', hit_probability_weight: 10 },
      },
      {
        id: TEST_ENTITY_IDS.rightArm,
        name: 'Right Arm',
        currentHealth: 30,
        maxHealth: 30,
        weight: 10,
        component: { subType: 'arm', hit_probability_weight: 10 },
      },
    ],
  };
}

/**
 * Seeds a SimpleEntityManager with test anatomy data.
 * Follows the pattern from damage-application.integration.test.js
 * @param {SimpleEntityManager} entityManager - Entity manager to seed
 * @param {Object} [options] - Configuration options
 * @param {string} [options.actorId] - Actor entity ID
 * @returns {Promise<Object>} Object containing entity IDs
 */
export async function seedTestAnatomy(entityManager, options = {}) {
  const ids = {
    actor: options.actorId || TEST_ENTITY_IDS.actor,
    torso: TEST_ENTITY_IDS.torso,
    head: TEST_ENTITY_IDS.head,
    leftArm: TEST_ENTITY_IDS.leftArm,
    rightArm: TEST_ENTITY_IDS.rightArm,
  };

  // Add body component to actor
  await entityManager.addComponent(ids.actor, COMPONENT_IDS.BODY, {
    recipeId: 'test:humanoid',
    body: {
      root: ids.torso,
      parts: {
        torso: ids.torso,
        head: ids.head,
        left_arm: ids.leftArm,
        right_arm: ids.rightArm,
      },
    },
  });

  // Add name component
  await entityManager.addComponent(ids.actor, COMPONENT_IDS.NAME, {
    name: 'Test Actor',
  });

  // Add torso
  await entityManager.addComponent(ids.torso, COMPONENT_IDS.PART, {
    subType: 'torso',
    ownerEntityId: ids.actor,
    hit_probability_weight: 50,
  });
  await entityManager.addComponent(ids.torso, COMPONENT_IDS.PART_HEALTH, {
    currentHealth: 100,
    maxHealth: 100,
  });

  // Add head
  await entityManager.addComponent(ids.head, COMPONENT_IDS.PART, {
    subType: 'head',
    ownerEntityId: ids.actor,
    hit_probability_weight: 30,
  });
  await entityManager.addComponent(ids.head, COMPONENT_IDS.PART_HEALTH, {
    currentHealth: 50,
    maxHealth: 50,
  });

  // Add left arm
  await entityManager.addComponent(ids.leftArm, COMPONENT_IDS.PART, {
    subType: 'arm',
    ownerEntityId: ids.actor,
    hit_probability_weight: 10,
  });
  await entityManager.addComponent(ids.leftArm, COMPONENT_IDS.PART_HEALTH, {
    currentHealth: 30,
    maxHealth: 30,
  });

  // Add right arm
  await entityManager.addComponent(ids.rightArm, COMPONENT_IDS.PART, {
    subType: 'arm',
    ownerEntityId: ids.actor,
    hit_probability_weight: 10,
  });
  await entityManager.addComponent(ids.rightArm, COMPONENT_IDS.PART_HEALTH, {
    currentHealth: 30,
    maxHealth: 30,
  });

  return ids;
}

/**
 * Creates a damage simulator test context with real services and mocked boundaries.
 * This is the main entry point for integration tests.
 * @returns {Promise<Object>} Test context with services and cleanup function
 */
export async function createDamageSimulatorTestContext() {
  const logger = createMockLogger();
  const dispatcher = createMockDispatcher();
  const entityManager = new SimpleEntityManager();
  const ids = await seedTestAnatomy(entityManager);

  return {
    logger,
    dispatcher,
    entityManager,
    ids,
    anatomyData: createMockAnatomyData(),
    cleanup: () => {
      jest.clearAllMocks();
    },
  };
}

/**
 * Helper function to wait for a specified duration
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a valid simulation configuration for MultiHitSimulator
 * @param {Object} [overrides] - Configuration overrides
 * @returns {Object} Simulation configuration
 */
export function createSimulationConfig(overrides = {}) {
  return {
    hitCount: 10,
    delayMs: 0,
    targetMode: 'random',
    focusPartId: null,
    damageEntry: SAMPLE_DAMAGE_ENTRY,
    multiplier: 1,
    entityId: TEST_ENTITY_IDS.actor,
    ...overrides,
  };
}

/**
 * Mock hit probability weight utilities for testing
 * @returns {Object} Mock hitProbabilityWeightUtils
 */
export function createMockHitProbabilityWeightUtils() {
  return {
    getEffectiveHitWeight: jest.fn((component) => {
      if (!component) return 1;
      return component.hit_probability_weight || 1;
    }),
    filterEligibleHitTargets: jest.fn((parts) => parts.filter((p) => p.component)),
    DEFAULT_HIT_PROBABILITY_WEIGHT: 1,
  };
}
