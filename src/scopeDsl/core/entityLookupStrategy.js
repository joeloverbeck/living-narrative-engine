import { devOnlyAssert } from './devOnlyAssert.js';

/**
 * Creates a reusable entity lookup strategy that prefers getEntityInstance over legacy helpers.
 *
 * @param {object} options
 * @param {import('../../interfaces/IEntityManager.js').IEntityManager|null} options.entityManager
 * @returns {{ resolve: (entityId: string) => object|undefined, describeOrder: () => string[] }}
 */
export function createEntityLookupStrategy({
  entityManager = null,
} = {}) {
  const hasEntityManager = Boolean(entityManager);
  const supportsGetEntityInstance =
    hasEntityManager && typeof entityManager.getEntityInstance === 'function';
  const supportsGetEntity =
    hasEntityManager && typeof entityManager.getEntity === 'function';

  if (hasEntityManager) {
    devOnlyAssert(
      Boolean(supportsGetEntityInstance || supportsGetEntity),
      'ScopeDSL expects runtimeCtx.entityManager to expose getEntityInstance or getEntity.'
    );
  }

  const order = [];
  if (supportsGetEntityInstance) {
    order.push('getEntityInstance');
  }
  if (supportsGetEntity) {
    order.push('getEntity');
  }

  return {
    resolve(entityId) {
      if (!entityId || !hasEntityManager) {
        return undefined;
      }

      if (supportsGetEntityInstance) {
        const entity = entityManager.getEntityInstance(entityId);
        if (entity) {
          return entity;
        }
      }

      if (supportsGetEntity) {
        return entityManager.getEntity(entityId);
      }

      return undefined;
    },
    describeOrder() {
      return order.slice();
    },
  };
}

export default createEntityLookupStrategy;
