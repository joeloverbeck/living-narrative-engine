/**
 * @jest-environment node
 */

import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import AddPerceptionLogEntryHandler from '../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import PerceptionFilterService from '../../../src/perception/services/perceptionFilterService.js';
import { PERCEPTION_LOG_COMPONENT_ID } from '../../../src/constants/componentIds.js';

/**
 * Integration tests for sense-aware perceptible event filtering.
 *
 * These tests verify the integration between AddPerceptionLogEntryHandler
 * and PerceptionFilterService for filtering events based on recipient
 * sensory capabilities and environmental conditions.
 *
 * Test scenarios per SENAWAPEREVE-007:
 * 1. Dark location + visual event -> receives auditory fallback
 * 2. Blind entity + visual event -> receives auditory fallback
 * 3. Actor always perceives own proprioceptive events
 * 4. Multiple recipients get different descriptions
 * 5. Omniscient events bypass filtering
 * 6. Silent filtering with no fallback
 * 7. sense_aware: false bypasses all filtering
 */

// ============================================================================
// Test Fixtures and Factories
// ============================================================================

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockDispatcher = () => ({
  dispatch: jest.fn(),
});

/**
 * Creates a mock entity manager with configurable entity data.
 * @param {Map<string, object>} entities - Map of entityId -> entity data
 * @param {Set<string>} entitiesInLocation - Set of entity IDs in location
 */
const createMockEntityManager = (entities = new Map(), entitiesInLocation = new Set()) => {
  const componentData = new Map();

  // Initialize perception log for each entity
  for (const entityId of entities.keys()) {
    componentData.set(`${entityId}:${PERCEPTION_LOG_COMPONENT_ID}`, {
      maxEntries: 50,
      logEntries: [],
    });
  }

  return {
    getEntitiesInLocation: jest.fn(() => entitiesInLocation),
    hasComponent: jest.fn((entityId, componentId) => {
      return componentData.has(`${entityId}:${componentId}`);
    }),
    getComponentData: jest.fn((entityId, componentId) => {
      return componentData.get(`${entityId}:${componentId}`);
    }),
    addComponent: jest.fn((entityId, componentId, data) => {
      componentData.set(`${entityId}:${componentId}`, data);
    }),
    batchAddComponentsOptimized: jest.fn(async (specs) => {
      let updateCount = 0;
      const errors = [];
      for (const spec of specs) {
        try {
          componentData.set(`${spec.instanceId}:${spec.componentTypeId}`, spec.componentData);
          updateCount++;
        } catch (error) {
          errors.push({ spec, error });
        }
      }
      return { updateCount, errors };
    }),
    // Helper to get log entries for verification
    _getLogEntries: (entityId) => {
      const data = componentData.get(`${entityId}:${PERCEPTION_LOG_COMPONENT_ID}`);
      return data?.logEntries || [];
    },
  };
};

/**
 * Creates a mock sensory capability service.
 * @param {Map<string, object>} capabilities - Map of entityId -> sensory capabilities
 */
const createMockSensoryCapabilityService = (capabilities = new Map()) => ({
  getSensoryCapabilities: jest.fn((entityId) => {
    return capabilities.get(entityId) || {
      canSee: true,
      canHear: true,
      canSmell: true,
      canFeel: true,
    };
  }),
});

/**
 * Creates a mock lighting state service.
 * @param {string} defaultLighting - Default lighting state
 */
const createMockLightingStateService = (defaultLighting = 'normal') => ({
  getLightingState: jest.fn(() => defaultLighting),
});

/**
 * Creates a full test environment with all services wired together.
 */
const createTestEnvironment = (config = {}) => {
  const {
    entityCapabilities = new Map(),
    entitiesInLocation = new Set(),
    lightingState = 'normal',
  } = config;

  const logger = createMockLogger();
  const dispatcher = createMockDispatcher();

  // Create entities map from capabilities
  const entities = new Map();
  for (const entityId of entityCapabilities.keys()) {
    entities.set(entityId, { id: entityId });
  }
  // Also add entities that are in location but might not have custom capabilities
  for (const entityId of entitiesInLocation) {
    if (!entities.has(entityId)) {
      entities.set(entityId, { id: entityId });
    }
  }

  const entityManager = createMockEntityManager(entities, entitiesInLocation);
  const sensoryCapabilityService = createMockSensoryCapabilityService(entityCapabilities);
  const lightingStateService = createMockLightingStateService(lightingState);

  // Create real PerceptionFilterService
  const perceptionFilterService = new PerceptionFilterService({
    sensoryCapabilityService,
    lightingStateService,
    logger,
  });

  // Create handler with real filter service
  const handler = new AddPerceptionLogEntryHandler({
    logger,
    entityManager,
    safeEventDispatcher: dispatcher,
    perceptionFilterService,
  });

  return {
    handler,
    entityManager,
    dispatcher,
    logger,
    perceptionFilterService,
    sensoryCapabilityService,
    lightingStateService,
  };
};

// ============================================================================
// Test Suites
// ============================================================================

describe('Sense-Aware Filtering Integration Tests', () => {
  describe('Dark location filtering', () => {
    test('should use auditory fallback when location is dark and visual event occurs', async () => {
      // Arrange: Dark location with sighted entity
      const entityCapabilities = new Map([
        ['npc:observer', { canSee: true, canHear: true, canSmell: true, canFeel: true }],
      ]);
      const entitiesInLocation = new Set(['npc:observer']);

      const env = createTestEnvironment({
        entityCapabilities,
        entitiesInLocation,
        lightingState: 'dark', // Dark location
      });

      const params = {
        location_id: 'loc:dark-room',
        entry: {
          descriptionText: 'A figure approaches.',
          perceptionType: 'movement.arrival', // Primary sense: visual
          actorId: 'npc:walker',
          timestamp: new Date().toISOString(),
        },
        originating_actor_id: 'npc:walker',
        sense_aware: true,
        alternate_descriptions: {
          auditory: 'You hear footsteps approaching.',
          tactile: 'The floor vibrates with approaching steps.',
        },
      };

      // Act
      await env.handler.execute(params, {});

      // Assert: Observer should receive auditory description
      const logEntries = env.entityManager._getLogEntries('npc:observer');
      expect(logEntries).toHaveLength(1);
      expect(logEntries[0].descriptionText).toBe('You hear footsteps approaching.');
      expect(logEntries[0].perceivedVia).toBe('auditory');
    });
  });

  describe('Blind entity filtering', () => {
    test('should use auditory fallback when entity is blind and visual event occurs', async () => {
      // Arrange: Normal lighting, blind entity
      const entityCapabilities = new Map([
        ['npc:blind-observer', { canSee: false, canHear: true, canSmell: true, canFeel: true }],
      ]);
      const entitiesInLocation = new Set(['npc:blind-observer']);

      const env = createTestEnvironment({
        entityCapabilities,
        entitiesInLocation,
        lightingState: 'normal', // Normal lighting
      });

      const params = {
        location_id: 'loc:tavern',
        entry: {
          descriptionText: 'A stranger walks in.',
          perceptionType: 'movement.arrival', // Primary sense: visual
          actorId: 'npc:stranger',
          timestamp: new Date().toISOString(),
        },
        originating_actor_id: 'npc:stranger',
        sense_aware: true,
        alternate_descriptions: {
          auditory: 'The door creaks open and footsteps enter.',
          olfactory: 'A new scent enters the room.',
        },
      };

      // Act
      await env.handler.execute(params, {});

      // Assert: Blind observer should receive auditory description
      const logEntries = env.entityManager._getLogEntries('npc:blind-observer');
      expect(logEntries).toHaveLength(1);
      expect(logEntries[0].descriptionText).toBe('The door creaks open and footsteps enter.');
      expect(logEntries[0].perceivedVia).toBe('auditory');
    });
  });

  describe('Proprioceptive events', () => {
    test('should deliver proprioceptive events only to the actor', async () => {
      // Arrange: Multiple entities, one is the actor
      const entityCapabilities = new Map([
        ['npc:thinker', { canSee: true, canHear: true, canSmell: true, canFeel: true }],
        ['npc:observer', { canSee: true, canHear: true, canSmell: true, canFeel: true }],
      ]);
      const entitiesInLocation = new Set(['npc:thinker', 'npc:observer']);

      const env = createTestEnvironment({
        entityCapabilities,
        entitiesInLocation,
        lightingState: 'normal',
      });

      const params = {
        location_id: 'loc:room',
        entry: {
          descriptionText: 'You ponder the meaning of existence.',
          perceptionType: 'communication.thought', // Primary sense: proprioceptive
          actorId: 'npc:thinker',
          timestamp: new Date().toISOString(),
        },
        originating_actor_id: 'npc:thinker',
        sense_aware: true,
        alternate_descriptions: {}, // No alternates for proprioceptive
      };

      // Act
      await env.handler.execute(params, {});

      // Assert: Only actor should receive the thought
      const thinkerLogs = env.entityManager._getLogEntries('npc:thinker');
      const observerLogs = env.entityManager._getLogEntries('npc:observer');

      expect(thinkerLogs).toHaveLength(1);
      expect(thinkerLogs[0].descriptionText).toBe('You ponder the meaning of existence.');
      expect(thinkerLogs[0].perceivedVia).toBe('proprioceptive');

      // Observer should NOT receive the thought
      expect(observerLogs).toHaveLength(0);
    });
  });

  describe('Multiple recipients with different capabilities', () => {
    test('should deliver different descriptions to recipients based on their senses', async () => {
      // Arrange: Three entities with different sensory capabilities
      const entityCapabilities = new Map([
        ['npc:sighted', { canSee: true, canHear: true, canSmell: true, canFeel: true }],
        ['npc:blind', { canSee: false, canHear: true, canSmell: true, canFeel: true }],
        ['npc:deaf-blind', { canSee: false, canHear: false, canSmell: true, canFeel: true }],
      ]);
      const entitiesInLocation = new Set(['npc:sighted', 'npc:blind', 'npc:deaf-blind']);

      const env = createTestEnvironment({
        entityCapabilities,
        entitiesInLocation,
        lightingState: 'normal',
      });

      const params = {
        location_id: 'loc:market',
        entry: {
          descriptionText: 'A merchant waves colorful fabrics.',
          perceptionType: 'movement.arrival', // Primary: visual, fallback: auditory, tactile
          actorId: 'npc:merchant',
          timestamp: new Date().toISOString(),
        },
        originating_actor_id: 'npc:merchant',
        sense_aware: true,
        alternate_descriptions: {
          auditory: 'You hear the rustle of fabrics being waved.',
          tactile: 'You feel the breeze from waving fabrics nearby.',
        },
      };

      // Act
      await env.handler.execute(params, {});

      // Assert: Each recipient gets appropriate description
      const sightedLogs = env.entityManager._getLogEntries('npc:sighted');
      const blindLogs = env.entityManager._getLogEntries('npc:blind');
      const deafBlindLogs = env.entityManager._getLogEntries('npc:deaf-blind');

      // Sighted sees the visual description
      expect(sightedLogs).toHaveLength(1);
      expect(sightedLogs[0].descriptionText).toBe('A merchant waves colorful fabrics.');
      expect(sightedLogs[0].perceivedVia).toBe('visual');

      // Blind hears auditory fallback
      expect(blindLogs).toHaveLength(1);
      expect(blindLogs[0].descriptionText).toBe('You hear the rustle of fabrics being waved.');
      expect(blindLogs[0].perceivedVia).toBe('auditory');

      // Deaf-blind feels tactile fallback
      expect(deafBlindLogs).toHaveLength(1);
      expect(deafBlindLogs[0].descriptionText).toBe('You feel the breeze from waving fabrics nearby.');
      expect(deafBlindLogs[0].perceivedVia).toBe('tactile');
    });
  });

  describe('Omniscient events', () => {
    test('should bypass filtering for omniscient perception types', async () => {
      // Arrange: Entity in dark with no senses (extreme case)
      const entityCapabilities = new Map([
        ['npc:any', { canSee: false, canHear: false, canSmell: false, canFeel: false }],
      ]);
      const entitiesInLocation = new Set(['npc:any']);

      const env = createTestEnvironment({
        entityCapabilities,
        entitiesInLocation,
        lightingState: 'dark',
      });

      const params = {
        location_id: 'loc:void',
        entry: {
          descriptionText: 'A system error has occurred.',
          perceptionType: 'error.system_error', // Primary sense: omniscient
          actorId: 'system',
          timestamp: new Date().toISOString(),
        },
        originating_actor_id: 'system',
        sense_aware: true,
        alternate_descriptions: {}, // Omniscient doesn't need alternates
      };

      // Act
      await env.handler.execute(params, {});

      // Assert: Entity receives omniscient event regardless of senses
      const logs = env.entityManager._getLogEntries('npc:any');
      expect(logs).toHaveLength(1);
      expect(logs[0].descriptionText).toBe('A system error has occurred.');
      expect(logs[0].perceivedVia).toBe('omniscient');
    });
  });

  describe('Silent filtering', () => {
    test('should silently filter when no fallback available and primary sense unavailable', async () => {
      // Arrange: Blind entity, visual event, no auditory fallback
      const entityCapabilities = new Map([
        ['npc:blind', { canSee: false, canHear: true, canSmell: true, canFeel: true }],
      ]);
      const entitiesInLocation = new Set(['npc:blind']);

      const env = createTestEnvironment({
        entityCapabilities,
        entitiesInLocation,
        lightingState: 'normal',
      });

      const params = {
        location_id: 'loc:silent-room',
        entry: {
          descriptionText: 'A silent gesture is made.',
          perceptionType: 'movement.arrival', // Primary: visual
          actorId: 'npc:gesturer',
          timestamp: new Date().toISOString(),
        },
        originating_actor_id: 'npc:gesturer',
        sense_aware: true,
        alternate_descriptions: {}, // No fallbacks provided!
      };

      // Act
      await env.handler.execute(params, {});

      // Assert: No log entry (silently filtered), no error dispatched
      const logs = env.entityManager._getLogEntries('npc:blind');
      expect(logs).toHaveLength(0);
      expect(env.dispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('sense_aware: false bypass', () => {
    test('should bypass all filtering when sense_aware is false', async () => {
      // Arrange: Blind entity in dark location
      const entityCapabilities = new Map([
        ['npc:blind', { canSee: false, canHear: false, canSmell: false, canFeel: false }],
      ]);
      const entitiesInLocation = new Set(['npc:blind']);

      const env = createTestEnvironment({
        entityCapabilities,
        entitiesInLocation,
        lightingState: 'dark',
      });

      const params = {
        location_id: 'loc:dark-room',
        entry: {
          descriptionText: 'Something happens that would normally be filtered.',
          perceptionType: 'movement.arrival', // Visual primary
          actorId: 'npc:actor',
          timestamp: new Date().toISOString(),
        },
        originating_actor_id: 'npc:actor',
        sense_aware: false, // Bypass filtering!
        alternate_descriptions: {
          auditory: 'You hear something.',
        },
      };

      // Act
      await env.handler.execute(params, {});

      // Assert: Original description delivered (no filtering)
      const logs = env.entityManager._getLogEntries('npc:blind');
      expect(logs).toHaveLength(1);
      expect(logs[0].descriptionText).toBe('Something happens that would normally be filtered.');
      // No perceivedVia field since filtering was bypassed
      expect(logs[0].perceivedVia).toBeUndefined();
    });
  });

  describe('Backward compatibility', () => {
    test('should work without alternate_descriptions (no filtering)', async () => {
      // Arrange: Standard setup without alternate descriptions
      const entityCapabilities = new Map([
        ['npc:observer', { canSee: false, canHear: true, canSmell: true, canFeel: true }],
      ]);
      const entitiesInLocation = new Set(['npc:observer']);

      const env = createTestEnvironment({
        entityCapabilities,
        entitiesInLocation,
        lightingState: 'normal',
      });

      const params = {
        location_id: 'loc:room',
        entry: {
          descriptionText: 'Standard event without alternates.',
          perceptionType: 'movement.arrival',
          actorId: 'npc:actor',
          timestamp: new Date().toISOString(),
        },
        originating_actor_id: 'npc:actor',
        // No sense_aware field (defaults to true)
        // No alternate_descriptions field
      };

      // Act
      await env.handler.execute(params, {});

      // Assert: Original description delivered (filtering not applied without alternates)
      const logs = env.entityManager._getLogEntries('npc:observer');
      expect(logs).toHaveLength(1);
      expect(logs[0].descriptionText).toBe('Standard event without alternates.');
      expect(logs[0].perceivedVia).toBeUndefined();
    });

    test('should work without perceptionFilterService (backward compat)', async () => {
      // Arrange: Handler created without filter service
      const logger = createMockLogger();
      const dispatcher = createMockDispatcher();
      const entities = new Map([['npc:observer', { id: 'npc:observer' }]]);
      const entityManager = createMockEntityManager(entities, new Set(['npc:observer']));

      // Create handler WITHOUT perceptionFilterService
      const handler = new AddPerceptionLogEntryHandler({
        logger,
        entityManager,
        safeEventDispatcher: dispatcher,
        // perceptionFilterService: undefined - intentionally omitted
      });

      const params = {
        location_id: 'loc:room',
        entry: {
          descriptionText: 'Event with alternates but no filter service.',
          perceptionType: 'movement.arrival',
          actorId: 'npc:actor',
          timestamp: new Date().toISOString(),
        },
        originating_actor_id: 'npc:actor',
        sense_aware: true,
        alternate_descriptions: {
          auditory: 'You hear something.',
        },
      };

      // Act
      await handler.execute(params, {});

      // Assert: Original description delivered (no filtering without service)
      const logs = entityManager._getLogEntries('npc:observer');
      expect(logs).toHaveLength(1);
      expect(logs[0].descriptionText).toBe('Event with alternates but no filter service.');
      expect(logs[0].perceivedVia).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    test('should handle limited fallback when all senses fail', async () => {
      // Arrange: Entity that can't use any normal sense
      const entityCapabilities = new Map([
        ['npc:limited', { canSee: false, canHear: false, canSmell: false, canFeel: false }],
      ]);
      const entitiesInLocation = new Set(['npc:limited']);

      const env = createTestEnvironment({
        entityCapabilities,
        entitiesInLocation,
        lightingState: 'normal',
      });

      const params = {
        location_id: 'loc:room',
        entry: {
          descriptionText: 'A visual event occurs.',
          perceptionType: 'movement.arrival',
          actorId: 'npc:actor',
          timestamp: new Date().toISOString(),
        },
        originating_actor_id: 'npc:actor',
        sense_aware: true,
        alternate_descriptions: {
          auditory: 'You hear something.',
          tactile: 'You feel something.',
          limited: 'You vaguely sense something happening.', // Limited fallback
        },
      };

      // Act
      await env.handler.execute(params, {});

      // Assert: Limited fallback is used
      const logs = env.entityManager._getLogEntries('npc:limited');
      expect(logs).toHaveLength(1);
      expect(logs[0].descriptionText).toBe('You vaguely sense something happening.');
      expect(logs[0].perceivedVia).toBe('limited');
    });

    test('should handle empty recipient list gracefully', async () => {
      // Arrange: No entities in location
      const env = createTestEnvironment({
        entityCapabilities: new Map(),
        entitiesInLocation: new Set(), // Empty!
        lightingState: 'normal',
      });

      const params = {
        location_id: 'loc:empty-room',
        entry: {
          descriptionText: 'Event in empty room.',
          perceptionType: 'movement.arrival',
          actorId: 'npc:actor',
          timestamp: new Date().toISOString(),
        },
        originating_actor_id: 'npc:actor',
        sense_aware: true,
        alternate_descriptions: {
          auditory: 'You hear something.',
        },
      };

      // Act - should not throw
      await env.handler.execute(params, {});

      // Assert: No errors dispatched
      expect(env.dispatcher.dispatch).not.toHaveBeenCalled();
    });
  });
});
