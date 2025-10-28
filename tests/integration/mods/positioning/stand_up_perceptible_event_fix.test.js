/**
 * @file Integration test to reproduce and verify fix for stand_up perceptible event issue.
 * @description This test reproduces the issue where stand_up perceptible events are not delivered
 * to other actors in the location due to invalid perceptionType validation.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { createRuleTestEnvironment } from '../../../common/engine/systemLogicTestEnv.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import { ModTestHandlerFactory } from '../../../common/mods/ModTestHandlerFactory.js';
import perceptibleEventSchema from '../../../../data/mods/core/events/perceptible_event.event.json';
import logPerceptibleEventsRule from '../../../../data/mods/core/rules/log_perceptible_events.rule.json';
import standUpRule from '../../../../data/mods/positioning/rules/stand_up.rule.json';
import standUpCondition from '../../../../data/mods/positioning/conditions/event-is-action-stand-up.condition.json';
import logSuccessMacro from '../../../../data/mods/core/macros/logSuccessAndEndTurn.macro.json';
import { PERCEPTION_LOG_COMPONENT_ID } from '../../../../src/constants/componentIds.js';
import { ATTEMPT_ACTION_ID } from '../../../../src/constants/eventIds.js';
import { expandMacros } from '../../../../src/utils/macroUtils.js';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Creates standardized kneeling positioning scenario for stand up tests.
 *
 * @returns {object} Object with actor and witness entities
 */
function setupKneelingStandUpScenario() {
  const room = new ModEntityBuilder('throne_room')
    .asRoom('Throne Room')
    .build();

  const actor = new ModEntityBuilder('test:actor1')
    .withName('Alice')
    .atLocation('throne_room')
    .withComponent('positioning:kneeling_before', { entityId: 'test:king' })
    .asActor()
    .build();

  const witness = new ModEntityBuilder('test:witness1')
    .withName('Bob')
    .atLocation('throne_room')
    .withComponent(PERCEPTION_LOG_COMPONENT_ID, {
      logEntries: [],
      maxEntries: 50,
    })
    .asActor()
    .build();

  return { room, actor, witness };
}

describe('positioning:stand_up perceptible event fix', () => {
  let testEnv;
  let ajv;
  let validatePerceptibleEvent;
  let perceptionTypeEnum = [];
  let mockGameDataRepository;

  beforeEach(async () => {
    // Set up AJV validator for perceptible events
    ajv = new Ajv({ strict: false, allErrors: true });
    addFormats(ajv);

    // Add common schema for reference resolution
    const commonSchemaPath = path.join(
      process.cwd(),
      'data/schemas/common.schema.json'
    );
    const commonSchema = JSON.parse(fs.readFileSync(commonSchemaPath, 'utf-8'));
    ajv.addSchema(commonSchema, commonSchema.$id);
    perceptionTypeEnum =
      commonSchema.definitions?.perceptionType?.enum ?? [];

    validatePerceptibleEvent = ajv.compile(
      perceptibleEventSchema.payloadSchema
    );

    mockGameDataRepository = {
      getComponentDefinition: jest.fn().mockReturnValue(null),
    };

    // Expand macros in stand_up rule
    const macros = { 'core:logSuccessAndEndTurn': logSuccessMacro };
    const expandedStandUpRule = {
      ...standUpRule,
      actions: expandMacros(standUpRule.actions, {
        get: (type, id) => (type === 'macros' ? macros[id] : undefined),
      }),
    };

    // Create test environment with both rules and enhanced handlers
    testEnv = createRuleTestEnvironment({
      createHandlers: (entityManager, eventBus, logger) =>
        ModTestHandlerFactory.createHandlersWithPerceptionLogging(
          entityManager,
          eventBus,
          logger,
          mockGameDataRepository
        ),
      entities: [],
      rules: [expandedStandUpRule, logPerceptibleEventsRule],
      conditions: {
        'positioning:event-is-action-stand-up': standUpCondition,
      },
    });
  });

  afterEach(() => {
    if (testEnv) {
      testEnv.cleanup();
    }
  });

  it('verifies the perceptible event validation now passes after fix', async () => {
    const entities = setupKneelingStandUpScenario();
    testEnv.reset(Object.values(entities));

    // Execute the stand_up action
    await testEnv.eventBus.dispatch(ATTEMPT_ACTION_ID, {
      eventName: 'core:attempt_action',
      actorId: 'test:actor1',
      actionId: 'positioning:stand_up',
      targetId: null,
      originalInput: 'stand up',
    });

    // Find the perceptible event that was dispatched
    const perceptibleEvent = testEnv.events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );

    expect(perceptibleEvent).toBeDefined();

    // Validate the perceptible event against the schema
    const isValid = validatePerceptibleEvent(perceptibleEvent.payload);

    if (!isValid) {
      console.log('Validation errors:', validatePerceptibleEvent.errors);
    }

    // This should now pass after the fix
    expect(isValid).toBe(true);
    expect(validatePerceptibleEvent.errors).toBeNull();

    // Verify the corrected values
    expect(perceptibleEvent.payload.perceptionType).toBe('action_self_general');
    expect(perceptibleEvent.payload.targetId).toBe(null);

    // Verify that witness DOES receive the perceptible log entry
    const witness = testEnv.entityManager.getEntityInstance('test:witness1');
    const logEntries =
      witness.components[PERCEPTION_LOG_COMPONENT_ID]?.logEntries || [];

    // Should have one entry now because the validation passes
    expect(logEntries).toHaveLength(1);
    expect(logEntries[0].descriptionText).toBe(
      'Alice stands up from their kneeling position.'
    );
    expect(logEntries[0].perceptionType).toBe('action_self_general');

    // Validate action success
    ModAssertionHelpers.assertActionSuccess(
      testEnv.events,
      'Alice stands up from their kneeling position.'
    );

    // Verify component was removed
    ModAssertionHelpers.assertComponentRemoved(
      testEnv.entityManager,
      'test:actor1',
      'positioning:kneeling_before'
    );
  });

  it('validates perceptionType enum values from schema', () => {
    expect(perceptionTypeEnum).not.toContain('action_general'); // Invalid
    expect(perceptionTypeEnum).toContain('action_self_general'); // Valid for self-actions
    expect(perceptionTypeEnum).toContain('action_target_general'); // Valid for target-actions
  });

  it('demonstrates valid payload structure with corrected perceptionType', () => {
    // Create a mock payload with the corrected perceptionType
    const correctedPayload = {
      eventName: 'core:perceptible_event',
      locationId: 'throne_room',
      descriptionText: 'Alice stands up from their kneeling position.',
      timestamp: new Date().toISOString(),
      perceptionType: 'action_self_general', // Corrected value
      actorId: 'test:actor1',
      targetId: null, // Using null instead of "none"
      involvedEntities: [],
      contextualData: {},
    };

    const isValid = validatePerceptibleEvent(correctedPayload);

    if (!isValid) {
      console.log('Validation errors:', validatePerceptibleEvent.errors);
    }

    // This should pass with the corrected values
    expect(isValid).toBe(true);
    expect(correctedPayload.perceptionType).toBe('action_self_general');
    expect(correctedPayload.targetId).toBe(null);
  });
});
