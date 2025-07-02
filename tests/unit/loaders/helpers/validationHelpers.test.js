import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { validateLoadItemsParams } from '../../../../src/loaders/helpers/validationHelpers.js';

describe('validateLoadItemsParams', () => {
  let logger;

  beforeEach(() => {
    logger = { error: jest.fn() };
  });

  it('returns trimmed values when all parameters valid', () => {
    const result = validateLoadItemsParams(
      logger,
      'TestLoader',
      ' mod ',
      {},
      ' actions ',
      ' folder ',
      ' registry '
    );

    expect(result).toEqual({
      modId: 'mod',
      contentKey: 'actions',
      diskFolder: 'folder',
      registryKey: 'registry',
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws when modId invalid', () => {
    expect(() =>
      validateLoadItemsParams(logger, 'TestLoader', '', {}, 'a', 'b', 'c')
    ).toThrow(TypeError);
  });
});
