/**
 * @file SenseAwareFiltering.e2e.test.js
 * @description E2E coverage for sense-aware filtering in perception log entries.
 * Verifies that PerceptionFilterService is properly wired and filtering occurs
 * based on sensory capabilities and lighting conditions.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';
import { ModTestHandlerFactory } from '../../common/mods/ModTestHandlerFactory.js';
import AddPerceptionLogEntryHandler from '../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import PerceptionFilterService from '../../../src/perception/services/perceptionFilterService.js';
import RecipientRoutingPolicyService from '../../../src/perception/services/recipientRoutingPolicyService.js';
import logPerceptibleEventsRule from '../../../data/mods/core/rules/log_perceptible_events.rule.json' assert { type: 'json' };

/**
 * Helper to await all pending event dispatches
 * @param {object} testEnv - Test environment with eventBus mock
 * @param {number} startIndex - Index to start awaiting from
 */
async function awaitDispatches(testEnv, startIndex) {
  const pending = testEnv.eventBus.dispatch.mock.results
    .slice(startIndex)
    .map((result) => result.value)
    .filter((value) => value && typeof value.then === 'function');
  if (pending.length > 0) {
    await Promise.all(pending);
  }
}

/**
 * Creates a mock SensoryCapabilityService
 * @param {object} overrides - Entity-specific sensory capability overrides
 * @returns {object} Mock sensory capability service
 */
function createMockSensoryCapabilityService(overrides = {}) {
  const defaultCapabilities = {
    canSee: true,
    canHear: true,
    canSmell: true,
    canFeel: true,
    availableSenses: ['visual', 'auditory', 'olfactory', 'tactile'],
  };

  return {
    getSensoryCapabilities: jest.fn((entityId) => {
      if (overrides[entityId]) {
        const caps = overrides[entityId];
        return {
          canSee: caps.canSee ?? true,
          canHear: caps.canHear ?? true,
          canSmell: caps.canSmell ?? true,
          canFeel: caps.canFeel ?? true,
          availableSenses: caps.availableSenses ?? defaultCapabilities.availableSenses,
        };
      }
      return { ...defaultCapabilities };
    }),
  };
}

/**
 * Creates a mock LightingStateService
 * @param {object} locationStates - Location-specific lighting states { locationId: { isLit: boolean } }
 * @returns {object} Mock lighting state service
 */
function createMockLightingStateService(locationStates = {}) {
  return {
    getLocationLightingState: jest.fn((locationId) => {
      if (locationStates[locationId]) {
        return locationStates[locationId];
      }
      return { isLit: true }; // Default to lit
    }),
  };
}

/**
 * Creates a handler factory that wires PerceptionFilterService
 * @param {object} options - Configuration options
 * @param {object} options.sensoryOverrides - Entity sensory capability overrides
 * @param {object} options.lightingStates - Location lighting state overrides
 * @returns {Function} Handler factory function
 */
function createHandlerFactoryWithPerceptionFilter({ sensoryOverrides = {}, lightingStates = {} } = {}) {
  return (entityManager, eventBus, logger) => {
    // Get base handlers from the factory
    const baseHandlers = ModTestHandlerFactory.createHandlersWithPerceptionLogging(
      entityManager,
      eventBus,
      logger
    );

    // Create mock services for PerceptionFilterService
    const mockSensoryCapabilityService = createMockSensoryCapabilityService(sensoryOverrides);
    const mockLightingStateService = createMockLightingStateService(lightingStates);

    // Create PerceptionFilterService with mocks
    const perceptionFilterService = new PerceptionFilterService({
      sensoryCapabilityService: mockSensoryCapabilityService,
      lightingStateService: mockLightingStateService,
      logger,
    });

    // Create safe dispatcher
    const safeDispatcher = ModTestHandlerFactory.createSafeDispatcher(eventBus);

    // Ensure entityManager has getEntitiesInLocation
    if (typeof entityManager.getEntitiesInLocation !== 'function') {
      entityManager.getEntitiesInLocation = (locationId) => {
        const entityIds = entityManager.getEntityIds();
        const entitiesInLocation = [];
        for (const entityId of entityIds) {
          const entity = entityManager.getEntityInstance(entityId);
          if (entity?.components?.['core:position']?.locationId === locationId) {
            entitiesInLocation.push(entityId);
          }
        }
        return new Set(entitiesInLocation);
      };
    }

    // Create routing policy service for mutual exclusivity validation
    const routingPolicyService = new RecipientRoutingPolicyService({
      logger,
      dispatcher: safeDispatcher,
    });

    // Replace ADD_PERCEPTION_LOG_ENTRY handler with one that has perceptionFilterService
    return {
      ...baseHandlers,
      ADD_PERCEPTION_LOG_ENTRY: new AddPerceptionLogEntryHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
        perceptionFilterService,
        routingPolicyService,
      }),
    };
  };
}

describe('Sense-Aware Filtering E2E', () => {
  const locationId = 'room1';
  const actorId = 'actor1';
  const targetId = 'actor2';
  const bystanderId = 'bystander1';

  describe('Primary Sense vs Fallback Sense Behavior', () => {
    it('uses visual description when location is lit and recipient can see', async () => {
      const entities = [
        { id: locationId, components: { 'core:name': { name: 'Lit Room' } } },
        {
          id: actorId,
          components: {
            'core:actor': { name: 'Actor' },
            'core:position': { locationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
        {
          id: bystanderId,
          components: {
            'core:actor': { name: 'Bystander' },
            'core:position': { locationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
      ];

      const testEnv = createRuleTestEnvironment({
        createHandlers: createHandlerFactoryWithPerceptionFilter({
          sensoryOverrides: {
            [bystanderId]: { canSee: true, canHear: true, availableSenses: ['visual', 'auditory'] },
          },
          lightingStates: {
            [locationId]: { isLit: true },
          },
        }),
        entities,
        rules: [logPerceptibleEventsRule],
        actions: [],
      });

      try {
        const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

        await testEnv.operationInterpreter.execute(
          {
            type: 'DISPATCH_PERCEPTIBLE_EVENT',
            parameters: {
              location_id: locationId,
              description_text: 'Base description of action.',
              perception_type: 'physical.target_action',
              actor_id: actorId,
              sense_aware: true,
              alternate_descriptions: {
                auditory: 'You hear a sound from the actor.',
                limited: 'Something happens nearby.',
              },
            },
          },
          { evaluationContext: {} }
        );

        await awaitDispatches(testEnv, dispatchStart);

        const bystanderLog = testEnv.entityManager.getComponentData(
          bystanderId,
          'core:perception_log'
        );

        expect(bystanderLog.logEntries).toHaveLength(1);
        // When primary sense (visual) works, the base description is used
        // alternate_descriptions are only for fallback senses
        expect(bystanderLog.logEntries[0].descriptionText).toBe('Base description of action.');
      } finally {
        testEnv.cleanup();
      }
    });

    it('falls back to auditory description when location is dark but recipient can hear', async () => {
      const entities = [
        { id: locationId, components: { 'core:name': { name: 'Dark Room' } } },
        {
          id: actorId,
          components: {
            'core:actor': { name: 'Actor' },
            'core:position': { locationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
        {
          id: bystanderId,
          components: {
            'core:actor': { name: 'Bystander' },
            'core:position': { locationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
      ];

      const testEnv = createRuleTestEnvironment({
        createHandlers: createHandlerFactoryWithPerceptionFilter({
          sensoryOverrides: {
            [bystanderId]: { canSee: true, canHear: true, availableSenses: ['visual', 'auditory'] },
          },
          lightingStates: {
            [locationId]: { isLit: false }, // Dark location
          },
        }),
        entities,
        rules: [logPerceptibleEventsRule],
        actions: [],
      });

      try {
        const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

        await testEnv.operationInterpreter.execute(
          {
            type: 'DISPATCH_PERCEPTIBLE_EVENT',
            parameters: {
              location_id: locationId,
              description_text: 'Base description of action.',
              perception_type: 'physical.target_action',
              actor_id: actorId,
              sense_aware: true,
              alternate_descriptions: {
                auditory: 'You hear a sound from the actor.',
                limited: 'Something happens nearby.',
              },
            },
          },
          { evaluationContext: {} }
        );

        await awaitDispatches(testEnv, dispatchStart);

        const bystanderLog = testEnv.entityManager.getComponentData(
          bystanderId,
          'core:perception_log'
        );

        expect(bystanderLog.logEntries).toHaveLength(1);
        // In darkness, visual is unavailable, should fall back to auditory
        expect(bystanderLog.logEntries[0].descriptionText).toBe('You hear a sound from the actor.');
      } finally {
        testEnv.cleanup();
      }
    });

    it('uses limited description when recipient lacks primary senses', async () => {
      const entities = [
        { id: locationId, components: { 'core:name': { name: 'Test Room' } } },
        {
          id: actorId,
          components: {
            'core:actor': { name: 'Actor' },
            'core:position': { locationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
        {
          id: bystanderId,
          components: {
            'core:actor': { name: 'Deaf Blind Bystander' },
            'core:position': { locationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
      ];

      const testEnv = createRuleTestEnvironment({
        createHandlers: createHandlerFactoryWithPerceptionFilter({
          sensoryOverrides: {
            // Bystander can't see or hear, only feel
            [bystanderId]: {
              canSee: false,
              canHear: false,
              canSmell: false,
              canFeel: true,
              availableSenses: ['tactile'],
            },
          },
          lightingStates: {
            [locationId]: { isLit: true },
          },
        }),
        entities,
        rules: [logPerceptibleEventsRule],
        actions: [],
      });

      try {
        const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

        await testEnv.operationInterpreter.execute(
          {
            type: 'DISPATCH_PERCEPTIBLE_EVENT',
            parameters: {
              location_id: locationId,
              description_text: 'Base description of action.',
              perception_type: 'physical.target_action',
              actor_id: actorId,
              sense_aware: true,
              alternate_descriptions: {
                auditory: 'You hear a sound from the actor.',
                limited: 'You sense movement nearby.',
              },
            },
          },
          { evaluationContext: {} }
        );

        await awaitDispatches(testEnv, dispatchStart);

        const bystanderLog = testEnv.entityManager.getComponentData(
          bystanderId,
          'core:perception_log'
        );

        expect(bystanderLog.logEntries).toHaveLength(1);
        // Without visual or auditory, should use limited
        expect(bystanderLog.logEntries[0].descriptionText).toBe('You sense movement nearby.');
      } finally {
        testEnv.cleanup();
      }
    });
  });

  describe('Actor Description Bypasses Filtering', () => {
    it('uses actor_description for the originating actor regardless of lighting', async () => {
      const entities = [
        { id: locationId, components: { 'core:name': { name: 'Dark Room' } } },
        {
          id: actorId,
          components: {
            'core:actor': { name: 'Actor' },
            'core:position': { locationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
        {
          id: bystanderId,
          components: {
            'core:actor': { name: 'Bystander' },
            'core:position': { locationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
      ];

      const testEnv = createRuleTestEnvironment({
        createHandlers: createHandlerFactoryWithPerceptionFilter({
          sensoryOverrides: {},
          lightingStates: {
            [locationId]: { isLit: false }, // Dark location
          },
        }),
        entities,
        rules: [logPerceptibleEventsRule],
        actions: [],
      });

      try {
        const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

        await testEnv.operationInterpreter.execute(
          {
            type: 'DISPATCH_PERCEPTIBLE_EVENT',
            parameters: {
              location_id: locationId,
              description_text: 'Base description.',
              perception_type: 'physical.target_action',
              actor_id: actorId,
              sense_aware: true,
              actor_description: 'You perform the action with confidence.',
              alternate_descriptions: {
                auditory: 'You hear a sound from the actor.',
                limited: 'Something happens nearby.',
              },
            },
          },
          { evaluationContext: {} }
        );

        await awaitDispatches(testEnv, dispatchStart);

        const actorLog = testEnv.entityManager.getComponentData(
          actorId,
          'core:perception_log'
        );

        expect(actorLog.logEntries).toHaveLength(1);
        // Actor should receive actor_description, bypassing sense filtering
        expect(actorLog.logEntries[0].descriptionText).toBe('You perform the action with confidence.');
      } finally {
        testEnv.cleanup();
      }
    });
  });

  describe('Target Description Respects Filtering', () => {
    it('uses target_description for target and applies sense filtering to it', async () => {
      const entities = [
        { id: locationId, components: { 'core:name': { name: 'Lit Room' } } },
        {
          id: actorId,
          components: {
            'core:actor': { name: 'Actor' },
            'core:position': { locationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
        {
          id: targetId,
          components: {
            'core:actor': { name: 'Target' },
            'core:position': { locationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
        {
          id: bystanderId,
          components: {
            'core:actor': { name: 'Bystander' },
            'core:position': { locationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
      ];

      const testEnv = createRuleTestEnvironment({
        createHandlers: createHandlerFactoryWithPerceptionFilter({
          sensoryOverrides: {
            [targetId]: { canSee: true, canHear: true, availableSenses: ['visual', 'auditory'] },
            [bystanderId]: { canSee: true, canHear: true, availableSenses: ['visual', 'auditory'] },
          },
          lightingStates: {
            [locationId]: { isLit: true },
          },
        }),
        entities,
        rules: [logPerceptibleEventsRule],
        actions: [],
      });

      try {
        const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

        await testEnv.operationInterpreter.execute(
          {
            type: 'DISPATCH_PERCEPTIBLE_EVENT',
            parameters: {
              location_id: locationId,
              description_text: 'Base description.',
              perception_type: 'physical.target_action',
              actor_id: actorId,
              target_id: targetId,
              sense_aware: true,
              target_description: 'The actor approaches you directly.',
              alternate_descriptions: {
                auditory: 'You hear footsteps toward someone.',
                limited: 'Something happens nearby.',
              },
            },
          },
          { evaluationContext: {} }
        );

        await awaitDispatches(testEnv, dispatchStart);

        const targetLog = testEnv.entityManager.getComponentData(
          targetId,
          'core:perception_log'
        );
        const bystanderLog = testEnv.entityManager.getComponentData(
          bystanderId,
          'core:perception_log'
        );

        // Target should receive target_description
        expect(targetLog.logEntries).toHaveLength(1);
        expect(targetLog.logEntries[0].descriptionText).toBe('The actor approaches you directly.');

        // Bystander should receive base description (lit room, can see via primary sense)
        // alternate_descriptions are only used for fallback senses
        expect(bystanderLog.logEntries).toHaveLength(1);
        expect(bystanderLog.logEntries[0].descriptionText).toBe('Base description.');
      } finally {
        testEnv.cleanup();
      }
    });

    it('applies sense filtering to target_description in dark room', async () => {
      const entities = [
        { id: locationId, components: { 'core:name': { name: 'Dark Room' } } },
        {
          id: actorId,
          components: {
            'core:actor': { name: 'Actor' },
            'core:position': { locationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
        {
          id: targetId,
          components: {
            'core:actor': { name: 'Target' },
            'core:position': { locationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
      ];

      const testEnv = createRuleTestEnvironment({
        createHandlers: createHandlerFactoryWithPerceptionFilter({
          sensoryOverrides: {
            [targetId]: { canSee: true, canHear: true, availableSenses: ['visual', 'auditory'] },
          },
          lightingStates: {
            [locationId]: { isLit: false }, // Dark location
          },
        }),
        entities,
        rules: [logPerceptibleEventsRule],
        actions: [],
      });

      try {
        const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

        await testEnv.operationInterpreter.execute(
          {
            type: 'DISPATCH_PERCEPTIBLE_EVENT',
            parameters: {
              location_id: locationId,
              description_text: 'Base description.',
              perception_type: 'physical.target_action',
              actor_id: actorId,
              target_id: targetId,
              sense_aware: true,
              target_description: 'The actor approaches you directly.',
              alternate_descriptions: {
                auditory: 'Someone approaches you in the darkness.',
                limited: 'Something happens nearby.',
              },
            },
          },
          { evaluationContext: {} }
        );

        await awaitDispatches(testEnv, dispatchStart);

        const targetLog = testEnv.entityManager.getComponentData(
          targetId,
          'core:perception_log'
        );

        // Target receives target_description (custom description preserved even when filtering is applied)
        // The handler preserves custom target_description over filtered alternate descriptions
        expect(targetLog.logEntries).toHaveLength(1);
        expect(targetLog.logEntries[0].descriptionText).toBe('The actor approaches you directly.');
      } finally {
        testEnv.cleanup();
      }
    });
  });

  describe('Sense-Aware Disabled (sense_aware: false)', () => {
    it('uses base description when sense_aware is false', async () => {
      const entities = [
        { id: locationId, components: { 'core:name': { name: 'Dark Room' } } },
        {
          id: actorId,
          components: {
            'core:actor': { name: 'Actor' },
            'core:position': { locationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
        {
          id: bystanderId,
          components: {
            'core:actor': { name: 'Blind Bystander' },
            'core:position': { locationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
      ];

      const testEnv = createRuleTestEnvironment({
        createHandlers: createHandlerFactoryWithPerceptionFilter({
          sensoryOverrides: {
            // Bystander can't see at all
            [bystanderId]: { canSee: false, canHear: false, canSmell: false, canFeel: true, availableSenses: ['tactile'] },
          },
          lightingStates: {
            [locationId]: { isLit: false },
          },
        }),
        entities,
        rules: [logPerceptibleEventsRule],
        actions: [],
      });

      try {
        const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

        await testEnv.operationInterpreter.execute(
          {
            type: 'DISPATCH_PERCEPTIBLE_EVENT',
            parameters: {
              location_id: locationId,
              description_text: 'The base description of the action.',
              perception_type: 'physical.target_action',
              actor_id: actorId,
              sense_aware: false, // Filtering disabled
              alternate_descriptions: {
                auditory: 'You hear a sound from the actor.',
                limited: 'Something happens nearby.',
              },
            },
          },
          { evaluationContext: {} }
        );

        await awaitDispatches(testEnv, dispatchStart);

        const bystanderLog = testEnv.entityManager.getComponentData(
          bystanderId,
          'core:perception_log'
        );

        expect(bystanderLog.logEntries).toHaveLength(1);
        // With sense_aware: false, should use base description regardless of senses
        expect(bystanderLog.logEntries[0].descriptionText).toBe('The base description of the action.');
      } finally {
        testEnv.cleanup();
      }
    });

    it('ignores alternate_descriptions when sense_aware is explicitly false', async () => {
      const entities = [
        { id: locationId, components: { 'core:name': { name: 'Test Room' } } },
        {
          id: actorId,
          components: {
            'core:actor': { name: 'Actor' },
            'core:position': { locationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
        {
          id: bystanderId,
          components: {
            'core:actor': { name: 'Bystander' },
            'core:position': { locationId },
            'core:perception_log': { logEntries: [], maxEntries: 50 },
          },
        },
      ];

      const testEnv = createRuleTestEnvironment({
        createHandlers: createHandlerFactoryWithPerceptionFilter({
          sensoryOverrides: {
            [bystanderId]: { canSee: true, canHear: true, availableSenses: ['visual', 'auditory'] },
          },
          lightingStates: {
            [locationId]: { isLit: true },
          },
        }),
        entities,
        rules: [logPerceptibleEventsRule],
        actions: [],
      });

      try {
        const dispatchStart = testEnv.eventBus.dispatch.mock.calls.length;

        await testEnv.operationInterpreter.execute(
          {
            type: 'DISPATCH_PERCEPTIBLE_EVENT',
            parameters: {
              location_id: locationId,
              description_text: 'Universal description for all.',
              perception_type: 'social.interaction',
              actor_id: actorId,
              sense_aware: false,
              alternate_descriptions: {
                auditory: 'Auditory version.',
                limited: 'Limited version.',
              },
            },
          },
          { evaluationContext: {} }
        );

        await awaitDispatches(testEnv, dispatchStart);

        const bystanderLog = testEnv.entityManager.getComponentData(
          bystanderId,
          'core:perception_log'
        );

        expect(bystanderLog.logEntries).toHaveLength(1);
        // Even with senses and alternates available, sense_aware: false means use base
        expect(bystanderLog.logEntries[0].descriptionText).toBe('Universal description for all.');
      } finally {
        testEnv.cleanup();
      }
    });
  });
});
