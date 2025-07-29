/**
 * @file Mock Target Context Builder for testing
 * @description Provides a mock implementation of TargetContextBuilder for unit and integration tests
 */

import { jest } from '@jest/globals';

/**
 * Creates a mock TargetContextBuilder instance
 *
 * @param entityManager
 * @returns {object} Mock TargetContextBuilder
 */
export function createMockTargetContextBuilder(entityManager) {
  return {
    buildBaseContext: jest.fn().mockImplementation((actorId, locationId) => {
      const actorEntity = entityManager?.getEntityInstance?.(actorId);
      const locationEntity = entityManager?.getEntityInstance?.(locationId);
      
      return {
        actor: actorEntity || { id: actorId, components: {} },
        location: locationEntity || { id: locationId, components: {} },
        game: {},
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
