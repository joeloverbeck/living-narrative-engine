/**
 * @file Shared helpers for ballet mod action integration tests.
 * @description Provides reusable assertions and fixtures for validating ballet mod actions and rules.
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

const ROOM_ID = 'ballet_rehearsal_room';
const ROOM_NAME = 'Grand Practice Studio';
const ACTOR_ID = 'principal_dancer';
const TARGET_ID = 'partner_dancer';
const ACTOR_NAME = 'Elena';
const TARGET_NAME = 'Marco';
const REQUIRED_COMPONENT = 'ballet:is_ballet_dancer';
const FORBIDDEN_COMPONENT = 'hugging-states:hugging';
const ACTION_SCHEMA = 'schema://living-narrative-engine/action.schema.json';
const RULE_SCHEMA = 'schema://living-narrative-engine/rule.schema.json';
const CONDITION_SCHEMA =
  'schema://living-narrative-engine/condition.schema.json';
const PERCEPTION_TYPE = 'physical.self_action';

/**
 * Runs a complete integration test suite for a ballet action using shared assertions.
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
export function runBalletActionIntegrationTests(config) {
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

  describe(`Ballet Mod: ${displayName}`, () => {
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
          forbidden: { actor: [FORBIDDEN_COMPONENT] },
        });
      });

      it('defines accessible Indigo Velvet visual styling', () => {
        validateVisualStyling(actionFile.visual, 'Indigo Velvet', {
          backgroundColor: '#283593',
          textColor: '#c5cae9',
          hoverBackgroundColor: '#3949ab',
          hoverTextColor: '#e8eaf6',
        });
        validateAccessibilityCompliance(
          actionFile.visual,
          'Indigo Velvet scheme'
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
          `ballet:event-is-action-${actionId.split(':')[1].replace(/_/g, '-')}`
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
          'ballet',
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
        includeBalletComponent = true,
        includeHugging = false,
      } = {}) => {
        const room = ModEntityScenarios.createRoom(ROOM_ID, ROOM_NAME);

        const actorBuilder = new ModEntityBuilder(ACTOR_ID)
          .withName(ACTOR_NAME)
          .atLocation(ROOM_ID)
          .withLocationComponent(ROOM_ID)
          .asActor();

        if (includeBalletComponent) {
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

      it('executes successfully for a trained dancer', async () => {
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

      it('rejects attempts without ballet training component', async () => {
        const { actorId } = setupScenario({ includeBalletComponent: false });

        await expect(testFixture.executeAction(actorId, null)).rejects.toThrow(
          /missing required component/i
        );
      });

      it('blocks execution while the dancer is hugging another entity', async () => {
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
