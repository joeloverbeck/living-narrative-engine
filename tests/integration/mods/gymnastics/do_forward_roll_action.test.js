/**
 * @file Integration tests for the gymnastics:do_forward_roll action.
 * @description Validates chance-based forward roll action structure, rule outcome handling,
 * and sense-aware perception configuration.
 */

import { describe, it, expect } from '@jest/globals';

import actionDefinition from '../../../../data/mods/gymnastics/actions/do_forward_roll.action.json';
import ruleDefinition from '../../../../data/mods/gymnastics/rules/handle_do_forward_roll.rule.json';
import conditionDefinition from '../../../../data/mods/gymnastics/conditions/event-is-action-do-forward-roll.condition.json';

describe('gymnastics:do_forward_roll integration tests', () => {
  describe('Action Definition', () => {
    it('should have correct action metadata', () => {
      expect(actionDefinition.id).toBe('gymnastics:do_forward_roll');
      expect(actionDefinition.name).toBe('Do Forward Roll');
      expect(actionDefinition.description).toBe(
        'Tuck tightly and roll forward along the spine for a smooth transition'
      );
      expect(actionDefinition.targets).toBe('none');
    });

    it('should require gymnast marker and mobility skill components', () => {
      expect(actionDefinition.required_components).toBeDefined();
      expect(actionDefinition.required_components.actor).toContain(
        'gymnastics:is_gymnast'
      );
      expect(actionDefinition.required_components.actor).toContain(
        'skills:mobility_skill'
      );
    });

    it('should have forbidden components preventing action during restraint', () => {
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
      expect(actionDefinition.template).toBe('do forward roll ({chance}% chance)');
    });

    it('should have chanceBased configuration enabled', () => {
      expect(actionDefinition.chanceBased).toBeDefined();
      expect(actionDefinition.chanceBased.enabled).toBe(true);
    });

    it('should use fixed_difficulty contest type', () => {
      expect(actionDefinition.chanceBased.contestType).toBe('fixed_difficulty');
      expect(actionDefinition.chanceBased.fixedDifficulty).toBe(50);
      expect(actionDefinition.chanceBased.formula).toBe('linear');
    });

    it('should configure actor skill for mobility', () => {
      expect(actionDefinition.chanceBased.actorSkill).toBeDefined();
      expect(actionDefinition.chanceBased.actorSkill.component).toBe(
        'skills:mobility_skill'
      );
      expect(actionDefinition.chanceBased.actorSkill.property).toBe('value');
      expect(actionDefinition.chanceBased.actorSkill.default).toBe(0);
    });

    it('should have bounds for chance calculation', () => {
      expect(actionDefinition.chanceBased.bounds).toBeDefined();
      expect(actionDefinition.chanceBased.bounds.min).toBe(5);
      expect(actionDefinition.chanceBased.bounds.max).toBe(95);
    });

    it('should have outcome thresholds for critical results', () => {
      expect(actionDefinition.chanceBased.outcomes).toBeDefined();
      expect(actionDefinition.chanceBased.outcomes.criticalSuccessThreshold).toBe(
        5
      );
      expect(actionDefinition.chanceBased.outcomes.criticalFailureThreshold).toBe(
        95
      );
    });

    it('should have visual styling configuration', () => {
      expect(actionDefinition.visual).toBeDefined();
      expect(actionDefinition.visual.backgroundColor).toBeDefined();
      expect(actionDefinition.visual.textColor).toBeDefined();
    });
  });

  describe('Condition Definition', () => {
    it('should have correct condition metadata', () => {
      expect(conditionDefinition.id).toBe(
        'gymnastics:event-is-action-do-forward-roll'
      );
    });

    it('should match action ID in event payload', () => {
      expect(conditionDefinition.logic).toBeDefined();
      // Verify the condition checks for the correct action ID
      const logicStr = JSON.stringify(conditionDefinition.logic);
      expect(logicStr).toContain('gymnastics:do_forward_roll');
    });
  });

  describe('Rule Definition', () => {
    it('should have correct rule metadata', () => {
      expect(ruleDefinition.rule_id).toBe('handle_do_forward_roll');
      expect(ruleDefinition.event_type).toBe('core:attempt_action');
    });

    it('should reference the correct condition', () => {
      expect(ruleDefinition.condition).toBeDefined();
      expect(ruleDefinition.condition.condition_ref).toBe(
        'gymnastics:event-is-action-do-forward-roll'
      );
    });

    it('should have actions array with proper structure', () => {
      expect(ruleDefinition.actions).toBeDefined();
      expect(Array.isArray(ruleDefinition.actions)).toBe(true);
      expect(ruleDefinition.actions.length).toBeGreaterThanOrEqual(10);
    });

    it('should start with GET_NAME operation', () => {
      const getNameAction = ruleDefinition.actions[0];
      expect(getNameAction.type).toBe('GET_NAME');
      expect(getNameAction.parameters.entity_ref).toBe('actor');
      expect(getNameAction.parameters.result_variable).toBe('actorName');
    });

    it('should query actor position', () => {
      const queryAction = ruleDefinition.actions[1];
      expect(queryAction.type).toBe('QUERY_COMPONENT');
      expect(queryAction.parameters.entity_ref).toBe('actor');
      expect(queryAction.parameters.component_type).toBe('core:position');
      expect(queryAction.parameters.result_variable).toBe('actorPosition');
    });

    it('should resolve outcome using mobility skill', () => {
      const resolveAction = ruleDefinition.actions[2];
      expect(resolveAction.type).toBe('RESOLVE_OUTCOME');
      expect(resolveAction.parameters.actor_skill_component).toBe(
        'skills:mobility_skill'
      );
      expect(resolveAction.parameters.difficulty_modifier).toBe(50);
      expect(resolveAction.parameters.formula).toBe('linear');
      expect(resolveAction.parameters.result_variable).toBe('rollResult');
    });

    it('should set required context variables', () => {
      const setVarActions = ruleDefinition.actions.filter(
        (a) => a.type === 'SET_VARIABLE'
      );
      const varNames = setVarActions.map((a) => a.parameters.variable_name);
      expect(varNames).toContain('locationId');
      expect(varNames).toContain('perceptionType');
      expect(varNames).toContain('targetId');
    });
  });

  describe('Outcome Branches', () => {
    const ifActions = () =>
      ruleDefinition.actions.filter((a) => a.type === 'IF');

    it('should have exactly 4 IF blocks for outcomes', () => {
      expect(ifActions().length).toBe(4);
    });

    describe('CRITICAL_SUCCESS outcome', () => {
      const getCriticalSuccessBranch = () =>
        ifActions().find((a) =>
          JSON.stringify(a.parameters.condition).includes('CRITICAL_SUCCESS')
        );

      it('should check for CRITICAL_SUCCESS outcome', () => {
        const branch = getCriticalSuccessBranch();
        expect(branch).toBeDefined();
        expect(branch.parameters.condition).toBeDefined();
      });

      it('should dispatch perceptible event with sense-aware descriptions', () => {
        const branch = getCriticalSuccessBranch();
        const dispatchAction = branch.parameters.then_actions.find(
          (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );
        expect(dispatchAction).toBeDefined();
        expect(dispatchAction.parameters.perception_type).toBe(
          'physical.self_action'
        );
        expect(dispatchAction.parameters.alternate_descriptions).toBeDefined();
        expect(
          dispatchAction.parameters.alternate_descriptions.auditory
        ).toBeDefined();
        expect(
          dispatchAction.parameters.alternate_descriptions.tactile
        ).toBeDefined();
      });

      it('should use success outcome macro', () => {
        const branch = getCriticalSuccessBranch();
        const macroAction = branch.parameters.then_actions.find((a) => a.macro);
        expect(macroAction).toBeDefined();
        expect(macroAction.macro).toBe('core:logSuccessOutcomeAndEndTurn');
      });
    });

    describe('SUCCESS outcome', () => {
      const getSuccessBranch = () =>
        ifActions().find(
          (a) =>
            JSON.stringify(a.parameters.condition).includes('"SUCCESS"') &&
            !JSON.stringify(a.parameters.condition).includes('CRITICAL')
        );

      it('should check for SUCCESS outcome', () => {
        const branch = getSuccessBranch();
        expect(branch).toBeDefined();
      });

      it('should dispatch perceptible event with sense-aware descriptions', () => {
        const branch = getSuccessBranch();
        const dispatchAction = branch.parameters.then_actions.find(
          (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );
        expect(dispatchAction).toBeDefined();
        expect(dispatchAction.parameters.alternate_descriptions).toBeDefined();
        expect(
          dispatchAction.parameters.alternate_descriptions.auditory
        ).toBeDefined();
        expect(
          dispatchAction.parameters.alternate_descriptions.tactile
        ).toBeDefined();
      });

      it('should use success outcome macro', () => {
        const branch = getSuccessBranch();
        const macroAction = branch.parameters.then_actions.find((a) => a.macro);
        expect(macroAction.macro).toBe('core:logSuccessOutcomeAndEndTurn');
      });
    });

    describe('FAILURE outcome', () => {
      const getFailureBranch = () =>
        ifActions().find(
          (a) =>
            JSON.stringify(a.parameters.condition).includes('"FAILURE"') &&
            !JSON.stringify(a.parameters.condition).includes('FUMBLE')
        );

      it('should check for FAILURE outcome', () => {
        const branch = getFailureBranch();
        expect(branch).toBeDefined();
      });

      it('should dispatch perceptible event with sense-aware descriptions', () => {
        const branch = getFailureBranch();
        const dispatchAction = branch.parameters.then_actions.find(
          (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );
        expect(dispatchAction).toBeDefined();
        expect(dispatchAction.parameters.alternate_descriptions).toBeDefined();
      });

      it('should NOT add fallen component', () => {
        const branch = getFailureBranch();
        const addComponentAction = branch.parameters.then_actions.find(
          (a) => a.type === 'ADD_COMPONENT'
        );
        expect(addComponentAction).toBeUndefined();
      });

      it('should use failure outcome macro', () => {
        const branch = getFailureBranch();
        const macroAction = branch.parameters.then_actions.find((a) => a.macro);
        expect(macroAction.macro).toBe('core:logFailureOutcomeAndEndTurn');
      });
    });

    describe('FUMBLE outcome', () => {
      const getFumbleBranch = () =>
        ifActions().find((a) =>
          JSON.stringify(a.parameters.condition).includes('FUMBLE')
        );

      it('should check for FUMBLE outcome', () => {
        const branch = getFumbleBranch();
        expect(branch).toBeDefined();
      });

      it('should add fallen component to actor', () => {
        const branch = getFumbleBranch();
        const addComponentAction = branch.parameters.then_actions.find(
          (a) => a.type === 'ADD_COMPONENT'
        );
        expect(addComponentAction).toBeDefined();
        expect(addComponentAction.parameters.entity_ref).toBe('actor');
        expect(addComponentAction.parameters.component_type).toBe(
          'recovery-states:fallen'
        );
      });

      it('should regenerate description after adding component', () => {
        const branch = getFumbleBranch();
        const regenAction = branch.parameters.then_actions.find(
          (a) => a.type === 'REGENERATE_DESCRIPTION'
        );
        expect(regenAction).toBeDefined();
        expect(regenAction.parameters.entity_ref).toBe('actor');
      });

      it('should dispatch perceptible event with sense-aware descriptions', () => {
        const branch = getFumbleBranch();
        const dispatchAction = branch.parameters.then_actions.find(
          (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );
        expect(dispatchAction).toBeDefined();
        expect(dispatchAction.parameters.alternate_descriptions).toBeDefined();
        expect(
          dispatchAction.parameters.alternate_descriptions.auditory
        ).toBeDefined();
        expect(
          dispatchAction.parameters.alternate_descriptions.tactile
        ).toBeDefined();
      });

      it('should use failure outcome macro', () => {
        const branch = getFumbleBranch();
        const macroAction = branch.parameters.then_actions.find((a) => a.macro);
        expect(macroAction.macro).toBe('core:logFailureOutcomeAndEndTurn');
      });
    });
  });

  describe('Sense-Aware Perception', () => {
    const getDispatchActions = () => {
      const ifActions = ruleDefinition.actions.filter((a) => a.type === 'IF');
      return ifActions
        .map((ifAction) =>
          ifAction.parameters.then_actions.find(
            (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
          )
        )
        .filter(Boolean);
    };

    it('should have perception_type set to physical.self_action for all events', () => {
      const dispatchActions = getDispatchActions();
      expect(dispatchActions.length).toBe(4);
      dispatchActions.forEach((dispatchAction) => {
        expect(dispatchAction.parameters.perception_type).toBe(
          'physical.self_action'
        );
      });
    });

    it('should have alternate_descriptions with auditory and tactile for all events', () => {
      const dispatchActions = getDispatchActions();
      expect(dispatchActions.length).toBe(4);
      dispatchActions.forEach((dispatchAction) => {
        const altDesc = dispatchAction.parameters.alternate_descriptions;
        expect(altDesc).toBeDefined();
        expect(typeof altDesc.auditory).toBe('string');
        expect(typeof altDesc.tactile).toBe('string');
        expect(altDesc.auditory.length).toBeGreaterThan(0);
        expect(altDesc.tactile.length).toBeGreaterThan(0);
      });
    });

    it('should have description_text and actor_description for all events', () => {
      const dispatchActions = getDispatchActions();
      expect(dispatchActions.length).toBe(4);
      dispatchActions.forEach((dispatchAction) => {
        expect(dispatchAction.parameters.description_text).toBeDefined();
        expect(dispatchAction.parameters.actor_description).toBeDefined();
      });
    });
  });

  describe('Narrative Messaging', () => {
    const getDispatchActionFromBranch = (outcomeKeyword) => {
      const ifActions = ruleDefinition.actions.filter((a) => a.type === 'IF');
      const branch = ifActions.find((a) =>
        JSON.stringify(a.parameters.condition).includes(outcomeKeyword)
      );
      return branch?.parameters.then_actions.find(
        (a) => a.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
    };

    it('CRITICAL_SUCCESS should have narrative about perfect execution', () => {
      const dispatch = getDispatchActionFromBranch('CRITICAL_SUCCESS');
      expect(dispatch.parameters.description_text).toMatch(/perfect|flawless/i);
      expect(dispatch.parameters.actor_description).toMatch(/perfect|fluid/i);
    });

    it('SUCCESS should have narrative about smooth completion', () => {
      const dispatch = getDispatchActionFromBranch('"SUCCESS"');
      expect(dispatch.parameters.description_text).toMatch(/smooth|centered/i);
    });

    it('FAILURE should have narrative about losing momentum', () => {
      const dispatch = getDispatchActionFromBranch('FAILURE');
      expect(dispatch.parameters.description_text).toMatch(
        /loses|awkward|struggle/i
      );
    });

    it('FUMBLE should have narrative about crashing', () => {
      const dispatch = getDispatchActionFromBranch('FUMBLE');
      expect(dispatch.parameters.description_text).toMatch(/crash|misjudge/i);
    });
  });
});
