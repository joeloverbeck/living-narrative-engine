/**
 * @file Shared helpers for gymnastics mod action integration tests.
 * @description Provides reusable assertions and fixtures for validating gymnastics mod actions and rules.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import {
  validateActionProperties,
  validateVisualStyling,
  validateComponentRequirements,
  validateRequiredActionProperties,
  validateAccessibilityCompliance,
} from '../../../common/mods/actionPropertyHelpers.js';

const ROOM_ID = 'gymnastics_training_floor';
const ROOM_NAME = 'Training Gymnasium';
const ACTOR_ID = 'gymnast_performer';
const TARGET_ID = 'gymnast_observer';
const ACTOR_NAME = 'Simone';
const TARGET_NAME = 'Jordan';
const REQUIRED_COMPONENT = 'gymnastics:is_gymnast';
const FORBIDDEN_COMPONENT = 'hugging-states:hugging';
const FORBIDDEN_COMPONENTS = [
  FORBIDDEN_COMPONENT,
  'positioning:being_restrained',
  'positioning:restraining',
];
const ACTION_SCHEMA = 'schema://living-narrative-engine/action.schema.json';
const RULE_SCHEMA = 'schema://living-narrative-engine/rule.schema.json';
const CONDITION_SCHEMA =
  'schema://living-narrative-engine/condition.schema.json';
const PERCEPTION_TYPE = 'physical.self_action';

/**
 * Runs a complete integration test suite for a gymnastics action using shared assertions.
 *
 * @param {object} config - Configuration for the test suite.
 * @param {string} config.actionId - Fully-qualified action identifier.
 * @param {object} config.actionFile - Parsed action JSON definition.
 * @param {object} config.ruleFile - Parsed rule JSON definition.
 * @param {object} config.conditionFile - Parsed condition JSON definition.
 * @param {string} config.displayName - Human readable action name for describe blocks.
 * @param {string} config.template - Expected action template text.
 * @param {string} config.description - Expected action description.
 * @param {string} config.logMessageSuffix - Narrative suffix appended after the actor name.
 */
export function runGymnasticsActionIntegrationTests(config) {
  const {
    actionId,
    actionFile,
    ruleFile,
    conditionFile,
    displayName,
    template,
    description,
    logMessageSuffix,
  } = config;

  const expectedNarrationTemplate = `{context.actorName} ${logMessageSuffix}`;
  const expectedNarrationText = `${ACTOR_NAME} ${logMessageSuffix}`;

  describe(`Gymnastics Mod: ${displayName}`, () => {
    describe('Action definition', () => {
      it('declares the expected core properties', () => {
        validateActionProperties(actionFile, {
          $schema: ACTION_SCHEMA,
          id: actionId,
          name: displayName,
          targets: 'none',
          template,
        });
        expect(actionFile.description).toBe(description);
      });

      it('specifies required and forbidden components', () => {
        validateComponentRequirements(actionFile, {
          required: { actor: [REQUIRED_COMPONENT] },
          forbidden: { actor: FORBIDDEN_COMPONENTS },
        });
      });

      it('defines accessible Journey Cobalt visual styling', () => {
        validateVisualStyling(actionFile.visual, 'Journey Cobalt', {
          backgroundColor: '#1a237e',
          textColor: '#e8eaf6',
          hoverBackgroundColor: '#283593',
          hoverTextColor: '#ffffff',
        });
        validateAccessibilityCompliance(
          actionFile.visual,
          'Journey Cobalt scheme'
        );
      });

      it('includes mandatory schema properties and no prerequisites', () => {
        validateRequiredActionProperties(actionFile);
        expect(actionFile.prerequisites).toEqual([]);
      });
    });

    describe('Rule structure', () => {
      it('identifies the handler rule correctly', () => {
        expect(ruleFile.$schema).toBe(RULE_SCHEMA);
        expect(ruleFile.rule_id).toBe(`handle_${actionId.split(':')[1]}`);
        expect(ruleFile.comment).toContain(displayName);
        expect(ruleFile.event_type).toBe('core:attempt_action');
        expect(ruleFile.condition).toEqual({
          condition_ref: conditionFile.id,
        });
      });

      it('configures narrative variable assignments and macro usage', () => {
        expect(ruleFile.actions).toHaveLength(7);

        const [
          getName,
          queryPosition,
          setLogMessage,
          setPerception,
          setLocation,
          setTarget,
          macro,
        ] = ruleFile.actions;

        expect(getName.type).toBe('GET_NAME');
        expect(getName.parameters.entity_ref).toBe('actor');
        expect(getName.parameters.result_variable).toBe('actorName');

        expect(queryPosition.type).toBe('QUERY_COMPONENT');
        expect(queryPosition.parameters.entity_ref).toBe('actor');
        expect(queryPosition.parameters.component_type).toBe('core:position');
        expect(queryPosition.parameters.result_variable).toBe('actorPosition');

        expect(setLogMessage.type).toBe('SET_VARIABLE');
        expect(setLogMessage.parameters.variable_name).toBe('logMessage');
        expect(setLogMessage.parameters.value).toBe(expectedNarrationTemplate);

        expect(setPerception.type).toBe('SET_VARIABLE');
        expect(setPerception.parameters.variable_name).toBe('perceptionType');
        expect(setPerception.parameters.value).toBe(PERCEPTION_TYPE);

        expect(setLocation.type).toBe('SET_VARIABLE');
        expect(setLocation.parameters.variable_name).toBe('locationId');
        expect(setLocation.parameters.value).toBe(
          '{context.actorPosition.locationId}'
        );

        expect(setTarget.type).toBe('SET_VARIABLE');
        expect(setTarget.parameters.variable_name).toBe('targetId');
        expect(setTarget.parameters.value).toBeNull();

        expect(macro.macro).toBe('core:logSuccessAndEndTurn');
      });

      it('matches only the intended action via condition logic', () => {
        expect(conditionFile.$schema).toBe(CONDITION_SCHEMA);
        expect(conditionFile.id).toBe(
          `gymnastics:event-is-action-${actionId.split(':')[1].replace(/_/g, '-')}`
        );
        expect(conditionFile.logic['==']).toEqual([
          { var: 'event.payload.actionId' },
          actionId,
        ]);
      });
    });

    describe('Rule execution', () => {
      /** @type {ModTestFixture} */
      let testFixture;

      beforeEach(async () => {
        testFixture = await ModTestFixture.forAction(
          'gymnastics',
          actionId,
          ruleFile,
          conditionFile
        );
      });

      afterEach(() => {
        testFixture.cleanup();
      });

      const setupScenario = ({
        includeTarget = false,
        includeGymnastComponent = true,
        includeHugging = false,
      } = {}) => {
        const room = ModEntityScenarios.createRoom(ROOM_ID, ROOM_NAME);

        const actorBuilder = new ModEntityBuilder(ACTOR_ID)
          .withName(ACTOR_NAME)
          .atLocation(ROOM_ID)
          .withLocationComponent(ROOM_ID)
          .asActor();

        if (includeGymnastComponent) {
          actorBuilder.withComponent(REQUIRED_COMPONENT, {});
        }

        if (includeHugging) {
          actorBuilder.withComponent(FORBIDDEN_COMPONENT, {
            embraced_entity_id: TARGET_ID,
            initiated: true,
          });
        }

        const entities = [room, actorBuilder.build()];

        if (includeTarget) {
          const target = new ModEntityBuilder(TARGET_ID)
            .withName(TARGET_NAME)
            .atLocation(ROOM_ID)
            .withLocationComponent(ROOM_ID)
            .asActor()
            .build();
          entities.push(target);
        }

        testFixture.reset(entities);
        testFixture.clearEvents();
        return { actorId: ACTOR_ID };
      };

      it('executes successfully for a trained gymnast', async () => {
        const { actorId } = setupScenario();

        await testFixture.executeAction(actorId, null);

        testFixture.assertActionSuccess(expectedNarrationText);
        testFixture.assertPerceptibleEvent({
          descriptionText: expectedNarrationText,
          locationId: ROOM_ID,
          actorId,
          perceptionType: PERCEPTION_TYPE,
        });

        const perceptibleEvent = testFixture.events.find(
          (event) => event.eventType === 'core:perceptible_event'
        );
        expect(perceptibleEvent.payload.targetId).toBeNull();
      });

      it('rejects attempts without gymnastics training component', async () => {
        const { actorId } = setupScenario({ includeGymnastComponent: false });

        await expect(testFixture.executeAction(actorId, null)).rejects.toThrow(
          /missing required component/i
        );
      });

      it('blocks execution while the gymnast is hugging another entity', async () => {
        const { actorId } = setupScenario({
          includeTarget: true,
          includeHugging: true,
        });

        await expect(testFixture.executeAction(actorId, null)).rejects.toThrow(
          /forbidden component/i
        );

        const actorInstance =
          testFixture.entityManager.getEntityInstance(actorId);
        expect(actorInstance.components[FORBIDDEN_COMPONENT]).toEqual({
          embraced_entity_id: TARGET_ID,
          initiated: true,
        });
      });

      it('ignores unrelated core:attempt_action events', async () => {
        const { actorId } = setupScenario();

        await testFixture.eventBus.dispatch('core:attempt_action', {
          eventName: 'core:attempt_action',
          actorId,
          actionId: 'core:wait',
          originalInput: 'wait',
        });

        testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
      });
    });
  });
}
