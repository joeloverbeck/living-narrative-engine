/**
 * @file Integration tests for AUTO_MOVE_FOLLOWERS parameter validation in feel_your_way_to_an_exit rule.
 * @description Validates that the AUTO_MOVE_FOLLOWERS operation uses correct parameter names
 * per the schema at data/schemas/operations/autoMoveFollowers.schema.json.
 *
 * The schema requires:
 * - leader_id: string (required)
 * - destination_id: string (required)
 */

import { describe, it, expect } from '@jest/globals';
import handleFeelYourWayRule from '../../../../data/mods/movement/rules/handle_feel_your_way_to_an_exit.rule.json' assert { type: 'json' };
import autoMoveFollowersSchema from '../../../../data/schemas/operations/autoMoveFollowers.schema.json' assert { type: 'json' };

const findIfByOutcome = (actions, outcomeValue) =>
  actions.find(
    (op) =>
      op.type === 'IF' && op.parameters?.condition?.['==']?.[1] === outcomeValue
  );

/**
 * Recursively find all AUTO_MOVE_FOLLOWERS operations in an action tree.
 *
 * @param {Array<object>} actions - Array of rule action objects to search
 * @returns {Array<object>} Array of AUTO_MOVE_FOLLOWERS operations found
 */
const findAutoMoveFollowersOperations = (actions) => {
  const operations = [];
  for (const action of actions) {
    if (action.type === 'AUTO_MOVE_FOLLOWERS') {
      operations.push(action);
    }
    if (action.type === 'IF' && action.parameters) {
      if (action.parameters.then_actions) {
        operations.push(
          ...findAutoMoveFollowersOperations(action.parameters.then_actions)
        );
      }
      if (action.parameters.else_actions) {
        operations.push(
          ...findAutoMoveFollowersOperations(action.parameters.else_actions)
        );
      }
    }
  }
  return operations;
};

describe('AUTO_MOVE_FOLLOWERS parameter validation in feel_your_way_to_an_exit', () => {
  describe('Schema requirements', () => {
    it('schema requires leader_id parameter', () => {
      const paramsSchema = autoMoveFollowersSchema.$defs?.Parameters;
      expect(paramsSchema?.required).toContain('leader_id');
      expect(paramsSchema?.properties?.leader_id).toBeDefined();
    });

    it('schema requires destination_id parameter', () => {
      const paramsSchema = autoMoveFollowersSchema.$defs?.Parameters;
      expect(paramsSchema?.required).toContain('destination_id');
      expect(paramsSchema?.properties?.destination_id).toBeDefined();
    });

    it('schema does not allow additional properties', () => {
      const paramsSchema = autoMoveFollowersSchema.$defs?.Parameters;
      expect(paramsSchema?.additionalProperties).toBe(false);
    });
  });

  describe('CRITICAL_SUCCESS branch AUTO_MOVE_FOLLOWERS', () => {
    it('uses correct leader_id parameter name', () => {
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

      // Must use leader_id, NOT leader_ref
      expect(autoMove.parameters.leader_id).toBeDefined();
      expect(autoMove.parameters.leader_ref).toBeUndefined();
    });

    it('uses correct destination_id parameter name', () => {
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

      // Must use destination_id, NOT destination
      expect(autoMove.parameters.destination_id).toBeDefined();
      expect(autoMove.parameters.destination).toBeUndefined();
    });

    it('provides valid leader_id value using event.payload.actorId', () => {
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

      // leader_id should reference event.payload.actorId for the entity ID
      expect(autoMove.parameters.leader_id).toBe('{event.payload.actorId}');
    });

    it('provides valid destination_id value', () => {
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

      // destination_id should reference the selected exit target
      expect(autoMove.parameters.destination_id).toBe(
        '{context.selectedExit.target}'
      );
    });
  });

  describe('SUCCESS branch AUTO_MOVE_FOLLOWERS', () => {
    it('uses correct leader_id parameter name', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'SUCCESS');
      const nestedIf = branch?.parameters.then_actions?.find(
        (op) => op.type === 'IF'
      );
      const nestedActions = nestedIf?.parameters.then_actions ?? [];

      const autoMove = nestedActions.find(
        (op) => op.type === 'AUTO_MOVE_FOLLOWERS'
      );
      expect(autoMove).toBeDefined();

      // Must use leader_id, NOT leader_ref
      expect(autoMove.parameters.leader_id).toBeDefined();
      expect(autoMove.parameters.leader_ref).toBeUndefined();
    });

    it('uses correct destination_id parameter name', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'SUCCESS');
      const nestedIf = branch?.parameters.then_actions?.find(
        (op) => op.type === 'IF'
      );
      const nestedActions = nestedIf?.parameters.then_actions ?? [];

      const autoMove = nestedActions.find(
        (op) => op.type === 'AUTO_MOVE_FOLLOWERS'
      );
      expect(autoMove).toBeDefined();

      // Must use destination_id, NOT destination
      expect(autoMove.parameters.destination_id).toBeDefined();
      expect(autoMove.parameters.destination).toBeUndefined();
    });

    it('provides valid leader_id value using event.payload.actorId', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'SUCCESS');
      const nestedIf = branch?.parameters.then_actions?.find(
        (op) => op.type === 'IF'
      );
      const nestedActions = nestedIf?.parameters.then_actions ?? [];

      const autoMove = nestedActions.find(
        (op) => op.type === 'AUTO_MOVE_FOLLOWERS'
      );
      expect(autoMove).toBeDefined();

      // leader_id should reference event.payload.actorId for the entity ID
      expect(autoMove.parameters.leader_id).toBe('{event.payload.actorId}');
    });

    it('provides valid destination_id value', () => {
      const branch = findIfByOutcome(handleFeelYourWayRule.actions, 'SUCCESS');
      const nestedIf = branch?.parameters.then_actions?.find(
        (op) => op.type === 'IF'
      );
      const nestedActions = nestedIf?.parameters.then_actions ?? [];

      const autoMove = nestedActions.find(
        (op) => op.type === 'AUTO_MOVE_FOLLOWERS'
      );
      expect(autoMove).toBeDefined();

      // destination_id should reference the selected exit target
      expect(autoMove.parameters.destination_id).toBe(
        '{context.selectedExit.target}'
      );
    });
  });

  describe('All AUTO_MOVE_FOLLOWERS operations validation', () => {
    it('all AUTO_MOVE_FOLLOWERS operations use correct parameter names', () => {
      const operations = findAutoMoveFollowersOperations(
        handleFeelYourWayRule.actions
      );

      expect(operations.length).toBe(2); // One in CRITICAL_SUCCESS, one in SUCCESS

      operations.forEach((op) => {
        // Verify correct parameter names are used
        expect(op.parameters.leader_id).toBeDefined();
        expect(op.parameters.destination_id).toBeDefined();

        // Verify incorrect parameter names are NOT used
        expect(op.parameters.leader_ref).toBeUndefined();
        expect(op.parameters.destination).toBeUndefined();
      });
    });

    it('no AUTO_MOVE_FOLLOWERS operations use legacy parameter names', () => {
      const operations = findAutoMoveFollowersOperations(
        handleFeelYourWayRule.actions
      );

      operations.forEach((op) => {
        // These are legacy/incorrect parameter names that would cause runtime errors
        expect(op.parameters).not.toHaveProperty('leader_ref');
        expect(op.parameters).not.toHaveProperty('destination');
      });
    });
  });
});
