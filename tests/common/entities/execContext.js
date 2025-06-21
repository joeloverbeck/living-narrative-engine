/**
 * @file Helper for constructing ExecutionContext objects in tests.
 * @see tests/common/entities/execContext.js
 */

/**
 * Builds an {@link import('../../src/logic/defs.js').ExecutionContext} object from
 * the raw evaluation context supplied by OperationInterpreter and the core
 * services used by operation handlers.
 *
 * @param {object} params - Options object.
 * @param {import('../../src/logic/defs.js').JsonLogicEvaluationContext} params.evaluationContext
 *   - Raw evaluation context passed into the handler.
 * @param {import('../../src/entities/entityManager.js').default} params.entityManager
 *   - EntityManager instance used by operations.
 * @param {import('../../src/interfaces/coreServices.js').ILogger} params.logger
 *   - Logger instance for operation handlers.
 * @returns {import('../../src/logic/defs.js').ExecutionContext} Constructed execution context.
 */
export function buildExecContext({ evaluationContext, entityManager, logger }) {
  return { evaluationContext, entityManager, logger };
}
