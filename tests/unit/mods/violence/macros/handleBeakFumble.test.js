/**
 * @file Unit tests for violence:handleBeakFumble macro
 * @description Verifies that the handleBeakFumble macro correctly handles beak attack
 * fumble outcomes by adding the fallen component (NOT dropping a weapon).
 */

import { describe, it, expect } from '@jest/globals';

// Import macro JSON for structure validation
import handleBeakFumble from '../../../../../data/mods/violence/macros/handleBeakFumble.macro.json' assert { type: 'json' };

describe('violence:handleBeakFumble macro', () => {
  describe('Schema Structure', () => {
    it('should have valid macro schema structure', () => {
      expect(handleBeakFumble.$schema).toBe(
        'schema://living-narrative-engine/macro.schema.json'
      );
      expect(handleBeakFumble.id).toBe('violence:handleBeakFumble');
      expect(handleBeakFumble.description).toBeDefined();
      expect(handleBeakFumble.actions).toBeDefined();
      expect(Array.isArray(handleBeakFumble.actions)).toBe(true);
    });

    it('should have a meaningful description', () => {
      expect(handleBeakFumble.description).toContain('FUMBLE');
      expect(handleBeakFumble.description).toContain('beak');
    });
  });

  describe('ADD_COMPONENT Operation', () => {
    it('should add recovery-states:fallen component to actor', () => {
      const addComponentOp = handleBeakFumble.actions.find(
        (op) => op.type === 'ADD_COMPONENT'
      );
      expect(addComponentOp).toBeDefined();
      expect(addComponentOp.parameters.entity_ref).toBe('actor');
      expect(addComponentOp.parameters.component_type).toBe(
        'recovery-states:fallen'
      );
    });

    it('should pass empty value object to fallen component', () => {
      const addComponentOp = handleBeakFumble.actions.find(
        (op) => op.type === 'ADD_COMPONENT'
      );
      expect(addComponentOp.parameters.value).toBeDefined();
      expect(addComponentOp.parameters.value).toEqual({});
    });

    it('should have a descriptive comment', () => {
      const addComponentOp = handleBeakFumble.actions.find(
        (op) => op.type === 'ADD_COMPONENT'
      );
      expect(addComponentOp.comment).toBeDefined();
      expect(addComponentOp.comment.toLowerCase()).toContain('fumble');
    });
  });

  describe('DISPATCH_PERCEPTIBLE_EVENT Operation', () => {
    it('should dispatch perceptible event with fumble narrative', () => {
      const dispatchOp = handleBeakFumble.actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatchOp).toBeDefined();
    });

    it('should reference correct location_id variable', () => {
      const dispatchOp = handleBeakFumble.actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatchOp.parameters.location_id).toBe(
        '{context.actorPosition.locationId}'
      );
    });

    it('should reference correct actor_id variable', () => {
      const dispatchOp = handleBeakFumble.actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatchOp.parameters.actor_id).toBe('{event.payload.actorId}');
    });

    it('should include falling-related narrative text', () => {
      const dispatchOp = handleBeakFumble.actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      const description = dispatchOp.parameters.description_text;
      const descriptionLower = description.toLowerCase();
      expect(descriptionLower).toContain('losing balance');
      expect(descriptionLower).toContain('falling');
    });

    it('should include beak reference in narrative text', () => {
      const dispatchOp = handleBeakFumble.actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      const description = dispatchOp.parameters.description_text.toLowerCase();
      expect(description).toContain('beak');
    });

    it('should mention the target in narrative text', () => {
      const dispatchOp = handleBeakFumble.actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      const description = dispatchOp.parameters.description_text;
      expect(description).toContain('{context.targetName}');
      expect(description.toLowerCase()).toContain('attack');
    });

    it('should use action_target_general perception type', () => {
      const dispatchOp = handleBeakFumble.actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatchOp.parameters.perception_type).toBe(
        'combat.violence'
      );
    });
  });

  describe('SET_VARIABLE Operation', () => {
    it('should set logMessage variable', () => {
      const setVarOp = handleBeakFumble.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'logMessage'
      );
      expect(setVarOp).toBeDefined();
    });

    it('should set logMessage to falling-related text', () => {
      const setVarOp = handleBeakFumble.actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'logMessage'
      );
      const message = setVarOp.parameters.value;
      const messageLower = message.toLowerCase();
      expect(messageLower).toContain('losing balance');
      expect(messageLower).toContain('falling');
      expect(message).toContain('{context.targetName}');
    });
  });

  describe('Macro Call to End Turn', () => {
    it('should call core:logFailureOutcomeAndEndTurn', () => {
      const macroCall = handleBeakFumble.actions.find(
        (op) => op.macro === 'core:logFailureOutcomeAndEndTurn'
      );
      expect(macroCall).toBeDefined();
    });
  });

  describe('No Weapon Drop Operations (Key Differentiator)', () => {
    it('should NOT include UNWIELD_ITEM operation', () => {
      const hasUnwield = handleBeakFumble.actions.some(
        (op) => op.type === 'UNWIELD_ITEM'
      );
      expect(hasUnwield).toBe(false);
    });

    it('should NOT include DROP_ITEM_AT_LOCATION operation', () => {
      const hasDrop = handleBeakFumble.actions.some(
        (op) => op.type === 'DROP_ITEM_AT_LOCATION'
      );
      expect(hasDrop).toBe(false);
    });
  });

  describe('Operation Order Validation', () => {
    it('should execute ADD_COMPONENT before DISPATCH_PERCEPTIBLE_EVENT', () => {
      const actions = handleBeakFumble.actions;
      const addComponentIndex = actions.findIndex(
        (op) => op.type === 'ADD_COMPONENT'
      );
      const dispatchIndex = actions.findIndex(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      expect(addComponentIndex).toBeGreaterThanOrEqual(0);
      expect(dispatchIndex).toBeGreaterThanOrEqual(0);
      expect(addComponentIndex).toBeLessThan(dispatchIndex);
    });

    it('should call macro reference as last action', () => {
      const actions = handleBeakFumble.actions;
      const lastAction = actions[actions.length - 1];
      expect(lastAction.macro).toBe('core:logFailureOutcomeAndEndTurn');
    });
  });
});
