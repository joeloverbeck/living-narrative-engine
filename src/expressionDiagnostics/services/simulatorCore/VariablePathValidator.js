/**
 * @file VariablePathValidator.js
 * @description Validates and resolves variable paths in expressions for Monte Carlo simulation.
 * Handles variable path validation, sampling coverage variable collection, and emotion reference extraction.
 */

import { collectVarPaths } from '../../../utils/jsonLogicVarExtractor.js';
import { MOOD_AXIS_RANGE } from '../../../constants/moodAffectConstants.js';

/**
 * Domain configuration for sampling coverage variable resolution.
 * Maps variable path patterns to their domains and value ranges.
 * @type {Array<{pattern: RegExp, domain: string, min: number, max: number}>}
 */
export const SAMPLING_COVERAGE_DOMAIN_RANGES = [
  {
    pattern: /^previousMoodAxes\./,
    domain: 'previousMoodAxes',
    ...MOOD_AXIS_RANGE,
  },
  { pattern: /^previousEmotions\./, domain: 'previousEmotions', min: 0, max: 1 },
  {
    pattern: /^previousSexualStates\./,
    domain: 'previousSexualStates',
    min: 0,
    max: 1,
  },
  { pattern: /^moodAxes\./, domain: 'moodAxes', ...MOOD_AXIS_RANGE },
  { pattern: /^mood\./, domain: 'moodAxes', ...MOOD_AXIS_RANGE },
  { pattern: /^emotions\./, domain: 'emotions', min: 0, max: 1 },
  { pattern: /^sexualStates\./, domain: 'sexualStates', min: 0, max: 1 },
  { pattern: /^sexual\./, domain: 'sexualStates', min: 0, max: 1 },
];

/**
 * Validates and resolves variable paths in expressions.
 * Stateless utility class for variable path operations.
 */
class VariablePathValidator {
  // Stateless - no constructor dependencies needed

  /**
   * Validates all variable paths in an expression against known context keys.
   * @param {Object} expression - Expression to validate
   * @param {Object} knownKeys - Known context keys structure
   * @param {Set<string>} knownKeys.topLevel - Top-level valid roots
   * @param {Set<string>} knownKeys.scalarKeys - Keys that are scalar (no nesting)
   * @param {Object<string, Set<string>>} knownKeys.nestedKeys - Valid nested keys per root
   * @returns {Array<{path: string, reason: string, suggestion: string}>} Validation warnings
   */
  validateExpressionVarPaths(expression, knownKeys) {
    const warnings = [];

    if (!expression?.prerequisites) {
      return warnings;
    }

    // Collect all var paths from all prerequisites
    const allPaths = [];
    for (const prereq of expression.prerequisites) {
      if (prereq?.logic) {
        collectVarPaths(prereq.logic, allPaths);
      }
    }

    // Deduplicate paths for validation (but track all occurrences for warnings)
    const seenPaths = new Set();
    for (const path of allPaths) {
      if (seenPaths.has(path)) continue;
      seenPaths.add(path);

      const result = this.validateVarPath(path, knownKeys);
      if (!result.isValid) {
        warnings.push({
          path,
          reason: result.reason,
          suggestion: result.suggestion,
        });
      }
    }

    return warnings;
  }

  /**
   * Validates a single variable path against known context keys.
   * @param {string} path - Variable path to validate
   * @param {Object} knownKeys - Known context keys structure
   * @param {Set<string>} knownKeys.topLevel - Top-level valid roots
   * @param {Set<string>} knownKeys.scalarKeys - Keys that are scalar (no nesting)
   * @param {Object<string, Set<string>>} knownKeys.nestedKeys - Valid nested keys per root
   * @returns {{isValid: boolean, reason?: string, suggestion?: string}} Validation result
   */
  validateVarPath(path, knownKeys) {
    const parts = path.split('.');
    const root = parts[0];

    // Check if root is known
    if (!knownKeys.topLevel.has(root)) {
      return {
        isValid: false,
        reason: 'unknown_root',
        suggestion: `Unknown root variable "${root}". Valid roots: ${[...knownKeys.topLevel].sort().join(', ')}`,
      };
    }

    // Check if trying to nest on a scalar
    if (parts.length > 1 && knownKeys.scalarKeys.has(root)) {
      return {
        isValid: false,
        reason: 'invalid_nesting',
        suggestion: `"${root}" is a scalar value and cannot have nested properties like "${path}"`,
      };
    }

    // Check nested key validity (if applicable)
    if (parts.length > 1) {
      const nestedKey = parts[1];
      const validNestedKeys = knownKeys.nestedKeys[root];

      if (validNestedKeys && !validNestedKeys.has(nestedKey)) {
        const knownList =
          validNestedKeys.size > 0
            ? [...validNestedKeys].sort().slice(0, 5).join(', ') +
              (validNestedKeys.size > 5 ? '...' : '')
            : '(none available)';
        return {
          isValid: false,
          reason: 'unknown_nested_key',
          suggestion: `Unknown key "${nestedKey}" in "${root}". Known keys: ${knownList}`,
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Collects all sampling coverage variables from an expression.
   * @param {Object} expression - Expression to analyze
   * @returns {Array<{variablePath: string, domain: string, min: number, max: number}>} Variables with domain and range info
   */
  collectSamplingCoverageVariables(expression) {
    if (!expression?.prerequisites) {
      return [];
    }

    const allPaths = [];
    for (const prereq of expression.prerequisites) {
      if (prereq?.logic) {
        collectVarPaths(prereq.logic, allPaths);
      }
    }

    const uniquePaths = new Set(allPaths);
    const variables = [];

    for (const path of uniquePaths) {
      const variable = this.resolveSamplingCoverageVariable(path);
      if (variable) {
        variables.push(variable);
      }
    }

    return variables;
  }

  /**
   * Resolves a variable path to its domain and range.
   * @param {string} variablePath - Variable path to resolve
   * @returns {{variablePath: string, domain: string, min: number, max: number}|null} Domain info or null if unknown
   */
  resolveSamplingCoverageVariable(variablePath) {
    if (!variablePath || typeof variablePath !== 'string') {
      return null;
    }

    for (const domainConfig of SAMPLING_COVERAGE_DOMAIN_RANGES) {
      if (domainConfig.pattern.test(variablePath)) {
        return {
          variablePath,
          domain: domainConfig.domain,
          min: domainConfig.min,
          max: domainConfig.max,
        };
      }
    }

    return null;
  }

  /**
   * Extracts all referenced emotion names from an expression.
   * @param {Object} expression - Expression to analyze
   * @returns {Set<string>} Referenced emotion names
   */
  extractReferencedEmotions(expression) {
    const emotionNames = new Set();

    const extractFromLogic = (logic) => {
      if (!logic || typeof logic !== 'object') return;

      // Handle {"var": "emotions.anger"} or {"var": "previousEmotions.anger"}
      if (logic.var && typeof logic.var === 'string') {
        const match = logic.var.match(/^(?:previous)?[Ee]motions\.(\w+)$/);
        if (match) {
          emotionNames.add(match[1]);
        }
        return;
      }

      // Recurse into arrays and objects
      for (const key in logic) {
        const value = logic[key];
        if (Array.isArray(value)) {
          value.forEach(extractFromLogic);
        } else if (typeof value === 'object') {
          extractFromLogic(value);
        }
      }
    };

    if (expression?.prerequisites) {
      for (const prereq of expression.prerequisites) {
        extractFromLogic(prereq);
      }
    }

    return emotionNames;
  }

  /**
   * Filters emotions to only those referenced in expression.
   * @param {Object} allEmotions - All available emotions keyed by name
   * @param {Set<string>} referencedNames - Names of referenced emotions
   * @returns {Object} Filtered emotions object
   */
  filterEmotions(allEmotions, referencedNames) {
    if (!allEmotions || referencedNames.size === 0) return {};

    const filtered = {};
    for (const name of referencedNames) {
      if (name in allEmotions) {
        filtered[name] = allEmotions[name];
      }
    }
    return filtered;
  }
}

export default VariablePathValidator;
