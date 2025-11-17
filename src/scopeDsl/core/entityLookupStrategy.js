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
  const boundGetEntityInstance = hasEntityManager &&
    typeof entityManager.getEntityInstance === 'function'
    ? entityManager.getEntityInstance.bind(entityManager)
    : null;
  const boundGetEntity = hasEntityManager && typeof entityManager.getEntity === 'function'
    ? entityManager.getEntity.bind(entityManager)
    : null;

  if (hasEntityManager) {
    devOnlyAssert(
      Boolean(boundGetEntityInstance || boundGetEntity),
      'ScopeDSL expects runtimeCtx.entityManager to expose getEntityInstance or getEntity.'
    );
  }

  const order = [];
  if (boundGetEntityInstance) {
    order.push('getEntityInstance');
  }
  if (boundGetEntity) {
    order.push('getEntity');
  }

  return {
    resolve(entityId) {
      if (!entityId || !hasEntityManager) {
        return undefined;
      }

      if (boundGetEntityInstance) {
        const entity = boundGetEntityInstance(entityId);
        if (entity) {
          return entity;
        }
      }

      if (boundGetEntity) {
        return boundGetEntity(entityId);
      }

      return undefined;
    },
    describeOrder() {
      return order.slice();
    },
  };
}

export default createEntityLookupStrategy;
