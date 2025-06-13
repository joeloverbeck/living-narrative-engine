// tests/utils/stringAccumulator.test.js

import { StringAccumulator } from '../../src/utils/stringAccumulator.js';
import { describe, test, expect } from '@jest/globals';

describe('StringAccumulator', () => {
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

  test('benchmark test comparing StringAccumulator vs direct +=', () => {
    const iterations = 10000;

    const acc = new StringAccumulator();
    const startAcc = Date.now();
    for (let i = 0; i < iterations; i++) {
      acc.append('x');
    }
    const accResult = acc.toString();
    const accTime = Date.now() - startAcc;

    let direct = '';
    const startDirect = Date.now();
    for (let i = 0; i < iterations; i++) {
      direct += 'x';
    }
    const directTime = Date.now() - startDirect;

    // Log timings for developer awareness; test stays green regardless.
     
    console.log(
      `Benchmark: StringAccumulator=${accTime}ms, direct +==${directTime}ms`
    );

    expect(accResult).toHaveLength(iterations);
    expect(direct).toHaveLength(iterations);
  });
});
