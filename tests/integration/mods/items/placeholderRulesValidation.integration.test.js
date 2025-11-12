/**
 * @file Integration test to verify placeholder rules use valid LOG operation type
 * Reproduces the runtime error where LOG_MESSAGE was used instead of LOG
 * Tests that handle_aim_item and handle_lower_aim rules load without validation errors
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  validateRuleStructure,
  performPreValidation,
} from '../../../../src/utils/preValidationUtils.js';
import { validateAgainstSchema } from '../../../../src/utils/schemaValidationUtils.js';
import fs from 'fs';
import path from 'path';

describe('Placeholder Rules Validation', () => {
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
      expect(aimItemRule.rule_id).toBe('items:handle_aim_item');
      expect(aimItemRule.event_type).toBe('core:attempt_action');
      expect(aimItemRule.actions).toBeInstanceOf(Array);
      expect(aimItemRule.actions.length).toBeGreaterThan(0);
    });

    it('should use LOG operation type (not LOG_MESSAGE)', () => {
      const firstAction = aimItemRule.actions[0];
      expect(firstAction).toBeDefined();
      expect(firstAction.type).toBe('LOG');
    });

    it('should have valid LOG operation parameters', () => {
      const logOperation = aimItemRule.actions[0];
      expect(logOperation.parameters).toBeDefined();
      expect(logOperation.parameters.message).toBeDefined();
      expect(typeof logOperation.parameters.message).toBe('string');
      expect(logOperation.parameters.message.length).toBeGreaterThan(0);

      // level is optional, but if present should be one of: debug, info, warn, error
      if (logOperation.parameters.level) {
        expect(['debug', 'info', 'warn', 'error']).toContain(
          logOperation.parameters.level
        );
      }
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
      expect(lowerAimRule.rule_id).toBe('items:handle_lower_aim');
      expect(lowerAimRule.event_type).toBe('core:attempt_action');
      expect(lowerAimRule.actions).toBeInstanceOf(Array);
      expect(lowerAimRule.actions.length).toBeGreaterThan(0);
    });

    it('should use LOG operation type (not LOG_MESSAGE)', () => {
      const firstAction = lowerAimRule.actions[0];
      expect(firstAction).toBeDefined();
      expect(firstAction.type).toBe('LOG');
    });

    it('should have valid LOG operation parameters', () => {
      const logOperation = lowerAimRule.actions[0];
      expect(logOperation.parameters).toBeDefined();
      expect(logOperation.parameters.message).toBeDefined();
      expect(typeof logOperation.parameters.message).toBe('string');
      expect(logOperation.parameters.message.length).toBeGreaterThan(0);

      // level is optional, but if present should be one of: debug, info, warn, error
      if (logOperation.parameters.level) {
        expect(['debug', 'info', 'warn', 'error']).toContain(
          logOperation.parameters.level
        );
      }
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
    it('both placeholder rules should use the same LOG operation type', () => {
      const aimOperation = aimItemRule.actions[0];
      const lowerOperation = lowerAimRule.actions[0];

      expect(aimOperation.type).toBe(lowerOperation.type);
      expect(aimOperation.type).toBe('LOG');
    });

    it('both placeholder rules should have similar LOG parameter structures', () => {
      const aimParams = aimItemRule.actions[0].parameters;
      const lowerParams = lowerAimRule.actions[0].parameters;

      // Both should have message parameter
      expect(aimParams).toHaveProperty('message');
      expect(lowerParams).toHaveProperty('message');

      // Both should have same level if specified
      if (aimParams.level && lowerParams.level) {
        expect(aimParams.level).toBe(lowerParams.level);
      }
    });
  });
});
