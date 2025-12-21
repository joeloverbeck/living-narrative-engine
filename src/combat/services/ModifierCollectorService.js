/**
 * @file Collects and aggregates modifiers for probability calculations
 * @description Gathers applicable modifiers from buffs, equipment, and environment
 * @see specs/data-driven-modifier-system.md
 */

import jsonLogic from 'json-logic-js';
import { resolveConditionRefs } from '../../utils/conditionRefResolver.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./ModifierContextBuilder.js').default} ModifierContextBuilder */

/**
 * @typedef {object} Modifier
 * @property {string} id - Unique modifier identifier
 * @property {string} source - Where modifier comes from (buff, equipment, environment)
 * @property {number} value - Modifier value (positive or negative)
 * @property {'flat' | 'percentage'} type - How modifier is applied
 * @property {string} description - Human-readable description
 * @property {string} [stackId] - Optional stacking group (same stackId = only highest)
 */

/**
 * @typedef {object} ModifierCollection
 * @property {Modifier[]} modifiers - All collected modifiers
 * @property {number} totalFlat - Sum of flat modifiers
 * @property {number} totalPercentage - Total percentage modifier (multiplicative)
 */

class ModifierCollectorService {
  // eslint-disable-next-line no-unused-private-class-members -- Reserved for future modifier collection from buffs/equipment/environment
  #entityManager;
  #modifierContextBuilder;
  #logger;
  #gameDataRepository;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {ModifierContextBuilder} deps.modifierContextBuilder
   * @param {ILogger} deps.logger
   * @param {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} [deps.gameDataRepository]
   */
  constructor({
    entityManager,
    modifierContextBuilder,
    logger,
    gameDataRepository = null,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error', 'info'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getComponentData', 'hasComponent'],
    });
    validateDependency(
      modifierContextBuilder,
      'ModifierContextBuilder',
      logger,
      {
        requiredMethods: ['buildContext'],
      }
    );
    if (gameDataRepository) {
      validateDependency(gameDataRepository, 'IGameDataRepository', logger, {
        requiredMethods: ['getConditionDefinition'],
      });
    }

    this.#entityManager = entityManager;
    this.#modifierContextBuilder = modifierContextBuilder;
    this.#logger = logger;
    this.#gameDataRepository = gameDataRepository;

    this.#logger.debug('ModifierCollectorService: Initialized');
  }

  /**
   * Collects all applicable modifiers for a chance calculation
   *
   * @param {object} params
   * @param {string} params.actorId - Actor entity ID
   * @param {string} [params.primaryTargetId] - Primary target entity ID
   * @param {string} [params.secondaryTargetId] - Secondary target entity ID
   * @param {string} [params.tertiaryTargetId] - Tertiary target entity ID
   * @param {object} [params.actionConfig] - Action's chanceBased configuration
   * @returns {ModifierCollection}
   */
  collectModifiers({
    actorId,
    primaryTargetId,
    secondaryTargetId,
    tertiaryTargetId,
    actionConfig,
  }) {
    this.#logger.debug(
      `ModifierCollectorService: Collecting modifiers for actor=${actorId}, primary=${primaryTargetId}`
    );

    /** @type {Modifier[]} */
    const allModifiers = [];

    // Collect from action definition's static modifiers
    if (actionConfig?.modifiers) {
      const actionModifiers = this.#collectActionModifiers({
        actorId,
        primaryTargetId,
        secondaryTargetId,
        tertiaryTargetId,
        modifierConfigs: actionConfig.modifiers,
      });
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
   * Collects modifiers defined in action configuration by evaluating JSON Logic conditions
   *
   * @private
   * @param {object} params
   * @param {string} params.actorId - Actor entity ID
   * @param {string} [params.primaryTargetId] - Primary target entity ID
   * @param {string} [params.secondaryTargetId] - Secondary target entity ID
   * @param {string} [params.tertiaryTargetId] - Tertiary target entity ID
   * @param {Array<object>} params.modifierConfigs - Modifier configurations from action
   * @returns {Modifier[]}
   */
  #collectActionModifiers({
    actorId,
    primaryTargetId,
    secondaryTargetId,
    tertiaryTargetId,
    modifierConfigs,
  }) {
    if (!modifierConfigs || modifierConfigs.length === 0) {
      return [];
    }

    // Build context for JSON Logic evaluation
    const context = this.#modifierContextBuilder.buildContext({
      actorId,
      primaryTargetId,
      secondaryTargetId,
      tertiaryTargetId,
    });

    /** @type {Modifier[]} */
    const activeModifiers = [];

    for (const config of modifierConfigs) {
      try {
        // Evaluate the JSON Logic condition
        const conditionResult = this.#evaluateCondition(
          config.condition,
          context
        );

        if (conditionResult) {
          // Modifier is active - build the Modifier object
          const modifier = this.#buildModifierFromConfig(config);
          activeModifiers.push(modifier);

          this.#logger.debug(
            `ModifierCollectorService: Modifier active - tag="${modifier.tag}", ` +
              `type=${modifier.type}, value=${modifier.value}`
          );
        }
      } catch (error) {
        this.#logger.warn(
          `ModifierCollectorService: Error evaluating modifier condition`,
          { description: config.description, error: error.message }
        );
        // Continue processing other modifiers
      }
    }

    return activeModifiers;
  }

  /**
   * Evaluates a JSON Logic condition against the context
   *
   * @private
   * @param {object} condition - The condition object (may be a condition_ref or inline logic)
   * @param {object} context - The evaluation context from ModifierContextBuilder
   * @returns {boolean}
   */
  #evaluateCondition(condition, context) {
    if (!condition) {
      // No condition means always active
      return true;
    }

    const normalizedCondition = this.#normalizeCondition(condition);
    const repository =
      this.#gameDataRepository ?? { getConditionDefinition: () => null };

    // Handle inline JSON Logic (wrapped in .logic property)
    if (normalizedCondition.logic) {
      const resolvedLogic = resolveConditionRefs(
        normalizedCondition.logic,
        repository,
        this.#logger
      );
      return jsonLogic.apply(resolvedLogic, context);
    }

    // Direct JSON Logic object or condition_ref container
    const resolvedLogic = resolveConditionRefs(
      normalizedCondition,
      repository,
      this.#logger
    );
    return jsonLogic.apply(resolvedLogic, context);
  }

  /**
   * Normalizes modifier condition formats for evaluation.
   *
   * @private
   * @param {object} condition
   * @returns {object}
   */
  #normalizeCondition(condition) {
    if (condition.$ref && !condition.condition_ref) {
      this.#logger.warn(
        'ModifierCollectorService: Deprecated "$ref" in modifier condition; use "condition_ref" instead.',
        { conditionRef: condition.$ref }
      );
      return { condition_ref: condition.$ref };
    }

    return condition;
  }

  /**
   * Builds a Modifier object from configuration
   *
   * @private
   * @param {object} config - Modifier configuration from action
   * @returns {Modifier}
   */
  #buildModifierFromConfig(config) {
    // Support both new format (value + type) and legacy format (modifier)
    let type = config.type || 'flat';
    let value;

    if (config.value !== undefined) {
      value = config.value;
    } else if (config.modifier !== undefined) {
      // Legacy format - modifier is always flat
      value = config.modifier;
      type = 'flat';
    } else {
      value = 0;
    }

    return {
      type,
      value,
      tag: config.tag || null,
      description: config.description || null,
      stackId: config.stackId || null,
      targetRole: config.targetRole || null,
    };
  }

  /**
   * Applies stacking rules - same stackId uses highest value only
   *
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
   *
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
