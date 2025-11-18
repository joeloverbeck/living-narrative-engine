import { ModValidationError } from '../../errors/modValidationError.js';
import { alwaysTrueCondition, simpleStateMatcher } from './builders.js';

const GOAL_NORMALIZATION_ERROR_CODE = 'GOAL_NORMALIZATION_FAILED';

/** @type {Set<Function>} */
const normalizationHooks = new Set();

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unwrapLogicContainer(candidate) {
  if (
    isPlainObject(candidate) &&
    Object.keys(candidate).length === 1 &&
    Object.prototype.hasOwnProperty.call(candidate, 'logic')
  ) {
    const value = candidate.logic;
    return isPlainObject(value) ? value : candidate;
  }
  return candidate;
}

function isConditionLike(value) {
  if (isPlainObject(value)) {
    if (
      typeof value.condition_ref === 'string' &&
      value.condition_ref.trim().length > 0
    ) {
      return true;
    }
    return Object.keys(value).length > 0;
  }
  return false;
}

function buildErrorContext(context, extra = {}) {
  return {
    modId: context?.modId || null,
    filename: context?.filename || null,
    ...extra,
  };
}

function warn(context, warnings, message, details = {}) {
  warnings.push({ message, details });
  const logger = context?.logger;
  if (logger && typeof logger.warn === 'function') {
    logger.warn(
      `Goal normalization warning [${context?.modId || 'unknown'}:${
        context?.filename || 'unknown'
      }]: ${message}`,
      {
        ...details,
        modId: context?.modId,
        filename: context?.filename,
      }
    );
  }
}

function recordMutation(mutations, mutation) {
  if (mutation) {
    mutations.push(mutation);
  }
}

function throwNormalizationError(context, message, extra = {}) {
  throw new ModValidationError(
    message,
    GOAL_NORMALIZATION_ERROR_CODE,
    buildErrorContext(context, extra),
    false
  );
}

function coercePriority(normalized, context, warnings, mutations) {
  const { priority } = normalized;
  if (typeof priority === 'number' && Number.isFinite(priority)) {
    return;
  }

  if (typeof priority === 'string') {
    const trimmed = priority.trim();
    if (trimmed.length > 0) {
      const coerced = Number(trimmed);
      if (!Number.isNaN(coerced) && Number.isFinite(coerced)) {
        normalized.priority = coerced;
        warn(context, warnings, 'Coerced string priority into number.', {
          from: priority,
          to: coerced,
        });
        recordMutation(mutations, {
          field: 'priority',
          type: 'coerced',
          from: priority,
          to: coerced,
        });
        return;
      }
    }
  }

  if (!context?.allowDefaults) {
    throwNormalizationError(context, 'Goal priority must be a finite number.', {
      field: 'priority',
      value: priority,
    });
  }

  normalized.priority = 0;
  warn(context, warnings, 'Missing or invalid priority defaulted to 0.', {
    previousValue: priority,
  });
  recordMutation(mutations, {
    field: 'priority',
    type: 'defaulted',
    from: priority,
    to: 0,
  });
}

function ensureConditionField(
  normalized,
  field,
  fallbackBuilder,
  context,
  warnings,
  mutations
) {
  const original = normalized[field];
  let candidate = unwrapLogicContainer(original);

  if (candidate !== original) {
    normalized[field] = candidate;
    recordMutation(mutations, {
      field,
      type: 'unwrapped',
      from: original,
      to: candidate,
    });
    warn(context, warnings, `${field} condition wrapped in 'logic' has been normalized.`, {
      field,
    });
  }

  if (isConditionLike(candidate)) {
    normalized[field] = candidate;
    return;
  }

  if (!context?.allowDefaults) {
    throwNormalizationError(context, `${field} condition is missing or invalid.`, {
      field,
      valueType: typeof candidate,
    });
  }

  const fallback = typeof fallbackBuilder === 'function'
    ? fallbackBuilder(context)
    : alwaysTrueCondition();
  normalized[field] = fallback;
  warn(context, warnings, `${field} missing or invalid. Applied default scaffolding.`, {
    field,
  });
  recordMutation(mutations, {
    field,
    type: 'defaulted',
    to: fallback,
  });
}

function runNormalizationHooks(normalized, context, warnings, mutations) {
  for (const hook of normalizationHooks) {
    try {
      const result = hook({
        data: normalized,
        context,
        builders: { alwaysTrueCondition, simpleStateMatcher },
      });
      if (result?.warnings?.length) {
        for (const hookWarning of result.warnings) {
          warn(context, warnings, hookWarning.message, {
            ...hookWarning.details,
            extensionName: hook.name || 'anonymous'
          });
        }
      }
      if (result?.mutations?.length) {
        for (const mutation of result.mutations) {
          recordMutation(mutations, {
            ...mutation,
            extensionName: hook.name || 'anonymous',
          });
        }
      }
    } catch (error) {
      if (context?.allowDefaults) {
        warn(
          context,
          warnings,
          `Goal normalization extension failed: ${error.message}`,
          {
            extensionName: hook.name || 'anonymous',
          }
        );
        continue;
      }
      throwNormalizationError(
        context,
        `Goal normalization extension failed: ${error.message}`,
        {
          extensionName: hook.name || 'anonymous',
        }
      );
    }
  }
}

export function normalizeGoalData(data, context = {}) {
  if (!isPlainObject(data)) {
    throw new TypeError('Goal data must be a plain object.');
  }

  const warnings = [];
  const mutations = [];

  coercePriority(data, context, warnings, mutations);
  ensureConditionField(data, 'relevance', () => alwaysTrueCondition(), context, warnings, mutations);
  ensureConditionField(
    data,
    'goalState',
    () => simpleStateMatcher(context?.defaultGoalStateVar || 'state.goal.placeholder', true),
    context,
    warnings,
    mutations
  );

  runNormalizationHooks(data, context, warnings, mutations);

  return { data, warnings, mutations };
}

export function registerGoalNormalizationExtension(extension) {
  if (typeof extension !== 'function') {
    throw new TypeError('Goal normalization extension must be a function.');
  }
  normalizationHooks.add(extension);
  return () => normalizationHooks.delete(extension);
}

export function clearGoalNormalizationExtensions() {
  normalizationHooks.clear();
}

export function getGoalNormalizationExtensions() {
  return Array.from(normalizationHooks);
}

export { GOAL_NORMALIZATION_ERROR_CODE };
