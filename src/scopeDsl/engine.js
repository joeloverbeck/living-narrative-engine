// src/scopeDsl/engine.js

/**
 * @file Scope-DSL Engine
 * @description AST walker/query engine that resolves Scope-DSL expressions to sets of entity IDs
 */

import ScopeDepthError from '../errors/scopeDepthError.js';
import ScopeCycleError from '../errors/scopeCycleError.js';
import { IScopeEngine } from '../interfaces/IScopeEngine.js';
import createDepthGuard from './core/depthGuard.js';
import createCycleDetector from './core/cycleDetector.js';
import createDispatcher from './nodes/dispatcher.js';
import createSourceResolver from './nodes/sourceResolver.js';
import createStepResolver from './nodes/stepResolver.js';
import createFilterResolver from './nodes/filterResolver.js';
import createUnionResolver from './nodes/unionResolver.js';
import createArrayIterationResolver from './nodes/arrayIterationResolver.js';

/** @typedef {import('../types/runtimeContext.js').RuntimeContext} RuntimeContext */

/**
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('../interfaces/ISpatialIndexManager.js').ISpatialIndexManager} ISpatialIndexManager
 * @typedef {import('../logic/jsonLogicEvaluationService.js').default} JsonLogicEval
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../actions/tracing/traceContext.js').TraceContext} TraceContext
 */

/**
 * @typedef {object} AST
 * @property {string} type - Node type
 * @property {object} [parent] - Parent node
 * @property {string} [field] - Field name for Step nodes
 * @property {object} [logic] - JSON Logic object for Filter nodes
 * @property {object} [left] - Left expression for Union nodes
 * @property {object} [right] - Right expression for Union nodes
 * @property {string} [kind] - Source kind for Source nodes
 * @property {string} [param] - Parameter for Source nodes
 */

/**
 * Scope-DSL Engine that resolves AST expressions to sets of entity IDs
 *
 * @implements {IScopeEngine}
 */
class ScopeEngine extends IScopeEngine {
  constructor() {
    super(); // Call parent constructor
    this.maxDepth = 4;
    this.depthGuard = null;
    this.cycleDetector = null;
  }

  setMaxDepth(n) {
    this.maxDepth = n;
    if (this.depthGuard) {
      this.depthGuard = createDepthGuard(n);
    }
  }

  /**
   * Initialize the engine with resolvers
   * This method must be called before using resolve()
   *
   * @private
   */
  _ensureInitialized(runtimeCtx) {
    // Create adapters for resolvers to work with runtimeCtx
    const locationProvider = {
      getLocation: () => runtimeCtx?.location,
    };

    const entitiesGateway = {
      getEntities: () => {
        const em = runtimeCtx?.entityManager;
        return em?.getEntities
          ? em.getEntities()
          : Array.from(em?.entities?.values() || []);
      },
      getEntitiesWithComponent: (cid) => {
        return runtimeCtx?.entityManager?.getEntitiesWithComponent(cid);
      },
      hasComponent: (eid, cid) => {
        const em = runtimeCtx?.entityManager;
        return em?.hasComponent ? em.hasComponent(eid, cid) : false;
      },
      getComponentData: (eid, cid) => {
        return runtimeCtx?.entityManager?.getComponentData(eid, cid);
      },
      getEntityInstance: (eid) => {
        const em = runtimeCtx?.entityManager;
        return em?.getEntity ? em.getEntity(eid) : em?.getEntityInstance(eid);
      },
    };

    const logicEval = {
      evaluate: (logic, context) => {
        return runtimeCtx?.jsonLogicEval?.evaluate(logic, context);
      },
    };

    // Create resolvers
    const resolvers = [
      createSourceResolver({ entitiesGateway, locationProvider }),
      createStepResolver({ entitiesGateway }),
      createFilterResolver({ logicEval, entitiesGateway, locationProvider }),
      createUnionResolver(),
      createArrayIterationResolver(),
    ];

    const dispatcher = createDispatcher(resolvers);
    if (!this.depthGuard) {
      this.depthGuard = createDepthGuard(this.maxDepth);
    }
    if (!this.cycleDetector) {
      this.cycleDetector = createCycleDetector();
    }

    return dispatcher;
  }

  /**
   * Resolves a Scope-DSL AST to a set of entity IDs
   *
   * @param {AST} ast - The parsed AST
   * @param {object} actorEntity - The acting entity instance.
   * @param {RuntimeContext} runtimeCtx - Runtime context with services
   * @param {TraceContext} [trace] - Optional trace context for logging.
   * @returns {Set<string>} Set of entity IDs
   * @throws {ScopeDepthError} When expression depth exceeds maxDepth
   * @throws {ScopeCycleError} When a cycle is detected
   */
  resolve(ast, actorEntity, runtimeCtx, trace = null) {
    const source = 'ScopeEngine';
    trace?.addLog('step', 'Starting scope resolution.', source, { ast });

    // Ensure engine is initialized with resolvers
    const dispatcher = this._ensureInitialized(runtimeCtx);

    // Create resolution context for resolvers with wrapped dispatcher
    const ctx = {
      actorEntity,
      runtimeCtx,
      trace,
      dispatcher: {
        resolve: (node, innerCtx) =>
          this._resolveWithDepthAndCycleChecking(node, innerCtx, dispatcher),
      },
      depth: 0,
      cycleDetector: this.cycleDetector,
      depthGuard: this.depthGuard,
    };

    const result = this._resolveWithDepthAndCycleChecking(ast, ctx, dispatcher);

    const finalTargets = Array.from(result);
    trace?.addLog(
      'success',
      `Scope resolution finished. Found ${result.size} target(s).`,
      source,
      { targets: finalTargets }
    );
    return result;
  }

  /**
   * Resolves a node with depth and cycle checking
   *
   * @param {object} node - AST node
   * @param {object} ctx - Resolution context
   * @returns {Set} Set of resolved values
   * @private
   */
  _resolveWithDepthAndCycleChecking(node, ctx, dispatcher) {
    // Check depth
    ctx.depthGuard.ensure(ctx.depth);

    // Generate key for cycle detection
    const nodeKey = `${node.type}:${node.field || ''}:${node.param || ''}`;

    // Enter cycle detection
    ctx.cycleDetector.enter(nodeKey);

    try {
      // Create new context with incremented depth and wrapped dispatcher
      const newCtx = {
        ...ctx,
        depth: ctx.depth + 1,
        dispatcher: {
          resolve: (innerNode, innerCtx) => {
            // Use the context passed by the resolver, which already has the correct depth
            return this._resolveWithDepthAndCycleChecking(
              innerNode,
              innerCtx,
              dispatcher
            );
          },
        },
      };

      // Use dispatcher to resolve
      return dispatcher.resolve(node, newCtx);
    } finally {
      // Always leave cycle detection
      ctx.cycleDetector.leave();
    }
  }
}

export default ScopeEngine;
