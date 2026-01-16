/**
 * @file Detects prototype types referenced in JSON Logic expressions
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {object} PrototypeTypeDetection
 * @property {boolean} hasEmotions - True if emotions.* references found
 * @property {boolean} hasSexualStates - True if sexualStates.* references found
 */

/**
 * @typedef {object} PrototypeRef
 * @property {string} id - Prototype ID
 * @property {'emotion'|'sexual'} type - Prototype type
 */

class PrototypeTypeDetector {
  /**
   * @param {object} deps
   * @param {object} deps.logger - ILogger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
  }

  /**
   * Detect prototype types referenced in expression.
   * @param {object|object[]|null} expressionOrPrerequisites
   * @returns {PrototypeTypeDetection}
   */
  detectReferencedTypes(expressionOrPrerequisites) {
    const result = { hasEmotions: false, hasSexualStates: false };
    const prerequisites = Array.isArray(expressionOrPrerequisites)
      ? expressionOrPrerequisites
      : expressionOrPrerequisites?.prerequisites;

    if (!prerequisites || prerequisites.length === 0) return result;

    for (const prereq of prerequisites) {
      this.#scanLogicForPrototypeTypes(prereq.logic, result);
      if (result.hasEmotions && result.hasSexualStates) break;
    }

    return result;
  }

  /**
   * Extract the prototype reference from expression prerequisites.
   * Returns the first prototype reference found (for determining "current" prototype).
   * @param {object|null} expression
   * @returns {PrototypeRef|null}
   */
  extractCurrentPrototype(expression) {
    if (!expression?.prerequisites) return null;

    for (const prereq of expression.prerequisites) {
      const protoRef = this.#findPrototypeRefInLogic(prereq.logic);
      if (protoRef) return protoRef;
    }

    return null;
  }

  /**
   * Recursively scan JSON Logic for prototype type references.
   * @private
   * @param {*} logic - JSON Logic node
   * @param {PrototypeTypeDetection} result - Mutated detection result
   */
  #scanLogicForPrototypeTypes(logic, result) {
    if (!logic || typeof logic !== 'object') return;

    if (logic.var && typeof logic.var === 'string') {
      if (logic.var.startsWith('emotions.')) {
        result.hasEmotions = true;
      } else if (logic.var.startsWith('sexualStates.')) {
        result.hasSexualStates = true;
      }
      return;
    }

    for (const op of ['>=', '>', '<=', '<', '==', '!=']) {
      if (logic[op] && Array.isArray(logic[op])) {
        for (const operand of logic[op]) {
          this.#scanLogicForPrototypeTypes(operand, result);
        }
      }
    }

    if (logic.and || logic.or) {
      const clauses = logic.and || logic.or;
      for (const clause of clauses) {
        this.#scanLogicForPrototypeTypes(clause, result);
      }
    }
  }

  /**
   * Recursively find prototype reference in JSON Logic.
   * Searches for emotions.* and sexualStates.* variable paths.
   * @private
   * @param {object} logic
   * @returns {PrototypeRef|null}
   */
  #findPrototypeRefInLogic(logic) {
    if (!logic || typeof logic !== 'object') return null;

    for (const op of ['>=', '>', '<=', '<']) {
      if (logic[op]) {
        const [left] = logic[op];
        if (typeof left === 'object' && left.var) {
          const varPath = left.var;
          if (varPath.startsWith('emotions.')) {
            return { id: varPath.replace('emotions.', ''), type: 'emotion' };
          }
          if (varPath.startsWith('sexualStates.')) {
            return { id: varPath.replace('sexualStates.', ''), type: 'sexual' };
          }
        }
      }
    }

    if (logic.and || logic.or) {
      const clauses = logic.and || logic.or;
      for (const clause of clauses) {
        const found = this.#findPrototypeRefInLogic(clause);
        if (found) return found;
      }
    }

    return null;
  }
}

export default PrototypeTypeDetector;
