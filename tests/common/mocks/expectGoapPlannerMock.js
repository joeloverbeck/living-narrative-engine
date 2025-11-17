import { expect } from '@jest/globals';
import { getRequiredPlannerMethods } from '../../../src/goap/planner/goapPlannerContractDefinition.js';

/**
 * Assert that a GOAP planner mock satisfies the runtime contract.
 * @param {object} mock - Planner mock instance
 */
export function expectGoapPlannerMock(mock) {
  expect(mock).toBeTruthy();

  for (const method of getRequiredPlannerMethods()) {
    expect(typeof mock[method]).toBe('function');
  }
}
