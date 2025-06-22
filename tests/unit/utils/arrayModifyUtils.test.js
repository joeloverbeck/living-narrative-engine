import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { applyArrayModification } from '../../../src/logic/utils/arrayModifyUtils.js';

describe('applyArrayModification', () => {
  let logger;

  beforeEach(() => {
    logger = { error: jest.fn() };
  });

  it('push adds value to end', () => {
    const arr = [1, 2];
    const result = applyArrayModification('push', arr, 3, logger);
    expect(result).toEqual([1, 2, 3]);
    expect(arr).toEqual([1, 2]);
  });

  it('push_unique adds when not present', () => {
    const arr = [1, 2];
    const result = applyArrayModification('push_unique', arr, 3, logger);
    expect(result).toEqual([1, 2, 3]);
  });

  it('push_unique does not add duplicate', () => {
    const arr = [1, 2];
    const result = applyArrayModification('push_unique', arr, 2, logger);
    expect(result).toEqual([1, 2]);
  });

  it('pop removes last item', () => {
    const arr = [1, 2, 3];
    const result = applyArrayModification('pop', arr, null, logger);
    expect(result).toEqual([1, 2]);
  });

  it('remove_by_value removes matching entries', () => {
    const arr = [1, 2, 3, 2];
    const result = applyArrayModification('remove_by_value', arr, 2, logger);
    expect(result).toEqual([1, 3]);
  });

  it('unknown mode logs error and returns original', () => {
    const arr = [1];
    const result = applyArrayModification('invalid', arr, 2, logger);
    expect(result).toBe(arr);
    expect(logger.error).toHaveBeenCalledWith('Unknown mode: invalid');
  });
});
