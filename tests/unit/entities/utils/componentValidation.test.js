import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import validateAndClone from '../../../../src/entities/utils/componentValidation.js';
import {
  validationSucceeded,
  formatValidationErrors,
} from '../../../../src/utils/entitiesValidationHelpers.js';

jest.mock('../../../../src/utils/entitiesValidationHelpers.js', () => ({
  validationSucceeded: jest.fn(),
  formatValidationErrors: jest.fn(),
}));

describe('validateAndClone', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clones the payload, validates it, and returns the cloned data when validation succeeds', () => {
    const original = { id: 'entity-1', payload: { hp: 42 } };
    const cloned = { id: 'entity-1', payload: { hp: 42 }, cloned: true };
    const clonerFn = jest.fn(() => cloned);
    const schemaValidator = {
      validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    };
    const logger = { error: jest.fn() };

    validationSucceeded.mockReturnValue(true);

    const result = validateAndClone(
      'core:test_component',
      original,
      schemaValidator,
      logger,
      'EntityManager',
      clonerFn
    );

    expect(clonerFn).toHaveBeenCalledTimes(1);
    expect(clonerFn).toHaveBeenCalledWith(original);
    expect(schemaValidator.validate).toHaveBeenCalledWith(
      'core:test_component',
      cloned
    );
    expect(validationSucceeded).toHaveBeenCalledWith({
      isValid: true,
      errors: [],
    });
    expect(logger.error).not.toHaveBeenCalled();
    expect(result).toBe(cloned);
    expect(result).not.toBe(original);
  });

  it('logs the formatted validation errors and throws when validation fails', () => {
    const componentData = { name: 'invalid', payload: { value: null } };
    const cloned = { ...componentData };
    const clonerFn = jest.fn(() => cloned);
    const validationError = {
      isValid: false,
      errors: [{ path: '#/value', message: 'required' }],
    };
    const schemaValidator = {
      validate: jest.fn().mockReturnValue(validationError),
    };
    const logger = { error: jest.fn() };

    validationSucceeded.mockReturnValue(false);
    const formattedErrors =
      '{\n  "path": "#/value",\n  "message": "required"\n}';
    formatValidationErrors.mockReturnValue(formattedErrors);

    const callValidateAndClone = () =>
      validateAndClone(
        'core:test_component',
        componentData,
        schemaValidator,
        logger,
        'EntityFactory',
        clonerFn
      );

    expect(callValidateAndClone).toThrow(
      new Error(`EntityFactory Errors:\n${formattedErrors}`)
    );
    expect(validationSucceeded).toHaveBeenCalledWith(validationError);
    expect(formatValidationErrors).toHaveBeenCalledWith(validationError);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      `EntityFactory Errors:\n${formattedErrors}`
    );
    expect(schemaValidator.validate).toHaveBeenCalledWith(
      'core:test_component',
      cloned
    );
  });
});
