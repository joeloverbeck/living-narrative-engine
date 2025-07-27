/**
 * @file Performance benchmarks for StringAccumulator utility
 * @description Tests the performance characteristics of StringAccumulator
 * compared to direct string concatenation methods.
 */

import { describe, test, expect } from '@jest/globals';
import { StringAccumulator } from '../../../src/utils/stringAccumulatorUtils.js';

describe('StringAccumulator Performance', () => {
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

  test('performance with varying string sizes', () => {
    const iterations = 1000;
    const sizes = [10, 100, 1000];

    sizes.forEach((size) => {
      const testString = 'a'.repeat(size);

      // Test StringAccumulator
      const acc = new StringAccumulator();
      const startAcc = performance.now();
      for (let i = 0; i < iterations; i++) {
        acc.append(testString);
      }
      const accResult = acc.toString();
      const accTime = performance.now() - startAcc;

      // Test direct concatenation
      let direct = '';
      const startDirect = performance.now();
      for (let i = 0; i < iterations; i++) {
        direct += testString;
      }
      const directTime = performance.now() - startDirect;

      console.log(
        `Size ${size}: StringAccumulator=${accTime.toFixed(2)}ms, direct +=${directTime.toFixed(2)}ms`
      );

      expect(accResult).toHaveLength(iterations * size);
      expect(direct).toHaveLength(iterations * size);
    });
  });

  test('memory efficiency with large concatenations', () => {
    const largeString = 'x'.repeat(1000);
    const iterations = 100;

    const acc = new StringAccumulator();
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      acc.append(largeString);
    }

    const result = acc.toString();
    const endTime = performance.now();
    const totalTime = endTime - startTime;

    expect(result).toHaveLength(iterations * largeString.length);
    expect(totalTime).toBeLessThan(100); // Should complete within 100ms

    console.log(`Large concatenation completed in ${totalTime.toFixed(2)}ms`);
  });
});
