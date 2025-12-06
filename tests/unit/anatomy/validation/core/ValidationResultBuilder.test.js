import { describe, it, expect, beforeEach } from '@jest/globals';
import ValidationResultBuilder from '../../../../../src/anatomy/validation/core/ValidationResultBuilder.js';

describe('ValidationResultBuilder', () => {
  describe('Constructor', () => {
    it('should create builder with required recipeId', () => {
      const builder = new ValidationResultBuilder('test-recipe');
      const result = builder.build();

      expect(result.recipeId).toBe('test-recipe');
      expect(result.recipePath).toBeUndefined();
      expect(result.timestamp).toBeDefined();
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.suggestions).toEqual([]);
      expect(result.passed).toEqual([]);
      expect(result.isValid).toBe(true);
    });

    it('should create builder with recipeId and recipePath', () => {
      const builder = new ValidationResultBuilder(
        'test-recipe',
        'path/to/recipe.json'
      );
      const result = builder.build();

      expect(result.recipeId).toBe('test-recipe');
      expect(result.recipePath).toBe('path/to/recipe.json');
    });

    it('should generate ISO timestamp in constructor', () => {
      const before = new Date().toISOString();
      const builder = new ValidationResultBuilder('test-recipe');
      const after = new Date().toISOString();
      const result = builder.build();

      expect(result.timestamp).toBeDefined();
      expect(result.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
      expect(result.timestamp >= before).toBe(true);
      expect(result.timestamp <= after).toBe(true);
    });

    it('should throw error if recipeId is not provided', () => {
      expect(() => new ValidationResultBuilder()).toThrow(
        'recipeId is required and must be a non-blank string'
      );
    });

    it('should throw error if recipeId is null', () => {
      expect(() => new ValidationResultBuilder(null)).toThrow(
        'recipeId is required and must be a non-blank string'
      );
    });

    it('should throw error if recipeId is empty string', () => {
      expect(() => new ValidationResultBuilder('')).toThrow(
        'recipeId is required and must be a non-blank string'
      );
    });

    it('should throw error if recipeId is whitespace only', () => {
      expect(() => new ValidationResultBuilder('   ')).toThrow(
        'recipeId is required and must be a non-blank string'
      );
    });

    it('should throw error if recipeId is not a string', () => {
      expect(() => new ValidationResultBuilder(123)).toThrow(
        'recipeId is required and must be a non-blank string'
      );
    });
  });

  describe('addError', () => {
    let builder;

    beforeEach(() => {
      builder = new ValidationResultBuilder('test-recipe');
    });

    it('should add error to errors array', () => {
      builder.addError('ERROR_TYPE', 'Error message');
      const result = builder.build();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        type: 'ERROR_TYPE',
        severity: 'error',
        message: 'Error message',
      });
    });

    it('should add error with metadata', () => {
      builder.addError('ERROR_TYPE', 'Error message', {
        componentId: 'body',
        fix: 'Add component',
      });
      const result = builder.build();

      expect(result.errors[0]).toEqual({
        type: 'ERROR_TYPE',
        severity: 'error',
        message: 'Error message',
        componentId: 'body',
        fix: 'Add component',
      });
    });

    it('should return this for method chaining', () => {
      const returnValue = builder.addError('ERROR_TYPE', 'Error message');
      expect(returnValue).toBe(builder);
    });

    it('should set isValid to false when errors present', () => {
      builder.addError('ERROR_TYPE', 'Error message');
      const result = builder.build();

      expect(result.isValid).toBe(false);
    });

    it('should add multiple errors', () => {
      builder
        .addError('ERROR_1', 'Error 1')
        .addError('ERROR_2', 'Error 2')
        .addError('ERROR_3', 'Error 3');
      const result = builder.build();

      expect(result.errors).toHaveLength(3);
      expect(result.errors[0].type).toBe('ERROR_1');
      expect(result.errors[1].type).toBe('ERROR_2');
      expect(result.errors[2].type).toBe('ERROR_3');
    });
  });

  describe('addWarning', () => {
    let builder;

    beforeEach(() => {
      builder = new ValidationResultBuilder('test-recipe');
    });

    it('should add warning to warnings array', () => {
      builder.addWarning('WARNING_TYPE', 'Warning message');
      const result = builder.build();

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toEqual({
        type: 'WARNING_TYPE',
        severity: 'warning',
        message: 'Warning message',
      });
    });

    it('should add warning with metadata', () => {
      builder.addWarning('WARNING_TYPE', 'Warning message', {
        suggestion: 'Consider updating',
      });
      const result = builder.build();

      expect(result.warnings[0]).toEqual({
        type: 'WARNING_TYPE',
        severity: 'warning',
        message: 'Warning message',
        suggestion: 'Consider updating',
      });
    });

    it('should return this for method chaining', () => {
      const returnValue = builder.addWarning('WARNING_TYPE', 'Warning message');
      expect(returnValue).toBe(builder);
    });

    it('should not affect isValid when only warnings present', () => {
      builder.addWarning('WARNING_TYPE', 'Warning message');
      const result = builder.build();

      expect(result.isValid).toBe(true);
    });

    it('should add multiple warnings', () => {
      builder
        .addWarning('WARNING_1', 'Warning 1')
        .addWarning('WARNING_2', 'Warning 2');
      const result = builder.build();

      expect(result.warnings).toHaveLength(2);
    });
  });

  describe('addInfo', () => {
    let builder;

    beforeEach(() => {
      builder = new ValidationResultBuilder('test-recipe');
    });

    it('should add info to suggestions array (not infos)', () => {
      builder.addInfo('INFO_TYPE', 'Info message');
      const result = builder.build();

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]).toEqual({
        type: 'INFO_TYPE',
        severity: 'info',
        message: 'Info message',
      });
      expect(result.infos).toBeUndefined();
    });

    it('should add info with metadata', () => {
      builder.addInfo('INFO_TYPE', 'Info message', {
        optimization: 'Use property X',
      });
      const result = builder.build();

      expect(result.suggestions[0]).toEqual({
        type: 'INFO_TYPE',
        severity: 'info',
        message: 'Info message',
        optimization: 'Use property X',
      });
    });

    it('should return this for method chaining', () => {
      const returnValue = builder.addInfo('INFO_TYPE', 'Info message');
      expect(returnValue).toBe(builder);
    });

    it('should not affect isValid when only info present', () => {
      builder.addInfo('INFO_TYPE', 'Info message');
      const result = builder.build();

      expect(result.isValid).toBe(true);
    });

    it('should add multiple info messages', () => {
      builder.addInfo('INFO_1', 'Info 1').addInfo('INFO_2', 'Info 2');
      const result = builder.build();

      expect(result.suggestions).toHaveLength(2);
    });
  });

  describe('addSuggestion', () => {
    let builder;

    beforeEach(() => {
      builder = new ValidationResultBuilder('test-recipe');
    });

    it('adds suggestion without severity for legacy compatibility', () => {
      builder.addSuggestion('MISSING_DESCRIPTORS', 'Add descriptors', {
        reason: 'Missing descriptors',
        location: { type: 'slot', name: 'torso' },
      });

      const result = builder.build();
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]).toEqual({
        type: 'MISSING_DESCRIPTORS',
        message: 'Add descriptors',
        reason: 'Missing descriptors',
        location: { type: 'slot', name: 'torso' },
      });
      expect(result.suggestions[0]).not.toHaveProperty('severity');
    });

    it('returns builder to allow chaining', () => {
      const returnValue = builder.addSuggestion('TYPE', 'Message');
      expect(returnValue).toBe(builder);
    });

    it('supports multiple suggestions', () => {
      builder
        .addSuggestion('S1', 'Suggestion 1')
        .addSuggestion('S2', 'Suggestion 2');

      const result = builder.build();
      expect(result.suggestions).toHaveLength(2);
    });
  });

  describe('addIssues', () => {
    let builder;

    beforeEach(() => {
      builder = new ValidationResultBuilder('test-recipe');
    });

    it('should categorize issues by severity', () => {
      const issues = [
        { severity: 'error', type: 'ERR1', message: 'Error 1' },
        { severity: 'warning', type: 'WARN1', message: 'Warning 1' },
        { severity: 'info', type: 'INFO1', message: 'Info 1' },
      ];

      builder.addIssues(issues);
      const result = builder.build();

      expect(result.errors).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
      expect(result.suggestions).toHaveLength(1);
      expect(result.errors[0].type).toBe('ERR1');
      expect(result.warnings[0].type).toBe('WARN1');
      expect(result.suggestions[0].type).toBe('INFO1');
    });

    it('should return this for method chaining', () => {
      const returnValue = builder.addIssues([]);
      expect(returnValue).toBe(builder);
    });

    it('should handle empty issues array', () => {
      builder.addIssues([]);
      const result = builder.build();

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });

    it('should handle multiple errors in batch', () => {
      const issues = [
        { severity: 'error', type: 'ERR1', message: 'Error 1' },
        { severity: 'error', type: 'ERR2', message: 'Error 2' },
        { severity: 'error', type: 'ERR3', message: 'Error 3' },
      ];

      builder.addIssues(issues);
      const result = builder.build();

      expect(result.errors).toHaveLength(3);
    });

    it('should preserve issue metadata', () => {
      const issues = [
        {
          severity: 'error',
          type: 'ERR1',
          message: 'Error 1',
          componentId: 'body',
          fix: 'Add component',
        },
      ];

      builder.addIssues(issues);
      const result = builder.build();

      expect(result.errors[0]).toEqual({
        severity: 'error',
        type: 'ERR1',
        message: 'Error 1',
        componentId: 'body',
        fix: 'Add component',
      });
    });

    it('should ignore issues with unknown severity', () => {
      const issues = [
        { severity: 'critical', type: 'CRIT1', message: 'Critical 1' },
        { severity: 'error', type: 'ERR1', message: 'Error 1' },
      ];

      builder.addIssues(issues);
      const result = builder.build();

      expect(result.errors).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });
  });

  describe('addPassed', () => {
    let builder;

    beforeEach(() => {
      builder = new ValidationResultBuilder('test-recipe');
    });

    it('should add passed message', () => {
      builder.addPassed('Validation check passed');
      const result = builder.build();

      expect(result.passed).toHaveLength(1);
      expect(result.passed[0]).toEqual({
        message: 'Validation check passed',
      });
    });

    it('should return this for method chaining', () => {
      const returnValue = builder.addPassed('Passed');
      expect(returnValue).toBe(builder);
    });

    it('should add multiple passed messages', () => {
      builder.addPassed('Check 1 passed').addPassed('Check 2 passed');
      const result = builder.build();

      expect(result.passed).toHaveLength(2);
      expect(result.passed[0].message).toBe('Check 1 passed');
      expect(result.passed[1].message).toBe('Check 2 passed');
    });
  });

  describe('setMetadata', () => {
    let builder;

    beforeEach(() => {
      builder = new ValidationResultBuilder('test-recipe');
    });

    it('should set metadata on result', () => {
      builder.setMetadata('validatorVersion', '1.0.0');
      const result = builder.build();

      expect(result.validatorVersion).toBe('1.0.0');
    });

    it('should return this for method chaining', () => {
      const returnValue = builder.setMetadata('key', 'value');
      expect(returnValue).toBe(builder);
    });

    it('should set multiple metadata fields', () => {
      builder
        .setMetadata('version', '1.0.0')
        .setMetadata('duration', 42)
        .setMetadata('validatedBy', 'PreflightValidator');
      const result = builder.build();

      expect(result.version).toBe('1.0.0');
      expect(result.duration).toBe(42);
      expect(result.validatedBy).toBe('PreflightValidator');
    });

    it('should spread metadata at top level of result', () => {
      builder.setMetadata('customField', 'customValue');
      const result = builder.build();

      expect(Object.keys(result)).toContain('customField');
      expect(result.customField).toBe('customValue');
    });

    it('should handle various metadata value types', () => {
      builder
        .setMetadata('string', 'value')
        .setMetadata('number', 42)
        .setMetadata('boolean', true)
        .setMetadata('array', [1, 2, 3])
        .setMetadata('object', { nested: 'value' });
      const result = builder.build();

      expect(result.string).toBe('value');
      expect(result.number).toBe(42);
      expect(result.boolean).toBe(true);
      expect(result.array).toEqual([1, 2, 3]);
      expect(result.object).toEqual({ nested: 'value' });
    });
  });

  describe('build', () => {
    it('should return frozen object', () => {
      const builder = new ValidationResultBuilder('test-recipe');
      const result = builder.build();

      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should prevent modification of result', () => {
      const builder = new ValidationResultBuilder('test-recipe');
      const result = builder.build();

      expect(() => {
        result.recipeId = 'modified';
      }).toThrow();
    });

    it('should calculate isValid as true when no errors', () => {
      const builder = new ValidationResultBuilder('test-recipe');
      builder.addWarning('WARN', 'Warning').addInfo('INFO', 'Info');
      const result = builder.build();

      expect(result.isValid).toBe(true);
    });

    it('should calculate isValid as false when errors present', () => {
      const builder = new ValidationResultBuilder('test-recipe');
      builder.addError('ERROR', 'Error');
      const result = builder.build();

      expect(result.isValid).toBe(false);
    });

    it('should include all required fields', () => {
      const builder = new ValidationResultBuilder('test-recipe', 'path.json');
      const result = builder.build();

      expect(result).toHaveProperty('recipeId');
      expect(result).toHaveProperty('recipePath');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('isValid');
    });

    it('should not have infos property', () => {
      const builder = new ValidationResultBuilder('test-recipe');
      builder.addInfo('INFO', 'Info message');
      const result = builder.build();

      expect(result).not.toHaveProperty('infos');
      expect(result).toHaveProperty('suggestions');
    });
  });

  describe('Method Chaining', () => {
    it('should chain all methods together', () => {
      const result = new ValidationResultBuilder('test-recipe', 'path.json')
        .addError('ERROR', 'Error message')
        .addWarning('WARNING', 'Warning message')
        .addInfo('INFO', 'Info message')
        .addPassed('Passed check')
        .setMetadata('version', '1.0.0')
        .build();

      expect(result.errors).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
      expect(result.suggestions).toHaveLength(1);
      expect(result.passed).toHaveLength(1);
      expect(result.version).toBe('1.0.0');
    });

    it('should chain multiple calls of same method', () => {
      const result = new ValidationResultBuilder('test-recipe')
        .addError('ERROR_1', 'Error 1')
        .addError('ERROR_2', 'Error 2')
        .addWarning('WARNING_1', 'Warning 1')
        .addWarning('WARNING_2', 'Warning 2')
        .build();

      expect(result.errors).toHaveLength(2);
      expect(result.warnings).toHaveLength(2);
    });
  });

  describe('Static success method', () => {
    it('should create successful validation result', () => {
      const result = ValidationResultBuilder.success('test-recipe');

      expect(result.recipeId).toBe('test-recipe');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.suggestions).toEqual([]);
      expect(result.passed).toEqual([]);
    });

    it('should accept recipePath', () => {
      const result = ValidationResultBuilder.success(
        'test-recipe',
        'path/to/recipe.json'
      );

      expect(result.recipePath).toBe('path/to/recipe.json');
    });

    it('should accept metadata', () => {
      const result = ValidationResultBuilder.success(
        'test-recipe',
        'path.json',
        {
          validatorVersion: '1.0.0',
          duration: 42,
        }
      );

      expect(result.validatorVersion).toBe('1.0.0');
      expect(result.duration).toBe(42);
    });

    it('should return frozen result', () => {
      const result = ValidationResultBuilder.success('test-recipe');
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should have all required fields', () => {
      const result = ValidationResultBuilder.success('test-recipe');

      expect(result).toHaveProperty('recipeId');
      expect(result).toHaveProperty('recipePath');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('isValid');
    });

    it('should handle empty metadata object', () => {
      const result = ValidationResultBuilder.success(
        'test-recipe',
        undefined,
        {}
      );
      expect(result.isValid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty builder', () => {
      const builder = new ValidationResultBuilder('test-recipe');
      const result = builder.build();

      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.suggestions).toEqual([]);
      expect(result.passed).toEqual([]);
      expect(result.isValid).toBe(true);
    });

    it('should handle large metadata objects', () => {
      const builder = new ValidationResultBuilder('test-recipe');
      const largeMetadata = {};
      for (let i = 0; i < 100; i++) {
        largeMetadata[`field${i}`] = `value${i}`;
      }

      for (const [key, value] of Object.entries(largeMetadata)) {
        builder.setMetadata(key, value);
      }

      const result = builder.build();
      expect(result.field0).toBe('value0');
      expect(result.field99).toBe('value99');
    });

    it('should handle special characters in messages', () => {
      const builder = new ValidationResultBuilder('test-recipe');
      builder.addError(
        'ERROR',
        'Error with "quotes", \'apostrophes\', and special chars: !@#$%^&*()'
      );
      const result = builder.build();

      expect(result.errors[0].message).toBe(
        'Error with "quotes", \'apostrophes\', and special chars: !@#$%^&*()'
      );
    });

    it('should handle Unicode characters in messages', () => {
      const builder = new ValidationResultBuilder('test-recipe');
      builder.addError('ERROR', '错误消息 🚨 émoji tëst');
      const result = builder.build();

      expect(result.errors[0].message).toBe('错误消息 🚨 émoji tëst');
    });

    it('should handle very long messages', () => {
      const builder = new ValidationResultBuilder('test-recipe');
      const longMessage = 'A'.repeat(10000);
      builder.addError('ERROR', longMessage);
      const result = builder.build();

      expect(result.errors[0].message).toBe(longMessage);
      expect(result.errors[0].message.length).toBe(10000);
    });

    it('should handle undefined recipePath gracefully', () => {
      const builder = new ValidationResultBuilder('test-recipe', undefined);
      const result = builder.build();

      expect(result.recipePath).toBeUndefined();
      expect(result.recipeId).toBe('test-recipe');
    });

    it('should handle null recipePath by storing as-is', () => {
      const builder = new ValidationResultBuilder('test-recipe', null);
      const result = builder.build();

      expect(result.recipePath).toBeNull();
    });

    it('should maintain separate issue arrays', () => {
      const builder = new ValidationResultBuilder('test-recipe');
      builder
        .addError('ERROR', 'Error')
        .addWarning('WARNING', 'Warning')
        .addInfo('INFO', 'Info');

      const result = builder.build();

      // Verify arrays are independent
      expect(result.errors).not.toBe(result.warnings);
      expect(result.errors).not.toBe(result.suggestions);
      expect(result.warnings).not.toBe(result.suggestions);
    });

    it('should handle mixed issue types in complex scenario', () => {
      const builder = new ValidationResultBuilder(
        'test-recipe',
        'complex.json'
      );

      builder
        .addError('ERR1', 'Critical error', { componentId: 'body' })
        .addError('ERR2', 'Another error', { fix: 'Add missing field' })
        .addWarning('WARN1', 'Potential issue')
        .addInfo('INFO1', 'Optimization suggestion')
        .addPassed('Component validation passed')
        .addPassed('Schema validation passed')
        .setMetadata('validatorVersion', '2.0.0')
        .setMetadata('duration', 125);

      const result = builder.build();

      expect(result.errors).toHaveLength(2);
      expect(result.warnings).toHaveLength(1);
      expect(result.suggestions).toHaveLength(1);
      expect(result.passed).toHaveLength(2);
      expect(result.isValid).toBe(false);
      expect(result.validatorVersion).toBe('2.0.0');
      expect(result.duration).toBe(125);
    });
  });
});
