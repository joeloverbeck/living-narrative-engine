/**
 * @file Unit tests for AjvSchemaValidator utility methods
 * @description Tests for validateAgainstSchema and formatAjvErrors methods (lines 601-627)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';

/**
 * Creates a mock logger for testing
 *
 * @returns {object} Mock logger with all required methods
 */
function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Mock the utility dependencies
jest.mock('../../../src/utils/schemaValidationUtils.js', () => ({
  validateAgainstSchema: jest.fn(),
}));

jest.mock('../../../src/utils/ajvUtils.js', () => ({
  formatAjvErrors: jest.fn(),
}));

jest.mock('../../../src/utils/ajvAnyOfErrorFormatter.js', () => ({
  formatAjvErrorsEnhanced: jest.fn(),
}));

describe('AjvSchemaValidator Utility Methods Tests', () => {
  let mockLogger;
  let validator;
  let mockValidateAgainstSchemaUtil;
  let mockFormatAjvErrors;
  let mockFormatAjvErrorsEnhanced;

  beforeEach(async () => {
    mockLogger = createMockLogger();

    // Import mocked utilities
    const schemaValidationUtils = await import(
      '../../../src/utils/schemaValidationUtils.js'
    );
    const ajvUtils = await import('../../../src/utils/ajvUtils.js');
    const ajvAnyOfErrorFormatter = await import('../../../src/utils/ajvAnyOfErrorFormatter.js');

    mockValidateAgainstSchemaUtil = schemaValidationUtils.validateAgainstSchema;
    mockFormatAjvErrors = ajvUtils.formatAjvErrors;
    mockFormatAjvErrorsEnhanced = ajvAnyOfErrorFormatter.formatAjvErrorsEnhanced;

    // Clear all mocks
    jest.clearAllMocks();

    // Create validator instance
    validator = new AjvSchemaValidator({ logger: mockLogger });
  });

  describe('validateAgainstSchema method (lines 601-617)', () => {
    it('should return true when validation succeeds', () => {
      // Arrange
      const testData = { name: 'test', value: 42 };
      const schemaId = 'test-schema';
      const context = { source: 'unit-test' };

      mockValidateAgainstSchemaUtil.mockReturnValue({ isValid: true });

      // Act
      const result = validator.validateAgainstSchema(
        testData,
        schemaId,
        context
      );

      // Assert
      expect(result).toBe(true);
      expect(mockValidateAgainstSchemaUtil).toHaveBeenCalledWith(
        validator,
        schemaId,
        testData,
        mockLogger,
        context
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should return false when validation fails', () => {
      // Arrange
      const testData = { invalid: 'data' };
      const schemaId = 'test-schema';

      mockValidateAgainstSchemaUtil.mockReturnValue({ isValid: false });

      // Act
      const result = validator.validateAgainstSchema(testData, schemaId);

      // Assert
      expect(result).toBe(false);
      expect(mockValidateAgainstSchemaUtil).toHaveBeenCalledWith(
        validator,
        schemaId,
        testData,
        mockLogger,
        {}
      );
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should return false and log error when utility throws exception', () => {
      // Arrange
      const testData = { name: 'test' };
      const schemaId = 'test-schema';
      const error = new Error('Validation utility failed');

      mockValidateAgainstSchemaUtil.mockImplementation(() => {
        throw error;
      });

      // Act
      const result = validator.validateAgainstSchema(testData, schemaId);

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `AjvSchemaValidator: validateAgainstSchema failed for schema 'test-schema': Validation utility failed`,
        { schemaId: 'test-schema', error }
      );
    });

    it('should use default empty context when none provided', () => {
      // Arrange
      const testData = { name: 'test' };
      const schemaId = 'test-schema';

      mockValidateAgainstSchemaUtil.mockReturnValue({ isValid: true });

      // Act
      validator.validateAgainstSchema(testData, schemaId);

      // Assert
      expect(mockValidateAgainstSchemaUtil).toHaveBeenCalledWith(
        validator,
        schemaId,
        testData,
        mockLogger,
        {}
      );
    });
  });

  describe('formatAjvErrors method (lines 626-627)', () => {
    it('should format errors using utility function', () => {
      // Arrange
      const errors = [
        {
          instancePath: '/name',
          schemaPath: '#/properties/name/type',
          keyword: 'type',
          params: { type: 'string' },
          message: 'must be string',
        },
        {
          instancePath: '/age',
          schemaPath: '#/properties/age/minimum',
          keyword: 'minimum',
          params: { limit: 0 },
          message: 'must be >= 0',
        },
      ];

      const expectedFormattedString = 'name: must be string; age: must be >= 0';
      mockFormatAjvErrorsEnhanced.mockReturnValue(expectedFormattedString);

      // Act
      const result = validator.formatAjvErrors(errors);

      // Assert
      expect(result).toBe(expectedFormattedString);
      expect(mockFormatAjvErrorsEnhanced).toHaveBeenCalledWith(errors, undefined);
    });

    it('should handle empty errors array', () => {
      // Arrange
      const errors = [];
      const expectedFormattedString = 'No validation errors';
      mockFormatAjvErrorsEnhanced.mockReturnValue(expectedFormattedString);

      // Act
      const result = validator.formatAjvErrors(errors);

      // Assert
      expect(result).toBe(expectedFormattedString);
      expect(mockFormatAjvErrorsEnhanced).toHaveBeenCalledWith(errors, undefined);
    });

    it('should handle null errors', () => {
      // Arrange
      const errors = null;
      const expectedFormattedString = 'No validation errors';
      mockFormatAjvErrorsEnhanced.mockReturnValue(expectedFormattedString);

      // Act
      const result = validator.formatAjvErrors(errors);

      // Assert
      expect(result).toBe(expectedFormattedString);
      expect(mockFormatAjvErrorsEnhanced).toHaveBeenCalledWith(errors, undefined);
    });

    it('should pass through complex error objects', () => {
      // Arrange
      const complexErrors = [
        {
          instancePath: '/nested/deep/property',
          schemaPath:
            '#/definitions/complexType/properties/nested/properties/deep/properties/property/type',
          keyword: 'type',
          params: { type: 'object' },
          message: 'must be object',
          data: { invalid: 'value' },
          parentSchema: { type: 'object' },
          schema: 'object',
        },
      ];

      const expectedFormattedString = 'Complex nested validation error';
      mockFormatAjvErrorsEnhanced.mockReturnValue(expectedFormattedString);

      // Act
      const result = validator.formatAjvErrors(complexErrors);

      // Assert
      expect(result).toBe(expectedFormattedString);
      expect(mockFormatAjvErrorsEnhanced).toHaveBeenCalledWith(complexErrors, undefined);
    });
  });
});
