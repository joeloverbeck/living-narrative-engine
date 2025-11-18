import { devOnlyAssert } from './devOnlyAssert.js';

/**
 *
 * @param entityManager
 */
function describeOrderFor(entityManager) {
  if (!entityManager) {
    return [];
  }

  const order = [];
  if (typeof entityManager.getEntityInstance === 'function') {
    order.push('getEntityInstance');
  }
  if (typeof entityManager.getEntity === 'function') {
    order.push('getEntity');
  }
  return order;
}

/**
 *
 * @param entityManager
 */
function validateEntityManager(entityManager) {
  if (!entityManager) {
    return;
  }

  const hasGetEntityInstance =
    typeof entityManager.getEntityInstance === 'function';
  const hasGetEntity = typeof entityManager.getEntity === 'function';

  devOnlyAssert(
    Boolean(hasGetEntityInstance || hasGetEntity),
    'ScopeDSL expects runtimeCtx.entityManager to expose getEntityInstance or getEntity.'
  );
}

/**
 *
 * @param root0
 * @param root0.trace
 * @param root0.logger
 * @param root0.debugConfig
 */
function createResolverChangeEmitter({ trace = null, logger = null, debugConfig }) {
  const debugEnabled = Boolean(debugConfig?.enabled);
  let lastResolverUsed = null;

  const emit = (resolver, entityManager) => {
    if (resolver === lastResolverUsed) {
      return;
    }

    lastResolverUsed = resolver;

    if (!debugEnabled) {
      return;
    }

    const payload = {
      resolver,
      order: describeOrderFor(entityManager),
    };

    if (trace?.addLog) {
      trace.addLog(
        'debug',
        'ScopeDSL entity lookup resolver switched.',
        'ScopeDSL.EntityLookupStrategy',
        payload
      );
      return;
    }

    if (logger?.debug) {
      logger.debug('ScopeDSL entity lookup resolver switched.', payload);
    }
  };

  const reset = () => {
    lastResolverUsed = null;
  };

  return { emit, reset };
}

/**
 * Creates a reusable entity lookup strategy that prefers getEntityInstance over legacy helpers.
 *
 * @param {object} options
 * @param {import('../../interfaces/IEntityManager.js').IEntityManager|null} options.entityManager
 * @param {import('../../actions/tracing/traceContext.js').TraceContext|null} [options.trace]
 * @param {import('../../interfaces/coreServices.js').ILogger|null} [options.logger]
 * @param {object|null} [options.debugConfig]
 * @returns {{ resolve: (entityId: string) => object|undefined, describeOrder: () => string[], refreshCapabilities: (entityManager?: import('../../interfaces/IEntityManager.js').IEntityManager|null) => string[] }}
 */
export function createEntityLookupStrategy({
  entityManager = null,
  trace = null,
  logger = null,
  debugConfig = null,
} = {}) {
  validateEntityManager(entityManager);

  let currentEntityManager = entityManager;
  const { emit, reset } = createResolverChangeEmitter({
    trace,
    logger,
    debugConfig,
  });

  /**
   *
   * @param entityId
   */
  function resolve(entityId) {
    if (!entityId) {
      return undefined;
    }

    if (!currentEntityManager) {
      emit('miss', currentEntityManager);
      return undefined;
    }

    const hasGetEntityInstance =
      typeof currentEntityManager.getEntityInstance === 'function';
    if (hasGetEntityInstance) {
      const entity = currentEntityManager.getEntityInstance(entityId);
      if (entity) {
        emit('getEntityInstance', currentEntityManager);
        return entity;
      }
    }

    const hasGetEntity =
      typeof currentEntityManager.getEntity === 'function';
    if (hasGetEntity) {
      const entity = currentEntityManager.getEntity(entityId);
      if (entity) {
        emit('getEntity', currentEntityManager);
        return entity;
      }
    }

    emit('miss', currentEntityManager);
    return undefined;
  }

  /**
   *
   */
  function describeOrder() {
    return describeOrderFor(currentEntityManager);
  }

  /**
   *
   * @param nextEntityManager
   */
  function refreshCapabilities(nextEntityManager) {
    if (typeof nextEntityManager !== 'undefined') {
      if (nextEntityManager === null) {
        currentEntityManager = null;
        reset();
      } else if (nextEntityManager !== currentEntityManager) {
        validateEntityManager(nextEntityManager);
        currentEntityManager = nextEntityManager;
        reset();
      }
    }

    return describeOrder();
  }

  return {
    resolve,
    describeOrder,
    refreshCapabilities,
  };
}

export default createEntityLookupStrategy;
