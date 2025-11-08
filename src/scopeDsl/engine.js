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
import ContextMerger from './core/contextMerger.js';
import createDispatcher from './nodes/dispatcher.js';
import createSourceResolver from './nodes/sourceResolver.js';
import createStepResolver from './nodes/stepResolver.js';
import createFilterResolver from './nodes/filterResolver.js';
import createUnionResolver from './nodes/unionResolver.js';
import createArrayIterationResolver from './nodes/arrayIterationResolver.js';
import createClothingStepResolver from './nodes/clothingStepResolver.js';
import createSlotAccessResolver from './nodes/slotAccessResolver.js';
import createScopeReferenceResolver from './nodes/scopeReferenceResolver.js';
import { ParameterValidator } from './core/parameterValidator.js';
import { tokens } from '../dependencyInjection/tokens.js';

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
  constructor({ scopeRegistry = null, errorHandler = null } = {}) {
    super();
    this.maxDepth = 12;
    this.contextMerger = new ContextMerger();
    this.scopeRegistry = scopeRegistry;
    this.errorHandler = errorHandler;
  }

  setMaxDepth(n) {
    this.maxDepth = n;
  }

  /**
   * Creates a provider that returns the current location.
   *
   * @private
   * @param {RuntimeContext} runtimeCtx - Runtime context with location info.
   * @returns {{getLocation: function(): {id:string}|null}} Location provider.
   */
  _createLocationProvider(runtimeCtx) {
    return {
      getLocation: () => runtimeCtx?.location,
    };
  }

  /**
   * Creates a gateway for entity operations used by resolvers.
   *
   * @private
   * @param {RuntimeContext} runtimeCtx - Runtime context containing entity manager.
   * @returns {object} Gateway with helper methods for entities.
   */
  _createEntitiesGateway(runtimeCtx) {
    return {
      getEntities: () => {
        const em = runtimeCtx?.entityManager;
        if (em?.getEntities) {
          return em.getEntities();
        }

        // Fallback: try different entity storage patterns
        if (em?.entities) {
          // If entities is a Map, use .values()
          if (typeof em.entities.values === 'function') {
            return Array.from(em.entities.values());
          }
          // If entities is already an array
          if (Array.isArray(em.entities)) {
            return em.entities;
          }
          // If entities is an object, get values
          if (typeof em.entities === 'object') {
            return Object.values(em.entities);
          }
        }

        // Final fallback
        return [];
      },
      getEntitiesWithComponent: (cid) =>
        runtimeCtx?.entityManager?.getEntitiesWithComponent(cid),
      hasComponent: (eid, cid) => {
        const em = runtimeCtx?.entityManager;
        return em?.hasComponent ? em.hasComponent(eid, cid) : false;
      },
      getComponentData: (eid, cid) =>
        runtimeCtx?.entityManager?.getComponentData(eid, cid),
      getEntityInstance: (eid) => {
        const em = runtimeCtx?.entityManager;
        return em?.getEntity ? em.getEntity(eid) : em?.getEntityInstance(eid);
      },
      getItemComponents: (itemId) => {
        // Primary path: Check if it's an entity (most clothing items)
        const entityManager = runtimeCtx?.entityManager;
        const entity = entityManager?.getEntity
          ? entityManager.getEntity(itemId)
          : entityManager?.getEntityInstance(itemId);

        if (entity) {
          // Convert entity components to plain object for JSON Logic
          const components = {};
          if (entity.components instanceof Map) {
            for (const [componentId, data] of entity.components) {
              components[componentId] = data;
            }
          } else if (
            entity.components &&
            typeof entity.components === 'object'
          ) {
            Object.assign(components, entity.components);
          } else if (Array.isArray(entity.componentTypeIds)) {
            // Build components from componentTypeIds
            for (const componentTypeId of entity.componentTypeIds) {
              const data =
                entity.getComponentData?.(componentTypeId) ||
                entityManager?.getComponentData(itemId, componentTypeId);
              if (data) {
                components[componentTypeId] = data;
              }
            }
          }
          return components;
        }

        // Fallback: Try component registry for item templates/definitions
        const componentRegistry = runtimeCtx?.componentRegistry;
        if (componentRegistry) {
          // Check for item definitions in registry
          const itemDef = componentRegistry.getDefinition?.(`item:${itemId}`);
          if (itemDef?.components) {
            return itemDef.components;
          }

          // Check clothing-specific definitions
          const clothingDef = componentRegistry.getDefinition?.(
            `clothing:${itemId}`
          );
          if (clothingDef?.components) {
            return clothingDef.components;
          }
        }

        return null;
      },
    };
  }

  /**
   * Creates an adapter for evaluating JSON logic expressions.
   *
   * @private
   * @param {RuntimeContext} runtimeCtx - Runtime context with logic evaluator.
   * @returns {{evaluate: function(object, object): any}} Logic evaluator.
   */
  _createLogicEvaluator(runtimeCtx) {
    return {
      evaluate: (logic, context) =>
        runtimeCtx?.jsonLogicEval?.evaluate(logic, context),
    };
  }

  /**
   * Constructs the list of node resolvers with clothing support.
   *
   * @private
   * @param {object} deps - Resolver dependencies.
   * @param {object} deps.locationProvider - Location provider.
   * @param {object} deps.entitiesGateway - Entities gateway.
   * @param {object} deps.logicEval - Logic evaluator.
   * @param {object} deps.runtimeCtx - Runtime context for service resolution.
   * @returns {Array<object>} Array of resolver objects including clothing resolvers.
   */
  _createResolvers({ locationProvider, entitiesGateway, logicEval, runtimeCtx }) {
    // Get ClothingAccessibilityService from runtime context if available
    const clothingAccessibilityService = runtimeCtx?.container?.resolve?.(
      tokens.ClothingAccessibilityService
    ) || null;

    // Create clothing resolvers
    const clothingStepResolver = createClothingStepResolver({
      entitiesGateway,
    });
    const slotAccessResolver = createSlotAccessResolver({ entitiesGateway });

    const resolvers = [
      // Clothing resolvers get priority for their specific fields
      clothingStepResolver,
      slotAccessResolver,

      // Existing resolvers maintain their order
      createSourceResolver({
        entitiesGateway,
        locationProvider,
        errorHandler: this.errorHandler,
      }),
      createStepResolver({
        entitiesGateway,
        errorHandler: this.errorHandler,
      }),
      createFilterResolver({
        logicEval,
        entitiesGateway,
        locationProvider,
        errorHandler: this.errorHandler,
      }),
      createUnionResolver(),
      createArrayIterationResolver({ 
        errorHandler: this.errorHandler,
        clothingAccessibilityService // Add service injection
      }),
    ];

    // Add scope reference resolver if scope registry is available
    if (this.scopeRegistry) {
      resolvers.push(
        createScopeReferenceResolver({
          scopeRegistry: this.scopeRegistry,
          cycleDetector: null, // Use resolution-scoped cycle detector from context
          errorHandler: this.errorHandler,
        })
      );
    }

    return resolvers;
  }

  /**
   * Ensures the dispatcher is created and ready for resolution.
   *
   * @private
   * @param {RuntimeContext} runtimeCtx - Runtime context providing dependencies.
   * @returns {object} Dispatcher used to resolve nodes.
   */
  _ensureInitialized(runtimeCtx) {
    const locationProvider = this._createLocationProvider(runtimeCtx);
    const entitiesGateway = this._createEntitiesGateway(runtimeCtx);
    const logicEval = this._createLogicEvaluator(runtimeCtx);
    const resolvers = this._createResolvers({
      locationProvider,
      entitiesGateway,
      logicEval,
      runtimeCtx,
    });
    return createDispatcher(resolvers);
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
    // Validate parameters - Fail fast with clear errors BEFORE any other code
    ParameterValidator.validateAST(ast, 'ScopeEngine.resolve');
    ParameterValidator.validateActorEntity(actorEntity, 'ScopeEngine.resolve');
    ParameterValidator.validateRuntimeContext(runtimeCtx, 'ScopeEngine.resolve');

    const source = 'ScopeEngine';

    // TEMPORARY DIAGNOSTIC: Log scope resolution entry
    const logger = runtimeCtx?.logger;
    if (logger && typeof logger.debug === 'function') {
      logger.debug('[DIAGNOSTIC] ScopeEngine.resolve called:', {
        astType: ast?.type,
        astValue: ast?.value,
        astKind: ast?.kind,
        astParam: ast?.param,
        actorId: actorEntity?.id,
        hasRuntimeCtx: !!runtimeCtx,
        hasEntityManager: !!runtimeCtx?.entityManager,
      });
    } else if (typeof console !== 'undefined' && typeof console.debug === 'function') {
      console.debug('[DIAGNOSTIC] ScopeEngine.resolve called:', {
        astType: ast?.type,
        astValue: ast?.value,
        astKind: ast?.kind,
        astParam: ast?.param,
        actorId: actorEntity?.id,
        hasRuntimeCtx: !!runtimeCtx,
        hasEntityManager: !!runtimeCtx?.entityManager,
      });
    }

    trace?.addLog('step', 'Starting scope resolution.', source, { ast });

    // Create isolated cycle detector and depth guard for this resolution
    // This ensures no state is shared between concurrent resolve() calls
    const cycleDetector = createCycleDetector();
    const depthGuard = createDepthGuard(this.maxDepth);

    // Ensure engine is initialized with resolvers
    const dispatcher = this._ensureInitialized(runtimeCtx);

    // Create resolution context for resolvers with wrapped dispatcher
    const ctx = {
      actorEntity,
      runtimeCtx,
      trace,
      dispatcher: {
        resolve: (node, innerCtx) =>
          this._resolveWithDepthAndCycleChecking(
            node,
            innerCtx,
            dispatcher,
            cycleDetector,
            depthGuard
          ),
      },
      depth: 0,
      cycleDetector,
      depthGuard,
    };

    const result = this._resolveWithDepthAndCycleChecking(
      ast,
      ctx,
      dispatcher,
      cycleDetector,
      depthGuard
    );

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
   * @param {object} dispatcher - Node dispatcher for resolution
   * @param {object} cycleDetector - Cycle detector instance for this resolution
   * @param {object} depthGuard - Depth guard instance for this resolution
   * @returns {Set} Set of resolved values
   * @private
   */
  _resolveWithDepthAndCycleChecking(
    node,
    ctx,
    dispatcher,
    cycleDetector,
    depthGuard
  ) {
    // Check depth
    depthGuard.ensure(ctx.depth);

    // Generate key for cycle detection
    let nodeKey;
    if (
      node.type === 'Union' ||
      node.type === 'Filter' ||
      node.type === 'ArrayIterationStep'
    ) {
      // For union, filter, and array iteration nodes, create a unique key based on the node object reference
      // This prevents false cycle detection when multiple nodes of the same type are nested
      nodeKey = `${node.type}:${Math.random().toString(36).substr(2, 9)}`;
    } else if (node.type === 'ScopeReference') {
      // For scope references, use the actual scope ID as the key
      // This allows proper cycle detection when scopes reference each other
      nodeKey = `ScopeReference:${node.scopeId}`;
    } else {
      nodeKey = `${node.type}:${node.field || ''}:${node.param || ''}`;
    }

    // Enter cycle detection
    cycleDetector.enter(nodeKey);

    try {
      // Create new context with incremented depth and wrapped dispatcher
      const newCtx = {
        ...ctx,
        depth: ctx.depth + 1,
        dispatcher: {
          resolve: (innerNode, innerCtx) => {
            // Use safe context merging
            const mergedCtx = this.contextMerger.merge(ctx, innerCtx);

            return this._resolveWithDepthAndCycleChecking(
              innerNode,
              mergedCtx,
              dispatcher,
              cycleDetector,
              depthGuard
            );
          },
        },
      };

      // Use dispatcher to resolve
      return dispatcher.resolve(node, newCtx);
    } finally {
      // Always leave cycle detection
      cycleDetector.leave();
    }
  }
}

export default ScopeEngine;
