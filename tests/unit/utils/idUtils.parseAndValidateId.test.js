import { describe, it, expect, jest } from '@jest/globals';
import { parseAndValidateId } from '../../../src/utils/idUtils.js';

/**
 * Helper to create a logger mock with warn spy.
 *
 * @returns {{warn: jest.Mock}} Logger mock instance.
 */
function createLogger() {
  return {
    warn: jest.fn(),
  };
}

describe('parseAndValidateId', () => {
  it('returns parsed ids when valid', () => {
    const logger = createLogger();
    const result = parseAndValidateId(
      { id: 'mod:thing' },
      'id',
      'mod',
      'file.json',
      logger
    );
    expect(result).toEqual({ fullId: 'mod:thing', baseId: 'thing' });
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('throws error when id missing or empty', () => {
    const logger = createLogger();
    expect(() =>
      parseAndValidateId({}, 'id', 'mod', 'file.json', logger)
    ).toThrow('Invalid or missing');
    expect(() =>
      parseAndValidateId({ id: '   ' }, 'id', 'mod', 'file.json', logger)
    ).toThrow('Invalid or missing');
  });

  it('warns and falls back when extraction fails with allowFallback', () => {
    const logger = createLogger();
    const result = parseAndValidateId(
      { id: 'mod:' },
      'id',
      'mod',
      'file.json',
      logger,
      { allowFallback: true }
    );
    expect(result).toEqual({ fullId: 'mod:', baseId: 'mod:' });
    expect(logger.warn).toHaveBeenCalledWith(
      "Could not extract base ID from 'mod:' in file 'file.json'. Falling back to full ID.",
      { modId: 'mod', filename: 'file.json', receivedId: 'mod:' }
    );
  });

  it('throws when extraction fails without fallback', () => {
    const logger = createLogger();
    expect(() =>
      parseAndValidateId({ id: 'mod:' }, 'id', 'mod', 'file.json', logger, {
        allowFallback: false,
      })
    ).toThrow('Could not extract base ID');
  });
});
