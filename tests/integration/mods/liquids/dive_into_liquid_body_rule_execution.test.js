/**
 * @file Integration tests for dive_into_liquid_body rule structure and registration.
 */

import { describe, it, expect } from '@jest/globals';
import handleDiveIntoLiquidBodyRule from '../../../../data/mods/liquids/rules/handle_dive_into_liquid_body.rule.json' assert { type: 'json' };
import diveIntoLiquidBodyCondition from '../../../../data/mods/liquids/conditions/event-is-action-dive-into-liquid-body.condition.json' assert { type: 'json' };
import modManifest from '../../../../data/mods/liquids/mod-manifest.json' assert { type: 'json' };

const ACTION_ID = 'liquids:dive_into_liquid_body';

describe('handle_dive_into_liquid_body rule structure', () => {
  describe('Rule registration', () => {
    it('registers rule and condition correctly', () => {
      expect(handleDiveIntoLiquidBodyRule.rule_id).toBe('handle_dive_into_liquid_body');
      expect(handleDiveIntoLiquidBodyRule.event_type).toBe('core:attempt_action');
      expect(handleDiveIntoLiquidBodyRule.condition.condition_ref).toBe(
        'liquids:event-is-action-dive-into-liquid-body'
      );
    });

    it('condition checks for correct action ID', () => {
      expect(diveIntoLiquidBodyCondition.id).toBe('liquids:event-is-action-dive-into-liquid-body');
      expect(diveIntoLiquidBodyCondition.logic).toEqual({
        '==': [
          { var: 'event.payload.actionId' },
          ACTION_ID,
        ],
      });
    });

    it('manifest includes the rule', () => {
      expect(modManifest.content.rules).toContain('handle_dive_into_liquid_body.rule.json');
    });

    it('manifest includes the condition', () => {
      expect(modManifest.content.conditions).toContain('event-is-action-dive-into-liquid-body.condition.json');
    });

    it('manifest includes the action', () => {
      expect(modManifest.content.actions).toContain('dive_into_liquid_body.action.json');
    });
  });

  describe('Rule operations setup', () => {
    const getOperation = (type, index = 0) => {
      const ops = handleDiveIntoLiquidBodyRule.actions.filter((a) => a.type === type);
      return ops[index];
    };

    it('sets up actor name retrieval', () => {
      const op = getOperation('GET_NAME', 0);
      expect(op).toBeDefined();
      expect(op.parameters.entity_ref).toBe('actor');
      expect(op.parameters.result_variable).toBe('actorName');
    });

    it('sets up target name retrieval', () => {
      const op = getOperation('GET_NAME', 1);
      expect(op).toBeDefined();
      expect(op.parameters.entity_ref).toBe('target');
      expect(op.parameters.result_variable).toBe('liquidBodyName');
    });

    it('sets up position query', () => {
      const op = handleDiveIntoLiquidBodyRule.actions.find(
        (a) => a.type === 'QUERY_COMPONENT' && a.parameters.component_type === 'core:position'
      );
      expect(op).toBeDefined();
      expect(op.parameters.entity_ref).toBe('actor');
      expect(op.parameters.result_variable).toBe('actorPosition');
    });

    it('sets up liquid body query for visibility', () => {
      const op = handleDiveIntoLiquidBodyRule.actions.find(
        (a) => a.type === 'QUERY_COMPONENT' && a.parameters.component_type === 'liquids:liquid_body'
      );
      expect(op).toBeDefined();
      expect(op.parameters.entity_ref).toEqual({ entityId: '{event.payload.targetId}' });
      expect(op.parameters.result_variable).toBe('liquidBodyComponent');
    });

    it('sets visibility variable', () => {
      const op = handleDiveIntoLiquidBodyRule.actions.find(
        (a) => a.type === 'SET_VARIABLE' && a.parameters.variable_name === 'liquidVisibility'
      );
      expect(op).toBeDefined();
      expect(op.parameters.value).toBe('{context.liquidBodyComponent.visibility}');
    });
  });

  describe('State modification operations', () => {
    it('adds in_liquid_body component', () => {
      const op = handleDiveIntoLiquidBodyRule.actions.find(
        (a) => a.type === 'ADD_COMPONENT' && a.parameters.component_type === 'liquids-states:in_liquid_body'
      );
      expect(op).toBeDefined();
      expect(op.parameters.entity_ref).toBe('actor');
      expect(op.parameters.value).toEqual({
        liquid_body_id: '{event.payload.targetId}',
      });
    });

    it('adds submerged component', () => {
      const op = handleDiveIntoLiquidBodyRule.actions.find(
        (a) => a.type === 'ADD_COMPONENT' && a.parameters.component_type === 'liquids-states:submerged'
      );
      expect(op).toBeDefined();
      expect(op.parameters.entity_ref).toBe('actor');
      expect(op.parameters.value).toEqual({});
    });

    it('operation order has ADD_COMPONENT before REGENERATE_DESCRIPTION', () => {
      const addComponentIndex = handleDiveIntoLiquidBodyRule.actions.findIndex(
        (a) => a.type === 'ADD_COMPONENT' && a.parameters.component_type === 'liquids-states:submerged'
      );
      const regenerateIndex = handleDiveIntoLiquidBodyRule.actions.findIndex(
        (a) => a.type === 'REGENERATE_DESCRIPTION'
      );
      expect(addComponentIndex).toBeLessThan(regenerateIndex);
    });
  });

  describe('Perceptible event configuration', () => {
    it('dispatches perceptible event with correct parameters', () => {
      const op = handleDiveIntoLiquidBodyRule.actions.find(
        (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(op).toBeDefined();
      expect(op.parameters.location_id).toBe('{context.actorPosition.locationId}');
      expect(op.parameters.actor_id).toBe('{event.payload.actorId}');
      expect(op.parameters.target_id).toBe('{event.payload.targetId}');
    });

    it('includes visibility in description_text', () => {
      const op = handleDiveIntoLiquidBodyRule.actions.find(
        (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(op.parameters.description_text).toContain('{context.liquidVisibility}');
    });

    it('uses physical.self_action perception type', () => {
      const op = handleDiveIntoLiquidBodyRule.actions.find(
        (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(op.parameters.perception_type).toBe('physical.self_action');
    });

    it('includes actor_description with first-person text', () => {
      const op = handleDiveIntoLiquidBodyRule.actions.find(
        (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(op.parameters.actor_description).toMatch(/^I dive into/);
    });

    it('includes alternate_descriptions with auditory fallback', () => {
      const op = handleDiveIntoLiquidBodyRule.actions.find(
        (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(op.parameters.alternate_descriptions.auditory).toBeDefined();
      expect(op.parameters.alternate_descriptions.auditory).toContain('splash');
    });

    it('includes alternate_descriptions with tactile fallback', () => {
      const op = handleDiveIntoLiquidBodyRule.actions.find(
        (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(op.parameters.alternate_descriptions.tactile).toBeDefined();
      expect(op.parameters.alternate_descriptions.tactile).toContain('liquid displacement');
    });
  });

  describe('Turn ending', () => {
    it('ends turn with success', () => {
      const op = handleDiveIntoLiquidBodyRule.actions.find(
        (a) => a.type === 'END_TURN'
      );
      expect(op).toBeDefined();
      expect(op.parameters.entityId).toBe('{event.payload.actorId}');
      expect(op.parameters.success).toBe(true);
    });
  });
});
