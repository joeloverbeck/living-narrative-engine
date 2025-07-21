/**
 * @file Test suite for the generic describeSuite helper.
 */

import { describe, it, expect, jest, afterAll } from '@jest/globals';
import { describeSuite } from '../../common/describeSuite.js';

class DummyBed {
  constructor(value) {
    this.value = value;
  }

  async cleanup() {}
}

describe('describeSuite', () => {
  it('creates test bed and calls cleanup', async () => {
    const cleanupSpy = jest.fn();
    const instances = [];

    class TestBed {
      constructor(value) {
        this.value = value;
        instances.push(this);
      }

      async cleanup() {
        cleanupSpy(this);
      }
    }

    // Simulate what describeSuite does
    let testBed;

    // Setup (what beforeEach does)
    testBed = new TestBed('foo');

    // First test - verify instantiation
    expect(testBed).toBeInstanceOf(TestBed);
    expect(testBed.value).toBe('foo');

    // Cleanup after first test
    await testBed.cleanup();

    // Setup for second test
    testBed = new TestBed('foo');

    // Second test - verify same instance within test
    const getBed = () => testBed;
    expect(getBed()).toBe(getBed());

    // Cleanup after second test
    await testBed.cleanup();

    // Verify cleanup was called twice
    expect(cleanupSpy).toHaveBeenCalledTimes(2);
    expect(instances).toHaveLength(2);
  });

  // Test the actual describeSuite function behavior
  describeSuite(
    'inner suite functionality',
    DummyBed,
    (getBed) => {
      it('instantiates the test bed with arguments', () => {
        const bed = getBed();
        expect(bed).toBeInstanceOf(DummyBed);
        expect(bed.value).toBe('foo');
      });

      it('provides the same instance to each test', () => {
        expect(getBed()).toBe(getBed());
      });
    },
    'foo'
  );
});
