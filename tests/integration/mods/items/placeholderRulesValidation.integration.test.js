/**
 * @file Integration test to verify aim item rules have correct structure and operations
 * Tests that handle_aim_item and handle_lower_aim rules load without validation errors
 * and contain the expected operation sequences
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  validateRuleStructure,
  performPreValidation,
} from '../../../../src/utils/preValidationUtils.js';
import fs from 'fs';
import path from 'path';

describe('Aim Item Rules Validation', () => {
  const rulePaths = {
    aimItem: path.join(
      process.cwd(),
      'data/mods/items/rules/handle_aim_item.rule.json'
    ),
    lowerAim: path.join(
      process.cwd(),
      'data/mods/items/rules/handle_lower_aim.rule.json'
    ),
  };

  let aimItemRule;
  let lowerAimRule;

  beforeEach(() => {
    // Read the rule files
    aimItemRule = JSON.parse(fs.readFileSync(rulePaths.aimItem, 'utf8'));
    lowerAimRule = JSON.parse(fs.readFileSync(rulePaths.lowerAim, 'utf8'));
  });

  describe('handle_aim_item.rule.json', () => {
    it('should be a valid rule object', () => {
      expect(aimItemRule).toBeDefined();
      expect(aimItemRule.rule_id).toBe('handle_aim_item');
      expect(aimItemRule.event_type).toBe('core:attempt_action');
      expect(aimItemRule.actions).toBeInstanceOf(Array);
      expect(aimItemRule.actions.length).toBeGreaterThan(0);
    });

    it('should have GET_TIMESTAMP as first operation', () => {
      const firstAction = aimItemRule.actions[0];
      expect(firstAction).toBeDefined();
      expect(firstAction.type).toBe('GET_TIMESTAMP');
      expect(firstAction.parameters).toBeDefined();
      expect(firstAction.parameters.result_variable).toBe('currentTimestamp');
    });

    it('should have complete operation sequence', () => {
      expect(aimItemRule.actions).toHaveLength(4);

      // Operation 1: GET_TIMESTAMP
      expect(aimItemRule.actions[0].type).toBe('GET_TIMESTAMP');

      // Operation 2: ADD_COMPONENT
      expect(aimItemRule.actions[1].type).toBe('ADD_COMPONENT');
      expect(aimItemRule.actions[1].parameters.component_type).toBe('items:aimed_at');

      // Operation 3: DISPATCH_EVENT
      expect(aimItemRule.actions[2].type).toBe('DISPATCH_EVENT');
      expect(aimItemRule.actions[2].parameters.eventType).toBe('items:item_aimed');

      // Operation 4: END_TURN
      expect(aimItemRule.actions[3].type).toBe('END_TURN');
      expect(aimItemRule.actions[3].parameters.success).toBe(true);
    });

    it('should pass pre-validation', () => {
      const result = validateRuleStructure(aimItemRule, rulePaths.aimItem);

      if (!result.isValid) {
        console.error('Pre-validation failed:', result.error);
        console.error('Path:', result.path);
        console.error('Suggestions:', result.suggestions);
      }

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should pass schema validation', () => {
      const result = performPreValidation(
        aimItemRule,
        'schema://living-narrative-engine/rule.schema.json',
        'handle_aim_item.rule.json'
      );

      if (!result.isValid) {
        console.error('Schema pre-validation failed:', result.error);
        console.error('Path:', result.path);
        console.error('Suggestions:', result.suggestions);
      }

      expect(result.isValid).toBe(true);
    });
  });

  describe('handle_lower_aim.rule.json', () => {
    it('should be a valid rule object', () => {
      expect(lowerAimRule).toBeDefined();
      expect(lowerAimRule.rule_id).toBe('handle_lower_aim');
      expect(lowerAimRule.event_type).toBe('core:attempt_action');
      expect(lowerAimRule.actions).toBeInstanceOf(Array);
      expect(lowerAimRule.actions.length).toBeGreaterThan(0);
    });

    it('should have QUERY_COMPONENT as first operation', () => {
      const firstAction = lowerAimRule.actions[0];
      expect(firstAction).toBeDefined();
      expect(firstAction.type).toBe('QUERY_COMPONENT');
      expect(firstAction.parameters).toBeDefined();
      expect(firstAction.parameters.component_type).toBe('items:aimed_at');
      expect(firstAction.parameters.result_variable).toBe('aimedAtData');
    });

    it('should have complete operation sequence', () => {
      expect(lowerAimRule.actions).toHaveLength(5);

      // Operation 1: QUERY_COMPONENT
      expect(lowerAimRule.actions[0].type).toBe('QUERY_COMPONENT');
      expect(lowerAimRule.actions[0].parameters.component_type).toBe('items:aimed_at');

      // Operation 2: GET_TIMESTAMP
      expect(lowerAimRule.actions[1].type).toBe('GET_TIMESTAMP');

      // Operation 3: REMOVE_COMPONENT
      expect(lowerAimRule.actions[2].type).toBe('REMOVE_COMPONENT');
      expect(lowerAimRule.actions[2].parameters.component_type).toBe('items:aimed_at');

      // Operation 4: DISPATCH_EVENT
      expect(lowerAimRule.actions[3].type).toBe('DISPATCH_EVENT');
      expect(lowerAimRule.actions[3].parameters.eventType).toBe('items:aim_lowered');

      // Operation 5: END_TURN
      expect(lowerAimRule.actions[4].type).toBe('END_TURN');
      expect(lowerAimRule.actions[4].parameters.success).toBe(true);
    });

    it('should pass pre-validation', () => {
      const result = validateRuleStructure(lowerAimRule, rulePaths.lowerAim);

      if (!result.isValid) {
        console.error('Pre-validation failed:', result.error);
        console.error('Path:', result.path);
        console.error('Suggestions:', result.suggestions);
      }

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should pass schema validation', () => {
      const result = performPreValidation(
        lowerAimRule,
        'schema://living-narrative-engine/rule.schema.json',
        'handle_lower_aim.rule.json'
      );

      if (!result.isValid) {
        console.error('Schema pre-validation failed:', result.error);
        console.error('Path:', result.path);
        console.error('Suggestions:', result.suggestions);
      }

      expect(result.isValid).toBe(true);
    });
  });

  describe('Cross-rule consistency', () => {
    it('both rules should use GET_TIMESTAMP operation', () => {
      // handle_aim_item uses GET_TIMESTAMP as first operation
      const aimTimestampOp = aimItemRule.actions[0];
      expect(aimTimestampOp.type).toBe('GET_TIMESTAMP');

      // handle_lower_aim uses GET_TIMESTAMP as second operation
      const lowerTimestampOp = lowerAimRule.actions[1];
      expect(lowerTimestampOp.type).toBe('GET_TIMESTAMP');

      // Both store result in currentTimestamp variable
      expect(aimTimestampOp.parameters.result_variable).toBe('currentTimestamp');
      expect(lowerTimestampOp.parameters.result_variable).toBe('currentTimestamp');
    });

    it('both rules should end with END_TURN operation', () => {
      // Both rules should have END_TURN as last operation
      const aimLastOp = aimItemRule.actions[aimItemRule.actions.length - 1];
      const lowerLastOp = lowerAimRule.actions[lowerAimRule.actions.length - 1];

      expect(aimLastOp.type).toBe('END_TURN');
      expect(lowerLastOp.type).toBe('END_TURN');

      // Both should mark success as true
      expect(aimLastOp.parameters.success).toBe(true);
      expect(lowerLastOp.parameters.success).toBe(true);
    });

    it('both rules should dispatch events related to aiming', () => {
      // handle_aim_item dispatches items:item_aimed
      const aimDispatchOp = aimItemRule.actions.find(op => op.type === 'DISPATCH_EVENT');
      expect(aimDispatchOp).toBeDefined();
      expect(aimDispatchOp.parameters.eventType).toBe('items:item_aimed');

      // handle_lower_aim dispatches items:aim_lowered
      const lowerDispatchOp = lowerAimRule.actions.find(op => op.type === 'DISPATCH_EVENT');
      expect(lowerDispatchOp).toBeDefined();
      expect(lowerDispatchOp.parameters.eventType).toBe('items:aim_lowered');
    });
  });
});
