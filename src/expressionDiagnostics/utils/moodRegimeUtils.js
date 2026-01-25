import {
  extractConstraintsFromPrototypeGates,
  extractPrototypeReferencesFromLogic,
} from './prototypeGateUtils.js';

const COMPARISON_OPERATORS = ['>=', '<=', '>', '<', '=='];

const DEFAULT_OPTIONS = {
  includeMoodAlias: true,
  andOnly: true,
};

const isMoodVarPath = (varPath, includeMoodAlias) => {
  if (typeof varPath !== 'string') return false;
  if (varPath.startsWith('moodAxes.')) return true;
  if (varPath.startsWith('sexualAxes.')) return true;
  return includeMoodAlias && varPath.startsWith('mood.');
};

/**
 * Safely retrieve a nested value from an object using a dot-notation path.
 * This is the canonical implementation used for consistent constraint evaluation
 * across MonteCarloSimulator, CoreSectionGenerator, and ReportIntegrityAnalyzer.
 * @param {object} obj - The source object
 * @param {string} path - Dot-notation path (e.g., 'moodAxes.valence')
 * @returns {*} The value at path, or undefined if not found
 */
export const getNestedValue = (obj, path) => {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
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

  // Sort constraints deterministically to ensure hash consistency
  return merged.sort((a, b) => {
    const pathCompare = String(a.varPath).localeCompare(String(b.varPath));
    if (pathCompare !== 0) return pathCompare;
    const opCompare = String(a.operator).localeCompare(String(b.operator));
    if (opCompare !== 0) return opCompare;
    return Number(a.threshold) - Number(b.threshold);
  });
};

/**
 * Extracts mood constraints from both:
 * 1. Direct moodAxes.* references in prerequisites
 * 2. Prototype gate-derived constraints from emotion/sexual prototypes
 *
 * @param {Array} prerequisites - Expression prerequisites
 * @param {object} dataRegistry - Data registry for prototype lookups (can be null)
 * @param {object} [options] - Options for extraction
 * @param {boolean} [options.includeMoodAlias=true] - Include mood.* alias paths
 * @param {boolean} [options.andOnly=true] - Only extract from AND conditions
 * @returns {Array} Merged mood constraints array
 */
export const extractMergedMoodConstraints = (
  prerequisites,
  dataRegistry,
  options = {}
) => {
  const { includeMoodAlias = true, andOnly = true } = options;

  const directConstraints = extractMoodConstraints(prerequisites, {
    includeMoodAlias,
    andOnly,
  });

  if (!dataRegistry) {
    return directConstraints;
  }

  const gateConstraints = extractConstraintsFromPrototypeGates(
    prerequisites,
    dataRegistry,
    { deduplicateByAxis: true }
  );

  return mergeConstraints(directConstraints, gateConstraints);
};

/**
 * Classifies what types of constraints an expression uses in its prerequisites.
 * This helps determine whether the expression is "prototype-only" (uses only
 * emotions.X or sexualStates.X references without direct moodAxes.X constraints),
 * which affects how mood regime filtering should be interpreted.
 *
 * @param {Array} prerequisites - Expression prerequisites array
 * @returns {{
 *   hasDirectMoodConstraints: boolean,  // Uses moodAxes.X directly
 *   hasPrototypeConstraints: boolean,   // Uses emotions.X or sexualStates.X
 *   isPrototypeOnly: boolean,           // ONLY uses prototype refs (no direct mood)
 *   prototypeRefs: Array<{prototypeId: string, type: string, varPath: string}>  // List of prototype references
 * }}
 */
export const classifyPrerequisiteTypes = (prerequisites) => {
  const result = {
    hasDirectMoodConstraints: false,
    hasPrototypeConstraints: false,
    isPrototypeOnly: false,
    prototypeRefs: [],
  };

  if (!Array.isArray(prerequisites) || prerequisites.length === 0) {
    return result;
  }

  // Check for direct moodAxes.* constraints
  const directConstraints = extractMoodConstraints(prerequisites, {
    includeMoodAlias: true,
    andOnly: false, // Check all constraints including OR blocks
  });
  result.hasDirectMoodConstraints = directConstraints.length > 0;

  // Check for prototype references (emotions.*, sexualStates.*)
  const prototypeRefs = [];
  for (const prereq of prerequisites) {
    if (prereq?.logic) {
      const refs = extractPrototypeReferencesFromLogic(prereq.logic);
      prototypeRefs.push(...refs);
    }
  }

  // Deduplicate and sort for determinism
  const seen = new Set();
  const uniqueRefs = [];
  for (const ref of prototypeRefs) {
    const key = `${ref.type}:${ref.prototypeId}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRefs.push(ref);
    }
  }

  // Sort deterministically by type, then by prototypeId
  uniqueRefs.sort((a, b) => {
    const typeCompare = String(a.type).localeCompare(String(b.type));
    if (typeCompare !== 0) return typeCompare;
    return String(a.prototypeId).localeCompare(String(b.prototypeId));
  });

  result.prototypeRefs = uniqueRefs;
  result.hasPrototypeConstraints = uniqueRefs.length > 0;

  // Expression is "prototype-only" if it uses prototype refs but NO direct mood constraints
  result.isPrototypeOnly =
    result.hasPrototypeConstraints && !result.hasDirectMoodConstraints;

  return result;
};
