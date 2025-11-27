/**
 * @file Collects and aggregates modifiers for probability calculations
 * @description Gathers applicable modifiers from buffs, equipment, and environment
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {Object} Modifier
 * @property {string} id - Unique modifier identifier
 * @property {string} source - Where modifier comes from (buff, equipment, environment)
 * @property {number} value - Modifier value (positive or negative)
 * @property {'flat' | 'percentage'} type - How modifier is applied
 * @property {string} description - Human-readable description
 * @property {string} [stackId] - Optional stacking group (same stackId = only highest)
 */

/**
 * @typedef {Object} ModifierCollection
 * @property {Modifier[]} modifiers - All collected modifiers
 * @property {number} totalFlat - Sum of flat modifiers
 * @property {number} totalPercentage - Total percentage modifier (multiplicative)
 */

class ModifierCollectorService {
  // eslint-disable-next-line no-unused-private-class-members -- Reserved for Phase 5+ modifier collection from buffs/equipment/environment
  #entityManager;
  #logger;

  /**
   * @param {Object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   */
  constructor({ entityManager, logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error', 'info'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getComponentData', 'hasComponent'],
    });

    this.#entityManager = entityManager;
    this.#logger = logger;

    this.#logger.debug('ModifierCollectorService: Initialized');
  }

  /**
   * Collects all applicable modifiers for a chance calculation
   * @param {Object} params
   * @param {string} params.actorId - Actor entity ID
   * @param {string} [params.targetId] - Target entity ID (for opposed checks)
   * @param {string} [params.locationId] - Location ID (for environmental modifiers)
   * @param {Object} [params.actionConfig] - Action's chanceBased configuration
   * @returns {ModifierCollection}
   */
  collectModifiers({ actorId, targetId, _locationId, actionConfig }) {
    this.#logger.debug(
      `ModifierCollectorService: Collecting modifiers for actor=${actorId}, target=${targetId}`
    );

    /** @type {Modifier[]} */
    const allModifiers = [];

    // Phase 5 stub: Collect from action definition's static modifiers
    if (actionConfig?.modifiers) {
      const actionModifiers = this.#collectActionModifiers(
        actorId,
        targetId,
        actionConfig.modifiers
      );
      allModifiers.push(...actionModifiers);
    }

    // Future: Collect from buff components
    // Future: Collect from equipment components
    // Future: Collect from environment

    // Apply stacking rules
    const stackedModifiers = this.#applyStackingRules(allModifiers);

    // Calculate totals
    const totals = this.#calculateTotals(stackedModifiers);

    this.#logger.debug(
      `ModifierCollectorService: Found ${stackedModifiers.length} modifiers, ` +
        `flat=${totals.totalFlat}, percentage=${totals.totalPercentage}`
    );

    return {
      modifiers: stackedModifiers,
      totalFlat: totals.totalFlat,
      totalPercentage: totals.totalPercentage,
    };
  }

  /**
   * Collects modifiers defined in action configuration
   * @private
   * @param {string} _actorId - Actor entity ID (unused in Phase 5 stub)
   * @param {string} [_targetId] - Target entity ID (unused in Phase 5 stub)
   * @param {Object} _modifierConfigs - Modifier configurations (unused in Phase 5 stub)
   * @returns {Modifier[]}
   */
  #collectActionModifiers(_actorId, _targetId, _modifierConfigs) {
    // In Phase 5, this evaluates JSON Logic conditions on each modifier
    // For now, return empty array as conditions are not evaluated yet
    return [];
  }

  /**
   * Applies stacking rules - same stackId uses highest value only
   * @private
   * @param {Modifier[]} modifiers
   * @returns {Modifier[]}
   */
  #applyStackingRules(modifiers) {
    const stackGroups = new Map();
    const unstackedModifiers = [];

    for (const mod of modifiers) {
      if (mod.stackId) {
        const existing = stackGroups.get(mod.stackId);
        if (!existing || Math.abs(mod.value) > Math.abs(existing.value)) {
          stackGroups.set(mod.stackId, mod);
        }
      } else {
        unstackedModifiers.push(mod);
      }
    }

    return [...unstackedModifiers, ...stackGroups.values()];
  }

  /**
   * Calculates total flat and percentage modifiers
   * @private
   * @param {Modifier[]} modifiers
   * @returns {{ totalFlat: number, totalPercentage: number }}
   */
  #calculateTotals(modifiers) {
    let totalFlat = 0;
    // Start at 1 (identity for multiplication) - not 0 which would zero out the result
    let totalPercentage = 1;

    for (const mod of modifiers) {
      if (mod.type === 'flat') {
        totalFlat += mod.value;
      } else if (mod.type === 'percentage') {
        // Percentage modifiers stack additively
        totalPercentage += mod.value;
      }
    }

    return { totalFlat, totalPercentage };
  }
}

export default ModifierCollectorService;
