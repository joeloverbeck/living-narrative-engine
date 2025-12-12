/**
 * @file Integration test for an unknown-category mod that uses component mutation and perception logging.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { PERCEPTION_LOG_COMPONENT_ID } from '../../../../src/constants/componentIds.js';

const UNKNOWN_MOD_ID = 'unknown-category-component-mod';
const ACTION_ID = `${UNKNOWN_MOD_ID}:test_action`;
const CONDITION_ID = `${UNKNOWN_MOD_ID}:event-is-action-test-action`;

const unknownCategoryRule = {
  $schema: 'schema://living-narrative-engine/rule.schema.json',
  rule_id: 'handle_test_action_for_unknown_category',
  event_type: 'core:attempt_action',
  condition: { condition_ref: CONDITION_ID },
  actions: [
    {
      type: 'ADD_COMPONENT',
      parameters: {
        entity_ref: 'actor',
        component_type: 'custom:unknown_marker',
        value: { state: 'added' },
      },
    },
    {
      type: 'ADD_PERCEPTION_LOG_ENTRY',
      parameters: {
        location_id: 'room1',
        entry: {
          descriptionText: 'Unknown category marker added',
          perceptionType: 'state.observable_change',
        },
      },
    },
  ],
};

const unknownCategoryCondition = {
  $schema: 'schema://living-narrative-engine/condition.schema.json',
  id: CONDITION_ID,
  description: 'Matches the unknown category test action.',
  logic: {
    '==': [{ var: 'event.payload.actionId' }, ACTION_ID],
  },
};

describe('Unknown category component/perception coverage', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      UNKNOWN_MOD_ID,
      ACTION_ID,
      unknownCategoryRule,
      unknownCategoryCondition
    );
  });

  afterEach(() => {
    testFixture?.cleanup();
  });

  it('auto-detects superset handlers for uncatalogued categories', () => {
    expect(testFixture.testEnv.handlers.ADD_COMPONENT).toBeDefined();
    expect(testFixture.testEnv.handlers.ADD_PERCEPTION_LOG_ENTRY).toBeDefined();
  });

  it('executes component mutation and perception logging without MissingHandlerError', async () => {
    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    const actor = new ModEntityBuilder('actor1')
      .withName('Ava')
      .atLocation('room1')
      .asActor()
      .withComponent(PERCEPTION_LOG_COMPONENT_ID, {
        maxEntries: 5,
        logEntries: [],
      })
      .build();
    const target = new ModEntityBuilder('target1')
      .withName('Blake')
      .atLocation('room1')
      .asActor()
      .withComponent(PERCEPTION_LOG_COMPONENT_ID, {
        maxEntries: 5,
        logEntries: [],
      })
      .build();

    testFixture.reset([room, actor, target]);

    await expect(
      testFixture.executeAction(actor.id, target.id, { skipDiscovery: true })
    ).resolves.not.toThrow();

    const updatedActor = testFixture.entityManager.getEntityInstance(actor.id);
    expect(updatedActor.components['custom:unknown_marker']).toEqual({
      state: 'added',
    });

    const perceptionLog = updatedActor.components[PERCEPTION_LOG_COMPONENT_ID];
    expect(perceptionLog.logEntries).toEqual([
      expect.objectContaining({
        descriptionText: 'Unknown category marker added',
      }),
    ]);
  });
});
