/**
 * @file Extensible priority rule system for future enhancements
 * @description Plugin-style priority calculation system with rule registration
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  COVERAGE_PRIORITY,
  LAYER_PRIORITY_WITHIN_COVERAGE,
} from './priorityConstants.js';

/**
 * Extensible priority rule system for future enhancements
 */
class PriorityRuleRegistry {
  #logger;
  #rules;

  /**
   * Constructor for PriorityRuleRegistry
   *
   * @param {object} dependencies - Injected dependencies
   * @param {object} dependencies.logger - Logger for warning and error output
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#logger = logger;
    this.#rules = new Map();
    this.registerDefaultRules();
  }

  /**
   * Register default priority calculation rules
   *
   * @private
   */
  registerDefaultRules() {
    // Standard coverage priority rules
    this.registerRule('coverage', (candidate) => {
      return (
        COVERAGE_PRIORITY[candidate.coveragePriority] ||
        COVERAGE_PRIORITY.direct
      );
    });

    // Layer priority rules
    this.registerRule('layer', (candidate) => {
      return (
        LAYER_PRIORITY_WITHIN_COVERAGE[candidate.layer] ||
        LAYER_PRIORITY_WITHIN_COVERAGE.base
      );
    });
  }

  /**
   * Register a new priority calculation rule
   *
   * @param {string} name - Unique name for the rule
   * @param {Function} calculator - Function that calculates priority contribution
   */
  registerRule(name, calculator) {
    if (typeof calculator !== 'function') {
      this.#logger.error(`Priority rule '${name}' must be a function`);
      throw new Error(`Priority rule '${name}' must be a function`);
    }

    this.#rules.set(name, calculator);
    this.#logger.debug(`Registered priority rule: ${name}`);
  }

  /**
   * Remove a priority calculation rule
   *
   * @param {string} name - Name of the rule to remove
   * @returns {boolean} True if rule was removed, false if not found
   */
  removeRule(name) {
    const removed = this.#rules.delete(name);
    if (removed) {
      this.#logger.debug(`Removed priority rule: ${name}`);
    } else {
      this.#logger.warn(
        `Attempted to remove non-existent priority rule: ${name}`
      );
    }
    return removed;
  }

  /**
   * Get list of registered rule names
   *
   * @returns {Array<string>} Array of rule names
   */
  getRuleNames() {
    return Array.from(this.#rules.keys());
  }

  /**
   * Check if a rule is registered
   *
   * @param {string} name - Rule name to check
   * @returns {boolean} True if rule exists
   */
  hasRule(name) {
    return this.#rules.has(name);
  }

  /**
   * Calculate total priority for a candidate using all registered rules
   *
   * @param {object} candidate - Candidate object with priority-relevant properties
   * @param {string} candidate.coveragePriority - Coverage priority (outer, base, underwear, direct)
   * @param {string} candidate.layer - Layer type (outer, base, underwear, accessories)
   * @param {string} candidate.itemId - Unique identifier for the item
   * @param {string} [candidate.source] - Source type (coverage, direct) for tie-breaking
   * @param {number} [candidate.equipTimestamp] - When item was equipped for tie-breaking
   * @returns {number} Total calculated priority score
   */
  calculatePriority(candidate) {
    if (!candidate || typeof candidate !== 'object') {
      this.#logger.warn('Invalid candidate provided to calculatePriority', {
        candidate,
      });
      return Number.MAX_SAFE_INTEGER; // Lowest priority for invalid candidates
    }

    let totalPriority = 0;
    const ruleName = null; // Will be set in the loop for error context

    for (const [currentRuleName, calculator] of this.#rules) {
      try {
        const contribution = calculator(candidate);

        if (typeof contribution !== 'number' || isNaN(contribution)) {
          this.#logger.warn(
            `Priority rule '${currentRuleName}' returned invalid number: ${contribution}`,
            { candidate, contribution }
          );
          continue; // Skip invalid contributions
        }

        totalPriority += contribution;
      } catch (error) {
        // Use injected logger instead of console
        this.#logger.warn(
          `Priority rule '${currentRuleName}' failed for candidate:`,
          { candidate, error: error.message, stack: error.stack }
        );
        // Continue with other rules - don't let one failure break everything
      }
    }

    return totalPriority;
  }

  /**
   * Process multiple candidates and return them with calculated priorities
   *
   * @param {Array} candidates - Array of candidate objects
   * @returns {Array} Array of candidates with priority property added
   */
  processCandidates(candidates) {
    if (!Array.isArray(candidates)) {
      this.#logger.warn('processCandidates called with non-array input', {
        candidates,
      });
      return [];
    }

    return candidates.map((candidate) => {
      const priority = this.calculatePriority(candidate);
      return {
        ...candidate,
        priority,
      };
    });
  }

  /**
   * Reset the registry to default rules only
   */
  resetToDefaults() {
    this.#rules.clear();
    this.registerDefaultRules();
    this.#logger.info('Priority rule registry reset to defaults');
  }

  /**
   * Get registry statistics for debugging and monitoring
   *
   * @returns {object} Registry statistics
   */
  getStats() {
    return {
      ruleCount: this.#rules.size,
      ruleNames: this.getRuleNames(),
      hasDefaults: this.hasRule('coverage') && this.hasRule('layer'),
    };
  }
}

export default PriorityRuleRegistry;
