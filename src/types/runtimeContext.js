/**
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('../interfaces/ISpatialIndexManager.js').ISpatialIndexManager} ISpatialIndexManager
 * @typedef {import('../logic/jsonLogicEvaluationService.js').default} JsonLogicEval
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../dependencyInjection/appContainer.js').default} AppContainer
 */

/**
 * @typedef {object} RuntimeContext
 * @property {IEntityManager} entityManager - Required for entity lookups.
 * @property {ISpatialIndexManager} [spatialIndexManager] - Spatial queries when available (required by some planners/resolvers).
 * @property {JsonLogicEval} [jsonLogicEval] - Required when filter evaluation is used.
 * @property {ILogger} [logger] - Used for diagnostics when provided.
 * @property {object|string|null} [location] - Current location entity or ID for location.* scopes.
 * @property {object} [tracer] - Scope evaluation tracer for diagnostics.
 * @property {AppContainer} [container] - DI container for service resolution.
 * @property {object} [componentRegistry] - Component registry with getDefinition().
 * @property {object} [target] - Target entity/context for target sources.
 * @property {object} [targets] - Multi-target context for targets.* scopes.
 * @property {object} [scopeEntityLookupDebug] - Debug config for entity lookup strategy.
 * @property {object} [scopeEntityLookupStrategy] - Custom entity lookup strategy.
 */

export {};
