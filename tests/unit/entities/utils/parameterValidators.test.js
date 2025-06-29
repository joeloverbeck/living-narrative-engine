import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { assertInstanceAndComponentIds } from '../../../../src/entities/utils/parameterValidators.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

describe('assertInstanceAndComponentIds', () => {
  let logger;

  beforeEach(() => {
    logger = { error: jest.fn(), warn: jest.fn() };
  });

  it('does not throw for valid ids', () => {
    expect(() =>
      assertInstanceAndComponentIds('ctx', 'e1', 'c1', logger)
    ).not.toThrow();
  });

  it('throws for invalid instanceId', () => {
    expect(() =>
      assertInstanceAndComponentIds('ctx', '', 'c1', logger)
    ).toThrow(InvalidArgumentError);
    expect(logger.error).toHaveBeenCalled();
  });

  it('throws for invalid componentTypeId', () => {
    expect(() =>
      assertInstanceAndComponentIds('ctx', 'e1', '', logger)
    ).toThrow(InvalidArgumentError);
    expect(logger.error).toHaveBeenCalled();
  });
});
