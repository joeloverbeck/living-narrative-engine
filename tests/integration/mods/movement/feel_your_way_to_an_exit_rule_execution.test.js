/**
 * @file Integration tests for handle_feel_your_way_to_an_exit rule wiring and outcomes.
 * @description Validates condition wiring, outcome resolution setup, and branch side effects/messages.
 */

import { describe, it, expect } from '@jest/globals';
import handleFeelYourWayRule from '../../../../data/mods/movement/rules/handle_feel_your_way_to_an_exit.rule.json' assert { type: 'json' };
import eventIsActionFeelYourWay from '../../../../data/mods/movement/conditions/event-is-action-feel-your-way-to-an-exit.condition.json' assert { type: 'json' };
import movementManifest from '../../../../data/mods/movement/mod-manifest.json' assert { type: 'json' };

const findIfByOutcome = (actions, outcomeValue) =>
  actions.find(
    (op) =>
      op.type === 'IF' && op.parameters?.condition?.['==']?.[1] === outcomeValue
  );

describe('handle_feel_your_way_to_an_exit rule', () => {
  it('registers rule and condition correctly', () => {
    expect(handleFeelYourWayRule.rule_id).toBe('handle_feel_your_way_to_an_exit');
    expect(handleFeelYourWayRule.event_type).toBe('core:attempt_action');
    expect(handleFeelYourWayRule.condition.condition_ref).toBe(
      'movement:event-is-action-feel-your-way-to-an-exit'
    );

    expect(eventIsActionFeelYourWay.id).toBe(
      'movement:event-is-action-feel-your-way-to-an-exit'
    );
    expect(eventIsActionFeelYourWay.logic['==']).toEqual([
      { var: 'event.payload.actionId' },
      'movement:feel_your_way_to_an_exit',
    ]);

    expect(movementManifest.content.rules).toContain(
      'handle_feel_your_way_to_an_exit.rule.json'
    );
    expect(movementManifest.content.conditions).toContain(
      'event-is-action-feel-your-way-to-an-exit.condition.json'
    );
  });

  it('sets up names, position lookup, and outcome resolution for awareness skill', () => {
    const getNameOps = handleFeelYourWayRule.actions.filter(
      (op) => op.type === 'GET_NAME'
    );
    const actorNameOp = getNameOps.find(
      (op) => op.parameters.entity_ref === 'actor'
    );

    expect(actorNameOp?.parameters.result_variable).toBe('actorName');

    const positionQuery = handleFeelYourWayRule.actions.find(
      (op) =>
        op.type === 'QUERY_COMPONENT' &&
        op.parameters.component_type === 'core:position'
    );
    expect(positionQuery?.parameters.entity_ref).toBe('actor');
    expect(positionQuery?.parameters.result_variable).toBe('actorPosition');

    const locationNameQuery = handleFeelYourWayRule.actions.find(
      (op) =>
        op.type === 'QUERY_COMPONENT' &&
        op.parameters.component_type === 'core:name' &&
        op.parameters.result_variable === 'currentLocationName'
    );
    expect(locationNameQuery).toBeDefined();

    const resolveOutcome = handleFeelYourWayRule.actions.find(
      (op) => op.type === 'RESOLVE_OUTCOME'
    );
    expect(resolveOutcome).toBeDefined();
    expect(resolveOutcome.parameters.actor_skill_component).toBe(
      'skills:awareness_skill'
    );
    // Fixed difficulty - no target skill component
    expect(resolveOutcome.parameters.target_skill_component).toBeUndefined();
    expect(resolveOutcome.parameters.actor_skill_default).toBe(0);
    expect(resolveOutcome.parameters.difficulty_modifier).toBe(50);
    expect(resolveOutcome.parameters.formula).toBe('linear');
    expect(resolveOutcome.parameters.result_variable).toBe('navigationResult');
  });

  it('sets shared variables for perception/logging', () => {
    const setVariableOps = handleFeelYourWayRule.actions.filter(
      (op) => op.type === 'SET_VARIABLE'
    );

    const locationVar = setVariableOps.find(
      (op) => op.parameters.variable_name === 'locationId'
    );
    const perceptionVar = setVariableOps.find(
      (op) => op.parameters.variable_name === 'perceptionType'
    );

    expect(locationVar?.parameters.value).toBe(
      '{context.actorPosition.locationId}'
    );
    expect(perceptionVar?.parameters.value).toBe('error.action_failed');
  });

  it('branches flatly for all four outcomes', () => {
    const ifOps = handleFeelYourWayRule.actions.filter(
      (op) => op.type === 'IF'
    );

    // Should have 4 top-level IF branches for outcomes
    expect(ifOps).toHaveLength(4);
    expect(
      findIfByOutcome(handleFeelYourWayRule.actions, 'CRITICAL_SUCCESS')
    ).toBeDefined();
    expect(
      findIfByOutcome(handleFeelYourWayRule.actions, 'SUCCESS')
    ).toBeDefined();
    expect(
      findIfByOutcome(handleFeelYourWayRule.actions, 'FAILURE')
    ).toBeDefined();
    expect(
      findIfByOutcome(handleFeelYourWayRule.actions, 'FUMBLE')
    ).toBeDefined();
  });

  describe('CRITICAL_SUCCESS branch', () => {
    it('picks random exit and moves actor on CRITICAL_SUCCESS', () => {
      const branch = findIfByOutcome(
        handleFeelYourWayRule.actions,
        'CRITICAL_SUCCESS'
      );
      const actions = branch?.parameters.then_actions ?? [];

      // Should pick random exit
      const pickRandom = actions.find(
        (op) => op.type === 'PICK_RANDOM_ARRAY_ELEMENT'
      );
      expect(pickRandom).toBeDefined();
      expect(pickRandom?.parameters.component_type).toBe('locations:exits');
      // array_field is intentionally omitted - handler uses smart default for locations:exits
      expect(pickRandom?.parameters.array_field).toBeUndefined();
      expect(pickRandom?.parameters.result_variable).toBe('selectedExit');
    });

    it('dispatches departure perception with confident message', () => {
      const branch = findIfByOutcome(
        handleFeelYourWayRule.actions,
        'CRITICAL_SUCCESS'
      );
      const nestedIf = branch?.parameters.then_actions?.find(
        (op) => op.type === 'IF'
      );
      const nestedActions = nestedIf?.parameters.then_actions ?? [];

      const departureDispatch = nestedActions.find(
        (op) =>
          op.type === 'DISPATCH_PERCEPTIBLE_EVENT' &&
          op.parameters.perception_type === 'movement.departure'
      );
      expect(departureDispatch).toBeDefined();
      expect(departureDispatch?.parameters.description_text).toContain(
        'confidently feels their way through the darkness'
      );
    });

    it('modifies actor position to new location', () => {
      const branch = findIfByOutcome(
        handleFeelYourWayRule.actions,
        'CRITICAL_SUCCESS'
      );
      const nestedIf = branch?.parameters.then_actions?.find(
        (op) => op.type === 'IF'
      );
      const nestedActions = nestedIf?.parameters.then_actions ?? [];

      const modifyComponent = nestedActions.find(
        (op) =>
          op.type === 'MODIFY_COMPONENT' &&
          op.parameters.component_type === 'core:position'
      );
      expect(modifyComponent).toBeDefined();
      expect(modifyComponent?.parameters.entity_ref).toBe('actor');
      expect(modifyComponent?.parameters.field).toBe('locationId');
      expect(modifyComponent?.parameters.mode).toBe('set');
      expect(modifyComponent?.parameters.value).toBe(
        '{context.selectedExit.target}'
      );
    });

    it('dispatches entity_moved event', () => {
      const branch = findIfByOutcome(
        handleFeelYourWayRule.actions,
        'CRITICAL_SUCCESS'
      );
      const nestedIf = branch?.parameters.then_actions?.find(
        (op) => op.type === 'IF'
      );
      const nestedActions = nestedIf?.parameters.then_actions ?? [];

      const dispatchEvent = nestedActions.find(
        (op) =>
          op.type === 'DISPATCH_EVENT' &&
          op.parameters.eventType === 'core:entity_moved'
      );
      expect(dispatchEvent).toBeDefined();
      expect(dispatchEvent?.parameters.payload.entityId).toBe(
        '{event.payload.actorId}'
      );
    });

    it('auto-moves followers', () => {
      const branch = findIfByOutcome(
        handleFeelYourWayRule.actions,
        'CRITICAL_SUCCESS'
      );
      const nestedIf = branch?.parameters.then_actions?.find(
        (op) => op.type === 'IF'
      );
      const nestedActions = nestedIf?.parameters.then_actions ?? [];

      const autoMove = nestedActions.find(
        (op) => op.type === 'AUTO_MOVE_FOLLOWERS'
      );
      expect(autoMove).toBeDefined();
      // Uses leader_id and destination_id per autoMoveFollowers.schema.json
      expect(autoMove?.parameters.leader_id).toBe('{event.payload.actorId}');
      expect(autoMove?.parameters.destination_id).toBe(
        '{context.selectedExit.target}'
      );
    });

    it('dispatches arrival perception', () => {
      const branch = findIfByOutcome(
        handleFeelYourWayRule.actions,
        'CRITICAL_SUCCESS'
      );
      const nestedIf = branch?.parameters.then_actions?.find(
        (op) => op.type === 'IF'
      );
      const nestedActions = nestedIf?.parameters.then_actions ?? [];

      const arrivalDispatch = nestedActions.find(
        (op) =>
          op.type === 'DISPATCH_PERCEPTIBLE_EVENT' &&
          op.parameters.perception_type === 'movement.arrival'
      );
      expect(arrivalDispatch).toBeDefined();
      expect(arrivalDispatch?.parameters.description_text).toContain(
        'emerges from the darkness with confidence'
      );
    });

    it('ends turn with success macro', () => {
      const branch = findIfByOutcome(
        handleFeelYourWayRule.actions,
        'CRITICAL_SUCCESS'
      );
      const nestedIf = branch?.parameters.then_actions?.find(
        (op) => op.type === 'IF'
      );
      const nestedActions = nestedIf?.parameters.then_actions ?? [];

      const hasSuccessMacro = nestedActions.some(
        (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
      );
      expect(hasSuccessMacro).toBe(true);
    });
  });

  describe('SUCCESS branch', () => {
    it('picks random exit and moves actor on SUCCESS', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'SUCCESS');
      const actions = branch?.parameters.then_actions ?? [];

      const pickRandom = actions.find(
        (op) => op.type === 'PICK_RANDOM_ARRAY_ELEMENT'
      );
      expect(pickRandom).toBeDefined();
      expect(pickRandom?.parameters.result_variable).toBe('selectedExit');
    });

    it('dispatches departure perception with careful message', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'SUCCESS');
      const nestedIf = branch?.parameters.then_actions?.find(
        (op) => op.type === 'IF'
      );
      const nestedActions = nestedIf?.parameters.then_actions ?? [];

      const departureDispatch = nestedActions.find(
        (op) =>
          op.type === 'DISPATCH_PERCEPTIBLE_EVENT' &&
          op.parameters.perception_type === 'movement.departure'
      );
      expect(departureDispatch?.parameters.description_text).toContain(
        'carefully feels their way along the walls'
      );
    });

    it('dispatches arrival perception with stumble message', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'SUCCESS');
      const nestedIf = branch?.parameters.then_actions?.find(
        (op) => op.type === 'IF'
      );
      const nestedActions = nestedIf?.parameters.then_actions ?? [];

      const arrivalDispatch = nestedActions.find(
        (op) =>
          op.type === 'DISPATCH_PERCEPTIBLE_EVENT' &&
          op.parameters.perception_type === 'movement.arrival'
      );
      expect(arrivalDispatch?.parameters.description_text).toContain(
        'stumbles out of the darkness'
      );
    });

    it('modifies actor position and ends with success macro', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'SUCCESS');
      const nestedIf = branch?.parameters.then_actions?.find(
        (op) => op.type === 'IF'
      );
      const nestedActions = nestedIf?.parameters.then_actions ?? [];

      const modifyComponent = nestedActions.find(
        (op) =>
          op.type === 'MODIFY_COMPONENT' &&
          op.parameters.component_type === 'core:position'
      );
      expect(modifyComponent).toBeDefined();

      const hasSuccessMacro = nestedActions.some(
        (op) => op.macro === 'core:logSuccessOutcomeAndEndTurn'
      );
      expect(hasSuccessMacro).toBe(true);
    });
  });

  describe('FAILURE branch', () => {
    it('leaves state unchanged on FAILURE', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'FAILURE');
      const actions = branch?.parameters.then_actions ?? [];

      // Should not add any components
      expect(actions.some((op) => op.type === 'ADD_COMPONENT')).toBe(false);

      // Should not modify position
      expect(actions.some((op) => op.type === 'MODIFY_COMPONENT')).toBe(false);

      // Should not pick random exit
      expect(
        actions.some((op) => op.type === 'PICK_RANDOM_ARRAY_ELEMENT')
      ).toBe(false);
    });

    it('dispatches perception with fumbling message', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'FAILURE');
      const actions = branch?.parameters.then_actions ?? [];

      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatch?.parameters.description_text).toContain(
        'fumbles around in the darkness but cannot find an exit'
      );
      // physical.self_action is used for action failures (not error.action_failed which shows crossed-out styling)
      expect(dispatch?.parameters.perception_type).toBe('physical.self_action');
    });

    it('sets correct log message', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'FAILURE');
      const actions = branch?.parameters.then_actions ?? [];

      const logMessage = actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'logMessage'
      );
      expect(logMessage?.parameters.value).toContain(
        'fumbles around in the darkness but cannot find an exit'
      );
    });

    it('ends turn with failure macro', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'FAILURE');
      const actions = branch?.parameters.then_actions ?? [];

      const hasFailureMacro = actions.some(
        (op) => op.macro === 'core:logFailureOutcomeAndEndTurn'
      );
      expect(hasFailureMacro).toBe(true);
    });
  });

  describe('FUMBLE branch', () => {
    it('adds fallen state on FUMBLE', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];

      const fallenAdd = actions.find(
        (op) =>
          op.type === 'ADD_COMPONENT' &&
          op.parameters.component_type === 'recovery-states:fallen'
      );
      expect(fallenAdd?.parameters.entity_ref).toBe('actor');
    });

    it('regenerates description after falling', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];

      const regenOp = actions.find((op) => op.type === 'REGENERATE_DESCRIPTION');
      expect(regenOp?.parameters.entity_ref).toBe('actor');
    });

    it('dispatches perception with stumble and fall message', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];

      const dispatch = actions.find(
        (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
      );
      expect(dispatch?.parameters.description_text).toContain(
        'stumbles in the darkness, trips over something, and falls to the ground'
      );
      // physical.self_action is used for action failures (not error.action_failed which shows crossed-out styling)
      expect(dispatch?.parameters.perception_type).toBe('physical.self_action');
    });

    it('sets correct log message', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];

      const logMessage = actions.find(
        (op) =>
          op.type === 'SET_VARIABLE' &&
          op.parameters.variable_name === 'logMessage'
      );
      expect(logMessage?.parameters.value).toContain(
        'stumbles in the darkness, trips over something, and falls to the ground'
      );
    });

    it('ends turn with failure macro', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];

      expect(
        actions.some((op) => op.macro === 'core:logFailureOutcomeAndEndTurn')
      ).toBe(true);
    });

    it('does not modify position on FUMBLE', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'FUMBLE');
      const actions = branch?.parameters.then_actions ?? [];

      // Should not modify position - actor stays in current location
      expect(actions.some((op) => op.type === 'MODIFY_COMPONENT')).toBe(false);
    });
  });

  describe('Dependency validation', () => {
    it('has skills as a dependency for awareness_skill component', () => {
      const skillsDep = movementManifest.dependencies.find(
        (dep) => dep.id === 'skills'
      );
      expect(skillsDep).toBeDefined();
      expect(skillsDep.version).toBe('^1.0.0');
    });

    it('has recovery-states as a dependency for fallen component', () => {
      const recoveryStatesDep = movementManifest.dependencies.find(
        (dep) => dep.id === 'recovery-states'
      );
      expect(recoveryStatesDep).toBeDefined();
      expect(recoveryStatesDep.version).toBe('^1.0.0');
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

    /**
     * Verifies that nested IFs in success branches have else_actions with turn-ending macros.
     * This is critical to prevent turn lockup if PICK_RANDOM_ARRAY_ELEMENT returns null.
     */
    it('CRITICAL_SUCCESS nested IF has else_actions with turn-ending macro', () => {
      const branch = findIfByOutcome(
        handleFeelYourWayRule.actions,
        'CRITICAL_SUCCESS'
      );
      const nestedIf = branch?.parameters.then_actions?.find(
        (op) => op.type === 'IF'
      );

      expect(nestedIf).toBeDefined();
      expect(nestedIf.parameters.else_actions).toBeDefined();
      expect(nestedIf.parameters.else_actions.length).toBeGreaterThan(0);

      const elseHasTurnEndingMacro = nestedIf.parameters.else_actions.some(
        (op) =>
          op.macro === 'core:logFailureOutcomeAndEndTurn' ||
          op.macro === 'core:logSuccessOutcomeAndEndTurn'
      );
      expect(elseHasTurnEndingMacro).toBe(true);
    });

    it('SUCCESS nested IF has else_actions with turn-ending macro', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'SUCCESS');
      const nestedIf = branch?.parameters.then_actions?.find(
        (op) => op.type === 'IF'
      );

      expect(nestedIf).toBeDefined();
      expect(nestedIf.parameters.else_actions).toBeDefined();
      expect(nestedIf.parameters.else_actions.length).toBeGreaterThan(0);

      const elseHasTurnEndingMacro = nestedIf.parameters.else_actions.some(
        (op) =>
          op.macro === 'core:logFailureOutcomeAndEndTurn' ||
          op.macro === 'core:logSuccessOutcomeAndEndTurn'
      );
      expect(elseHasTurnEndingMacro).toBe(true);
    });

    it('all outcome branches contain at least one turn-ending macro', () => {
      const outcomes = ['CRITICAL_SUCCESS', 'SUCCESS', 'FAILURE', 'FUMBLE'];
      const turnEndingMacros = [
        'core:logSuccessOutcomeAndEndTurn',
        'core:logFailureOutcomeAndEndTurn',
      ];

      outcomes.forEach((outcome) => {
        const branch = findIfByOutcome(handleFeelYourWayRule.actions, outcome);
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

    it('every code path in success branches leads to a turn-ending macro', () => {
      // For CRITICAL_SUCCESS and SUCCESS, both then_actions AND else_actions
      // of the nested IF must end with a turn-ending macro
      ['CRITICAL_SUCCESS', 'SUCCESS'].forEach((outcome) => {
        const branch = findIfByOutcome(handleFeelYourWayRule.actions, outcome);
        const nestedIf = branch?.parameters.then_actions?.find(
          (op) => op.type === 'IF'
        );

        // Check then_actions path
        const thenMacros = findAllTerminalMacros(
          nestedIf.parameters.then_actions ?? []
        );
        expect(thenMacros).toContain('core:logSuccessOutcomeAndEndTurn');

        // Check else_actions path (edge case when no exit found)
        const elseMacros = findAllTerminalMacros(
          nestedIf.parameters.else_actions ?? []
        );
        expect(elseMacros).toContain('core:logFailureOutcomeAndEndTurn');
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
      const perceptionTypes = findAllPerceptionTypes(handleFeelYourWayRule.actions);

      expect(perceptionTypes.length).toBeGreaterThan(0);

      perceptionTypes.forEach((type) => {
        expect(VALID_PERCEPTION_TYPES).toContain(type);
      });
    });

    it('uses physical.self_action for failure-related events (not error.action_failed)', () => {
      // FAILURE and FUMBLE branches should use physical.self_action
      // (error.action_failed shows crossed-out styling which is wrong for action failures)
      ['FAILURE', 'FUMBLE'].forEach((outcome) => {
        const branch = findIfByOutcome(handleFeelYourWayRule.actions, outcome);
        const dispatchEvent = branch?.parameters.then_actions?.find(
          (op) => op.type === 'DISPATCH_PERCEPTIBLE_EVENT'
        );

        expect(dispatchEvent).toBeDefined();
        expect(dispatchEvent.parameters.perception_type).toBe('physical.self_action');
      });
    });

    it('does not use invalid perception_type "movement.navigation"', () => {
      const perceptionTypes = findAllPerceptionTypes(handleFeelYourWayRule.actions);

      expect(perceptionTypes).not.toContain('movement.navigation');
    });
  });
});
