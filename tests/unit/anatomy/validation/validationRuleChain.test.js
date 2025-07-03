import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ValidationRuleChain } from '../../../../src/anatomy/validation/validationRuleChain.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

describe('ValidationRuleChain', () => {
  let chain;
  let mockLogger;
  let mockContext;

  beforeEach(() => {
    // Create mocks
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
    };

    mockContext = {
      addIssues: jest.fn(),
      getResult: jest.fn().mockReturnValue({
        errors: [],
        warnings: [],
      }),
    };

    // Create chain instance
    chain = new ValidationRuleChain({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should throw error if logger is not provided', () => {
      expect(() => new ValidationRuleChain({})).toThrow(InvalidArgumentError);
    });
  });

  describe('addRule', () => {
    it('should add rule to chain', () => {
      const mockRule = {
        ruleName: 'Test Rule',
        validate: jest.fn(),
      };

      const result = chain.addRule(mockRule);

      expect(result).toBe(chain); // Should return self for chaining
      expect(chain.getRuleCount()).toBe(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "ValidationRuleChain: Added rule 'Test Rule' to chain"
      );
    });

    it('should throw error if rule is not provided', () => {
      expect(() => chain.addRule(null)).toThrow(InvalidArgumentError);
    });

    it('should throw error if rule does not implement validate method', () => {
      const invalidRule = { ruleName: 'Invalid Rule' };
      expect(() => chain.addRule(invalidRule)).toThrow(InvalidArgumentError);
    });

    it('should support method chaining', () => {
      const rule1 = { ruleName: 'Rule 1', validate: jest.fn() };
      const rule2 = { ruleName: 'Rule 2', validate: jest.fn() };

      chain.addRule(rule1).addRule(rule2);

      expect(chain.getRuleCount()).toBe(2);
      expect(chain.getRuleNames()).toEqual(['Rule 1', 'Rule 2']);
    });
  });

  describe('execute', () => {
    it('should execute all rules in order', async () => {
      const rule1 = {
        ruleId: 'rule-1',
        ruleName: 'Rule 1',
        shouldApply: jest.fn().mockReturnValue(true),
        validate: jest.fn().mockResolvedValue([]),
      };

      const rule2 = {
        ruleId: 'rule-2',
        ruleName: 'Rule 2',
        shouldApply: jest.fn().mockReturnValue(true),
        validate: jest.fn().mockResolvedValue([
          { severity: 'error', message: 'Test error', ruleId: 'rule-2' },
        ]),
      };

      chain.addRule(rule1).addRule(rule2);

      await chain.execute(mockContext);

      expect(rule1.shouldApply).toHaveBeenCalledWith(mockContext);
      expect(rule1.validate).toHaveBeenCalledWith(mockContext);
      expect(rule2.shouldApply).toHaveBeenCalledWith(mockContext);
      expect(rule2.validate).toHaveBeenCalledWith(mockContext);
      expect(mockContext.addIssues).toHaveBeenCalledWith([
        { severity: 'error', message: 'Test error', ruleId: 'rule-2' },
      ]);
    });

    it('should skip rules when shouldApply returns false', async () => {
      const rule = {
        ruleId: 'rule-1',
        ruleName: 'Rule 1',
        shouldApply: jest.fn().mockReturnValue(false),
        validate: jest.fn(),
      };

      chain.addRule(rule);
      await chain.execute(mockContext);

      expect(rule.shouldApply).toHaveBeenCalledWith(mockContext);
      expect(rule.validate).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "ValidationRuleChain: Skipping rule 'Rule 1' - shouldApply returned false"
      );
    });

    it('should handle rule errors gracefully', async () => {
      const error = new Error('Rule execution failed');
      const rule = {
        ruleId: 'failing-rule',
        ruleName: 'Failing Rule',
        shouldApply: jest.fn().mockReturnValue(true),
        validate: jest.fn().mockRejectedValue(error),
      };

      chain.addRule(rule);
      await chain.execute(mockContext);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "ValidationRuleChain: Error executing rule 'Failing Rule'",
        { error: error.message, stack: error.stack }
      );
      expect(mockContext.addIssues).toHaveBeenCalledWith([
        {
          severity: 'error',
          message: "Validation rule 'Failing Rule' failed: Rule execution failed",
          ruleId: 'failing-rule',
          context: { error: 'Rule execution failed' },
        },
      ]);
    });

    it('should throw error if context is not provided', async () => {
      await expect(chain.execute(null)).rejects.toThrow(InvalidArgumentError);
    });

    it('should handle empty rule chain', async () => {
      await chain.execute(mockContext);

      expect(mockContext.addIssues).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ValidationRuleChain: Executing 0 validation rules'
      );
    });

    it('should log debug messages for successful execution', async () => {
      mockContext.getResult.mockReturnValue({
        errors: ['Error 1', 'Error 2'],
        warnings: ['Warning 1'],
      });

      await chain.execute(mockContext);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ValidationRuleChain: Completed validation with 2 errors and 1 warnings'
      );
    });
  });

  describe('getRuleCount', () => {
    it('should return the number of rules in chain', () => {
      expect(chain.getRuleCount()).toBe(0);

      chain.addRule({ ruleName: 'Rule 1', validate: jest.fn() });
      expect(chain.getRuleCount()).toBe(1);

      chain.addRule({ ruleName: 'Rule 2', validate: jest.fn() });
      expect(chain.getRuleCount()).toBe(2);
    });
  });

  describe('getRuleNames', () => {
    it('should return array of rule names', () => {
      expect(chain.getRuleNames()).toEqual([]);

      chain.addRule({ ruleName: 'Rule A', validate: jest.fn() });
      chain.addRule({ ruleName: 'Rule B', validate: jest.fn() });

      expect(chain.getRuleNames()).toEqual(['Rule A', 'Rule B']);
    });
  });
});