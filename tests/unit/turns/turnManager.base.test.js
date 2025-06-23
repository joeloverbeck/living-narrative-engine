// src/tests/turns/turnManager.base.test.js
// --- FILE START (Corrected) ---

import { describeTurnManagerSuite } from '../../common/turns/turnManagerTestBed.js';
import { beforeEach, expect, test } from '@jest/globals';

describeTurnManagerSuite('TurnManager', (getBed) => {
  let testBed;

  beforeEach(() => {
    testBed = getBed();
  });

  // --- Basic Sanity / Setup Tests ---

  test('should exist and be a class', () => {
    const instance = testBed.turnManager;

    expect(instance).toBeDefined();
    expect(instance).toBeInstanceOf(testBed.turnManager.constructor);
  });

  // Further tests for start, stop, and other behaviors are covered in dedicated suites

  // Add more tests for start, stop, advanceTurn, etc. later
});
// --- FILE END ---
