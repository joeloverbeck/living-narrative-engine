/**
 * @file Unit tests for BaseValidator
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BaseValidator } from '../../../../../src/anatomy/validation/validators/BaseValidator.js';
import ValidationResultBuilder from '../../../../../src/anatomy/validation/core/ValidationResultBuilder.js';
import { createTestBed } from '../../../../common/testBed.js';

/**
 * Concrete test implementation for testing abstract BaseValidator
 */
class TestValidator extends BaseValidator {
  #shouldThrow;
  #performValidationCalled;
  #lastRecipe;
  #lastOptions;
  #lastBuilder;

  constructor({ name, priority, failFast, logger, shouldThrow = false }) {
    super({ name, priority, failFast, logger });
    this.#shouldThrow = shouldThrow;
    this.#performValidationCalled = false;
    this.#lastRecipe = null;
    this.#lastOptions = null;
    this.#lastBuilder = null;
  }

  async performValidation(recipe, options, builder) {
    this.#performValidationCalled = true;
    this.#lastRecipe = recipe;
    this.#lastOptions = options;
    this.#lastBuilder = builder;

    if (this.#shouldThrow) {
      throw new Error('Test validation error');
    }

    // Add a test validation result
    builder.addPassed('Test validation passed');
  }

  get performValidationCalled() {
    return this.#performValidationCalled;
  }

  get lastRecipe() {
    return this.#lastRecipe;
  }

  get lastOptions() {
    return this.#lastOptions;
  }

  get lastBuilder() {
    return this.#lastBuilder;
  }
}

describe('BaseValidator', () => {
  let testBed;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
  });

  describe('Constructor Validation', () => {
    it('should create validator with valid parameters', () => {
      const validator = new TestValidator({
        name: 'test-validator',
        priority: 10,
        failFast: true,
        logger: mockLogger,
      });

      expect(validator.name).toBe('test-validator');
      expect(validator.priority).toBe(10);
      expect(validator.failFast).toBe(true);
    });

    it('should default failFast to false when not provided', () => {
      const validator = new TestValidator({
        name: 'test-validator',
        priority: 10,
        logger: mockLogger,
      });

      expect(validator.failFast).toBe(false);
    });

    it('should throw error for null name', () => {
      expect(() => {
        new TestValidator({
          name: null,
          priority: 10,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw error for empty string name', () => {
      expect(() => {
        new TestValidator({
          name: '',
          priority: 10,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw error for whitespace-only name', () => {
      expect(() => {
        new TestValidator({
          name: '   ',
          priority: 10,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw error for non-number priority', () => {
      expect(() => {
        new TestValidator({
          name: 'test-validator',
          priority: '10',
          logger: mockLogger,
        });
      }).toThrow('Validator priority must be a valid number');
    });

    it('should throw error for NaN priority', () => {
      expect(() => {
        new TestValidator({
          name: 'test-validator',
          priority: NaN,
          logger: mockLogger,
        });
      }).toThrow('Validator priority must be a valid number');
    });

    it('should throw error for non-boolean failFast', () => {
      expect(() => {
        new TestValidator({
          name: 'test-validator',
          priority: 10,
          failFast: 'true',
          logger: mockLogger,
        });
      }).toThrow('Validator failFast must be a boolean');
    });

    it('should throw error for invalid logger', () => {
      expect(() => {
        new TestValidator({
          name: 'test-validator',
          priority: 10,
          logger: {},
        });
      }).toThrow();
    });

    it('should throw error for null logger', () => {
      expect(() => {
        new TestValidator({
          name: 'test-validator',
          priority: 10,
          logger: null,
        });
      }).toThrow();
    });
  });

  describe('Getter Methods', () => {
    let validator;

    beforeEach(() => {
      validator = new TestValidator({
        name: 'test-validator',
        priority: 25,
        failFast: true,
        logger: mockLogger,
      });
    });

    it('should return correct name', () => {
      expect(validator.name).toBe('test-validator');
    });

    it('should return correct priority', () => {
      expect(validator.priority).toBe(25);
    });

    it('should return correct failFast value', () => {
      expect(validator.failFast).toBe(true);
    });

    it('should return false for failFast when not provided', () => {
      const validator2 = new TestValidator({
        name: 'test-validator-2',
        priority: 10,
        logger: mockLogger,
      });

      expect(validator2.failFast).toBe(false);
    });
  });

  describe('Template Method Execution', () => {
    let validator;
    let recipe;

    beforeEach(() => {
      validator = new TestValidator({
        name: 'test-validator',
        priority: 10,
        logger: mockLogger,
      });

      recipe = {
        recipeId: 'test-recipe',
        parts: [],
      };
    });

    it('should call performValidation with correct parameters', async () => {
      const options = { recipePath: 'test/path.json' };
      await validator.validate(recipe, options);

      expect(validator.performValidationCalled).toBe(true);
      expect(validator.lastRecipe).toBe(recipe);
      expect(validator.lastOptions).toBe(options);
    });

    it('should pass ValidationResultBuilder to performValidation', async () => {
      await validator.validate(recipe);

      expect(validator.lastBuilder).toBeInstanceOf(ValidationResultBuilder);
    });

    it('should return built result object', async () => {
      const result = await validator.validate(recipe);

      expect(result).toBeDefined();
      expect(result.recipeId).toBe('test-recipe');
      expect(result.isValid).toBe(true);
      expect(result.passed).toHaveLength(1);
      expect(result.passed[0].message).toBe('Test validation passed');
    });

    it('should return frozen result object', async () => {
      const result = await validator.validate(recipe);

      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should handle empty options parameter', async () => {
      const result = await validator.validate(recipe);

      expect(result).toBeDefined();
      expect(validator.lastOptions).toEqual({});
    });

    it('should initialize builder with recipeId', async () => {
      const result = await validator.validate(recipe);

      expect(result.recipeId).toBe('test-recipe');
    });

    it('should initialize builder with recipePath from options', async () => {
      const result = await validator.validate(recipe, {
        recipePath: 'data/recipes/test.json',
      });

      expect(result.recipePath).toBe('data/recipes/test.json');
    });
  });

  describe('Exception Handling', () => {
    let throwingValidator;
    let recipe;

    beforeEach(() => {
      throwingValidator = new TestValidator({
        name: 'throwing-validator',
        priority: 10,
        logger: mockLogger,
        shouldThrow: true,
      });

      recipe = {
        recipeId: 'test-recipe',
        parts: [],
      };
    });

    it('should catch exceptions from performValidation', async () => {
      // Should not throw - exception should be caught
      const result = await throwingValidator.validate(recipe);

      expect(result).toBeDefined();
    });

    it('should wrap exception in VALIDATOR_EXCEPTION error', async () => {
      const result = await throwingValidator.validate(recipe);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('VALIDATOR_EXCEPTION');
    });

    it('should log error with context', async () => {
      await throwingValidator.validate(recipe);

      expect(mockLogger.error).toHaveBeenCalled();
      const errorCall = mockLogger.error.mock.calls[0];
      expect(errorCall[0]).toContain('throwing-validator');
      expect(errorCall[0]).toContain('test-recipe');
    });

    it('should return error result instead of throwing', async () => {
      const result = await throwingValidator.validate(recipe);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should include error metadata in result', async () => {
      const result = await throwingValidator.validate(recipe);

      const error = result.errors[0];
      expect(error.validatorName).toBe('throwing-validator');
      expect(error.recipeId).toBe('test-recipe');
      expect(error.errorType).toBe('Error');
      expect(error.errorMessage).toBe('Test validation error');
      expect(error.errorStack).toBeDefined();
    });

    it('should include error message in result', async () => {
      const result = await throwingValidator.validate(recipe);

      const error = result.errors[0];
      expect(error.message).toContain('Validation failed with exception');
      expect(error.message).toContain('Test validation error');
    });

    it('should handle different exception types', async () => {
      class CustomValidator extends BaseValidator {
        // eslint-disable-next-line no-unused-vars
        async performValidation(_recipe, _options, _builder) {
          throw new TypeError('Type error in validation');
        }
      }

      const validator = new CustomValidator({
        name: 'custom-validator',
        priority: 10,
        logger: mockLogger,
      });

      const result = await validator.validate(recipe);

      expect(result.isValid).toBe(false);
      expect(result.errors[0].errorType).toBe('TypeError');
      expect(result.errors[0].errorMessage).toBe('Type error in validation');
    });
  });

  describe('Abstract Method Enforcement', () => {
    it('should throw error when performValidation not overridden', async () => {
      // Create a subclass that doesn't implement performValidation
      class EmptyValidator extends BaseValidator {}

      const validator = new EmptyValidator({
        name: 'empty-validator',
        priority: 10,
        logger: mockLogger,
      });

      const recipe = { recipeId: 'test-recipe' };

      // The error should be caught and wrapped
      const result = await validator.validate(recipe);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('not implemented');
    });

    it('should include class name in error message', async () => {
      class IncompleteValidator extends BaseValidator {
        // Intentionally not implementing performValidation
      }

      const validator = new IncompleteValidator({
        name: 'incomplete-validator',
        priority: 10,
        logger: mockLogger,
      });

      const recipe = { recipeId: 'test-recipe' };
      const result = await validator.validate(recipe);

      expect(result.errors[0].message).toContain('IncompleteValidator');
    });

    it('should provide helpful error message for subclasses', async () => {
      class IncompleteValidator extends BaseValidator {
        // Intentionally not implementing performValidation
      }

      const validator = new IncompleteValidator({
        name: 'incomplete-validator',
        priority: 10,
        logger: mockLogger,
      });

      const recipe = { recipeId: 'test-recipe' };
      const result = await validator.validate(recipe);

      expect(result.errors[0].message).toContain('performValidation');
      expect(result.errors[0].message).toContain('override');
    });
  });

  describe('Integration with ValidationResultBuilder', () => {
    let validator;
    let recipe;

    beforeEach(() => {
      validator = new TestValidator({
        name: 'test-validator',
        priority: 10,
        logger: mockLogger,
      });

      recipe = {
        recipeId: 'test-recipe',
        parts: [],
      };
    });

    it('should properly initialize builder with recipeId', async () => {
      const result = await validator.validate(recipe);

      expect(result.recipeId).toBe('test-recipe');
    });

    it('should pass recipePath from options to builder', async () => {
      const result = await validator.validate(recipe, {
        recipePath: 'data/recipes/test.json',
      });

      expect(result.recipePath).toBe('data/recipes/test.json');
    });

    it('should return frozen result object', async () => {
      const result = await validator.validate(recipe);

      expect(Object.isFrozen(result)).toBe(true);
    });

    it('should preserve result structure from builder', async () => {
      const result = await validator.validate(recipe);

      expect(result).toHaveProperty('recipeId');
      expect(result).toHaveProperty('recipePath');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('isValid');
    });

    it('should allow subclass to add multiple result types', async () => {
      class MultiResultValidator extends BaseValidator {
        async performValidation(_recipe, _options, builder) {
          builder.addPassed('Check 1 passed');
          builder.addWarning('WARNING_1', 'Warning message');
          builder.addInfo('SUGGESTION_1', 'Suggestion message');
        }
      }

      const multiValidator = new MultiResultValidator({
        name: 'multi-validator',
        priority: 10,
        logger: mockLogger,
      });

      const result = await multiValidator.validate(recipe);

      expect(result.passed).toHaveLength(1);
      expect(result.warnings).toHaveLength(1);
      expect(result.suggestions).toHaveLength(1);
      expect(result.isValid).toBe(true);
    });

    it('should set isValid false when errors present', async () => {
      class ErrorValidator extends BaseValidator {
        async performValidation(_recipe, _options, builder) {
          builder.addError('ERROR_1', 'Error message');
        }
      }

      const errorValidator = new ErrorValidator({
        name: 'error-validator',
        priority: 10,
        logger: mockLogger,
      });

      const result = await errorValidator.validate(recipe);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });
});
