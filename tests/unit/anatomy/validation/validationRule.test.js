import { beforeEach, describe, expect, it } from '@jest/globals';
import { ValidationRule } from '../../../../src/anatomy/validation/validationRule.js';

// Concrete implementation for testing non-abstract methods
class TestValidationRule extends ValidationRule {
  get ruleId() {
    return 'test-rule';
  }

  get ruleName() {
    return 'Test Rule';
  }

  async validate() {
    return [];
  }
}

describe('ValidationRule', () => {
  describe('abstract methods', () => {
    let rule;

    beforeEach(() => {
      rule = new ValidationRule();
    });

    it('should throw error when accessing abstract ruleId', () => {
      expect(() => rule.ruleId).toThrow(
        'ruleId must be implemented by subclass'
      );
    });

    it('should throw error when accessing abstract ruleName', () => {
      expect(() => rule.ruleName).toThrow(
        'ruleName must be implemented by subclass'
      );
    });

    it('should throw error when calling abstract validate method', async () => {
      await expect(rule.validate({})).rejects.toThrow(
        'validate must be implemented by subclass'
      );
    });
  });

  describe('shouldApply', () => {
    it('should return true by default', () => {
      const rule = new TestValidationRule();
      const mockContext = {
        entityIds: [],
        socketOccupancy: new Set(),
        entityManager: {},
        logger: {},
      };

      expect(rule.shouldApply(mockContext)).toBe(true);
    });
  });

  describe('helper methods', () => {
    let rule;

    beforeEach(() => {
      rule = new TestValidationRule();
    });

    describe('createError', () => {
      it('should create error with correct structure', () => {
        const error = rule.createError('Test error message');

        expect(error).toEqual({
          severity: 'error',
          message: 'Test error message',
          ruleId: 'test-rule',
          context: {},
        });
      });

      it('should include additional context when provided', () => {
        const additionalContext = { entityId: '123', socketId: 'socket-1' };
        const error = rule.createError('Test error message', additionalContext);

        expect(error).toEqual({
          severity: 'error',
          message: 'Test error message',
          ruleId: 'test-rule',
          context: additionalContext,
        });
      });
    });

    describe('createWarning', () => {
      it('should create warning with correct structure', () => {
        const warning = rule.createWarning('Test warning message');

        expect(warning).toEqual({
          severity: 'warning',
          message: 'Test warning message',
          ruleId: 'test-rule',
          context: {},
        });
      });

      it('should include additional context when provided', () => {
        const additionalContext = {
          entityId: '456',
          reason: 'missing component',
        };
        const warning = rule.createWarning(
          'Test warning message',
          additionalContext
        );

        expect(warning).toEqual({
          severity: 'warning',
          message: 'Test warning message',
          ruleId: 'test-rule',
          context: additionalContext,
        });
      });
    });

    describe('createInfo', () => {
      it('should create info with correct structure', () => {
        const info = rule.createInfo('Test info message');

        expect(info).toEqual({
          severity: 'info',
          message: 'Test info message',
          ruleId: 'test-rule',
          context: {},
        });
      });

      it('should include additional context when provided', () => {
        const additionalContext = {
          entityId: '789',
          detail: 'additional info',
        };
        const info = rule.createInfo('Test info message', additionalContext);

        expect(info).toEqual({
          severity: 'info',
          message: 'Test info message',
          ruleId: 'test-rule',
          context: additionalContext,
        });
      });
    });

    describe('helper methods with complex context', () => {
      it('should handle empty additional context object', () => {
        const error = rule.createError('Message', {});
        const warning = rule.createWarning('Message', {});
        const info = rule.createInfo('Message', {});

        expect(error.context).toEqual({});
        expect(warning.context).toEqual({});
        expect(info.context).toEqual({});
      });

      it('should handle nested context objects', () => {
        const complexContext = {
          entityId: '123',
          metadata: {
            type: 'anatomy',
            subtype: 'part',
          },
          errors: ['error1', 'error2'],
        };

        const error = rule.createError('Complex error', complexContext);

        expect(error.context).toEqual(complexContext);
        expect(error.context).toBe(complexContext); // Context is passed by reference
      });
    });
  });
});
