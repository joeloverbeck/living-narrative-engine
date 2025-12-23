/**
 * @file Integration tests for handle_rise_to_surface rule wiring and outcomes.
 * @description Validates condition wiring, outcome resolution setup, and branch side effects/messages.
 */

import { describe, it, expect } from '@jest/globals';
import handleRiseRule from '../../../../data/mods/liquids/rules/handle_rise_to_surface.rule.json' assert { type: 'json' };
import eventIsActionRise from '../../../../data/mods/liquids/conditions/event-is-action-rise-to-surface.condition.json' assert { type: 'json' };
import liquidsManifest from '../../../../data/mods/liquids/mod-manifest.json' assert { type: 'json' };

const findIfByOutcome = (actions, outcomeValue) =>
  actions.find(
    (op) =>
      op.type === 'IF' && op.parameters?.condition?.['==']?.[1] === outcomeValue
  );

describe('handle_rise_to_surface rule', () => {
  it('registers rule and condition correctly', () => {
    expect(handleRiseRule.rule_id).toBe('handle_rise_to_surface');
    expect(handleRiseRule.event_type).toBe('core:attempt_action');
    expect(handleRiseRule.condition.condition_ref).toBe(
      'liquids:event-is-action-rise-to-surface'
    );

    expect(eventIsActionRise.id).toBe(
      'liquids:event-is-action-rise-to-surface'
    );
    expect(eventIsActionRise.logic['==']).toEqual([
      { var: 'event.payload.actionId' },
      'liquids:rise_to_surface',
    ]);
  });

  it('sets up names, position lookup, and outcome resolution for mobility skill', () => {
    const getNameOps = handleRiseRule.actions.filter(
      (op) => op.type === 'GET_NAME'
    );
    const actorNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'actor'
    );

    expect(actorNameOp?.parameters.result_variable).toBe('actorName');

    // Gets liquid body name (primary target)
    const liquidBodyNameOp = getNameOps.find(
      (op) => op.parameters.result_variable === 'liquidBodyName'
    );
    expect(liquidBodyNameOp).toBeDefined();
    expect(liquidBodyNameOp?.parameters.entity_ref.entityId).toBe(
      '{event.payload.primaryId}'
    );

    const positionQuery = handleRiseRule.actions.find(
      (op) =>
        op.type === 'QUERY_COMPONENT' &&
        op.parameters.component_type === 'core:position'
    );
    expect(positionQuery?.parameters.entity_ref).toBe('actor');
    expect(positionQuery?.parameters.result_variable).toBe('actorPosition');

    const liquidBodyQuery = handleRiseRule.actions.find(
      (op) =>
        op.type === 'QUERY_COMPONENT' &&
        op.parameters.component_type === 'liquids:liquid_body'
    );
    expect(liquidBodyQuery?.parameters.entity_ref.entityId).toBe(
      '{event.payload.primaryId}'
    );
    expect(liquidBodyQuery?.parameters.result_variable).toBe(
      'liquidBodyComponent'
    );

    const resolveOutcome = handleRiseRule.actions.find(
      (op) => op.type === 'RESOLVE_OUTCOME'
    );
    expect(resolveOutcome).toBeDefined();
    expect(resolveOutcome.parameters.actor_skill_component).toBe(
      'skills:mobility_skill'
    );
    // Fixed difficulty - no target skill component
    expect(resolveOutcome.parameters.target_skill_component).toBeUndefined();
    expect(resolveOutcome.parameters.actor_skill_default).toBe(0);
    expect(resolveOutcome.parameters.difficulty_modifier).toBe(50);
    expect(resolveOutcome.parameters.formula).toBe('linear');
    expect(resolveOutcome.parameters.result_variable).toBe('surfaceResult');
  });

  it('sets shared variables for perception/logging', () => {
    const setVariableOps = handleRiseRule.actions.filter(
      (op) => op.type === 'SET_VARIABLE'
    );

    const locationVar = setVariableOps.find(
      (op) => op.parameters.variable_name === 'locationId'
    );
    expect(locationVar?.parameters.value).toBe(
      '{context.actorPosition.locationId}'
    );

    const visibilityVar = setVariableOps.find(
      (op) => op.parameters.variable_name === 'liquidVisibility'
    );
    expect(visibilityVar?.parameters.value).toBe(
      '{context.liquidBodyComponent.visibility}'
    );
  });

  it('branches flatly for all four outcomes', () => {
    const ifOps = handleRiseRule.actions.filter((op) => op.type === 'IF');

    // Should have 4 top-level IF branches for outcomes
    expect(ifOps).toHaveLength(4);
    expect(
      findIfByOutcome(handleRiseRule.actions, 'CRITICAL_SUCCESS')
    ).toBeDefined();
    expect(findIfByOutcome(handleRiseRule.actions, 'SUCCESS')).toBeDefined();
    expect(findIfByOutcome(handleRiseRule.actions, 'FAILURE')).toBeDefined();
    expect(findIfByOutcome(handleRiseRule.actions, 'FUMBLE')).toBeDefined();
  });

  describe('CRITICAL_SUCCESS branch', () => {
    it('removes submerged component', () => {
      const branch = findIfByOutcome(
        handleRiseRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];

      const removeComponent = actions.find(
        (op) =>
          op.type === 'REMOVE_COMPONENT' &&
          op.parameters.component_type === 'liquids-states:submerged'
      );
      expect(removeComponent).toBeDefined();
      expect(removeComponent?.parameters.entity_ref).toBe('actor');
    });

    it('calls REGENERATE_DESCRIPTION for the actor', () => {
      const branch = findIfByOutcome(
        handleRiseRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];

      const regenOp = actions.find((op) => op.type === 'REGENERATE_DESCRIPTION');
      expect(regenOp).toBeDefined();
      expect(regenOp?.parameters.entity_ref).toBe('actor');
    });

    it('dispatches perception with swiftly breaks surface message', () => {
      const branch = findIfByOutcome(
        handleRiseRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];

      const dispatch = actions.find(
        (op) =>
          op.type === 'DISPATCH_PERCEPTIBLE_EVENT' &&
          op.parameters.description_text.includes('swiftly breaks')
      );
      expect(dispatch).toBeDefined();
      expect(dispatch?.parameters.location_id).toBe(
        '{context.actorPosition.locationId}'
      );
    });

    it('includes visibility in message text', () => {
      const branch = findIfByOutcome(
        handleRiseRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];

      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatch?.parameters.description_text).toContain(
        '{context.liquidVisibility}'
      );
    });

    it('includes sense-aware fields in perceptible events', () => {
      const branch = findIfByOutcome(
        handleRiseRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];

      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatch.parameters.actor_description).toBeDefined();
      expect(dispatch.parameters.alternate_descriptions).toBeDefined();
      expect(dispatch.parameters.alternate_descriptions.auditory).toBeDefined();
      expect(dispatch.parameters.alternate_descriptions.tactile).toBeDefined();
    });

    it('ends turn with success macro', () => {
      const branch = findIfByOutcome(
        handleRiseRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];

      const hasSuccessMacro = actions.some(
        (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
      );
      expect(hasSuccessMacro).toBe(true);
    });

    it('sets log message for UI display', () => {
      const branch = findIfByOutcome(
        handleRiseRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];

      const logMessage = actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'logMessage'
      );
      expect(logMessage?.parameters.value).toContain('swiftly breaks');
      expect(logMessage?.parameters.value).toContain('{context.liquidVisibility}');
    });
  });

  describe('SUCCESS branch', () => {
    it('removes submerged component', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'SUCCESS');
      const actions = branch?.parameters.then_actions ?? [];

      const removeComponent = actions.find(
        (op) =>
          op.type === 'REMOVE_COMPONENT' &&
          op.parameters.component_type === 'liquids-states:submerged'
      );
      expect(removeComponent).toBeDefined();
      expect(removeComponent?.parameters.entity_ref).toBe('actor');
    });

    it('calls REGENERATE_DESCRIPTION for the actor', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'SUCCESS');
      const actions = branch?.parameters.then_actions ?? [];

      const regenOp = actions.find((op) => op.type === 'REGENERATE_DESCRIPTION');
      expect(regenOp).toBeDefined();
      expect(regenOp?.parameters.entity_ref).toBe('actor');
    });

    it('dispatches perception with rises to surface message', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'SUCCESS');
      const actions = branch?.parameters.then_actions ?? [];

      const dispatch = actions.find(
        (op) =>
          op.type === 'DISPATCH_PERCEPTIBLE_EVENT' &&
          op.parameters.description_text.includes('rises to the surface')
      );
      expect(dispatch).toBeDefined();
    });

    it('includes visibility in message text', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'SUCCESS');
      const actions = branch?.parameters.then_actions ?? [];

      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatch?.parameters.description_text).toContain(
        '{context.liquidVisibility}'
      );
    });

    it('includes sense-aware fields in perceptible events', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'SUCCESS');
      const actions = branch?.parameters.then_actions ?? [];

      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatch.parameters.actor_description).toBeDefined();
      expect(dispatch.parameters.alternate_descriptions).toBeDefined();
    });

    it('ends turn with success macro', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'SUCCESS');
      const actions = branch?.parameters.then_actions ?? [];

      const hasSuccessMacro = actions.some(
        (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
      );
      expect(hasSuccessMacro).toBe(true);
    });
  });

  describe('FAILURE branch', () => {
    it('leaves components unchanged on FAILURE', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'FAILURE');
      const actions = branch?.parameters.then_actions ?? [];

      // Should not remove any components
      expect(actions.some((op) => op.type === 'REMOVE_COMPONENT')).toBe(false);

      // Should not add any components
      expect(actions.some((op) => op.type === 'ADD_COMPONENT')).toBe(false);

      // Should not modify any components
      expect(actions.some((op) => op.type === 'MODIFY_COMPONENT')).toBe(false);

      // Should not regenerate description (no state change)
      expect(actions.some((op) => op.type === 'REGENERATE_DESCRIPTION')).toBe(
        false
      );
    });

    it('dispatches perception with struggling message', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'FAILURE');
      const actions = branch?.parameters.then_actions ?? [];

      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatch?.parameters.description_text).toContain(
        'struggles to break the surface'
      );
      expect(dispatch?.parameters.description_text).toContain(
        'barely makes progress'
      );
    });

    it('includes visibility in message text', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'FAILURE');
      const actions = branch?.parameters.then_actions ?? [];

      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatch?.parameters.description_text).toContain(
        '{context.liquidVisibility}'
      );
    });

    it('includes sense-aware fields in perceptible events', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'FAILURE');
      const actions = branch?.parameters.then_actions ?? [];

      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatch.parameters.actor_description).toBeDefined();
      expect(dispatch.parameters.alternate_descriptions).toBeDefined();
      expect(dispatch.parameters.alternate_descriptions.auditory).toContain(
        'muffled splashing'
      );
      expect(dispatch.parameters.alternate_descriptions.tactile).toContain(
        'turbulent liquid movements'
      );
    });

    it('sets correct log message', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'FAILURE');
      const actions = branch?.parameters.then_actions ?? [];

      const logMessage = actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'logMessage'
      );
      expect(logMessage?.parameters.value).toContain('struggles to break');
      expect(logMessage?.parameters.value).toContain('{context.liquidVisibility}');
    });

    it('ends turn with failure macro', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'FAILURE');
      const actions = branch?.parameters.then_actions ?? [];

      const hasFailureMacro = actions.some(
        (op) => op.macro === 'core:logFailureOutcomeAndEndTurn'
      );
      expect(hasFailureMacro).toBe(true);
    });
  });

  describe('FUMBLE branch', () => {
    it('does NOT add or remove components on FUMBLE (flavor only)', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];

      // Should not remove any components
      expect(actions.some((op) => op.type === 'REMOVE_COMPONENT')).toBe(false);

      // Should not add any components (flavor only, no mechanical effects)
      expect(actions.some((op) => op.type === 'ADD_COMPONENT')).toBe(false);

      // Should not modify any components
      expect(actions.some((op) => op.type === 'MODIFY_COMPONENT')).toBe(false);

      // Should not regenerate description (no state change)
      expect(actions.some((op) => op.type === 'REGENERATE_DESCRIPTION')).toBe(
        false
      );
    });

    it('dispatches perception with flounders/inhales liquid flavor text', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];

      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatch?.parameters.description_text).toContain(
        'flounders helplessly'
      );
      expect(dispatch?.parameters.description_text).toContain(
        'inhales liquid'
      );
    });

    it('includes visibility in message text', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];

      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatch?.parameters.description_text).toContain(
        '{context.liquidVisibility}'
      );
    });

    it('includes sense-aware fields in perceptible events', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];

      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatch.parameters.actor_description).toBeDefined();
      expect(dispatch.parameters.alternate_descriptions).toBeDefined();
      expect(dispatch.parameters.alternate_descriptions.auditory).toContain(
        'frantic, panicked splashing'
      );
      expect(dispatch.parameters.alternate_descriptions.tactile).toContain(
        'chaotic liquid thrashing'
      );
    });

    it('sets correct log message', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];

      const logMessage = actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'logMessage'
      );
      expect(logMessage?.parameters.value).toContain('flounders helplessly');
      expect(logMessage?.parameters.value).toContain('inhales liquid');
      expect(logMessage?.parameters.value).toContain('{context.liquidVisibility}');
    });

    it('ends turn with failure macro', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];

      expect(
        actions.some((op) => op.macro === 'core:logFailureOutcomeAndEndTurn')
      ).toBe(true);
    });
  });

  describe('Turn ending guarantees', () => {
    /**
     * Helper to recursively find all terminal macro calls in an action tree.
     * Returns array of macro names found at leaf positions of then_actions and else_actions.
     *
     * @param {Array<object>} actions - Array of rule action objects to search
     * @returns {Array<string>} Array of macro names found
     */
    const findAllTerminalMacros = (actions) => {
      const macros = [];
      for (const action of actions) {
        if (action.macro) {
          macros.push(action.macro);
        }
        if (action.type === 'IF' && action.parameters) {
          if (action.parameters.then_actions) {
            macros.push(...findAllTerminalMacros(action.parameters.then_actions));
          }
          if (action.parameters.else_actions) {
            macros.push(...findAllTerminalMacros(action.parameters.else_actions));
          }
        }
      }
      return macros;
    };

    it('all outcome branches contain at least one turn-ending macro', () => {
      const outcomes = ['CRITICAL_SUCCESS', 'SUCCESS', 'FAILURE', 'FUMBLE'];
      const turnEndingMacros = [
        'core:logSuccessOutcomeAndEndTurn',
        'core:logFailureOutcomeAndEndTurn',
      ];

      outcomes.forEach((outcome) => {
        const branch = findIfByOutcome(handleRiseRule.actions, outcome);
        expect(branch).toBeDefined();

        const allMacros = findAllTerminalMacros(
          branch.parameters.then_actions ?? []
        );
        const hasTurnEndingMacro = allMacros.some((macro) =>
          turnEndingMacros.includes(macro)
        );

        expect(hasTurnEndingMacro).toBe(true);
      });
    });

    it('success outcomes use success macro', () => {
      ['CRITICAL_SUCCESS', 'SUCCESS'].forEach((outcome) => {
        const branch = findIfByOutcome(handleRiseRule.actions, outcome);
        const allMacros = findAllTerminalMacros(
          branch.parameters.then_actions ?? []
        );
        expect(allMacros).toContain('core:logSuccessOutcomeAndEndTurn');
      });
    });

    it('failure outcomes use failure macro', () => {
      ['FAILURE', 'FUMBLE'].forEach((outcome) => {
        const branch = findIfByOutcome(handleRiseRule.actions, outcome);
        const allMacros = findAllTerminalMacros(
          branch.parameters.then_actions ?? []
        );
        expect(allMacros).toContain('core:logFailureOutcomeAndEndTurn');
      });
    });
  });

  describe('Perception type validation', () => {
    // Valid perception types from src/perception/registries/perceptionTypeRegistry.js
    const VALID_PERCEPTION_TYPES = [
      // Communication
      'communication.speech',
      'communication.thought',
      'communication.notes',
      // Movement
      'movement.arrival',
      'movement.departure',
      // Combat
      'combat.attack',
      'combat.damage',
      'combat.death',
      'combat.violence',
      // Item
      'item.pickup',
      'item.drop',
      'item.transfer',
      'item.use',
      'item.examine',
      // Container
      'container.open',
      'container.take',
      'container.put',
      // Connection
      'connection.lock',
      'connection.unlock',
      // Consumption
      'consumption.consume',
      // State
      'state.observable_change',
      // Social
      'social.gesture',
      'social.affection',
      'social.interaction',
      // Physical
      'physical.self_action',
      'physical.target_action',
      // Intimacy
      'intimacy.sexual',
      'intimacy.sensual',
      // Performance
      'performance.music',
      'performance.dance',
      // Magic
      'magic.spell',
      'magic.ritual',
      // Error
      'error.system_error',
      'error.action_failed',
    ];

    /**
     * Recursively find all perception_type values in an action tree.
     *
     * @param {Array<object>} actions - Array of rule action objects to search
     * @returns {Array<string>} Array of perception_type values found
     */
    const findAllPerceptionTypes = (actions) => {
      const types = [];
      for (const action of actions) {
        if (
          action.type === 'DISPATCH_PERCEPTIBLE_EVENT' &&
          action.parameters?.perception_type
        ) {
          types.push(action.parameters.perception_type);
        }
        if (action.type === 'IF' && action.parameters) {
          if (action.parameters.then_actions) {
            types.push(...findAllPerceptionTypes(action.parameters.then_actions));
          }
          if (action.parameters.else_actions) {
            types.push(...findAllPerceptionTypes(action.parameters.else_actions));
          }
        }
      }
      return types;
    };

    it('all DISPATCH_PERCEPTIBLE_EVENT operations use valid perception_type values', () => {
      const perceptionTypes = findAllPerceptionTypes(handleRiseRule.actions);

      expect(perceptionTypes.length).toBeGreaterThan(0);

      perceptionTypes.forEach((type) => {
        expect(VALID_PERCEPTION_TYPES).toContain(type);
      });
    });

    it('uses physical.self_action for all rise events', () => {
      // All rise events should use physical.self_action
      const perceptionTypes = findAllPerceptionTypes(handleRiseRule.actions);

      perceptionTypes.forEach((type) => {
        expect(type).toBe('physical.self_action');
      });
    });
  });

  describe('State update order validation', () => {
    it('REGENERATE_DESCRIPTION comes after REMOVE_COMPONENT on CRITICAL_SUCCESS', () => {
      const branch = findIfByOutcome(
        handleRiseRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];

      const removeIndex = actions.findIndex(
        (op) =>
          op.type === 'REMOVE_COMPONENT' &&
          op.parameters.component_type === 'liquids-states:submerged'
      );
      const regenIndex = actions.findIndex(
        (op) => op.type === 'REGENERATE_DESCRIPTION'
      );

      expect(removeIndex).toBeGreaterThan(-1);
      expect(regenIndex).toBeGreaterThan(-1);
      expect(regenIndex).toBeGreaterThan(removeIndex);
    });

    it('REGENERATE_DESCRIPTION comes after REMOVE_COMPONENT on SUCCESS', () => {
      const branch = findIfByOutcome(handleRiseRule.actions, 'SUCCESS');
      const actions = branch?.parameters.then_actions ?? [];

      const removeIndex = actions.findIndex(
        (op) =>
          op.type === 'REMOVE_COMPONENT' &&
          op.parameters.component_type === 'liquids-states:submerged'
      );
      const regenIndex = actions.findIndex(
        (op) => op.type === 'REGENERATE_DESCRIPTION'
      );

      expect(removeIndex).toBeGreaterThan(-1);
      expect(regenIndex).toBeGreaterThan(-1);
      expect(regenIndex).toBeGreaterThan(removeIndex);
    });
  });

  describe('Visibility placeholder validation', () => {
    it('all dispatch messages include visibility placeholder', () => {
      const outcomes = ['CRITICAL_SUCCESS', 'SUCCESS', 'FAILURE', 'FUMBLE'];

      outcomes.forEach((outcome) => {
        const branch = findIfByOutcome(handleRiseRule.actions, outcome);
        const actions = branch?.parameters.then_actions ?? [];

        const dispatches = actions.filter(
          (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );
        dispatches.forEach((dispatch) => {
          expect(dispatch.parameters.description_text).toContain(
            '{context.liquidVisibility}'
          );
          expect(dispatch.parameters.actor_description).toContain(
            '{context.liquidVisibility}'
          );
        });
      });
    });

    it('all log messages include visibility placeholder', () => {
      const outcomes = ['CRITICAL_SUCCESS', 'SUCCESS', 'FAILURE', 'FUMBLE'];

      outcomes.forEach((outcome) => {
        const branch = findIfByOutcome(handleRiseRule.actions, outcome);
        const actions = branch?.parameters.then_actions ?? [];

        const logMessage = actions.find(
          (op) =>
            op.type === 'SET_VARIABLE' &&
            op.parameters.variable_name === 'logMessage'
        );
        expect(logMessage?.parameters.value).toContain(
          '{context.liquidVisibility}'
        );
      });
    });
  });
});
