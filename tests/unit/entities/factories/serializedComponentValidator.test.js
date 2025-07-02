import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { validateSerializedComponent } from '../../../../src/entities/factories/serializedComponentValidator.js';

describe('validateSerializedComponent', () => {
  let validator;
  let logger;

  beforeEach(() => {
    validator = { validate: jest.fn(() => ({ isValid: true })) };
    logger = { debug: jest.fn(), error: jest.fn() };
  });

  it('returns cloned data when valid', () => {
    const data = { a: 1 };
    const result = validateSerializedComponent(
      'type1',
      data,
      validator,
      logger,
      'ent1',
      'def1'
    );
    expect(result).toEqual(data);
    expect(result).not.toBe(data);
    expect(validator.validate).toHaveBeenCalledWith(
      'type1',
      data,
      'Reconstruction component type1 for entity ent1 (definition def1)'
    );
  });

  it('returns null when data is null', () => {
    const result = validateSerializedComponent(
      'type1',
      null,
      validator,
      logger,
      'ent1',
      'def1'
    );
    expect(result).toBeNull();
    expect(validator.validate).not.toHaveBeenCalled();
  });

  it('throws when validation fails', () => {
    validator.validate.mockReturnValue({ isValid: false, errors: ['bad'] });
    expect(() =>
      validateSerializedComponent(
        'type1',
        { b: 2 },
        validator,
        logger,
        'ent1',
        'def1'
      )
    ).toThrow(
      'Reconstruction component type1 for entity ent1 (definition def1) Errors: ["bad"]'
    );
  });
});
