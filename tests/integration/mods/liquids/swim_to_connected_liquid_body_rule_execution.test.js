/**
 * @file Integration tests for handle_swim_to_connected_liquid_body rule wiring and outcomes.
 * @description Validates condition wiring, outcome resolution setup, and branch side effects/messages.
 */

import { describe, it, expect } from '@jest/globals';
import handleSwimRule from '../../../../data/mods/liquids/rules/handle_swim_to_connected_liquid_body.rule.json' assert { type: 'json' };
import eventIsActionSwim from '../../../../data/mods/liquids/conditions/event-is-action-swim-to-connected-liquid-body.condition.json' assert { type: 'json' };
import liquidsManifest from '../../../../data/mods/liquids/mod-manifest.json' assert { type: 'json' };

const findIfByOutcome = (actions, outcomeValue) =>
  actions.find(
    (op) =>
      op.type === 'IF' && op.parameters?.condition?.['==']?.[1] === outcomeValue
  );

describe('handle_swim_to_connected_liquid_body rule', () => {
  it('registers rule and condition correctly', () => {
    expect(handleSwimRule.rule_id).toBe('handle_swim_to_connected_liquid_body');
    expect(handleSwimRule.event_type).toBe('core:attempt_action');
    expect(handleSwimRule.condition.condition_ref).toBe(
      'liquids:event-is-action-swim-to-connected-liquid-body'
    );

    expect(eventIsActionSwim.id).toBe(
      'liquids:event-is-action-swim-to-connected-liquid-body'
    );
    expect(eventIsActionSwim.logic['==']).toEqual([
      { var: 'event.payload.actionId' },
      'liquids:swim_to_connected_liquid_body',
    ]);

    expect(liquidsManifest.content.rules).toContain(
      'handle_swim_to_connected_liquid_body.rule.json'
    );
    expect(liquidsManifest.content.conditions).toContain(
      'event-is-action-swim-to-connected-liquid-body.condition.json'
    );
  });

  it('sets up names, position lookup, and outcome resolution for mobility skill', () => {
    const getNameOps = handleSwimRule.actions.filter(
      (op) => op.type === 'GET_NAME'
    );
    const actorNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'actor'
    );

    expect(actorNameOp?.parameters.result_variable).toBe('actorName');

    // Gets connected liquid body name
    const liquidBodyNameOp = getNameOps.find(
      (op) => op.parameters.result_variable === 'connectedLiquidBodyName'
    );
    expect(liquidBodyNameOp).toBeDefined();
    expect(liquidBodyNameOp?.parameters.entity_ref.entityId).toBe(
      '{event.payload.primaryId}'
    );

    // Gets connected location name
    const locationNameOp = getNameOps.find(
      (op) => op.parameters.result_variable === 'connectedLocationName'
    );
    expect(locationNameOp).toBeDefined();
    expect(locationNameOp?.parameters.entity_ref.entityId).toBe(
      '{event.payload.secondaryId}'
    );

    const positionQuery = handleSwimRule.actions.find(
      (op) =>
        op.type === 'QUERY_COMPONENT' &&
        op.parameters.component_type === 'core:position'
    );
    expect(positionQuery?.parameters.entity_ref).toBe('actor');
    expect(positionQuery?.parameters.result_variable).toBe('actorPosition');

    const resolveOutcome = handleSwimRule.actions.find(
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
    expect(resolveOutcome.parameters.result_variable).toBe('swimResult');
  });

  it('sets shared variables for perception/logging', () => {
    const setVariableOps = handleSwimRule.actions.filter(
      (op) => op.type === 'SET_VARIABLE'
    );

    const locationVar = setVariableOps.find(
      (op) => op.parameters.variable_name === 'locationId'
    );

    expect(locationVar?.parameters.value).toBe(
      '{context.actorPosition.locationId}'
    );
  });

  it('branches flatly for all four outcomes', () => {
    const ifOps = handleSwimRule.actions.filter((op) => op.type === 'IF');

    // Should have 4 top-level IF branches for outcomes
    expect(ifOps).toHaveLength(4);
    expect(
      findIfByOutcome(handleSwimRule.actions, 'CRITICAL_SUCCESS')
    ).toBeDefined();
    expect(findIfByOutcome(handleSwimRule.actions, 'SUCCESS')).toBeDefined();
    expect(findIfByOutcome(handleSwimRule.actions, 'FAILURE')).toBeDefined();
    expect(findIfByOutcome(handleSwimRule.actions, 'FUMBLE')).toBeDefined();
  });

  describe('CRITICAL_SUCCESS branch', () => {
    it('updates liquids-states:in_liquid_body.liquid_body_id', () => {
      const branch = findIfByOutcome(
        handleSwimRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];

      const modifyLiquidBody = actions.find(
        (op) =>
          op.type === 'MODIFY_COMPONENT' &&
          op.parameters.component_type === 'liquids-states:in_liquid_body'
      );
      expect(modifyLiquidBody).toBeDefined();
      expect(modifyLiquidBody?.parameters.entity_ref).toBe('actor');
      expect(modifyLiquidBody?.parameters.field).toBe('liquid_body_id');
      expect(modifyLiquidBody?.parameters.mode).toBe('set');
      expect(modifyLiquidBody?.parameters.value).toBe(
        '{event.payload.primaryId}'
      );
    });

    it('updates core:position.locationId to the connected location', () => {
      const branch = findIfByOutcome(
        handleSwimRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];

      const modifyPosition = actions.find(
        (op) =>
          op.type === 'MODIFY_COMPONENT' &&
          op.parameters.component_type === 'core:position'
      );
      expect(modifyPosition).toBeDefined();
      expect(modifyPosition?.parameters.entity_ref).toBe('actor');
      expect(modifyPosition?.parameters.field).toBe('locationId');
      expect(modifyPosition?.parameters.mode).toBe('set');
      expect(modifyPosition?.parameters.value).toBe(
        '{event.payload.secondaryId}'
      );
    });

    it('calls REGENERATE_DESCRIPTION for the actor', () => {
      const branch = findIfByOutcome(
        handleSwimRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];

      const regenOp = actions.find((op) => op.type === 'REGENERATE_DESCRIPTION');
      expect(regenOp).toBeDefined();
      expect(regenOp?.parameters.entity_ref).toBe('actor');
    });

    it('dispatches departure perception with effortless message', () => {
      const branch = findIfByOutcome(
        handleSwimRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];

      const departureDispatch = actions.find(
        (op) =>
          op.type === 'DISPATCH_PERCEPTIBLE_EVENT' &&
          op.parameters.description_text.includes('effortlessly')
      );
      expect(departureDispatch).toBeDefined();
      expect(departureDispatch?.parameters.location_id).toBe(
        '{context.actorPosition.locationId}'
      );
    });

    it('dispatches arrival perception at new location', () => {
      const branch = findIfByOutcome(
        handleSwimRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];

      const arrivalDispatch = actions.find(
        (op) =>
          op.type === 'DISPATCH_PERCEPTIBLE_EVENT' &&
          op.parameters.description_text.includes('arrives')
      );
      expect(arrivalDispatch).toBeDefined();
      expect(arrivalDispatch?.parameters.location_id).toBe(
        '{event.payload.secondaryId}'
      );
    });

    it('includes sense-aware fields in perceptible events', () => {
      const branch = findIfByOutcome(
        handleSwimRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];

      const dispatches = actions.filter(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      dispatches.forEach((dispatch) => {
        expect(dispatch.parameters.actor_description).toBeDefined();
        expect(dispatch.parameters.alternate_descriptions).toBeDefined();
        expect(dispatch.parameters.alternate_descriptions.auditory).toBeDefined();
        expect(dispatch.parameters.alternate_descriptions.tactile).toBeDefined();
      });
    });

    it('ends turn with success macro', () => {
      const branch = findIfByOutcome(
        handleSwimRule.actions,
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
        handleSwimRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];

      const logMessage = actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'logMessage'
      );
      expect(logMessage?.parameters.value).toContain('swims effortlessly');
    });
  });

  describe('SUCCESS branch', () => {
    it('updates liquids-states:in_liquid_body.liquid_body_id', () => {
      const branch = findIfByOutcome(handleSwimRule.actions, 'SUCCESS');
      const actions = branch?.parameters.then_actions ?? [];

      const modifyLiquidBody = actions.find(
        (op) =>
          op.type === 'MODIFY_COMPONENT' &&
          op.parameters.component_type === 'liquids-states:in_liquid_body'
      );
      expect(modifyLiquidBody).toBeDefined();
      expect(modifyLiquidBody?.parameters.field).toBe('liquid_body_id');
      expect(modifyLiquidBody?.parameters.value).toBe(
        '{event.payload.primaryId}'
      );
    });

    it('updates core:position.locationId to the connected location', () => {
      const branch = findIfByOutcome(handleSwimRule.actions, 'SUCCESS');
      const actions = branch?.parameters.then_actions ?? [];

      const modifyPosition = actions.find(
        (op) =>
          op.type === 'MODIFY_COMPONENT' &&
          op.parameters.component_type === 'core:position'
      );
      expect(modifyPosition).toBeDefined();
      expect(modifyPosition?.parameters.field).toBe('locationId');
      expect(modifyPosition?.parameters.value).toBe(
        '{event.payload.secondaryId}'
      );
    });

    it('calls REGENERATE_DESCRIPTION for the actor', () => {
      const branch = findIfByOutcome(handleSwimRule.actions, 'SUCCESS');
      const actions = branch?.parameters.then_actions ?? [];

      const regenOp = actions.find((op) => op.type === 'REGENERATE_DESCRIPTION');
      expect(regenOp).toBeDefined();
      expect(regenOp?.parameters.entity_ref).toBe('actor');
    });

    it('dispatches departure and arrival perceptions', () => {
      const branch = findIfByOutcome(handleSwimRule.actions, 'SUCCESS');
      const actions = branch?.parameters.then_actions ?? [];

      const dispatches = actions.filter(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatches.length).toBe(2);
    });

    it('includes sense-aware fields in perceptible events', () => {
      const branch = findIfByOutcome(handleSwimRule.actions, 'SUCCESS');
      const actions = branch?.parameters.then_actions ?? [];

      const dispatches = actions.filter(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );

      dispatches.forEach((dispatch) => {
        expect(dispatch.parameters.actor_description).toBeDefined();
        expect(dispatch.parameters.alternate_descriptions).toBeDefined();
      });
    });

    it('ends turn with success macro', () => {
      const branch = findIfByOutcome(handleSwimRule.actions, 'SUCCESS');
      const actions = branch?.parameters.then_actions ?? [];

      const hasSuccessMacro = actions.some(
        (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
      );
      expect(hasSuccessMacro).toBe(true);
    });
  });

  describe('FAILURE branch', () => {
    it('leaves components unchanged on FAILURE', () => {
      const branch = findIfByOutcome(handleSwimRule.actions, 'FAILURE');
      const actions = branch?.parameters.then_actions ?? [];

      // Should not modify any components
      expect(actions.some((op) => op.type === 'MODIFY_COMPONENT')).toBe(false);

      // Should not add any components
      expect(actions.some((op) => op.type === 'ADD_COMPONENT')).toBe(false);

      // Should not regenerate description (no state change)
      expect(actions.some((op) => op.type === 'REGENERATE_DESCRIPTION')).toBe(
        false
      );
    });

    it('dispatches perception with struggling message', () => {
      const branch = findIfByOutcome(handleSwimRule.actions, 'FAILURE');
      const actions = branch?.parameters.then_actions ?? [];

      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatch?.parameters.description_text).toContain(
        'struggles to swim'
      );
      expect(dispatch?.parameters.description_text).toContain(
        'making little progress'
      );
    });

    it('includes sense-aware fields in perceptible events', () => {
      const branch = findIfByOutcome(handleSwimRule.actions, 'FAILURE');
      const actions = branch?.parameters.then_actions ?? [];

      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatch.parameters.actor_description).toBeDefined();
      expect(dispatch.parameters.alternate_descriptions).toBeDefined();
      expect(dispatch.parameters.alternate_descriptions.auditory).toContain(
        'labored splashing'
      );
      expect(dispatch.parameters.alternate_descriptions.tactile).toContain(
        'erratic water movements'
      );
    });

    it('sets correct log message', () => {
      const branch = findIfByOutcome(handleSwimRule.actions, 'FAILURE');
      const actions = branch?.parameters.then_actions ?? [];

      const logMessage = actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'logMessage'
      );
      expect(logMessage?.parameters.value).toContain('struggles to swim');
    });

    it('ends turn with failure macro', () => {
      const branch = findIfByOutcome(handleSwimRule.actions, 'FAILURE');
      const actions = branch?.parameters.then_actions ?? [];

      const hasFailureMacro = actions.some(
        (op) => op.macro === 'core:logFailureOutcomeAndEndTurn'
      );
      expect(hasFailureMacro).toBe(true);
    });
  });

  describe('FUMBLE branch', () => {
    it('adds submerged component on FUMBLE', () => {
      const branch = findIfByOutcome(handleSwimRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];

      // Should not modify any components (doesn't change location or liquid body)
      expect(actions.some((op) => op.type === 'MODIFY_COMPONENT')).toBe(false);

      // Should add submerged component
      const addComponentOp = actions.find((op) => op.type === 'ADD_COMPONENT');
      expect(addComponentOp).toBeDefined();
      expect(addComponentOp?.parameters.entity_ref).toBe('actor');
      expect(addComponentOp?.parameters.component_type).toBe(
        'liquids-states:submerged'
      );
      expect(addComponentOp?.parameters.value).toEqual({});
    });

    it('regenerates description after adding submerged component', () => {
      const branch = findIfByOutcome(handleSwimRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];

      const regenOp = actions.find((op) => op.type === 'REGENERATE_DESCRIPTION');
      expect(regenOp).toBeDefined();
      expect(regenOp?.parameters.entity_ref).toBe('actor');

      // REGENERATE_DESCRIPTION should come after ADD_COMPONENT
      const addComponentIndex = actions.findIndex(
        (op) => op.type === 'ADD_COMPONENT'
      );
      const regenIndex = actions.findIndex(
        (op) => op.type === 'REGENERATE_DESCRIPTION'
      );
      expect(regenIndex).toBeGreaterThan(addComponentIndex);
    });

    it('dispatches perception with uncoordinated/submerged message', () => {
      const branch = findIfByOutcome(handleSwimRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];

      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatch?.parameters.description_text).toContain(
        'struggles in an uncoordinated way'
      );
      expect(dispatch?.parameters.description_text).toContain(
        'submerged in the liquid'
      );
    });

    it('includes sense-aware fields in perceptible events', () => {
      const branch = findIfByOutcome(handleSwimRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];

      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatch.parameters.actor_description).toBeDefined();
      expect(dispatch.parameters.alternate_descriptions).toBeDefined();
      expect(dispatch.parameters.alternate_descriptions.auditory).toContain(
        'desperate thrashing'
      );
      expect(dispatch.parameters.alternate_descriptions.tactile).toContain(
        'chaotic water movements'
      );
    });

    it('sets correct log message', () => {
      const branch = findIfByOutcome(handleSwimRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];

      const logMessage = actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'logMessage'
      );
      expect(logMessage?.parameters.value).toContain('uncoordinated');
      expect(logMessage?.parameters.value).toContain('submerged');
    });

    it('ends turn with failure macro', () => {
      const branch = findIfByOutcome(handleSwimRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];

      expect(
        actions.some((op) => op.macro === 'core:logFailureOutcomeAndEndTurn')
      ).toBe(true);
    });
  });

  describe('Dependency validation', () => {
    it('has skills as a dependency for mobility_skill component', () => {
      const skillsDep = liquidsManifest.dependencies.find(
        (dep) => dep.id === 'skills'
      );
      expect(skillsDep).toBeDefined();
      expect(skillsDep.version).toBe('^1.0.0');
    });

    it('has liquids-states as a dependency for in_liquid_body component', () => {
      const liquidsDep = liquidsManifest.dependencies.find(
        (dep) => dep.id === 'liquids-states'
      );
      expect(liquidsDep).toBeDefined();
      expect(liquidsDep.version).toBe('^1.0.0');
    });

    it('has positioning as a dependency for forbidden_components', () => {
      const positioningDep = liquidsManifest.dependencies.find(
        (dep) => dep.id === 'positioning'
      );
      expect(positioningDep).toBeDefined();
      expect(positioningDep.version).toBe('^1.0.0');
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
        const branch = findIfByOutcome(handleSwimRule.actions, outcome);
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
        const branch = findIfByOutcome(handleSwimRule.actions, outcome);
        const allMacros = findAllTerminalMacros(
          branch.parameters.then_actions ?? []
        );
        expect(allMacros).toContain('core:logSuccessOutcomeAndEndTurn');
      });
    });

    it('failure outcomes use failure macro', () => {
      ['FAILURE', 'FUMBLE'].forEach((outcome) => {
        const branch = findIfByOutcome(handleSwimRule.actions, outcome);
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
      const perceptionTypes = findAllPerceptionTypes(handleSwimRule.actions);

      expect(perceptionTypes.length).toBeGreaterThan(0);

      perceptionTypes.forEach((type) => {
        expect(VALID_PERCEPTION_TYPES).toContain(type);
      });
    });

    it('uses physical.self_action for all swim events', () => {
      // All swim events should use physical.self_action
      const perceptionTypes = findAllPerceptionTypes(handleSwimRule.actions);

      perceptionTypes.forEach((type) => {
        expect(type).toBe('physical.self_action');
      });
    });
  });

  describe('State update order validation', () => {
    it('modifies liquid body before position on CRITICAL_SUCCESS', () => {
      const branch = findIfByOutcome(
        handleSwimRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];

      const liquidBodyIndex = actions.findIndex(
        (op) =>
          op.type === 'MODIFY_COMPONENT' &&
          op.parameters.component_type === 'liquids-states:in_liquid_body'
      );
      const positionIndex = actions.findIndex(
        (op) =>
          op.type === 'MODIFY_COMPONENT' &&
          op.parameters.component_type === 'core:position'
      );

      expect(liquidBodyIndex).toBeGreaterThan(-1);
      expect(positionIndex).toBeGreaterThan(-1);
      expect(liquidBodyIndex).toBeLessThan(positionIndex);
    });

    it('modifies liquid body before position on SUCCESS', () => {
      const branch = findIfByOutcome(handleSwimRule.actions, 'SUCCESS');
      const actions = branch?.parameters.then_actions ?? [];

      const liquidBodyIndex = actions.findIndex(
        (op) =>
          op.type === 'MODIFY_COMPONENT' &&
          op.parameters.component_type === 'liquids-states:in_liquid_body'
      );
      const positionIndex = actions.findIndex(
        (op) =>
          op.type === 'MODIFY_COMPONENT' &&
          op.parameters.component_type === 'core:position'
      );

      expect(liquidBodyIndex).toBeGreaterThan(-1);
      expect(positionIndex).toBeGreaterThan(-1);
      expect(liquidBodyIndex).toBeLessThan(positionIndex);
    });

    it('REGENERATE_DESCRIPTION comes after both component modifications', () => {
      ['CRITICAL_SUCCESS', 'SUCCESS'].forEach((outcome) => {
        const branch = findIfByOutcome(handleSwimRule.actions, outcome);
        const actions = branch?.parameters.then_actions ?? [];

        const positionIndex = actions.findIndex(
          (op) =>
            op.type === 'MODIFY_COMPONENT' &&
            op.parameters.component_type === 'core:position'
        );
        const regenIndex = actions.findIndex(
          (op) => op.type === 'REGENERATE_DESCRIPTION'
        );

        expect(regenIndex).toBeGreaterThan(positionIndex);
      });
    });
  });
});
