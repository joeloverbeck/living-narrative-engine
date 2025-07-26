/**
 * @file Mock Target Context Builder for testing
 * @description Provides a mock implementation of TargetContextBuilder for unit and integration tests
 */

import { jest } from '@jest/globals';

/**
 * Creates a mock TargetContextBuilder instance
 *
 * @returns {object} Mock TargetContextBuilder
 */
export function createMockTargetContextBuilder() {
  return {
    buildBaseContext: jest.fn().mockImplementation((actorId, locationId) => {
      return {
        actor: actorId,
        location: locationId,
        gameState: {},
        // Add any other properties that the real implementation returns
      };
    }),

    buildDependentContext: jest
      .fn()
      .mockImplementation((baseContext, resolvedTargets, targetDef) => {
        return {
          ...baseContext,
          resolvedTargets,
          targetDef,
          // Include resolved target data for dependent scopes
          ...Object.entries(resolvedTargets).reduce((acc, [key, targets]) => {
            acc[key] = targets;
            return acc;
          }, {}),
        };
      }),
  };
}

export default createMockTargetContextBuilder;