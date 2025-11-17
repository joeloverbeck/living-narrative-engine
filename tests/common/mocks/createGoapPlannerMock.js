import { jest } from '@jest/globals';
import {
  getRequiredPlannerMethods,
  createPlannerContractSnapshot,
} from '../../../src/goap/planner/goapPlannerContractDefinition.js';

/**
 * Create a canonical GOAP planner mock that satisfies the runtime contract.
 * @param {object} [options]
 * @param {*} [options.planResult={ tasks: [] }] - Default plan result when plan() is invoked.
 * @param {*} [options.lastFailure=null] - Default value returned by getLastFailure().
 * @param {Function} [options.planImplementation] - Custom plan implementation.
 * @returns {object} Planner mock instance with helper mutators.
 */
export function createGoapPlannerMock(options = {}) {
  const state = {
    planResult: options.planResult ?? { tasks: [] },
    lastFailure: options.lastFailure ?? null,
  };

  const mock = {
    plan: jest.fn().mockImplementation((actorId, goal, initialState, planOptions = {}) => {
      if (typeof options.planImplementation === 'function') {
        return options.planImplementation(actorId, goal, initialState, planOptions);
      }
      return state.planResult;
    }),
    getLastFailure: jest.fn().mockImplementation(() => state.lastFailure),
    /**
     * Helper to override the next value returned by plan().
     * @param {*} result - Plan result payload
     * @returns {object} mock instance
     */
    withPlanResult(result) {
      state.planResult = result;
      return mock;
    },
    /**
     * Helper to replace plan() implementation entirely.
     * @param {Function} impl - New plan implementation
     * @returns {object} mock instance
     */
    withPlanImplementation(impl) {
      if (typeof impl === 'function') {
        mock.plan.mockImplementation(impl);
      }
      return mock;
    },
    /**
     * Helper to control getLastFailure() payloads.
     * @param {*} failure - Failure object or null
     * @returns {object} mock instance
     */
    withFailure(failure) {
      state.lastFailure = failure;
      return mock;
    },
    /**
     * Reset failure payload to null.
     * @returns {object} mock instance
     */
    clearFailure() {
      state.lastFailure = null;
      return mock;
    },
  };

  // Attach metadata consumers (debugger/tests) can read when needed.
  mock.__plannerContract = {
    snapshot: createPlannerContractSnapshot(mock),
    requiredMethods: getRequiredPlannerMethods(),
    createdAt: Date.now(),
  };

  return mock;
}
