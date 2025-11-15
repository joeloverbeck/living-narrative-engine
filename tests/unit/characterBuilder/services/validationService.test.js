/**
 * @file Unit tests for ValidationService.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ValidationService } from '../../../../src/characterBuilder/services/validationService.js';
import {
  ERROR_CATEGORIES,
} from '../../../../src/characterBuilder/controllers/BaseCharacterBuilderController.js';

describe('ValidationService', () => {
  let schemaValidator;
  let logger;
  let handleError;
  let service;

  beforeEach(() => {
    schemaValidator = { validate: jest.fn() };
    logger = { warn: jest.fn() };
    handleError = jest.fn();
    service = new ValidationService({
      schemaValidator,
      logger,
      handleError,
      errorCategories: ERROR_CATEGORIES,
    });
  });

  it('returns success when validator reports valid payload', () => {
    schemaValidator.validate.mockReturnValue({ isValid: true });

    const result = service.validateData({ name: 'Alice' }, 'character.schema');

    expect(result).toEqual({ isValid: true });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('formats errors, logs warning, and returns failure payload when invalid', () => {
    schemaValidator.validate.mockReturnValue({
      isValid: false,
      errors: [
        { instancePath: '/name', message: 'must be string' },
        'Unsupported payload',
      ],
    });

    const context = {
      operation: 'saveCharacter',
      controllerName: 'TestController',
      payloadType: 'concept',
    };

    const result = service.validateData(
      { name: 123 },
      'character.schema',
      context
    );

    const expectedFailureMessage =
      "TestController: Validation failed for schema 'character.schema' with 2 error(s)";
    expect(logger.warn).toHaveBeenCalledWith(expectedFailureMessage, {
      ...context,
      schemaId: 'character.schema',
    });
    expect(result).toEqual({
      isValid: false,
      errors: ['name: must be string', 'Unsupported payload'],
      errorMessage:
        'Please fix the following errors:\n• name: must be string\n• Unsupported payload',
      failureMessage: expectedFailureMessage,
    });
  });

  it('handles validator exceptions via injected error handler', () => {
    const validationError = new Error('schema missing');
    schemaValidator.validate.mockImplementation(() => {
      throw validationError;
    });

    const result = service.validateData(
      { field: 'value' },
      'missing.schema',
      { operation: 'loadSchema' }
    );

    expect(handleError).toHaveBeenCalledWith(validationError, {
      operation: 'loadSchema',
      category: ERROR_CATEGORIES.SYSTEM,
      userMessage: 'Validation failed. Please check your input.',
      metadata: { schemaId: 'missing.schema', dataKeys: ['field'] },
    });
    expect(result).toEqual({
      isValid: false,
      errors: ['Validation error: schema missing'],
      errorMessage: 'Unable to validate data. Please try again.',
    });
  });

  describe('formatValidationErrors', () => {
    it('normalizes non-array inputs', () => {
      expect(service.formatValidationErrors('oops')).toEqual([
        'Invalid data format',
      ]);
    });

    it('formats AJV style errors and falls back to message', () => {
      const errors = [
        { instancePath: '/details/name', message: 'is required' },
        { message: 'Unknown failure' },
      ];
      expect(service.formatValidationErrors(errors)).toEqual([
        'details.name: is required',
        'Unknown failure',
      ]);
    });
  });

  describe('buildValidationErrorMessage', () => {
    it('returns the single error when only one exists', () => {
      expect(service.buildValidationErrorMessage(['Only error'])).toBe(
        'Only error'
      );
    });

    it('creates bullet list for multiple errors', () => {
      expect(
        service.buildValidationErrorMessage(['First issue', 'Second issue'])
      ).toBe('Please fix the following errors:\n• First issue\n• Second issue');
    });
  });
});
