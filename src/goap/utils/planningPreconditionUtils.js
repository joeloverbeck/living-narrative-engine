/**
 * @file Helpers for normalizing planning preconditions across GOAP subsystems.
 * Provides backwards compatibility with legacy `preconditions` definitions while
 * nudging authors toward the `planningPreconditions` contract documented in
 * specs/goap-system-specs.md.
 */

import { deepClone } from '../../utils/cloneUtils.js';

const legacyPreconditionWarnings = new Set();
const LEGACY_PRECONDITION_ASSERTION_CODE = 'GOAP_LEGACY_PRECONDITIONS_ASSERTION';

/**
 * Normalize a task's planning preconditions.
 *
 * Tasks authored before the GOAP planning rewrite often used a `preconditions`
 * array where each entry was a raw JSON Logic snippet. Modern tasks are expected
 * to populate `planningPreconditions` with objects that expose
 * `{ description, condition }`. This helper returns a consistent array of
 * `{ description, condition }` objects regardless of which shape the task uses.
 *
 * When only the legacy property is present we emit a single warning (per task)
 * so authors know to migrate.
 *
 * @param {object} task - Task definition
 * @param {import('../../logging/logger.js').default} logger - Logger for warnings
 * @returns {Array<{description: string, condition: object}>} Normalized preconditions
 */
export function normalizePlanningPreconditions(task, logger, options = {}) {
  if (!task || typeof task !== 'object') {
    return [];
  }

  const settings = options || {};
  const diagnostics = settings.diagnostics || null;
  const actorId = settings.actorId ?? null;
  const goalId = settings.goalId ?? null;
  const origin = settings.origin ?? null;

  if (diagnostics && !Array.isArray(diagnostics.preconditionNormalizations)) {
    diagnostics.preconditionNormalizations = [];
  }

  const normalized = [];
  const hasModernPreconditions = Array.isArray(task.planningPreconditions)
    ? task.planningPreconditions.length > 0
    : false;

  if (hasModernPreconditions) {
    for (let index = 0; index < task.planningPreconditions.length; index++) {
      normalized.push(
        normalizePreconditionEntry(task.planningPreconditions[index], index, task.id)
      );
    }
    return normalized;
  }

  if (Array.isArray(task.preconditions) && task.preconditions.length > 0) {
    if (logger && task.id && !legacyPreconditionWarnings.has(task.id)) {
      logger.warn(
        `Task "${task.id}" uses legacy "preconditions". ` +
          'Update to "planningPreconditions" per specs/goap-system-specs.md.',
        {
          taskId: task.id,
          origin,
          code: 'GOAP_LEGACY_PRECONDITIONS_FALLBACK',
        }
      );
      legacyPreconditionWarnings.add(task.id);
    }

    for (let index = 0; index < task.preconditions.length; index++) {
      normalized.push(
        normalizePreconditionEntry(task.preconditions[index], index, task.id)
      );
    }

    recordLegacyNormalization(task, normalized, {
      diagnostics,
      actorId,
      goalId,
      origin,
    });

    if (process.env.GOAP_STATE_ASSERT === '1') {
      const assertionError = new Error(
        `Legacy "preconditions" detected for task "${task.id}" with GOAP_STATE_ASSERT=1`
      );
      assertionError.code = LEGACY_PRECONDITION_ASSERTION_CODE;
      assertionError.taskId = task.id;
      throw assertionError;
    }
  }

  return normalized;
}

function normalizePreconditionEntry(entry, index, taskId) {
  if (!entry) {
    return {
      description: buildDescription(index, taskId),
      condition: { '==': [true, true] },
    };
  }

  if (
    typeof entry === 'object' &&
    entry !== null &&
    Object.prototype.hasOwnProperty.call(entry, 'condition')
  ) {
    return {
      description: entry.description ?? buildDescription(index, taskId),
      condition: deepClone(entry.condition),
    };
  }

  if (typeof entry === 'object' && entry !== null) {
    const { description, ...rest } = entry;
    const conditionSource =
      Object.keys(rest).length > 0 ? rest : { '==': [true, true] };

    return {
      description: description ?? buildDescription(index, taskId),
      condition: deepClone(conditionSource),
    };
  }

  return {
    description: buildDescription(index, taskId),
    condition: deepClone(entry),
  };
}

function buildDescription(index, taskId) {
  const suffix = taskId ? ` for ${taskId}` : '';
  return `Precondition ${index + 1}${suffix}`;
}

function recordLegacyNormalization(task, normalizedEntries, context = {}) {
  const diagnostics = context.diagnostics;
  if (!diagnostics) {
    return;
  }

  const entry = {
    taskId: task?.id ?? null,
    sourceField: 'preconditions',
    normalizedCount: normalizedEntries.length,
    normalizedPreconditions: deepClone(normalizedEntries),
    actorId: context.actorId ?? null,
    goalId: context.goalId ?? null,
    origin: context.origin ?? null,
    timestamp: Date.now(),
  };

  diagnostics.preconditionNormalizations.push(entry);
}
