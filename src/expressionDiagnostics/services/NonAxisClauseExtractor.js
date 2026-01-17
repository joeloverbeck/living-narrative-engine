/**
 * @file NonAxisClauseExtractor - Extracts non-axis atomic clauses from prerequisites
 * @description Service to traverse JSON Logic prerequisite trees and extract comparison clauses
 * that target non-axis variables (emotions.*, sexualStates.*, previousEmotions.*, etc.).
 * Excludes axis paths (moodAxes.*, mood.*, sexualAxes.*, affectTraits.*).
 * @see specs/prototype-fit-blockers-scope-disambiguation.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {'emotion' | 'sexual' | 'delta' | 'other'} ClauseType
 */

/**
 * @typedef {object} ExtractedClause
 * @property {string} varPath - Normalized variable path (e.g., 'emotions.confusion').
 * @property {string} operator - Comparison operator (>=, >, <=, <, ==, !=).
 * @property {number} threshold - Threshold value for the comparison.
 * @property {boolean} isDelta - Whether this is a delta clause (current - previous).
 * @property {string} sourcePath - Path in the original prerequisites tree for tracing.
 * @property {ClauseType} clauseType - Classification of the clause type.
 */

/**
 * Comparison operators supported for clause extraction.
 *
 * @type {readonly string[]}
 */
const COMPARISON_OPERATORS = Object.freeze([
  '>=',
  '>',
  '<=',
  '<',
  '==',
  '!=',
]);

/**
 * Axis variable path patterns that should be excluded from extraction.
 *
 * @type {readonly RegExp[]}
 */
const AXIS_PATTERNS = Object.freeze([
  /^moodAxes\./,
  /^mood\./,
  /^sexualAxes\./,
  /^affectTraits\./,
]);

/**
 * Service to extract non-axis atomic clauses from expression prerequisites.
 * Traverses JSON Logic trees and identifies comparison clauses targeting
 * emotions, sexual states, and delta patterns.
 */
class NonAxisClauseExtractor {
  /** @type {import('../../interfaces/ILogger.js').ILogger} */
  #logger;

  /**
   * Create a NonAxisClauseExtractor instance.
   *
   * @param {object} params - Constructor parameters.
   * @param {import('../../interfaces/ILogger.js').ILogger} params.logger - Logger instance.
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn'],
    });
    this.#logger = logger;
  }

  /**
   * Extract non-axis atomic clauses from expression prerequisites.
   *
   * @param {Array<{logic?: object}>} prerequisites - Expression prerequisites array.
   * @returns {ExtractedClause[]} Array of extracted non-axis clauses.
   */
  extract(prerequisites) {
    if (!Array.isArray(prerequisites)) {
      this.#logger.debug(
        'NonAxisClauseExtractor: prerequisites is not an array, returning empty'
      );
      return [];
    }

    const clauses = [];

    for (let i = 0; i < prerequisites.length; i++) {
      const prereq = prerequisites[i];
      if (!prereq?.logic) {
        continue;
      }
      this.#traverseLogic(prereq.logic, `prereqs[${i}]`, clauses);
    }

    this.#logger.debug(
      `NonAxisClauseExtractor: extracted ${clauses.length} non-axis clause(s)`
    );
    return clauses;
  }

  /**
   * Traverse JSON Logic tree and extract non-axis comparison clauses.
   *
   * @param {unknown} node - Current JSON Logic node.
   * @param {string} path - Current path in the tree.
   * @param {ExtractedClause[]} results - Accumulator for extracted clauses.
   */
  #traverseLogic(node, path, results) {
    if (!node || typeof node !== 'object') {
      return;
    }

    // Check for comparison operators
    for (const op of COMPARISON_OPERATORS) {
      if (Object.hasOwn(node, op)) {
        const extracted = this.#extractComparison(node[op], op, path);
        if (extracted && this.#isNonAxisClause(extracted.varPath)) {
          results.push(extracted);
        }
        return;
      }
    }

    // Recurse into compound operators ('and', 'or')
    for (const compoundOp of ['and', 'or']) {
      if (Array.isArray(node[compoundOp])) {
        const children = node[compoundOp];
        for (let idx = 0; idx < children.length; idx++) {
          this.#traverseLogic(
            children[idx],
            `${path}.${compoundOp}[${idx}]`,
            results
          );
        }
        return;
      }
    }
  }

  /**
   * Extract comparison clause details from a comparison operator's arguments.
   *
   * @param {unknown} args - Arguments array for the comparison operator.
   * @param {string} operator - The comparison operator.
   * @param {string} path - Current path in the tree.
   * @returns {ExtractedClause | null} Extracted clause or null if not extractable.
   */
  #extractComparison(args, operator, path) {
    if (!Array.isArray(args) || args.length < 2) {
      return null;
    }

    const [left, right] = args;
    let varPath = null;
    let threshold = null;
    let isDelta = false;

    // Case 1: { "var": "path" } op number
    if (this.#isVarNode(left) && typeof right === 'number') {
      varPath = left.var;
      threshold = right;
    }
    // Case 2: number op { "var": "path" }
    else if (typeof left === 'number' && this.#isVarNode(right)) {
      varPath = right.var;
      threshold = left;
    }
    // Case 3: Delta pattern { "-": [current, previous] } op number
    else if (this.#isDeltaNode(left) && typeof right === 'number') {
      const deltaArgs = left['-'];
      if (this.#isVarNode(deltaArgs[0]) && this.#isVarNode(deltaArgs[1])) {
        varPath = deltaArgs[0].var;
        threshold = right;
        isDelta = true;
      }
    }

    if (!varPath) {
      return null;
    }

    return {
      varPath: this.#canonicalizeVarPath(varPath),
      operator,
      threshold,
      isDelta,
      sourcePath: path,
      clauseType: this.#classifyClauseType(varPath, isDelta),
    };
  }

  /**
   * Check if a node is a variable reference.
   *
   * @param {unknown} node - Node to check.
   * @returns {node is {var: string}} True if node is a variable reference.
   */
  #isVarNode(node) {
    return (
      node !== null &&
      typeof node === 'object' &&
      'var' in node &&
      typeof node.var === 'string'
    );
  }

  /**
   * Check if a node is a delta subtraction pattern.
   *
   * @param {unknown} node - Node to check.
   * @returns {node is {'-': unknown[]}} True if node is a delta pattern.
   */
  #isDeltaNode(node) {
    return (
      node !== null &&
      typeof node === 'object' &&
      '-' in node &&
      Array.isArray(node['-']) &&
      node['-'].length >= 2
    );
  }

  /**
   * Check if clause is non-axis (not matching any axis patterns).
   *
   * @param {string} varPath - Variable path to check.
   * @returns {boolean} True if the path is a non-axis variable.
   */
  #isNonAxisClause(varPath) {
    return !AXIS_PATTERNS.some((pattern) => pattern.test(varPath));
  }

  /**
   * Classify the type of clause based on variable path.
   *
   * @param {string} varPath - Variable path.
   * @param {boolean} isDelta - Whether this is a delta clause.
   * @returns {ClauseType} The clause type classification.
   */
  #classifyClauseType(varPath, isDelta) {
    if (isDelta) {
      return 'delta';
    }
    if (
      varPath.startsWith('emotions.') ||
      varPath.startsWith('previousEmotions.')
    ) {
      return 'emotion';
    }
    if (
      varPath.startsWith('sexualStates.') ||
      varPath.startsWith('previousSexualStates.')
    ) {
      return 'sexual';
    }
    return 'other';
  }

  /**
   * Canonicalize variable path for consistency.
   * Normalizes 'mood.' alias to 'moodAxes.' (though these are filtered out as axis paths).
   *
   * @param {string} varPath - Variable path to normalize.
   * @returns {string} Normalized variable path.
   */
  #canonicalizeVarPath(varPath) {
    // Normalize mood. alias to moodAxes. for consistency
    // Note: These will be filtered out by #isNonAxisClause anyway
    if (varPath.startsWith('mood.') && !varPath.startsWith('moodAxes.')) {
      return 'moodAxes.' + varPath.slice(5);
    }
    return varPath;
  }
}

export default NonAxisClauseExtractor;
