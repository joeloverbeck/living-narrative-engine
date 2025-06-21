import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { validateAgainstSchema } from '../../../src/utils/schemaValidationUtils.js';
import { formatAjvErrors } from '../../../src/utils/ajvUtils.js';
import { createMockLogger } from '../testUtils.js';

/** @typedef {import('../../../src/interfaces/coreServices.js').ValidationResult} ValidationResult */

describe('validateAgainstSchema', () => {
  let validator;
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    validator = {
      isSchemaLoaded: jest.fn(),
      validate: jest.fn(),
    };
  });

  it('returns success and logs a warning when schema is missing but skipping is enabled', () => {
    validator.isSchemaLoaded.mockReturnValue(false);
    const result = validateAgainstSchema(validator, 'missing', {}, logger, {
      notLoadedMessage: 'not loaded',
      notLoadedLogLevel: 'warn',
      skipIfSchemaNotLoaded: true,
    });
    expect(logger.warn).toHaveBeenCalledWith('not loaded');
    expect(result).toEqual({ isValid: true, errors: null });
  });

  it('throws an error when schema is missing and skipping is disabled', () => {
    validator.isSchemaLoaded.mockReturnValue(false);
    expect(() =>
      validateAgainstSchema(validator, 'id', {}, logger, {
        notLoadedMessage: 'missing schema',
        notLoadedThrowMessage: 'throw me',
      })
    ).toThrow('throw me');
    expect(logger.error).toHaveBeenCalledWith('missing schema');
  });

  it('logs debug message and returns validator result when validation succeeds', () => {
    validator.isSchemaLoaded.mockReturnValue(true);
    validator.validate.mockReturnValue({ isValid: true, errors: null });
    const result = validateAgainstSchema(
      validator,
      'schema',
      { a: 1 },
      logger,
      { validationDebugMessage: 'debug msg' }
    );
    expect(logger.debug).toHaveBeenCalledWith('debug msg');
    expect(result).toEqual({ isValid: true, errors: null });
  });

  it('logs error with context and throws formatted message on validation failure', () => {
    validator.isSchemaLoaded.mockReturnValue(true);
    const errors = [{ instancePath: '/name', message: 'bad', params: {} }];
    validator.validate.mockReturnValue({ isValid: false, errors });
    const formatted = formatAjvErrors(errors);
    expect(() =>
      validateAgainstSchema(validator, 'schema', {}, logger, {
        failureMessage: 'Invalid',
        failureContext: { stage: 'test' },
        failureThrowMessage: 'Failed',
      })
    ).toThrow(`Failed\nDetails:\n${formatted}`);
    expect(logger.error).toHaveBeenCalledWith('Invalid', {
      stage: 'test',
      schemaId: 'schema',
      validationErrors: errors,
      validationErrorDetails: formatted,
    });
  });

  it('supports functional failureMessage and omits details when appendErrorDetails is false', () => {
    validator.isSchemaLoaded.mockReturnValue(true);
    const errors = [{ instancePath: '', message: 'oops', params: {} }];
    validator.validate.mockReturnValue({ isValid: false, errors });
    const formatted = formatAjvErrors(errors);
    expect(() =>
      validateAgainstSchema(validator, 'schema', {}, logger, {
        failureMessage: (errs) => `bad ${errs.length}`,
        appendErrorDetails: false,
      })
    ).toThrow('bad 1');
    expect(logger.error).toHaveBeenCalledWith('bad 1', {
      schemaId: 'schema',
      validationErrors: errors,
      validationErrorDetails: formatted,
    });
  });
});
