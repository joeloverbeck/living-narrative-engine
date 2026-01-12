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
    .map((constraint) => `\`${constraint.varPath} ${constraint.operator} ${constraint.threshold}\``)
    .join(', ');
};
