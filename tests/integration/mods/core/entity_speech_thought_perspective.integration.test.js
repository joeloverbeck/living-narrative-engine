/**
 * @file entity_speech_thought_perspective.integration.test.js
 * @description Integration tests verifying perspective-aware perception in speech and thought rules.
 *
 * These tests validate:
 * - Speech rule includes actor_description for first-person perspective
 * - Speech rule includes alternate_descriptions for sensory fallbacks
 * - Thought rule does NOT include actor_description (thoughts go via DISPATCH_THOUGHT)
 * - Both rules include log_entry: true
 *
 * @see tickets/DISPEREVEUPG-007-core.md
 */

import { describe, it, expect } from '@jest/globals';
import entitySpeechRule from '../../../../data/mods/core/rules/entity_speech.rule.json' assert { type: 'json' };
import entityThoughtRule from '../../../../data/mods/core/rules/entity_thought.rule.json' assert { type: 'json' };

describe('Core Communication Rules - Perspective-Aware Perception', () => {
  describe('entity_speech.rule.json', () => {
    it('should successfully import entity_speech.rule.json', () => {
      expect(entitySpeechRule).toBeDefined();
      expect(entitySpeechRule.rule_id).toBe('entity_speech');
      expect(entitySpeechRule.event_type).toBe('core:entity_spoke');
    });

    it('should have DISPATCH_PERCEPTIBLE_EVENT with actor_description', () => {
      // Navigate to the DISPATCH_PERCEPTIBLE_EVENT operation
      const ifOperation = entitySpeechRule.actions.find(
        (action) => action.type === 'IF'
      );
      expect(ifOperation).toBeDefined();

      const dispatchOp = ifOperation.parameters.then_actions.find(
        (action) => action.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatchOp).toBeDefined();

      // Verify actor_description for first-person perspective
      expect(dispatchOp.parameters.actor_description).toBeDefined();
      expect(dispatchOp.parameters.actor_description).toContain('I say:');
      expect(dispatchOp.parameters.actor_description).toContain(
        'speechContent'
      );
    });

    it('should have alternate_descriptions with valid sensory types', () => {
      const ifOperation = entitySpeechRule.actions.find(
        (action) => action.type === 'IF'
      );
      const dispatchOp = ifOperation.parameters.then_actions.find(
        (action) => action.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      // Verify alternate_descriptions structure
      expect(dispatchOp.parameters.alternate_descriptions).toBeDefined();

      // Verify only valid sensory types are used (auditory, tactile, olfactory, limited)
      const alternates = dispatchOp.parameters.alternate_descriptions;
      const validTypes = ['auditory', 'tactile', 'olfactory', 'limited'];
      const usedTypes = Object.keys(alternates);

      usedTypes.forEach((type) => {
        expect(validTypes).toContain(type);
      });

      // Speech should have auditory and limited fallbacks
      expect(alternates.auditory).toBeDefined();
      expect(alternates.limited).toBeDefined();
    });

    it('should have log_entry set to true', () => {
      const ifOperation = entitySpeechRule.actions.find(
        (action) => action.type === 'IF'
      );
      const dispatchOp = ifOperation.parameters.then_actions.find(
        (action) => action.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      expect(dispatchOp.parameters.log_entry).toBe(true);
    });

    it('should maintain third-person description_text for observers', () => {
      const ifOperation = entitySpeechRule.actions.find(
        (action) => action.type === 'IF'
      );
      const dispatchOp = ifOperation.parameters.then_actions.find(
        (action) => action.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      // Verify third-person observer description
      expect(dispatchOp.parameters.description_text).toBeDefined();
      expect(dispatchOp.parameters.description_text).toContain(
        'speakerNameComponent'
      );
      expect(dispatchOp.parameters.description_text).toContain('says:');
    });
  });

  describe('entity_thought.rule.json', () => {
    it('should successfully import entity_thought.rule.json', () => {
      expect(entityThoughtRule).toBeDefined();
      expect(entityThoughtRule.rule_id).toBe('entity_thought');
      expect(entityThoughtRule.event_type).toBe('core:entity_thought');
    });

    it('should NOT have actor_description (thoughts go via DISPATCH_THOUGHT)', () => {
      // Navigate to the DISPATCH_PERCEPTIBLE_EVENT operation
      const ifOperation = entityThoughtRule.actions.find(
        (action) => action.type === 'IF'
      );
      expect(ifOperation).toBeDefined();

      const dispatchOp = ifOperation.parameters.then_actions.find(
        (action) => action.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatchOp).toBeDefined();

      // CRITICAL: actor_description should NOT be present for thoughts
      // Reason: Thoughts are delivered to the actor via DISPATCH_THOUGHT operation,
      // not through the perceptible event system. Adding actor_description would
      // pollute the perception log with redundant information.
      expect(dispatchOp.parameters.actor_description).toBeUndefined();
    });

    it('should have alternate_descriptions with limited fallback only', () => {
      const ifOperation = entityThoughtRule.actions.find(
        (action) => action.type === 'IF'
      );
      const dispatchOp = ifOperation.parameters.then_actions.find(
        (action) => action.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      // Verify alternate_descriptions structure
      expect(dispatchOp.parameters.alternate_descriptions).toBeDefined();

      // Verify only valid sensory types are used
      const alternates = dispatchOp.parameters.alternate_descriptions;
      const validTypes = ['auditory', 'tactile', 'olfactory', 'limited'];
      const usedTypes = Object.keys(alternates);

      usedTypes.forEach((type) => {
        expect(validTypes).toContain(type);
      });

      // Thought should have limited fallback for partial perception awareness
      expect(alternates.limited).toBeDefined();

      // Verify 'telepathic' is NOT used (not a valid schema type)
      expect(alternates.telepathic).toBeUndefined();
    });

    it('should have log_entry set to true', () => {
      const ifOperation = entityThoughtRule.actions.find(
        (action) => action.type === 'IF'
      );
      const dispatchOp = ifOperation.parameters.then_actions.find(
        (action) => action.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      expect(dispatchOp.parameters.log_entry).toBe(true);
    });

    it('should maintain third-person description_text for observers', () => {
      const ifOperation = entityThoughtRule.actions.find(
        (action) => action.type === 'IF'
      );
      const dispatchOp = ifOperation.parameters.then_actions.find(
        (action) => action.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      // Verify third-person observer description
      expect(dispatchOp.parameters.description_text).toBeDefined();
      expect(dispatchOp.parameters.description_text).toContain(
        'thinkerNameComponent'
      );
      expect(dispatchOp.parameters.description_text).toContain(
        'is lost in thought'
      );
    });

    it('should still dispatch thoughts via DISPATCH_THOUGHT operation', () => {
      // Verify the rule still has DISPATCH_THOUGHT for actor's own thought delivery
      const ifOperation = entityThoughtRule.actions.find(
        (action) => action.type === 'IF'
      );

      // Find nested IF for suppressDisplay check
      const nestedIf = ifOperation.parameters.then_actions.find(
        (action) =>
          action.type === 'IF' &&
          action.parameters?.then_actions?.some(
            (a) => a.type === 'DISPATCH_THOUGHT'
          )
      );
      expect(nestedIf).toBeDefined();

      const dispatchThought = nestedIf.parameters.then_actions.find(
        (action) => action.type === 'DISPATCH_THOUGHT'
      );
      expect(dispatchThought).toBeDefined();
      expect(dispatchThought.parameters.entity_id).toBeDefined();
      expect(dispatchThought.parameters.thoughts).toBeDefined();
    });
  });

  describe('Consistency between rules', () => {
    it('both rules should have consistent structure for perceptible events', () => {
      const speechIfOp = entitySpeechRule.actions.find(
        (a) => a.type === 'IF'
      );
      const thoughtIfOp = entityThoughtRule.actions.find(
        (a) => a.type === 'IF'
      );

      const speechDispatch = speechIfOp.parameters.then_actions.find(
        (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      const thoughtDispatch = thoughtIfOp.parameters.then_actions.find(
        (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      // Both should have these common fields
      ['location_id', 'description_text', 'perception_type', 'actor_id', 'log_entry', 'alternate_descriptions'].forEach(
        (field) => {
          expect(speechDispatch.parameters[field]).toBeDefined();
          expect(thoughtDispatch.parameters[field]).toBeDefined();
        }
      );
    });

    it('perception types should be communication category', () => {
      const speechIfOp = entitySpeechRule.actions.find(
        (a) => a.type === 'IF'
      );
      const thoughtIfOp = entityThoughtRule.actions.find(
        (a) => a.type === 'IF'
      );

      const speechDispatch = speechIfOp.parameters.then_actions.find(
        (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      const thoughtDispatch = thoughtIfOp.parameters.then_actions.find(
        (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      expect(speechDispatch.parameters.perception_type).toBe(
        'communication.speech'
      );
      expect(thoughtDispatch.parameters.perception_type).toBe(
        'communication.thought'
      );
    });
  });
});
