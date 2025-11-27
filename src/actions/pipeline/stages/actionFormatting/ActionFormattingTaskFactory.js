/**
 * @typedef {import('../../../../entities/entity.js').default} Entity
 * @typedef {import('../../../../interfaces/IGameDataRepository.js').ActionDefinition} ActionDefinition
 * @typedef {import('../../../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext
 */

/**
 * @typedef {object} ActionFormattingTask
 * @property {Entity} actor - Actor performing the action
 * @property {ActionDefinition} actionDef - Action definition metadata
 * @property {ActionTargetContext[]} targetContexts - Legacy target contexts
 * @property {object|null} resolvedTargets - Normalised resolved targets reference
 * @property {object|null} targetDefinitions - Target definition metadata
 * @property {boolean} isMultiTarget - Indicates if the task should be treated as multi-target aware
 * @property {object} formatterOptions - Shared formatter options prepared for the task
 * @property {{ source: 'per-action'|'batch'|'legacy', hasPerActionMetadata: boolean }} metadata - Diagnostic metadata
 * @property {string|null} formattedTemplate - Pre-formatted template (e.g., with {chance} replaced), or null if using actionDef.template directly
 */

/**
 * @typedef {object} ActionFormattingTaskFactoryOptions
 * @property {Entity} actor - Actor performing the action
 * @property {{
 *   actionDef: ActionDefinition,
 *   targetContexts?: ActionTargetContext[],
 *   resolvedTargets?: object|null,
 *   targetDefinitions?: object|null,
 *   isMultiTarget?: boolean,
 *   formattedTemplate?: string|null
 * }} actionWithTargets - Raw action data including per-action metadata
 * @property {object} formatterOptions - Shared formatter configuration for command formatters
 * @property {object|null} [batchResolvedTargets] - Batch-level resolved targets fallback
 * @property {object|null} [batchTargetDefinitions] - Batch-level target definition fallback
 */

/**
 * @description Creates an {@link ActionFormattingTask} from stage inputs.
 * @param {ActionFormattingTaskFactoryOptions} options - Task creation options
 * @returns {ActionFormattingTask} Normalised task payload
 */
export function createActionFormattingTask({
  actor,
  actionWithTargets,
  formatterOptions,
  batchResolvedTargets = null,
  batchTargetDefinitions = null,
}) {
  const {
    actionDef,
    targetContexts = [],
    resolvedTargets = null,
    targetDefinitions = null,
    isMultiTarget,
    formattedTemplate = null,
  } = actionWithTargets;

  const hasPerActionMetadata = Boolean(
    resolvedTargets && targetDefinitions && typeof isMultiTarget === 'boolean'
  );

  const resolvedTargetsForTask =
    resolvedTargets ?? batchResolvedTargets ?? null;
  const targetDefinitionsForTask =
    targetDefinitions ?? batchTargetDefinitions ?? null;

  const inferredIsMultiTarget = Boolean(
    typeof isMultiTarget === 'boolean'
      ? isMultiTarget
      : resolvedTargetsForTask && targetDefinitionsForTask
  );

  let source = 'legacy';
  if (hasPerActionMetadata) {
    source = 'per-action';
  } else if (resolvedTargetsForTask && targetDefinitionsForTask) {
    source = 'batch';
  }

  return {
    actor,
    actionDef,
    targetContexts,
    resolvedTargets: resolvedTargetsForTask,
    targetDefinitions: targetDefinitionsForTask,
    isMultiTarget: inferredIsMultiTarget,
    formatterOptions,
    formattedTemplate,
    metadata: {
      source,
      hasPerActionMetadata,
    },
  };
}

export default createActionFormattingTask;
