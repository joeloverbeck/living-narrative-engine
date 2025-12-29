/**
 * @file Integration tests for the gymnastics:do_backward_roll chance-based action.
 * @description Tests the do_backward_roll action definition and handle_do_backward_roll rule
 * with outcome resolution (CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE).
 * FUMBLE outcome adds recovery-states:fallen component to the actor.
 */

import { describe, it, expect } from '@jest/globals';

// Import action, rule, and condition JSON for structure validation
import actionDefinition from '../../../../data/mods/gymnastics/actions/do_backward_roll.action.json' assert { type: 'json' };
import ruleDefinition from '../../../../data/mods/gymnastics/rules/handle_do_backward_roll.rule.json' assert { type: 'json' };
import conditionDefinition from '../../../../data/mods/gymnastics/conditions/event-is-action-do-backward-roll.condition.json' assert { type: 'json' };

describe('gymnastics:do_backward_roll chance-based action', () => {
  describe('Action Definition Structure', () => {
    it('should have correct action ID and schema', () => {
      expect(actionDefinition.$schema).toBe(
        'schema://living-narrative-engine/action.schema.json'
      );
      expect(actionDefinition.id).toBe('gymnastics:do_backward_roll');
      expect(actionDefinition.name).toBe('Do Backward Roll');
    });

    it('should be a self-action with no target', () => {
      expect(actionDefinition.targets).toBe('none');
    });

    it('should require both is_gymnast and mobility_skill components', () => {
      expect(actionDefinition.required_components).toBeDefined();
      expect(actionDefinition.required_components.actor).toContain(
        'gymnastics:is_gymnast'
      );
      expect(actionDefinition.required_components.actor).toContain(
        'skills:mobility_skill'
      );
    });

    it('should have forbidden components for physical constraints', () => {
      expect(actionDefinition.forbidden_components).toBeDefined();
      expect(actionDefinition.forbidden_components.actor).toContain(
        'hugging-states:hugging'
      );
      expect(actionDefinition.forbidden_components.actor).toContain(
        'physical-control-states:being_restrained'
      );
      expect(actionDefinition.forbidden_components.actor).toContain(
        'physical-control-states:restraining'
      );
    });

    it('should have template showing chance percentage', () => {
      expect(actionDefinition.template).toContain('{chance}');
      expect(actionDefinition.template).toContain('backward roll');
    });

    it('should have chanceBased enabled', () => {
      expect(actionDefinition.chanceBased).toBeDefined();
      expect(actionDefinition.chanceBased.enabled).toBe(true);
    });

    it('should use fixed_difficulty contest type with difficulty 50', () => {
      expect(actionDefinition.chanceBased.contestType).toBe('fixed_difficulty');
      expect(actionDefinition.chanceBased.fixedDifficulty).toBe(50);
    });

    it('should use linear formula', () => {
      expect(actionDefinition.chanceBased.formula).toBe('linear');
    });

    it('should use mobility_skill as actor skill', () => {
      expect(actionDefinition.chanceBased.actorSkill).toBeDefined();
      expect(actionDefinition.chanceBased.actorSkill.component).toBe(
        'skills:mobility_skill'
      );
      expect(actionDefinition.chanceBased.actorSkill.property).toBe('value');
      expect(actionDefinition.chanceBased.actorSkill.default).toBe(0);
    });

    it('should have standard bounds (5-95) and thresholds', () => {
      expect(actionDefinition.chanceBased.bounds).toEqual({
        min: 5,
        max: 95,
      });
      expect(actionDefinition.chanceBased.outcomes).toEqual({
        criticalSuccessThreshold: 5,
        criticalFailureThreshold: 95,
      });
    });

    it('should have Journey Cobalt visual styling', () => {
      expect(actionDefinition.visual).toBeDefined();
      expect(actionDefinition.visual.backgroundColor).toBe('#1a237e');
      expect(actionDefinition.visual.textColor).toBe('#e8eaf6');
      expect(actionDefinition.visual.hoverBackgroundColor).toBe('#283593');
      expect(actionDefinition.visual.hoverTextColor).toBe('#ffffff');
    });
  });

  describe('Condition Definition Structure', () => {
    it('should have correct schema and ID', () => {
      expect(conditionDefinition.$schema).toBe(
        'schema://living-narrative-engine/condition.schema.json'
      );
      expect(conditionDefinition.id).toBe(
        'gymnastics:event-is-action-do-backward-roll'
      );
    });

    it('should match the action ID in payload', () => {
      expect(conditionDefinition.logic).toBeDefined();
      expect(conditionDefinition.logic['==']).toBeDefined();
      expect(conditionDefinition.logic['=='][0]).toEqual({
        var: 'event.payload.actionId',
      });
      expect(conditionDefinition.logic['=='][1]).toBe(
        'gymnastics:do_backward_roll'
      );
    });
  });

  describe('Rule Structure Validation', () => {
    it('should have correct rule ID and schema', () => {
      expect(ruleDefinition.$schema).toBe(
        'schema://living-narrative-engine/rule.schema.json'
      );
      expect(ruleDefinition.rule_id).toBe('handle_do_backward_roll');
    });

    it('should trigger on core:attempt_action event', () => {
      expect(ruleDefinition.event_type).toBe('core:attempt_action');
    });

    it('should reference the correct condition', () => {
      expect(ruleDefinition.condition).toEqual({
        condition_ref: 'gymnastics:event-is-action-do-backward-roll',
      });
    });

    it('should have comment mentioning chance-based and 4 outcomes', () => {
      expect(ruleDefinition.comment).toContain('chance-based');
      expect(ruleDefinition.comment).toContain('4 outcomes');
    });
  });

  describe('Rule Operations Validation', () => {
    it('should include GET_NAME operation for actor', () => {
      const getNameOp = ruleDefinition.actions.find(
        (op) =>
          op.type === 'GET_NAME' && op.parameters.entity_ref === 'actor'
      );

      expect(getNameOp).toBeDefined();
      expect(getNameOp.parameters.result_variable).toBe('actorName');
    });

    it('should include QUERY_COMPONENT for actor position', () => {
      const queryOp = ruleDefinition.actions.find(
        (op) => op.type === 'QUERY_COMPONENT'
      );

      expect(queryOp).toBeDefined();
      expect(queryOp.parameters.entity_ref).toBe('actor');
      expect(queryOp.parameters.component_type).toBe('core:position');
      expect(queryOp.parameters.result_variable).toBe('actorPosition');
    });

    it('should include RESOLVE_OUTCOME with correct parameters', () => {
      const resolveOutcomeOp = ruleDefinition.actions.find(
        (op) => op.type === 'RESOLVE_OUTCOME'
      );

      expect(resolveOutcomeOp).toBeDefined();
      expect(resolveOutcomeOp.parameters.actor_skill_component).toBe(
        'skills:mobility_skill'
      );
      expect(resolveOutcomeOp.parameters.actor_skill_default).toBe(0);
      expect(resolveOutcomeOp.parameters.difficulty_modifier).toBe(50);
      expect(resolveOutcomeOp.parameters.formula).toBe('linear');
      expect(resolveOutcomeOp.parameters.result_variable).toBe('rollResult');
    });

    it('should set common variables for end-turn macros', () => {
      const ruleString = JSON.stringify(ruleDefinition);

      expect(ruleString).toContain('"variable_name":"locationId"');
      expect(ruleString).toContain('"variable_name":"perceptionType"');
      expect(ruleString).toContain('"value":"physical.self_action"');
      expect(ruleString).toContain('"variable_name":"targetId"');
    });
  });

  describe('Outcome Branch Validation', () => {
    // Helper to find IF operation by outcome value (flat structure)
    const findIfByOutcome = (ops, outcomeValue) =>
      ops.find(
        (op) =>
          op.type === 'IF' &&
          op.parameters?.condition?.['==']?.[1] === outcomeValue
      );

    it('should have 4 independent IF operations (flat structure)', () => {
      const ifOps = ruleDefinition.actions.filter((op) => op.type === 'IF');
      expect(ifOps.length).toBe(4);

      expect(findIfByOutcome(ruleDefinition.actions, 'CRITICAL_SUCCESS')).toBeDefined();
      expect(findIfByOutcome(ruleDefinition.actions, 'SUCCESS')).toBeDefined();
      expect(findIfByOutcome(ruleDefinition.actions, 'FAILURE')).toBeDefined();
      expect(findIfByOutcome(ruleDefinition.actions, 'FUMBLE')).toBeDefined();
    });

    it('should check context.rollResult.outcome in all branches', () => {
      const ifOps = ruleDefinition.actions.filter((op) => op.type === 'IF');

      for (const ifOp of ifOps) {
        expect(ifOp.parameters.condition['==']).toBeDefined();
        expect(ifOp.parameters.condition['=='][0]).toEqual({
          var: 'context.rollResult.outcome',
        });
      }
    });

    describe('CRITICAL_SUCCESS branch', () => {
      it('should dispatch perceptible event with flawless message', () => {
        const criticalIf = findIfByOutcome(
          ruleDefinition.actions,
          'CRITICAL_SUCCESS'
        );
        const thenActions = criticalIf.parameters.then_actions;
        const dispatchOp = thenActions.find(
          (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );

        expect(dispatchOp).toBeDefined();
        expect(dispatchOp.parameters.description_text).toContain('flawless');
        expect(dispatchOp.parameters.perception_type).toBe(
          'physical.self_action'
        );
      });

      it('should have sense-aware alternate descriptions', () => {
        const criticalIf = findIfByOutcome(
          ruleDefinition.actions,
          'CRITICAL_SUCCESS'
        );
        const dispatchOp = criticalIf.parameters.then_actions.find(
          (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );

        expect(dispatchOp.parameters.alternate_descriptions).toBeDefined();
        expect(dispatchOp.parameters.alternate_descriptions.auditory).toBeDefined();
        expect(dispatchOp.parameters.alternate_descriptions.tactile).toBeDefined();
      });

      it('should use logSuccessOutcomeAndEndTurn macro', () => {
        const criticalIf = findIfByOutcome(
          ruleDefinition.actions,
          'CRITICAL_SUCCESS'
        );
        const hasMacro = criticalIf.parameters.then_actions.some(
          (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
        );
        expect(hasMacro).toBe(true);
      });
    });

    describe('SUCCESS branch', () => {
      it('should dispatch perceptible event with smoothly message', () => {
        const successIf = findIfByOutcome(ruleDefinition.actions, 'SUCCESS');
        const dispatchOp = successIf.parameters.then_actions.find(
          (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );

        expect(dispatchOp).toBeDefined();
        expect(dispatchOp.parameters.description_text).toContain('smoothly');
      });

      it('should have sense-aware alternate descriptions', () => {
        const successIf = findIfByOutcome(ruleDefinition.actions, 'SUCCESS');
        const dispatchOp = successIf.parameters.then_actions.find(
          (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );

        expect(dispatchOp.parameters.alternate_descriptions).toBeDefined();
        expect(dispatchOp.parameters.alternate_descriptions.auditory).toBeDefined();
        expect(dispatchOp.parameters.alternate_descriptions.tactile).toBeDefined();
      });

      it('should use logSuccessOutcomeAndEndTurn macro', () => {
        const successIf = findIfByOutcome(ruleDefinition.actions, 'SUCCESS');
        const hasMacro = successIf.parameters.then_actions.some(
          (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
        );
        expect(hasMacro).toBe(true);
      });
    });

    describe('FAILURE branch', () => {
      it('should dispatch perceptible event with stumbling message', () => {
        const failureIf = findIfByOutcome(ruleDefinition.actions, 'FAILURE');
        const dispatchOp = failureIf.parameters.then_actions.find(
          (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );

        expect(dispatchOp).toBeDefined();
        expect(dispatchOp.parameters.description_text).toContain('stumbling');
      });

      it('should have sense-aware alternate descriptions', () => {
        const failureIf = findIfByOutcome(ruleDefinition.actions, 'FAILURE');
        const dispatchOp = failureIf.parameters.then_actions.find(
          (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );

        expect(dispatchOp.parameters.alternate_descriptions).toBeDefined();
        expect(dispatchOp.parameters.alternate_descriptions.auditory).toBeDefined();
        expect(dispatchOp.parameters.alternate_descriptions.tactile).toBeDefined();
      });

      it('should use logFailureOutcomeAndEndTurn macro', () => {
        const failureIf = findIfByOutcome(ruleDefinition.actions, 'FAILURE');
        const hasMacro = failureIf.parameters.then_actions.some(
          (op) => op.macro === 'core:logFailureOutcomeAndEndTurn'
        );
        expect(hasMacro).toBe(true);
      });

      it('should NOT add fallen component', () => {
        const failureIf = findIfByOutcome(ruleDefinition.actions, 'FAILURE');
        const addComponentOp = failureIf.parameters.then_actions.find(
          (op) => op.type === 'ADD_COMPONENT'
        );
        expect(addComponentOp).toBeUndefined();
      });
    });

    describe('FUMBLE branch', () => {
      it('should add recovery-states:fallen component to actor', () => {
        const fumbleIf = findIfByOutcome(ruleDefinition.actions, 'FUMBLE');
        const addComponentOp = fumbleIf.parameters.then_actions.find(
          (op) => op.type === 'ADD_COMPONENT'
        );

        expect(addComponentOp).toBeDefined();
        expect(addComponentOp.parameters.entity_ref).toBe('actor');
        expect(addComponentOp.parameters.component_type).toBe(
          'recovery-states:fallen'
        );
      });

      it('should call REGENERATE_DESCRIPTION after ADD_COMPONENT', () => {
        const fumbleIf = findIfByOutcome(ruleDefinition.actions, 'FUMBLE');
        const thenActions = fumbleIf.parameters.then_actions;

        const addComponentIndex = thenActions.findIndex(
          (op) => op.type === 'ADD_COMPONENT'
        );
        const regenIndex = thenActions.findIndex(
          (op) => op.type === 'REGENERATE_DESCRIPTION'
        );

        expect(addComponentIndex).toBeGreaterThanOrEqual(0);
        expect(regenIndex).toBeGreaterThanOrEqual(0);
        expect(regenIndex).toBeGreaterThan(addComponentIndex);
      });

      it('should dispatch perceptible event with crashing message', () => {
        const fumbleIf = findIfByOutcome(ruleDefinition.actions, 'FUMBLE');
        const dispatchOp = fumbleIf.parameters.then_actions.find(
          (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );

        expect(dispatchOp).toBeDefined();
        expect(dispatchOp.parameters.description_text).toContain('crashing');
        expect(dispatchOp.parameters.description_text).toContain('ground');
      });

      it('should have sense-aware alternate descriptions', () => {
        const fumbleIf = findIfByOutcome(ruleDefinition.actions, 'FUMBLE');
        const dispatchOp = fumbleIf.parameters.then_actions.find(
          (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );

        expect(dispatchOp.parameters.alternate_descriptions).toBeDefined();
        expect(dispatchOp.parameters.alternate_descriptions.auditory).toContain(
          'thud'
        );
        expect(dispatchOp.parameters.alternate_descriptions.tactile).toContain(
          'impact'
        );
      });

      it('should use logFailureOutcomeAndEndTurn macro', () => {
        const fumbleIf = findIfByOutcome(ruleDefinition.actions, 'FUMBLE');
        const hasMacro = fumbleIf.parameters.then_actions.some(
          (op) => op.macro === 'core:logFailureOutcomeAndEndTurn'
        );
        expect(hasMacro).toBe(true);
      });
    });
  });

  describe('Sense-Aware Perception Validation', () => {
    it('should use physical.self_action perception type in all branches', () => {
      const ifOps = ruleDefinition.actions.filter((op) => op.type === 'IF');

      for (const ifOp of ifOps) {
        const dispatchOp = ifOp.parameters.then_actions.find(
          (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );

        if (dispatchOp) {
          expect(dispatchOp.parameters.perception_type).toBe(
            'physical.self_action'
          );
        }
      }
    });

    it('should have actor_description (first-person with "I") in all branches', () => {
      const ifOps = ruleDefinition.actions.filter((op) => op.type === 'IF');

      for (const ifOp of ifOps) {
        const dispatchOp = ifOp.parameters.then_actions.find(
          (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );

        if (dispatchOp) {
          expect(dispatchOp.parameters.actor_description).toBeDefined();
          expect(dispatchOp.parameters.actor_description).toMatch(/^I /);
        }
      }
    });

    it('should have target_id set to null in all branches (self-action)', () => {
      const ifOps = ruleDefinition.actions.filter((op) => op.type === 'IF');

      for (const ifOp of ifOps) {
        const dispatchOp = ifOp.parameters.then_actions.find(
          (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );

        if (dispatchOp) {
          expect(dispatchOp.parameters.target_id).toBeNull();
        }
      }
    });

    it('should have alternate_descriptions with auditory and tactile in all branches', () => {
      const ifOps = ruleDefinition.actions.filter((op) => op.type === 'IF');

      for (const ifOp of ifOps) {
        const dispatchOp = ifOp.parameters.then_actions.find(
          (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );

        if (dispatchOp) {
          expect(dispatchOp.parameters.alternate_descriptions).toBeDefined();
          expect(
            dispatchOp.parameters.alternate_descriptions.auditory
          ).toBeDefined();
          expect(
            dispatchOp.parameters.alternate_descriptions.tactile
          ).toBeDefined();
        }
      }
    });
  });

  describe('Narrative Messaging Validation', () => {
    it('should have CRITICAL_SUCCESS message containing "flawless"', () => {
      const ruleString = JSON.stringify(ruleDefinition);
      expect(ruleString).toContain('flawless');
    });

    it('should have SUCCESS message containing "smoothly"', () => {
      const ruleString = JSON.stringify(ruleDefinition);
      expect(ruleString).toContain('smoothly');
    });

    it('should have FAILURE message containing "stumbling"', () => {
      const ruleString = JSON.stringify(ruleDefinition);
      expect(ruleString).toContain('stumbling');
    });

    it('should have FUMBLE message containing "crashing" and "ground"', () => {
      const ruleString = JSON.stringify(ruleDefinition);
      expect(ruleString).toContain('crashing');
      expect(ruleString).toContain('ground');
    });
  });

  describe('Variable Resolution Consistency', () => {
    it('should define all required result variables', () => {
      const ruleString = JSON.stringify(ruleDefinition);

      expect(ruleString).toContain('"result_variable":"actorName"');
      expect(ruleString).toContain('"result_variable":"actorPosition"');
      expect(ruleString).toContain('"result_variable":"rollResult"');
    });

    it('should use context variables correctly in branches', () => {
      const ruleString = JSON.stringify(ruleDefinition);

      expect(ruleString).toContain('context.rollResult.outcome');
      expect(ruleString).toContain('context.actorPosition.locationId');
      expect(ruleString).toContain('context.actorName');
    });
  });
});
