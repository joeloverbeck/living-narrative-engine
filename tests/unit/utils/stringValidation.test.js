import { afterEach, describe, expect, it, jest } from '@jest/globals';
import stringValidation, {
  validateNonEmptyString,
} from '../../../src/utils/stringValidation.js';
import * as textUtils from '../../../src/utils/textUtils.js';

describe('stringValidation.validateNonEmptyString', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the trimmed string when provided with a non-empty string value', () => {
    const spy = jest.spyOn(textUtils, 'isNonBlankString');

    const result = validateNonEmptyString('username', '  Alice  ');

    expect(result).toBe('Alice');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('  Alice  ');
  });

  it('returns null when the provided value is blank after trimming whitespace', () => {
    expect(validateNonEmptyString('username', '   ')).toBeNull();
    expect(validateNonEmptyString('username', '\n\t')).toBeNull();
  });

  it('returns null when the value is not a string', () => {
    expect(validateNonEmptyString('username', 42)).toBeNull();
    expect(validateNonEmptyString('username', undefined)).toBeNull();
    expect(validateNonEmptyString('username', null)).toBeNull();
    expect(validateNonEmptyString('username', { text: 'nope' })).toBeNull();
  });

  it('honours the result of textUtils.isNonBlankString even for seemingly valid strings', () => {
    const spy = jest
      .spyOn(textUtils, 'isNonBlankString')
      .mockReturnValueOnce(false);

    const result = validateNonEmptyString('username', 'Valid looking text');

    expect(result).toBeNull();
    expect(spy).toHaveBeenCalledWith('Valid looking text');
  });

  it('re-exports validateNonEmptyString from the default object for convenience', () => {
    expect(stringValidation).toEqual({
      validateNonEmptyString,
    });
  });
});
