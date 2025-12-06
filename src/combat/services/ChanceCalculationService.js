/**
 * @file Orchestrates all combat services for chance calculations
 * @description Unified API for action discovery display and rule execution
 * @see specs/non-deterministic-actions-system.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @typedef {object} DisplayResult
 * @property {number} chance - Calculated probability (0-100)
 * @property {string} displayText - Formatted for template (e.g., "55%")
 * @property {string[]} activeTags - Tags from active modifiers for display
 * @property {object} breakdown - Detailed calculation breakdown
 * @property {number} breakdown.actorSkill - Actor's skill value used
 * @property {number} breakdown.targetSkill - Target's skill value used
 * @property {number} breakdown.baseChance - Base chance before modifiers
 * @property {number} breakdown.finalChance - Final chance after modifiers/bounds
 * @property {Array} breakdown.modifiers - Applied modifiers
 * @property {string} breakdown.formula - Formula used for calculation
 */

/**
 * @typedef {object} OutcomeResult
 * @property {'CRITICAL_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'FUMBLE'} outcome
 * @property {number} roll - The d100 roll
 * @property {number} threshold - Success threshold (finalChance)
 * @property {number} margin - Roll - threshold (negative = success)
 * @property {Array} modifiers - Applied modifiers
 * @property {string[]} activeTags - Tags from active modifiers for display
 * @property {boolean} isCritical - Whether outcome was critical
 */

/**
 * Orchestrates all combat services for complete chance calculation.
 * Provides a unified API used by both action discovery (for displaying
 * probability percentages) and rule execution (for resolving outcomes).
 *
 * @example
 * // For action discovery UI
 * const result = service.calculateForDisplay({ actorId, targetId, actionDef });
 * // Returns { chance: 55, displayText: '55%', breakdown: {...} }
 * @example
 * // For rule execution
 * const outcome = service.resolveOutcome({ actorId, targetId, actionDef });
 * // Returns { outcome: 'SUCCESS', roll: 42, threshold: 55, margin: -13, ... }
 */
class ChanceCalculationService {
  #skillResolverService;
  #modifierCollectorService;
  #probabilityCalculatorService;
  #outcomeDeterminerService;
  #logger;

  /**
   * @param {object} deps
   * @param {object} deps.skillResolverService - Service for resolving skill values
   * @param {object} deps.modifierCollectorService - Service for collecting modifiers
   * @param {object} deps.probabilityCalculatorService - Service for calculating probability
   * @param {object} deps.outcomeDeterminerService - Service for determining outcomes
   * @param {ILogger} deps.logger
   */
  constructor({
    skillResolverService,
    modifierCollectorService,
    probabilityCalculatorService,
    outcomeDeterminerService,
    logger,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error', 'info'],
    });
    validateDependency(skillResolverService, 'SkillResolverService', logger, {
      requiredMethods: ['getSkillValue'],
    });
    validateDependency(
      modifierCollectorService,
      'ModifierCollectorService',
      logger,
      {
        requiredMethods: ['collectModifiers'],
      }
    );
    validateDependency(
      probabilityCalculatorService,
      'ProbabilityCalculatorService',
      logger,
      {
        requiredMethods: ['calculate'],
      }
    );
    validateDependency(
      outcomeDeterminerService,
      'OutcomeDeterminerService',
      logger,
      {
        requiredMethods: ['determine'],
      }
    );

    this.#skillResolverService = skillResolverService;
    this.#modifierCollectorService = modifierCollectorService;
    this.#probabilityCalculatorService = probabilityCalculatorService;
    this.#outcomeDeterminerService = outcomeDeterminerService;
    this.#logger = logger;

    this.#logger.debug('ChanceCalculationService: Initialized');
  }

  /**
   * Calculate chance for action discovery display
   *
   * @param {object} params
   * @param {string} params.actorId - Actor entity ID
   * @param {string} [params.targetId] - Target entity ID (for opposed checks, legacy alias for primaryTargetId)
   * @param {string} [params.primaryTargetId] - Primary target entity ID (preferred over targetId)
   * @param {string} [params.secondaryTargetId] - Secondary target entity ID
   * @param {string} [params.tertiaryTargetId] - Tertiary target entity ID
   * @param {object} params.actionDef - Action definition with chanceBased config
   * @returns {DisplayResult}
   */
  calculateForDisplay({
    actorId,
    targetId,
    primaryTargetId,
    secondaryTargetId,
    tertiaryTargetId,
    actionDef,
  }) {
    // Support legacy targetId parameter (backward compatibility)
    const resolvedPrimaryTargetId = primaryTargetId ?? targetId;
    this.#logger.debug(
      `ChanceCalculationService: Calculating display chance for ${actionDef?.id ?? 'unknown'}`
    );

    const chanceBased = actionDef?.chanceBased;
    if (!chanceBased?.enabled) {
      return {
        chance: 100,
        displayText: '',
        activeTags: [],
        breakdown: { reason: 'Action is not chance-based' },
      };
    }

    // 1. Resolve skills
    const actorSkill = this.#skillResolverService.getSkillValue(
      actorId,
      chanceBased.actorSkill?.component,
      chanceBased.actorSkill?.default ?? 0
    );

    let targetSkillValue = 0;
    if (chanceBased.contestType === 'opposed' && chanceBased.targetSkill) {
      // Determine which target to use for skill resolution based on targetRole
      const targetRole = chanceBased.targetSkill.targetRole ?? 'primary';
      let targetIdForSkill;

      switch (targetRole) {
        case 'secondary':
          targetIdForSkill = secondaryTargetId;
          break;
        case 'tertiary':
          targetIdForSkill = tertiaryTargetId;
          break;
        case 'primary':
        default:
          targetIdForSkill = resolvedPrimaryTargetId;
          break;
      }

      if (targetIdForSkill) {
        const targetSkill = this.#skillResolverService.getSkillValue(
          targetIdForSkill,
          chanceBased.targetSkill.component,
          chanceBased.targetSkill.default ?? 0
        );
        targetSkillValue = targetSkill.baseValue;
      }
    }

    // 2. Collect modifiers (now with all target roles)
    const modifierCollection = this.#modifierCollectorService.collectModifiers({
      actorId,
      primaryTargetId: resolvedPrimaryTargetId,
      secondaryTargetId,
      tertiaryTargetId,
      actionConfig: chanceBased,
    });

    // 3. Calculate probability
    const calculation = this.#probabilityCalculatorService.calculate({
      actorSkill: actorSkill.baseValue,
      targetSkill: targetSkillValue,
      difficulty: chanceBased.fixedDifficulty ?? 0,
      formula: chanceBased.formula ?? 'ratio',
      modifiers: modifierCollection,
      bounds: chanceBased.bounds ?? { min: 5, max: 95 },
    });

    const roundedChance = Math.round(calculation.finalChance);

    // Extract active tags from modifiers
    const activeTags = this.#extractActiveTags(modifierCollection.modifiers);

    return {
      chance: roundedChance,
      displayText: `${roundedChance}%`,
      activeTags,
      breakdown: {
        actorSkill: actorSkill.baseValue,
        targetSkill: targetSkillValue,
        baseChance: calculation.baseChance,
        finalChance: calculation.finalChance,
        modifiers: modifierCollection.modifiers ?? [],
        formula: chanceBased.formula ?? 'ratio',
      },
    };
  }

  /**
   * Resolve outcome for rule execution
   *
   * @param {object} params
   * @param {string} params.actorId - Actor entity ID
   * @param {string} [params.targetId] - Target entity ID (for opposed checks, legacy alias for primaryTargetId)
   * @param {string} [params.primaryTargetId] - Primary target entity ID (preferred over targetId)
   * @param {string} [params.secondaryTargetId] - Secondary target entity ID
   * @param {string} [params.tertiaryTargetId] - Tertiary target entity ID
   * @param {object} params.actionDef - Action definition with chanceBased config
   * @param {number} [params.forcedRoll] - For testing determinism (1-100)
   * @returns {OutcomeResult}
   */
  resolveOutcome({
    actorId,
    targetId,
    primaryTargetId,
    secondaryTargetId,
    tertiaryTargetId,
    actionDef,
    forcedRoll,
  }) {
    this.#logger.debug(
      `ChanceCalculationService: Resolving outcome for ${actionDef?.id ?? 'unknown'}`
    );

    const chanceBased = actionDef?.chanceBased;
    if (!chanceBased?.enabled) {
      // Non-chance actions always succeed
      return {
        outcome: 'SUCCESS',
        roll: 0,
        threshold: 100,
        margin: -100,
        modifiers: [],
        activeTags: [],
        isCritical: false,
      };
    }

    // Calculate chance (reuse display calculation logic)
    const displayResult = this.calculateForDisplay({
      actorId,
      targetId,
      primaryTargetId,
      secondaryTargetId,
      tertiaryTargetId,
      actionDef,
    });

    // Determine outcome
    const thresholds = {
      // Support both schema naming (criticalSuccessThreshold) and the service naming (criticalSuccess)
      criticalSuccess:
        chanceBased.outcomes?.criticalSuccess ??
        chanceBased.outcomes?.criticalSuccessThreshold ??
        5,
      criticalFailure:
        chanceBased.outcomes?.criticalFailure ??
        chanceBased.outcomes?.criticalFailureThreshold ??
        95,
    };

    const outcome = this.#outcomeDeterminerService.determine({
      finalChance: displayResult.chance,
      thresholds,
      forcedRoll,
    });

    return {
      outcome: outcome.outcome,
      roll: outcome.roll,
      threshold: displayResult.chance,
      margin: outcome.margin,
      modifiers: displayResult.breakdown.modifiers ?? [],
      activeTags: displayResult.activeTags,
      isCritical: outcome.isCritical,
    };
  }

  /**
   * Extracts active tags from modifiers for display
   *
   * @private
   * @param {Array<object>} modifiers - Active modifiers
   * @returns {string[]} - Array of tag strings
   */
  #extractActiveTags(modifiers) {
    if (!modifiers || modifiers.length === 0) {
      return [];
    }

    return modifiers
      .filter(
        (mod) =>
          mod.tag && typeof mod.tag === 'string' && mod.tag.trim().length > 0
      )
      .map((mod) => mod.tag);
  }
}

export default ChanceCalculationService;
