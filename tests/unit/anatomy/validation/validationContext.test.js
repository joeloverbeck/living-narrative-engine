import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ValidationContext } from '../../../../src/anatomy/validation/validationContext.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

describe('ValidationContext', () => {
  let mockEntityManager;
  let mockLogger;
  let contextParams;

  beforeEach(() => {
    // Create mocks
    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
    };

    // Default context parameters
    contextParams = {
      entityIds: ['entity-1', 'entity-2'],
      recipe: { name: 'test-recipe' },
      socketOccupancy: new Set(['parent:socket']),
      entityManager: mockEntityManager,
      logger: mockLogger,
    };
  });

  describe('constructor', () => {
    it('should create context with valid parameters', () => {
      const context = new ValidationContext(contextParams);

      expect(context.entityIds).toEqual(['entity-1', 'entity-2']);
      expect(context.recipe).toEqual({ name: 'test-recipe' });
      expect(context.socketOccupancy).toBe(contextParams.socketOccupancy);
      expect(context.entityManager).toBe(mockEntityManager);
      expect(context.logger).toBe(mockLogger);
    });

    it('should throw error if entityIds is missing', () => {
      delete contextParams.entityIds;
      expect(() => new ValidationContext(contextParams)).toThrow(InvalidArgumentError);
    });

    it('should throw error if recipe is missing', () => {
      delete contextParams.recipe;
      expect(() => new ValidationContext(contextParams)).toThrow(InvalidArgumentError);
    });

    it('should throw error if socketOccupancy is missing', () => {
      delete contextParams.socketOccupancy;
      expect(() => new ValidationContext(contextParams)).toThrow(InvalidArgumentError);
    });

    it('should throw error if entityManager is missing', () => {
      delete contextParams.entityManager;
      expect(() => new ValidationContext(contextParams)).toThrow(InvalidArgumentError);
    });

    it('should throw error if logger is missing', () => {
      delete contextParams.logger;
      expect(() => new ValidationContext(contextParams)).toThrow(InvalidArgumentError);
    });
  });

  describe('issue management', () => {
    let context;

    beforeEach(() => {
      context = new ValidationContext(contextParams);
    });

    it('should add and retrieve issues', () => {
      const issues = [
        {
          severity: 'error',
          message: 'Test error',
          ruleId: 'test-rule',
          context: {},
        },
        {
          severity: 'warning',
          message: 'Test warning',
          ruleId: 'test-rule',
          context: {},
        },
      ];

      context.addIssues(issues);
      expect(context.getIssues()).toEqual(issues);
    });

    it('should filter issues by severity', () => {
      const errorIssue = {
        severity: 'error',
        message: 'Test error',
        ruleId: 'test-rule',
      };
      const warningIssue = {
        severity: 'warning',
        message: 'Test warning',
        ruleId: 'test-rule',
      };

      context.addIssues([errorIssue, warningIssue]);

      expect(context.getIssuesBySeverity('error')).toEqual([errorIssue]);
      expect(context.getIssuesBySeverity('warning')).toEqual([warningIssue]);
    });

    it('should get error messages', () => {
      context.addIssues([
        { severity: 'error', message: 'Error 1', ruleId: 'rule1' },
        { severity: 'error', message: 'Error 2', ruleId: 'rule2' },
        { severity: 'warning', message: 'Warning 1', ruleId: 'rule3' },
      ]);

      expect(context.getErrors()).toEqual(['Error 1', 'Error 2']);
    });

    it('should get warning messages', () => {
      context.addIssues([
        { severity: 'error', message: 'Error 1', ruleId: 'rule1' },
        { severity: 'warning', message: 'Warning 1', ruleId: 'rule2' },
        { severity: 'warning', message: 'Warning 2', ruleId: 'rule3' },
      ]);

      expect(context.getWarnings()).toEqual(['Warning 1', 'Warning 2']);
    });

    it('should check if has errors', () => {
      expect(context.hasErrors()).toBe(false);

      context.addIssues([{ severity: 'warning', message: 'Warning', ruleId: 'rule1' }]);
      expect(context.hasErrors()).toBe(false);

      context.addIssues([{ severity: 'error', message: 'Error', ruleId: 'rule2' }]);
      expect(context.hasErrors()).toBe(true);
    });
  });

  describe('metadata management', () => {
    let context;

    beforeEach(() => {
      context = new ValidationContext(contextParams);
    });

    it('should store and retrieve metadata', () => {
      context.setMetadata('key1', 'value1');
      context.setMetadata('key2', { nested: 'object' });

      expect(context.getMetadata('key1')).toBe('value1');
      expect(context.getMetadata('key2')).toEqual({ nested: 'object' });
    });

    it('should return undefined for non-existent metadata', () => {
      expect(context.getMetadata('nonexistent')).toBeUndefined();
    });
  });

  describe('getResult', () => {
    let context;

    beforeEach(() => {
      context = new ValidationContext(contextParams);
    });

    it('should return valid result with no issues', () => {
      const result = context.getResult();

      expect(result).toEqual({
        valid: true,
        errors: [],
        warnings: [],
      });
    });

    it('should return invalid result with errors', () => {
      context.addIssues([
        { severity: 'error', message: 'Error 1', ruleId: 'rule1' },
        { severity: 'error', message: 'Error 2', ruleId: 'rule2' },
      ]);

      const result = context.getResult();

      expect(result).toEqual({
        valid: false,
        errors: ['Error 1', 'Error 2'],
        warnings: [],
      });
    });

    it('should return valid result with only warnings', () => {
      context.addIssues([
        { severity: 'warning', message: 'Warning 1', ruleId: 'rule1' },
        { severity: 'warning', message: 'Warning 2', ruleId: 'rule2' },
      ]);

      const result = context.getResult();

      expect(result).toEqual({
        valid: true,
        errors: [],
        warnings: ['Warning 1', 'Warning 2'],
      });
    });

    it('should handle mixed errors and warnings', () => {
      context.addIssues([
        { severity: 'error', message: 'Error 1', ruleId: 'rule1' },
        { severity: 'warning', message: 'Warning 1', ruleId: 'rule2' },
        { severity: 'error', message: 'Error 2', ruleId: 'rule3' },
      ]);

      const result = context.getResult();

      expect(result).toEqual({
        valid: false,
        errors: ['Error 1', 'Error 2'],
        warnings: ['Warning 1'],
      });
    });
  });
});