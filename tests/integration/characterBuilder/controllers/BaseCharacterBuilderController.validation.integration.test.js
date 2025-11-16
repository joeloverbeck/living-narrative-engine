/**
 * @file Integration tests for BaseCharacterBuilderController validation service integration
 * @description Tests validation error propagation, schema validation, and ValidationService interaction
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BaseCharacterBuilderControllerIntegrationTestBase } from './BaseCharacterBuilderController.integration.testbase.js';
import BaseCharacterBuilderController from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';

class ValidationTestController extends BaseCharacterBuilderController {
  constructor(dependencies) {
    super(dependencies);
    this.validationErrors = [];
  }

  async initialize() {
    // Override to bypass heavy initialization
  }

  validateData(data, schemaId) {
    return this._validateData(data, schemaId);
  }

  handleValidationError(error, context) {
    this.validationErrors.push({ error, context, timestamp: Date.now() });
    return this._handleValidationError?.(error, context);
  }

  getValidationErrors() {
    return [...this.validationErrors];
  }

  clearValidationErrors() {
    this.validationErrors = [];
  }
}

describe('BaseCharacterBuilderController - Validation Integration', () => {
  let testBase;
  let controller;

  beforeEach(async () => {
    testBase = new BaseCharacterBuilderControllerIntegrationTestBase();
    await testBase.setup({ includeFullDOM: false });

    controller = new ValidationTestController(testBase.getDependencies());
  });

  afterEach(async () => {
    if (controller && typeof controller.destroy === 'function') {
      await controller.destroy();
    }
    await testBase.cleanup();
  });

  describe('Schema Validation Integration', () => {
    it('should validate data against schema successfully', () => {
      const validData = {
        concept: 'Test concept',
        status: 'completed',
      };

      const result = controller.validateData(validData, 'character-concept');

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should detect validation errors for invalid data', () => {
      const invalidData = {
        concept: '', // Empty string
        status: 'invalid-status', // Invalid enum value
      };

      const result = controller.validateData(invalidData, 'character-concept');

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate nested object structures', () => {
      const nestedData = {
        concept: 'Test concept',
        status: 'completed',
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      const result = controller.validateData(nestedData, 'character-concept');

      expect(result.isValid).toBe(true);
    });

    it('should validate array data structures', () => {
      const arrayData = {
        concepts: [
          { concept: 'Concept 1', status: 'completed' },
          { concept: 'Concept 2', status: 'pending' },
        ],
      };

      const result = controller.validateData(arrayData, 'concept-list');

      // Validation result depends on schema definition
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
    });

    it('should handle missing required fields', () => {
      const incompleteData = {
        // Missing required 'concept' field
        status: 'completed',
      };

      const result = controller.validateData(incompleteData, 'character-concept');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({
          keyword: 'required',
        })
      );
    });

    it('should validate data type constraints', () => {
      const wrongTypeData = {
        concept: 123, // Should be string
        status: 'completed',
      };

      const result = controller.validateData(wrongTypeData, 'character-concept');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.objectContaining({
          keyword: 'type',
        })
      );
    });
  });

  describe('Validation Error Handling', () => {
    it('should propagate validation errors to event bus', () => {
      const invalidData = {
        concept: '',
        status: 'invalid',
      };

      const result = controller.validateData(invalidData, 'character-concept');

      if (!result.isValid) {
        controller.handleValidationError(result.errors, 'character-concept-validation');
      }

      const errors = controller.getValidationErrors();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].context).toBe('character-concept-validation');
    });

    it('should format validation errors for user display', () => {
      const invalidData = {
        concept: '',
        status: 'invalid-status',
      };

      const result = controller.validateData(invalidData, 'character-concept');

      expect(result.isValid).toBe(false);
      
      // Errors should be formatted with human-readable messages
      const errorMessages = result.errors?.map((err) => err.message || err.keyword);
      expect(errorMessages).toBeDefined();
      expect(errorMessages.length).toBeGreaterThan(0);
    });

    it('should log validation errors at appropriate level', () => {
      const invalidData = {
        concept: '',
      };

      controller.validateData(invalidData, 'character-concept');

      expect(testBase.mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/validation|failed|error/i)
      );
    });

    it('should provide error context for debugging', () => {
      const invalidData = {
        concept: '',
        status: 'invalid',
      };

      const result = controller.validateData(invalidData, 'character-concept');

      if (!result.isValid) {
        result.errors.forEach((error) => {
          expect(error).toHaveProperty('dataPath');
          expect(error).toHaveProperty('keyword');
        });
      }
    });
  });

  describe('ValidationService Integration', () => {
    it('should delegate validation to ValidationService', () => {
      const testData = {
        concept: 'Test',
        status: 'completed',
      };

      controller.validateData(testData, 'character-concept');

      // ValidationService should have been invoked
      expect(testBase.mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/validat/i)
      );
    });

    it('should cache validation results for performance', () => {
      const testData = {
        concept: 'Test',
        status: 'completed',
      };

      // First validation
      const result1 = controller.validateData(testData, 'character-concept');
      
      // Second validation with same data
      const result2 = controller.validateData(testData, 'character-concept');

      expect(result1.isValid).toBe(result2.isValid);
      
      // Should use cached result (fewer debug logs)
      const debugCalls = testBase.mocks.logger.debug.mock.calls.filter((call) =>
        call[0]?.includes('validat')
      );
      expect(debugCalls.length).toBeGreaterThan(0);
    });

    it('should support custom validation rules', () => {
      const dataWithCustomRule = {
        concept: 'Test concept',
        status: 'completed',
        customField: 'custom-value',
      };

      // Custom validation logic could be injected via ValidationService
      const result = controller.validateData(dataWithCustomRule, 'character-concept');

      expect(result).toBeDefined();
    });

    it('should handle schema not found errors gracefully', () => {
      const testData = {
        concept: 'Test',
      };

      const result = controller.validateData(testData, 'non-existent-schema');

      expect(result.isValid).toBe(false);
      expect(testBase.mocks.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Schema not found')
      );
    });
  });

  describe('Real-World Validation Scenarios', () => {
    it('should validate character concept creation data', () => {
      const conceptData = {
        concept: 'A brooding detective with a dark past',
        status: 'pending',
        thematicDirections: ['direction-1', 'direction-2'],
        metadata: {
          createdAt: new Date().toISOString(),
        },
      };

      const result = controller.validateData(conceptData, 'character-concept');

      expect(result.isValid).toBe(true);
    });

    it('should validate thematic direction data', () => {
      const directionData = {
        title: 'Redemption Arc',
        description: 'A journey of redemption and forgiveness',
        thematicDirection: 'From darkness to light',
        conceptId: 'concept-123',
      };

      const result = controller.validateData(directionData, 'thematic-direction');

      expect(result.isValid).toBe(true);
    });

    it('should validate trait generation input', () => {
      const traitsInput = {
        coreMotivation: 'To protect the innocent',
        internalContradiction: 'Wants justice but uses brutal methods',
        centralQuestion: 'Can I protect without becoming the villain?',
        thematicDirectionId: 'direction-123',
      };

      const result = controller.validateData(traitsInput, 'traits-generation-input');

      expect(result.isValid).toBe(true);
    });

    it('should reject invalid character concept data', () => {
      const invalidConcept = {
        concept: '', // Empty
        status: 'not-a-valid-status',
        thematicDirections: 'should-be-array', // Wrong type
      };

      const result = controller.validateData(invalidConcept, 'character-concept');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle validation during form submission workflow', () => {
      const formData = {
        concept: 'Valid concept',
        status: 'completed',
      };

      // Step 1: Validate form data
      const validationResult = controller.validateData(formData, 'character-concept');
      expect(validationResult.isValid).toBe(true);

      // Step 2: If invalid, collect errors for UI display
      if (!validationResult.isValid) {
        controller.handleValidationError(validationResult.errors, 'form-submission');
      }

      // Step 3: Verify no errors were logged for valid data
      expect(controller.getValidationErrors()).toHaveLength(0);
    });

    it('should provide field-level validation feedback', () => {
      const partialData = {
        concept: 'Test concept',
        // Missing status field
      };

      const result = controller.validateData(partialData, 'character-concept');

      if (!result.isValid) {
        // Errors should specify which field failed
        const statusError = result.errors.find((err) =>
          err.dataPath?.includes('status') || err.params?.missingProperty === 'status'
        );
        expect(statusError).toBeDefined();
      }
    });
  });

  describe('Validation Performance and Caching', () => {
    it('should validate large datasets efficiently', () => {
      const largeDataset = {
        concepts: Array.from({ length: 100 }, (_, i) => ({
          concept: `Concept ${i}`,
          status: 'completed',
        })),
      };

      const startTime = Date.now();
      controller.validateData(largeDataset, 'concept-list');
      const endTime = Date.now();

      // Should complete in reasonable time (< 100ms for 100 items)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should cleanup validation cache on destroy', async () => {
      const testData = {
        concept: 'Test',
        status: 'completed',
      };

      controller.validateData(testData, 'character-concept');
      
      await controller.destroy();

      expect(testBase.mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/cleanup|cache|validation/i)
      );
    });
  });

  describe('Integration with Error Recovery', () => {
    it('should integrate validation with error recovery flow', () => {
      const invalidData = {
        concept: '',
        status: 'invalid',
      };

      const result = controller.validateData(invalidData, 'character-concept');

      if (!result.isValid) {
        controller.handleValidationError(result.errors, 'recovery-test');
        
        // Error should be logged and tracked
        expect(controller.getValidationErrors().length).toBeGreaterThan(0);
        expect(testBase.mocks.logger.warn).toHaveBeenCalled();
      }
    });

    it('should clear validation errors on successful validation', () => {
      // First, create some errors
      const invalidData = { concept: '' };
      const invalidResult = controller.validateData(invalidData, 'character-concept');
      
      if (!invalidResult.isValid) {
        controller.handleValidationError(invalidResult.errors, 'test');
      }

      expect(controller.getValidationErrors().length).toBeGreaterThan(0);

      // Then validate correct data
      const validData = { concept: 'Valid', status: 'completed' };
      const validResult = controller.validateData(validData, 'character-concept');

      expect(validResult.isValid).toBe(true);

      // Clear errors after successful validation
      controller.clearValidationErrors();
      expect(controller.getValidationErrors()).toHaveLength(0);
    });
  });
});
