/**
 * @file openContainerRuleValidation.test.js
 * @description Integration test that reproduces the runtime error where OPEN_CONTAINER
 * operation type is not recognized during rule pre-validation.
 * This test loads the actual handle_open_container.rule.json file and validates it.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  performPreValidation,
  validateRuleStructure,
  formatPreValidationError,
} from '../../../../src/utils/preValidationUtils.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('OPEN_CONTAINER Rule Validation Integration', () => {
  let ruleData;
  const rulePath = join(
    process.cwd(),
    'data/mods/containers/rules/handle_open_container.rule.json'
  );

  beforeEach(() => {
    // Load actual rule file from items mod
    const ruleContent = readFileSync(rulePath, 'utf-8');
    ruleData = JSON.parse(ruleContent);
  });

  describe('Pre-validation with actual rule file', () => {
    it('should validate handle_open_container.rule.json successfully', () => {
      const result = performPreValidation(
        ruleData,
        'schema://living-narrative-engine/rule.schema.json',
        'handle_open_container.rule.json'
      );

      // This test will FAIL before the fix and PASS after adding OPEN_CONTAINER
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should recognize OPEN_CONTAINER as valid operation type', () => {
      // Validate just the rule structure (includes operation type validation)
      const result = validateRuleStructure(
        ruleData,
        'handle_open_container.rule.json'
      );

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should not generate error message for OPEN_CONTAINER operation', () => {
      const result = performPreValidation(
        ruleData,
        'schema://living-narrative-engine/rule.schema.json',
        'handle_open_container.rule.json'
      );

      if (!result.isValid) {
        const errorMessage = formatPreValidationError(
          result,
          'handle_open_container.rule.json',
          'schema://living-narrative-engine/rule.schema.json'
        );
        console.error('Pre-validation error:', errorMessage);
      }

      expect(result.isValid).toBe(true);
    });
  });

  describe('OPEN_CONTAINER operation structure validation', () => {
    it('should validate OPEN_CONTAINER operation with all required parameters', () => {
      const openContainerOp = {
        type: 'OPEN_CONTAINER',
        parameters: {
          actorEntity: '{event.payload.actorId}',
          containerEntity: '{event.payload.targetId}',
          result_variable: 'openResult',
        },
      };

      const result = validateRuleStructure(
        {
          event_type: 'core:attempt_action',
          actions: [openContainerOp],
        },
        'test_rule.json'
      );

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should validate rule with OPEN_CONTAINER in nested IF operation', () => {
      const ruleWithNestedOpenContainer = {
        event_type: 'core:test_event',
        actions: [
          {
            type: 'IF',
            parameters: {
              condition: { '==': [true, true] },
              then_actions: [
                {
                  type: 'OPEN_CONTAINER',
                  parameters: {
                    actorEntity: 'actor',
                    containerEntity: 'container',
                    result_variable: 'result',
                  },
                },
              ],
            },
          },
        ],
      };

      const result = validateRuleStructure(
        ruleWithNestedOpenContainer,
        'nested_test.json'
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe('Error reproduction (before fix)', () => {
    it('should reproduce the exact runtime error format when operation type is unknown', () => {
      // Create a rule with an intentionally unknown operation type
      const ruleWithUnknownOp = {
        event_type: 'core:test_event',
        actions: [
          {
            type: 'DEFINITELY_UNKNOWN_OPERATION',
            parameters: { test: 'value' },
          },
        ],
      };

      const result = performPreValidation(
        ruleWithUnknownOp,
        'schema://living-narrative-engine/rule.schema.json',
        'test_unknown.rule.json'
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unknown operation type');
      expect(result.error).toContain('DEFINITELY_UNKNOWN_OPERATION');

      // Verify error message format matches runtime error
      const errorMessage = formatPreValidationError(
        result,
        'test_unknown.rule.json',
        'schema://living-narrative-engine/rule.schema.json'
      );

      expect(errorMessage).toContain('Pre-validation failed');
      expect(errorMessage).toContain('root.actions[0]');
      expect(errorMessage).toContain('Unknown operation type');
      expect(errorMessage).toContain('Valid operation types include:');
    });
  });

  describe('Rule structure validation', () => {
    it('should validate complete handle_open_container rule structure', () => {
      // Verify the rule has all required fields
      expect(ruleData).toHaveProperty('rule_id');
      expect(ruleData).toHaveProperty('event_type');
      expect(ruleData).toHaveProperty('actions');

      expect(ruleData.rule_id).toBe('handle_open_container');
      expect(ruleData.event_type).toBe('core:attempt_action');
      expect(Array.isArray(ruleData.actions)).toBe(true);
      expect(ruleData.actions.length).toBeGreaterThan(0);

      // Verify first action is OPEN_CONTAINER
      expect(ruleData.actions[0].type).toBe('OPEN_CONTAINER');
      expect(ruleData.actions[0].parameters).toBeDefined();
    });

    it('should validate all operations in the actual rule file', () => {
      const result = validateRuleStructure(
        ruleData,
        'handle_open_container.rule.json'
      );

      // Detailed error reporting for debugging
      if (!result.isValid) {
        console.error('Validation failed:', {
          error: result.error,
          path: result.path,
          suggestions: result.suggestions,
        });
      }

      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('Integration with operation registry', () => {
    it('should verify OPEN_CONTAINER operation can be used in rules', () => {
      // This test verifies that once OPEN_CONTAINER is added to KNOWN_OPERATION_TYPES,
      // it will be recognized as valid during pre-validation
      const simpleRule = {
        event_type: 'core:test',
        actions: [
          {
            type: 'OPEN_CONTAINER',
            comment: 'Test operation',
            parameters: {
              actorEntity: 'test_actor',
              containerEntity: 'test_container',
              result_variable: 'result',
            },
          },
        ],
      };

      const result = performPreValidation(
        simpleRule,
        'schema://living-narrative-engine/rule.schema.json',
        'test.rule.json'
      );

      expect(result.isValid).toBe(true);
    });
  });
});
