import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { validateAgainstSchema } from '../../../src/utils/schemaValidationUtils.js';
import * as ajvUtils from '../../../src/utils/ajvUtils.js';
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
    jest.spyOn(ajvUtils, 'formatAjvErrors').mockReturnValue('DETAILS');
    expect(() =>
      validateAgainstSchema(validator, 'schema', {}, logger)
    ).toThrow('Schema validation failed.\nDetails:\nDETAILS');
    expect(logger.error).not.toHaveBeenCalled();
    expect(ajvUtils.formatAjvErrors).toHaveBeenCalledWith(errors);
  });
});
