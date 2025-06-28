import createDepthGuard from './depthGuard.js';
import createCycleDetector from './cycleDetector.js';
import createDispatcher from '../nodes/dispatcher.js';

/**
 * Creates a scope engine factory with the provided configuration
 *
 * @param {Array | object} resolversOrConfig - Array of resolvers or config object
 * @param {number} [maxDepth] - Maximum expression depth (for array API)
 * @returns {object} Scope engine instance
 */
export default function createScopeEngine(resolversOrConfig, maxDepth = 4) {
  // Handle both APIs:
  // 1. Ticket API: createScopeEngine(resolvers, maxDepth)
  // 2. Test API: createScopeEngine({ resolvers, logger, maxDepth })
  let resolvers, logger;

  if (Array.isArray(resolversOrConfig)) {
    // Ticket API: createScopeEngine(resolvers, maxDepth)
    resolvers = resolversOrConfig;
    logger = { debug: () => {} }; // Dummy logger for ticket API
  } else {
    // Test API: createScopeEngine({ resolvers, logger, maxDepth })
    const config = resolversOrConfig || {};
    ({ resolvers, logger, maxDepth = 4 } = config);

    if (!logger) {
      throw new Error('Logger is required for createScopeEngine');
    }

    if (!resolvers || !Array.isArray(resolvers) || resolvers.length === 0) {
      throw new Error('Resolvers array is required and must not be empty');
    }
  }

  let depth = createDepthGuard(maxDepth);
  const cycle = createCycleDetector();
  const dispatch = createDispatcher(resolvers);

  // Generate unique key for a node for cycle detection
  /**
   *
   * @param node
   */
  function nodeKey(node) {
    return `${node.type}:${node.field || ''}:${node.param || ''}`;
  }

  /**
   *
   * @param node
   * @param ctx
   * @param level
   */
  function walk(node, ctx, level) {
    depth.ensure(level);
    cycle.enter(nodeKey(node));
    try {
      return dispatch.resolve(node, {
        ...ctx,
        walk: (n) => walk(n, ctx, level + 1),
      });
    } finally {
      cycle.leave();
    }
  }

  return {
    resolve(ast, actor, ports, trace = null) {
      const source = 'ScopeEngine';
      trace?.addLog('step', 'Starting scope resolution.', source, { ast });

      const result = walk(
        ast,
        {
          actorEntity: actor,
          runtimeCtx: ports,
          depth: 0,
          trace,
          ...ports,
        },
        0
      );

      const finalTargets = Array.from(result);
      trace?.addLog(
        'success',
        `Scope resolution finished. Found ${result.size} target(s).`,
        source,
        { targets: finalTargets }
      );

      return result;
    },
    setMaxDepth(n) {
      if (typeof n !== 'number' || n < 1) {
        throw new Error('Max depth must be a positive number');
      }
      depth = createDepthGuard(n);
      logger.debug(`Scope engine max depth updated to ${n}`);
    },
  };
}
