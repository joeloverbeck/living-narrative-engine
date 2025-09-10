import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { validateAgainstSchema } from '../../../src/utils/schemaValidationUtils.js';
import * as ajvAnyOfErrorFormatter from '../../../src/utils/ajvAnyOfErrorFormatter.js';
import { createMockLogger } from '../testUtils.js';

describe('validateAgainstSchema additional branches', () => {
  let validator;
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    validator = {
      isSchemaLoaded: jest.fn(),
      validate: jest.fn(),
    };
  });

  it('throws default message when schema missing without context', () => {
    validator.isSchemaLoaded.mockReturnValue(false);
    expect(() => validateAgainstSchema(validator, 'id', {}, logger)).toThrow(
      "Schema 'id' not loaded."
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws default failure message when validation fails and no messages provided', () => {
    validator.isSchemaLoaded.mockReturnValue(true);
    const errors = [{ instancePath: '', message: 'bad', params: {} }];
    validator.validate.mockReturnValue({ isValid: false, errors });
    jest
      .spyOn(ajvAnyOfErrorFormatter, 'formatAjvErrorsEnhanced')
      .mockReturnValue('Validation errors:\n  - root: bad');
    expect(() =>
      validateAgainstSchema(validator, 'schema', {}, logger)
    ).toThrow(
      'Schema validation failed.\nDetails:\nValidation errors:\n  - root: bad'
    );
    expect(logger.error).not.toHaveBeenCalled();
    expect(ajvAnyOfErrorFormatter.formatAjvErrorsEnhanced).toHaveBeenCalledWith(
      errors,
      {}
    );
  });
});
