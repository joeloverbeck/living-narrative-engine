/**
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('../interfaces/ISpatialIndexManager.js').ISpatialIndexManager} ISpatialIndexManager
 * @typedef {import('../logic/jsonLogicEvaluationService.js').default} JsonLogicEval
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../actions/tracing/traceContext.js').TraceContext} TraceContext
 */

/**
 * @typedef {object} RuntimeContext
 * @property {IEntityManager} entityManager
 * @property {ISpatialIndexManager} spatialIndexManager
 * @property {JsonLogicEval} jsonLogicEval
 * @property {ILogger} logger
 */

export {};
