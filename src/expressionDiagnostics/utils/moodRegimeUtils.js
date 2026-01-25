const COMPARISON_OPERATORS = ['>=', '<=', '>', '<', '=='];

const DEFAULT_OPTIONS = {
  includeMoodAlias: true,
  andOnly: true,
};

const isMoodVarPath = (varPath, includeMoodAlias) => {
  if (typeof varPath !== 'string') return false;
  if (varPath.startsWith('moodAxes.')) return true;
  return includeMoodAlias && varPath.startsWith('mood.');
};

const getNestedValue = (obj, path) => {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
};

const extractMoodConstraintsFromLogic = (logic, constraints, options) => {
  if (!logic || typeof logic !== 'object') return;

  for (const op of COMPARISON_OPERATORS) {
    if (logic[op]) {
      const [left, right] = logic[op];
      if (typeof left === 'object' && left.var && typeof right === 'number') {
        const varPath = left.var;
        if (isMoodVarPath(varPath, options.includeMoodAlias)) {
          constraints.push({ varPath, operator: op, threshold: right });
        }
      }
    }
  }

  if (logic.and && Array.isArray(logic.and)) {
    for (const clause of logic.and) {
      extractMoodConstraintsFromLogic(clause, constraints, options);
    }
  }

  if (!options.andOnly && logic.or && Array.isArray(logic.or)) {
    for (const clause of logic.or) {
      extractMoodConstraintsFromLogic(clause, constraints, options);
    }
  }
};

const hasOrMoodConstraintsInLogic = (logic, inOrBlock, includeMoodAlias) => {
  if (!logic || typeof logic !== 'object') return false;

  for (const op of COMPARISON_OPERATORS) {
    if (logic[op]) {
      const [left, right] = logic[op];
      if (
        inOrBlock &&
        typeof left === 'object' &&
        left.var &&
        typeof right === 'number'
      ) {
        if (isMoodVarPath(left.var, includeMoodAlias)) {
          return true;
        }
      }
    }
  }

  if (logic.or && Array.isArray(logic.or)) {
    for (const clause of logic.or) {
      if (hasOrMoodConstraintsInLogic(clause, true, includeMoodAlias)) {
        return true;
      }
    }
  }

  if (logic.and && Array.isArray(logic.and)) {
    for (const clause of logic.and) {
      if (hasOrMoodConstraintsInLogic(clause, inOrBlock, includeMoodAlias)) {
        return true;
      }
    }
  }

  return false;
};

export const extractMoodConstraints = (prerequisites, options = {}) => {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const constraints = [];

  if (!Array.isArray(prerequisites)) {
    return constraints;
  }

  for (const prereq of prerequisites) {
    extractMoodConstraintsFromLogic(prereq.logic, constraints, mergedOptions);
  }

  return constraints;
};

export const hasOrMoodConstraints = (prerequisites, options = {}) => {
  const { includeMoodAlias = DEFAULT_OPTIONS.includeMoodAlias } = options;
  if (!Array.isArray(prerequisites)) {
    return false;
  }

  for (const prereq of prerequisites) {
    if (hasOrMoodConstraintsInLogic(prereq.logic, false, includeMoodAlias)) {
      return true;
    }
  }

  return false;
};

export const evaluateConstraint = (value, operator, threshold) => {
  if (typeof value !== 'number' || typeof threshold !== 'number') {
    return false;
  }

  switch (operator) {
    case '>=':
      return value >= threshold;
    case '<=':
      return value <= threshold;
    case '>':
      return value > threshold;
    case '<':
      return value < threshold;
    case '==':
      return value === threshold;
    default:
      return false;
  }
};

export const filterContextsByConstraints = (contexts, constraints) => {
  if (!Array.isArray(contexts) || contexts.length === 0) {
    return [];
  }
  if (!Array.isArray(constraints) || constraints.length === 0) {
    return contexts;
  }

  return contexts.filter((ctx) => {
    return constraints.every((constraint) => {
      const value = getNestedValue(ctx, constraint.varPath);
      return evaluateConstraint(value, constraint.operator, constraint.threshold);
    });
  });
};

export const formatConstraints = (constraints) => {
  if (!Array.isArray(constraints) || constraints.length === 0) {
    return '';
  }

  return constraints
    .map((constraint) => {
      const base = `${constraint.varPath} ${constraint.operator} ${constraint.threshold}`;
      if (isMoodVarPath(constraint.varPath, true)) {
        const normalized =
          typeof constraint.threshold === 'number' &&
          Number.isFinite(constraint.threshold)
            ? (constraint.threshold / 100).toFixed(2)
            : null;

        if (normalized !== null) {
          return `\`${base} (normalized ${constraint.operator} ${normalized})\``;
        }
      }

      return `\`${base}\``;
    })
    .join(', ');
};

/**
 * Converts axis constraints Map (from PrototypeConstraintAnalyzer) to MoodConstraint array format.
 * This enables reuse of existing population filtering with prototype-derived constraints.
 *
 * @param {Map<string, {min?: number, max?: number}>} axisConstraints - Axis constraints from prototype gates
 * @returns {Array<{varPath: string, operator: string, threshold: number, source: string}>} MoodConstraint array
 */
export const convertAxisConstraintsToMoodConstraints = (axisConstraints) => {
  const constraints = [];
  if (!axisConstraints || !(axisConstraints instanceof Map)) {
    return constraints;
  }

  for (const [axis, bounds] of axisConstraints.entries()) {
    const varPath = `moodAxes.${axis}`;

    if (typeof bounds.min === 'number') {
      constraints.push({
        varPath,
        operator: '>=',
        threshold: bounds.min,
        source: 'prototype-gate',
      });
    }
    if (typeof bounds.max === 'number') {
      constraints.push({
        varPath,
        operator: '<=',
        threshold: bounds.max,
        source: 'prototype-gate',
      });
    }
  }
  return constraints;
};

/**
 * Merges direct mood constraints (from explicit moodAxes.* references) with
 * prototype-derived constraints (from prototype gates).
 * Direct constraints take precedence for duplicates.
 *
 * @param {Array<{varPath: string, operator: string, threshold: number}>} directConstraints - From extractMoodConstraints()
 * @param {Array<{varPath: string, operator: string, threshold: number, source?: string}>} prototypeConstraints - From convertAxisConstraintsToMoodConstraints()
 * @returns {Array<{varPath: string, operator: string, threshold: number, source?: string}>} Merged constraints
 */
export const mergeConstraints = (directConstraints, prototypeConstraints) => {
  const direct = Array.isArray(directConstraints) ? directConstraints : [];
  const prototype = Array.isArray(prototypeConstraints) ? prototypeConstraints : [];

  const merged = [...direct];
  const directKeys = new Set(
    direct.map((c) => `${c.varPath}:${c.operator}`)
  );

  for (const c of prototype) {
    const key = `${c.varPath}:${c.operator}`;
    if (!directKeys.has(key)) {
      merged.push(c);
    }
  }
  return merged;
};
