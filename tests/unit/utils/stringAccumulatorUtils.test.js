// tests/utils/stringAccumulator.test.js

import { StringAccumulator } from '../../../src/utils/stringAccumulatorUtils.js';
import { describe, test, expect } from '@jest/globals';

describe('StringAccumulator', () => {
  test('length begins at 0', () => {
    const acc = new StringAccumulator();
    expect(acc.length).toBe(0);
  });

  test('length increments correctly', () => {
    const acc = new StringAccumulator();
    acc.append('a');
    expect(acc.length).toBe(1);
    acc.append('bc');
    expect(acc.length).toBe(3);
  });
  test('append sequence returns correct final string', () => {
    const acc = new StringAccumulator();
    acc.append('a');
    acc.append('b');
    acc.append('c');
    expect(acc.toString()).toBe('abc');
  });

  test('length matches manual concat', () => {
    const pieces = ['hello', ' ', 'world'];
    const acc = new StringAccumulator();
    pieces.forEach((p) => acc.append(p));
    const manual = pieces.join('');
    expect(acc.length).toBe(manual.length);
    expect(acc.toString()).toBe(manual);
  });

  test('appending numbers and booleans coerces to string', () => {
    const acc = new StringAccumulator();
    acc.append(123);
    acc.append(true);
    // '123true' has length 7
    expect(acc.toString()).toBe('123true');
    expect(acc.length).toBe('123true'.length);
  });
});
