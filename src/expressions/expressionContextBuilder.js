/**
 * @file Expression Context Builder - Constructs evaluation context for expressions.
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { createEntityContext } from '../logic/contextAssembler.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').IEntityManager} IEntityManager */

class ExpressionContextBuilder {
  #emotionCalculatorService;
  #entityManager;
  #logger;

  /**
   * @param {object} deps
   * @param {object} deps.emotionCalculatorService
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   */
  constructor({ emotionCalculatorService, entityManager, logger }) {
    validateDependency(emotionCalculatorService, 'IEmotionCalculatorService', logger, {
      requiredMethods: [
        'calculateSexualArousal',
        'calculateEmotions',
        'calculateSexualStates',
      ],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: [
        'getComponentData',
        'getAllComponentTypesForEntity',
        'hasComponent',
      ],
    });
    validateDependency(logger, 'logger');

    this.#emotionCalculatorService = emotionCalculatorService;
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Build complete evaluation context for expression prerequisites.
   *
   * @param {string} actorId - Actor entity ID.
   * @param {object} moodData - Current mood component data.
   * @param {object} sexualStateData - Current sexual state component data.
   * @param {object|null} previousState - Previous emotion/sexual state (optional).
   * @returns {object} Expression evaluation context.
   */
  buildContext(actorId, moodData, sexualStateData, previousState = null) {
    const sexualArousal =
      this.#emotionCalculatorService.calculateSexualArousal(sexualStateData);

    const emotions = this.#emotionCalculatorService.calculateEmotions(
      moodData,
      sexualArousal,
      sexualStateData
    );

    const sexualStates = this.#emotionCalculatorService.calculateSexualStates(
      moodData,
      sexualArousal,
      sexualStateData
    );

    const actorContext = createEntityContext(
      actorId,
      this.#entityManager,
      this.#logger
    );

    return {
      actor: actorContext,
      emotions: this.#mapToObject(emotions),
      sexualStates: this.#mapToObject(sexualStates),
      moodAxes: this.#extractMoodAxes(moodData),
      sexualArousal,
      previousEmotions: previousState?.emotions ?? null,
      previousSexualStates: previousState?.sexualStates ?? null,
      previousMoodAxes: previousState?.moodAxes ?? null,
    };
  }

  /**
   * Extract mood axes from mood component data.
   *
   * @param {object} moodData
   * @returns {object}
   */
  #extractMoodAxes(moodData) {
    return {
      valence: moodData?.valence ?? 0,
      arousal: moodData?.arousal ?? 0,
      agency_control: moodData?.agency_control ?? 0,
      threat: moodData?.threat ?? 0,
      engagement: moodData?.engagement ?? 0,
      future_expectancy: moodData?.future_expectancy ?? 0,
      self_evaluation: moodData?.self_evaluation ?? 0,
    };
  }

  /**
   * Convert Map to plain object for JSON Logic.
   *
   * @param {Map<string, number>} map
   * @returns {Record<string, number>}
   */
  #mapToObject(map) {
    if (!map || typeof map[Symbol.iterator] !== 'function') {
      return {};
    }

    const obj = {};
    for (const [key, value] of map) {
      obj[key] = value;
    }
    return obj;
  }
}

export default ExpressionContextBuilder;
