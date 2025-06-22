import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { advancedArrayModify } from '../../../src/logic/utils/arrayModifyUtils.js';

describe('advancedArrayModify', () => {
  let logger;

  beforeEach(() => {
    logger = { error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
  });

  it('push returns new array and result', () => {
    const arr = [1];
    const { nextArray, result } = advancedArrayModify('push', arr, 2, logger);
    expect(nextArray).toEqual([1, 2]);
    expect(result).toEqual([1, 2]);
    expect(arr).toEqual([1]);
    expect(nextArray).not.toBe(arr);
  });

  it('push_unique with object only adds when not present', () => {
    const obj = { a: 1 };
    const arr = [{ a: 1 }];
    const { nextArray } = advancedArrayModify('push_unique', arr, obj, logger);
    expect(nextArray).toEqual(arr);
    expect(nextArray).not.toBe(arr); // returned array should be new
    expect(arr).toEqual([{ a: 1 }]);

    const { nextArray: newArr } = advancedArrayModify(
      'push_unique',
      arr,
      { a: 2 },
      logger
    );
    expect(newArr).toEqual([...arr, { a: 2 }]);
    expect(arr).toEqual([{ a: 1 }]);
  });

  it('pop returns popped item', () => {
    const arr = [1, 2];
    const { nextArray, result } = advancedArrayModify('pop', arr, null, logger);
    expect(nextArray).toEqual([1]);
    expect(result).toBe(2);
    expect(arr).toEqual([1, 2]);
    expect(nextArray).not.toBe(arr);
  });

  it('remove_by_value removes object by deep match', () => {
    const target = { id: 1 };
    const arr = [{ id: 1 }, { id: 2 }];
    const { nextArray } = advancedArrayModify(
      'remove_by_value',
      arr,
      target,
      logger
    );
    expect(nextArray).toEqual([{ id: 2 }]);
    expect(arr).toEqual([{ id: 1 }, { id: 2 }]);
    expect(nextArray).not.toBe(arr);
  });

  it('remove_by_value returns new array when value not found', () => {
    const arr = [1, 2];
    const { nextArray } = advancedArrayModify(
      'remove_by_value',
      arr,
      3,
      logger
    );
    expect(nextArray).toEqual([1, 2]);
    expect(nextArray).not.toBe(arr);
    expect(arr).toEqual([1, 2]);
  });
});
