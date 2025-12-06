import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { validateAgainstSchema } from '../../../src/utils/schemaValidationUtils.js';
import * as preValidationUtils from '../../../src/utils/preValidationUtils.js';
import { createMockLogger } from '../testUtils.js';

/** @typedef {import('../../../src/interfaces/coreServices.js').ValidationResult} ValidationResult */

describe('validateAgainstSchema pre-validation coverage', () => {
  let validator;
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    validator = {
      isSchemaLoaded: jest.fn(),
      validate: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('surfaces detailed errors when pre-validation fails', () => {
    validator.isSchemaLoaded.mockReturnValue(true);
    const data = { operations: [] };

    const performSpy = jest
      .spyOn(preValidationUtils, 'performPreValidation')
      .mockReturnValue({
        isValid: false,
        error: 'Unexpected structure',
        path: 'root.operations[0]',
        suggestions: ['Ensure type is provided'],
      });

    const formatSpy = jest
      .spyOn(preValidationUtils, 'formatPreValidationError')
      .mockReturnValue('Formatted pre-validation error');

    expect(() =>
      validateAgainstSchema(
        validator,
        'schema://living-narrative-engine/rule.schema.json',
        data,
        logger,
        {
          filePath: '/mods/example/rule.json',
          failureContext: { stage: 'loading' },
        }
      )
    ).toThrow(
      "Pre-validation failed for 'rule.json': Unexpected structure\nDetails:\nFormatted pre-validation error"
    );

    expect(performSpy).toHaveBeenCalledWith(
      data,
      'schema://living-narrative-engine/rule.schema.json',
      '/mods/example/rule.json'
    );
    expect(formatSpy).toHaveBeenCalledWith(
      {
        isValid: false,
        error: 'Unexpected structure',
        path: 'root.operations[0]',
        suggestions: ['Ensure type is provided'],
      },
      'rule.json',
      'schema://living-narrative-engine/rule.schema.json'
    );
    expect(logger.error).toHaveBeenCalledWith(
      "Pre-validation failed for 'rule.json'",
      {
        stage: 'loading',
        schemaId: 'schema://living-narrative-engine/rule.schema.json',
        preValidationError: 'Unexpected structure',
        preValidationPath: 'root.operations[0]',
        preValidationSuggestions: ['Ensure type is provided'],
      }
    );
    expect(validator.validate).not.toHaveBeenCalled();
  });

  it('logs success when pre-validation passes with a file path', () => {
    validator.isSchemaLoaded.mockReturnValue(true);
    validator.validate.mockReturnValue(
      /** @type {ValidationResult} */ ({ isValid: true, errors: null })
    );

    jest.spyOn(preValidationUtils, 'performPreValidation').mockReturnValue({
      isValid: true,
      error: null,
      path: null,
      suggestions: null,
    });

    const result = validateAgainstSchema(
      validator,
      'schema://living-narrative-engine/rule.schema.json',
      { operations: [] },
      logger,
      { filePath: '/mods/example/rule.json' }
    );

    expect(logger.debug).toHaveBeenCalledWith(
      "Pre-validation passed for '/mods/example/rule.json' against schema 'schema://living-narrative-engine/rule.schema.json'"
    );
    expect(result).toEqual({ isValid: true, errors: null });
  });

  it('skips pre-validation when requested', () => {
    validator.isSchemaLoaded.mockReturnValue(true);
    validator.validate.mockReturnValue(
      /** @type {ValidationResult} */ ({ isValid: true, errors: null })
    );

    const performSpy = jest.spyOn(preValidationUtils, 'performPreValidation');

    const result = validateAgainstSchema(
      validator,
      'schema://living-narrative-engine/rule.schema.json',
      { operations: [] },
      logger,
      { skipPreValidation: true, filePath: '/mods/example/rule.json' }
    );

    expect(performSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ isValid: true, errors: null });
    expect(logger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('Pre-validation passed for')
    );
  });
});
