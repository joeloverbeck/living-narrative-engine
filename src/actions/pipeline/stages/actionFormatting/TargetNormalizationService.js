import { TargetExtractionResult } from '../../../../entities/multiTarget/targetExtractionResult.js';

/**
 * @typedef {import('../../../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext
 */

/**
 * @typedef {object} TargetNormalizationResult
 * @property {Record<string, string[]>} targetIds - Normalized target identifiers grouped by placeholder
 * @property {import('../../../../entities/multiTarget/targetExtractionResult.js').TargetExtractionResult|null} targetExtractionResult - Structured extraction result
 * @property {ActionTargetContext|null} primaryTargetContext - Primary target context suitable for legacy fallbacks
 * @property {object} params - Stage-compatible parameter payload
 * @property {{ code: string, message: string }|null} [error] - Optional error descriptor when normalization fails
 */

/**
 * @typedef {object} TargetNormalizationOptions
 * @property {object|import('../../../../entities/multiTarget/targetExtractionResult.js').TargetExtractionResult|null|undefined} resolvedTargets - Incoming target metadata
 * @property {ActionTargetContext[]|undefined} [targetContexts] - Legacy target contexts used for fallbacks or display data
 * @property {boolean} [isMultiTarget=false] - Hint describing whether the originating action was multi-target aware
 * @property {string} [actionId] - Optional action identifier for diagnostics
 */

/**
 * @description Service responsible for normalising target metadata into the structures expected by {@link ActionFormattingStage}.
 */
export class TargetNormalizationService {
  #logger;

  /**
   * @param {{ logger?: import('../../../../logging/consoleLogger.js').default }} deps - Service dependencies
   */
  constructor({ logger } = {}) {
    this.#logger = logger;
  }

  /**
   * @description Normalises raw target metadata and produces stage-ready payloads.
   * @param {TargetNormalizationOptions} options - Normalisation input parameters
   * @returns {TargetNormalizationResult} Normalised target payload
   */
  normalize({
    resolvedTargets,
    targetContexts = [],
    isMultiTarget = false,
    actionId,
  }) {
    if (resolvedTargets instanceof TargetExtractionResult) {
      return this.#normalizeExtractionResult({
        extractionResult: resolvedTargets,
        targetContexts,
        isMultiTarget,
      });
    }

    if (this.#isResolvedTargetMap(resolvedTargets)) {
      return this.#normalizeResolvedTargetMap({
        resolvedTargets,
        isMultiTarget,
      });
    }

    if (Array.isArray(targetContexts) && targetContexts.length > 0) {
      return this.#normalizeFromTargetContexts({ targetContexts });
    }

    return {
      targetIds: {},
      targetExtractionResult: null,
      primaryTargetContext: null,
      params: {},
      error: {
        code: 'TARGETS_MISSING',
        message: actionId
          ? `No target information supplied for action '${actionId}'.`
          : 'No target information supplied for action.',
      },
    };
  }

  /**
   * @description Creates a normalised payload from an existing {@link TargetExtractionResult} instance.
   * @param {{ extractionResult: TargetExtractionResult, targetContexts: ActionTargetContext[], isMultiTarget: boolean }} params - Extraction normalisation inputs
   * @returns {TargetNormalizationResult} Target normalisation result
   */
  #normalizeExtractionResult({
    extractionResult,
    targetContexts,
    isMultiTarget,
  }) {
    const targetIds = {};
    for (const name of extractionResult.getTargetNames()) {
      const entityId = extractionResult.getEntityIdByPlaceholder(name);
      if (entityId) {
        targetIds[name] = [entityId];
      }
    }

    const primaryTargetContext = this.#resolvePrimaryFromExtractionResult(
      extractionResult,
      targetContexts
    );

    const params = this.#buildParams({
      targetIds,
      primaryTargetContext,
      isMultiTarget: isMultiTarget || extractionResult.isMultiTarget(),
    });

    return {
      targetIds,
      targetExtractionResult: extractionResult,
      primaryTargetContext,
      params,
      error: null,
    };
  }

  /**
   * @description Normalises legacy resolved target maps into stage-ready data structures.
   * @param {{ resolvedTargets: object, isMultiTarget: boolean }} params - Legacy resolved target information
   * @returns {TargetNormalizationResult} Target normalisation result
   */
  #normalizeResolvedTargetMap({ resolvedTargets, isMultiTarget }) {
    const targetIds = {};
    const invalidPlaceholders = [];

    for (const [placeholder, targets] of Object.entries(resolvedTargets)) {
      if (!Array.isArray(targets) || targets.length === 0) {
        continue;
      }

      const ids = [];
      for (const target of targets) {
        if (target && typeof target.id === 'string') {
          ids.push(target.id);
        } else {
          invalidPlaceholders.push(placeholder);
        }
      }

      if (ids.length > 0) {
        targetIds[placeholder] = ids;
      }
    }

    if (Object.keys(targetIds).length === 0) {
      return {
        targetIds: {},
        targetExtractionResult: null,
        primaryTargetContext: null,
        params: {},
        error: {
          code: 'TARGETS_INVALID',
          message:
            'Resolved targets were provided but no valid target identifiers could be extracted.',
        },
      };
    }

    if (invalidPlaceholders.length > 0) {
      this.#logger?.warn?.(
        `Invalid target entries detected for placeholders: ${invalidPlaceholders.join(', ')}`
      );
    }

    const primaryTargetContext = this.#resolvePrimaryFromResolvedTargets(
      resolvedTargets
    );

    const params = this.#buildParams({
      targetIds,
      primaryTargetContext,
      isMultiTarget: isMultiTarget || Object.keys(targetIds).length > 1,
    });

    const targetExtractionResult = TargetExtractionResult.fromResolvedParameters(
      {
        isMultiTarget: Boolean(
          params.isMultiTarget || Object.keys(targetIds).length > 1
        ),
        targetIds,
      },
      this.#logger
    );

    return {
      targetIds,
      targetExtractionResult,
      primaryTargetContext,
      params,
      error: null,
    };
  }

  /**
   * @description Normalises data derived from legacy target contexts when no resolved metadata is available.
   * @param {{ targetContexts: ActionTargetContext[] }} params - Legacy target contexts
   * @returns {TargetNormalizationResult} Target normalisation result
   */
  #normalizeFromTargetContexts({ targetContexts }) {
    const primaryTargetContext = this.#resolvePrimaryFromContexts(targetContexts);

    const targetExtractionResult = primaryTargetContext?.entityId
      ? TargetExtractionResult.fromResolvedParameters(
          { targetId: primaryTargetContext.entityId },
          this.#logger
        )
      : null;

    const params = this.#buildParams({
      targetIds: {},
      primaryTargetContext,
      isMultiTarget: false,
    });

    const hasExplicitNoTargetContext = targetContexts.some(
      (context) => context?.type === 'none'
    );

    if (hasExplicitNoTargetContext && !('targetId' in params)) {
      params.targetId = null;
    }

    return {
      targetIds: {},
      targetExtractionResult,
      primaryTargetContext,
      params,
      error: null,
    };
  }

  /**
   * @description Builds the params payload consumed by {@link ActionFormattingStage}.
   * @param {{ targetIds: Record<string, string[]>, primaryTargetContext: ActionTargetContext|null, isMultiTarget: boolean }} params - Parameter construction inputs
   * @returns {object} Stage parameter payload
   */
  #buildParams({ targetIds, primaryTargetContext, isMultiTarget }) {
    const params = {};
    const hasTargetIds = Object.keys(targetIds).length > 0;
    const inferredMultiTarget =
      isMultiTarget ||
      Object.keys(targetIds).length > 1 ||
      Object.values(targetIds).some((ids) => ids.length > 1);

    if (hasTargetIds) {
      params.targetIds = { ...targetIds };
      if (inferredMultiTarget) {
        params.isMultiTarget = true;
      }

      if (
        primaryTargetContext?.entityId &&
        targetIds.primary &&
        targetIds.primary.length === 1
      ) {
        params.targetId = targetIds.primary[0];
      } else if (primaryTargetContext?.entityId && !inferredMultiTarget) {
        params.targetId = primaryTargetContext.entityId;
      }
    } else if (primaryTargetContext?.entityId) {
      params.targetId = primaryTargetContext.entityId;
    }

    return params;
  }

  /**
   * @description Determines whether a value matches the legacy resolved target map shape.
   * @param {object} resolvedTargets - Potential resolved targets map
   * @returns {boolean} True when the value is a resolved target map
   */
  #isResolvedTargetMap(resolvedTargets) {
    return (
      resolvedTargets &&
      typeof resolvedTargets === 'object' &&
      !(resolvedTargets instanceof TargetExtractionResult)
    );
  }

  /**
   * @description Derives the primary target context from an existing {@link TargetExtractionResult}.
   * @param {TargetExtractionResult} extractionResult - Previously extracted targets
   * @param {ActionTargetContext[]} targetContexts - Contextual metadata for resolved targets
   * @returns {ActionTargetContext|null} Primary target context or null when unavailable
   */
  #resolvePrimaryFromExtractionResult(extractionResult, targetContexts) {
    const primaryId = extractionResult.getPrimaryTarget();
    if (!primaryId) {
      return null;
    }

    const matchedContext = Array.isArray(targetContexts)
      ? targetContexts.find((context) => context?.entityId === primaryId)
      : null;

    return {
      type: matchedContext?.type || 'entity',
      entityId: primaryId,
      displayName: matchedContext?.displayName || null,
    };
  }

  /**
   * @description Builds a primary target context from the first available resolved target entry.
   * @param {object} resolvedTargets - Legacy resolved target map
   * @returns {ActionTargetContext|null} Primary target context or null when none found
   */
  #resolvePrimaryFromResolvedTargets(resolvedTargets) {
    const entries = Object.entries(resolvedTargets || {});

    const primaryList = Array.isArray(resolvedTargets?.primary)
      ? resolvedTargets.primary
      : entries[0]?.[1];

    if (!Array.isArray(primaryList) || primaryList.length === 0) {
      return null;
    }

    const primaryTarget = primaryList[0];

    if (!primaryTarget || typeof primaryTarget.id !== 'string') {
      return null;
    }

    return {
      type: 'entity',
      entityId: primaryTarget.id,
      displayName: primaryTarget.displayName || null,
    };
  }

  /**
   * @description Creates a primary target context using the first legacy context entry.
   * @param {ActionTargetContext[]} targetContexts - Legacy target contexts
   * @returns {ActionTargetContext|null} Primary context or null when missing
   */
  #resolvePrimaryFromContexts(targetContexts) {
    const primaryContext = targetContexts?.[0];
    if (!primaryContext || !primaryContext.entityId) {
      return null;
    }

    return {
      type: primaryContext.type || 'entity',
      entityId: primaryContext.entityId,
      displayName: primaryContext.displayName || null,
    };
  }
}

export default TargetNormalizationService;
