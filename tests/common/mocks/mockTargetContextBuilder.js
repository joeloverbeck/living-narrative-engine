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
        const dependentContext = {
          ...baseContext,
          resolvedTargets,
          targetDef,
        };

        // Include resolved target data for dependent scopes
        // For contextFrom: "primary", add the primary target as "target"
        if (targetDef?.contextFrom === 'primary' && resolvedTargets.primary) {
          const primaryTargets = Array.from(resolvedTargets.primary);
          if (primaryTargets.length > 0) {
            const primaryTarget = primaryTargets[0];
            // Check if primaryTarget is already an entity object or just an ID
            if (typeof primaryTarget === 'object' && primaryTarget.entity) {
              // It's a resolved target object with entity property
              dependentContext.target = primaryTarget.entity;
            } else if (typeof primaryTarget === 'string') {
              // It's just an ID, so get the entity
              const targetEntity =
                entityManager?.getEntityInstance?.(primaryTarget);
              dependentContext.target = targetEntity || {
                id: primaryTarget,
                components: {},
              };
            } else if (typeof primaryTarget === 'object' && primaryTarget.id) {
              // It's already an entity object
              dependentContext.target = primaryTarget;
            }
          }
        }

        return dependentContext;
      }),
  };
}

export default createMockTargetContextBuilder;
