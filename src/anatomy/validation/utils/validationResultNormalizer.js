import ValidationResultBuilder from '../core/ValidationResultBuilder.js';

/**
 * Normalize the payload returned by ValidationPipeline to guarantee ValidationReport
 * receives the expected shape even when custom validators misbehave.
 *
 * @param {object} recipe - Recipe metadata used for fallbacks.
 * @param {object} pipelineResult - Raw pipeline payload (may be undefined).
 * @param {import('../../../interfaces/coreServices.js').ILogger} logger - Logger.
 * @param {object} [options] - Normalization options.
 * @param {number} [options.validatorCount] - Count of registered validators for diagnostics.
 * @param {object|null} [options.monitoringCoordinator] - Monitoring coordinator for telemetry.
 * @param {string} [options.recipePath] - Explicit recipe path override.
 * @returns {object} Frozen validation result compatible with ValidationReport.
 */
export function normalizeValidationResult(
  recipe,
  pipelineResult,
  logger,
  options = {}
) {
  const {
    validatorCount = 0,
    monitoringCoordinator = null,
    recipePath: explicitRecipePath,
  } = options;

  const recipeId =
    recipe?.recipeId ?? pipelineResult?.recipeId ?? 'unknown-recipe';
  const inferredRecipePath =
    explicitRecipePath ?? pipelineResult?.recipePath ?? recipe?.recipePath;
  const defaults = ValidationResultBuilder.success(
    recipeId,
    inferredRecipePath
  );

  const emitDiagnostic = (issue, level = 'warn', extra = {}) => {
    const payload = {
      recipeId,
      validatorCount,
      issue,
      ...extra,
    };

    if (typeof logger?.[level] === 'function') {
      logger[level]('ValidationPipeline:invalid_result', payload);
    }

    if (
      monitoringCoordinator &&
      typeof monitoringCoordinator.incrementValidationPipelineHealth ===
        'function'
    ) {
      monitoringCoordinator.incrementValidationPipelineHealth(issue);
    }
  };

  if (!pipelineResult || typeof pipelineResult !== 'object') {
    if (typeof logger?.error === 'function') {
      logger.error(`ValidationPipeline returned no payload for ${recipeId}`);
    }

    emitDiagnostic('missing_payload', 'error');

    const syntheticError = {
      type: 'VALIDATION_ERROR',
      severity: 'error',
      message:
        'Validation pipeline returned no payload. Validators may have failed to execute.',
      check: 'validation_pipeline',
    };

    const normalizedMissing = {
      ...defaults,
      errors: [syntheticError],
      isValid: false,
    };

    return Object.freeze(normalizedMissing);
  }

  const normalized = {
    ...pipelineResult,
    recipeId: pipelineResult.recipeId ?? defaults.recipeId,
    recipePath: pipelineResult.recipePath ?? defaults.recipePath,
    timestamp: pipelineResult.timestamp ?? defaults.timestamp,
  };

  const appliedDefaults = [];

  const ensureArray = (fieldName) => {
    if (Array.isArray(pipelineResult[fieldName])) {
      normalized[fieldName] = [...pipelineResult[fieldName]];
      return;
    }
    normalized[fieldName] = [...defaults[fieldName]];
    appliedDefaults.push(fieldName);
  };

  ensureArray('errors');
  ensureArray('warnings');
  ensureArray('suggestions');
  ensureArray('passed');

  if (typeof normalized.isValid !== 'boolean') {
    normalized.isValid = normalized.errors.length === 0;
    appliedDefaults.push('isValid');
  }

  if (appliedDefaults.length > 0) {
    if (typeof logger?.debug === 'function') {
      logger.debug('ValidationPipeline: normalized missing fields', {
        recipeId,
        defaultsApplied: appliedDefaults,
      });
    }
    emitDiagnostic('missing_fields', 'warn', { fields: appliedDefaults });
  }

  return Object.freeze(normalized);
}

export default normalizeValidationResult;
