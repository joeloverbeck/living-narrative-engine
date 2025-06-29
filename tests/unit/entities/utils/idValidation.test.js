import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  isValidId,
  validateInstanceAndComponent,
} from '../../../../src/entities/utils/idValidation.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

describe('idValidation utilities', () => {
  let logger;

  beforeEach(() => {
    logger = { error: jest.fn(), warn: jest.fn() };
  });

  describe('isValidId', () => {
    it('returns true for valid ids', () => {
      const result = isValidId('foo', 'test', logger);
      expect(result).toBe(true);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('returns false and logs for invalid ids', () => {
      const result = isValidId('', 'test', logger);
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('validateInstanceAndComponent', () => {
    it('does not throw for valid ids', () => {
      expect(() =>
        validateInstanceAndComponent('ent1', 'comp1', logger, 'ctx')
      ).not.toThrow();
    });

    it('throws InvalidArgumentError for invalid instanceId', () => {
      expect(() =>
        validateInstanceAndComponent('', 'comp1', logger, 'ctx')
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalled();
    });

    it('throws InvalidArgumentError for invalid componentTypeId', () => {
      expect(() =>
        validateInstanceAndComponent('ent1', '', logger, 'ctx')
      ).toThrow(InvalidArgumentError);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
