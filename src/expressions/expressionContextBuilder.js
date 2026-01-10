/**
 * @file Expression Context Builder - Constructs evaluation context for expressions.
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { createEntityContext } from '../logic/contextAssembler.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').IEntityManager} IEntityManager */

const MOOD_AXES_KEYS = [
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'self_evaluation',
  'affiliation',
];

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
        'getEmotionPrototypeKeys',
        'getSexualPrototypeKeys',
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

    const emotionKeys = this.#emotionCalculatorService.getEmotionPrototypeKeys();
    const sexualKeys = this.#emotionCalculatorService.getSexualPrototypeKeys();

    this.#assertStateCoverage(emotions, 'emotions', emotionKeys);
    this.#assertStateCoverage(sexualStates, 'sexualStates', sexualKeys);

    const actorContext = createEntityContext(
      actorId,
      this.#entityManager,
      this.#logger
    );

    const previousEmotions = this.#buildPreviousState(
      previousState?.emotions ?? null,
      emotionKeys,
      'previousEmotions'
    );
    const previousSexualStates = this.#buildPreviousState(
      previousState?.sexualStates ?? null,
      sexualKeys,
      'previousSexualStates'
    );
    const previousMoodAxes = this.#buildPreviousState(
      previousState?.moodAxes ?? null,
      MOOD_AXES_KEYS,
      'previousMoodAxes',
      'mood axes'
    );

    return {
      actor: actorContext,
      emotions: this.#mapToObject(emotions),
      sexualStates: this.#mapToObject(sexualStates),
      moodAxes: this.#extractMoodAxes(moodData),
      sexualArousal,
      previousEmotions,
      previousSexualStates,
      previousMoodAxes,
    };
  }

  /**
   * Ensure calculator results contain all prototype keys.
   *
   * @param {Map<string, number>} stateMap
   * @param {'emotions'|'sexualStates'} kind
   * @param expectedKeys
   * @private
   */
  #assertStateCoverage(stateMap, kind, expectedKeys) {
    if (!stateMap || typeof stateMap[Symbol.iterator] !== 'function') {
      throw new Error(
        `[ExpressionContextBuilder] ${kind} evaluation returned non-iterable results.`
      );
    }

    if (!Array.isArray(expectedKeys)) {
      throw new Error(
        `[ExpressionContextBuilder] ${kind} prototype lookup returned invalid keys.`
      );
    }

    const expectedCount = expectedKeys.length;
    if (expectedCount === 0) {
      throw new Error(
        `[ExpressionContextBuilder] ${kind} prototype lookup returned no keys. ` +
          `This is unexpected - EmotionCalculatorService should have thrown. ` +
          `Check that mocks provide non-empty prototype key arrays.`
      );
    }
    const actualCount = stateMap.size;

    if (expectedCount !== actualCount) {
      const expectedSet = new Set(expectedKeys);
      const missingKeys = [];
      for (const key of expectedSet) {
        if (!stateMap.has(key)) {
          missingKeys.push(key);
        }
      }

      throw new Error(
        `[ExpressionContextBuilder] ${kind} evaluation missing prototype keys. Expected ${expectedCount}, got ${actualCount}. Missing: ${missingKeys.join(
          ', '
        )}. This may indicate a mismatch between prototype lookup and calculator logic.`
      );
    }
  }

  /**
   * Build previous-state objects with full coverage and validation.
   *
   * @param {object|Map<string, number>|null} previousValues
   * @param {string[]} expectedKeys
   * @param {string} label
   * @param {string} [sourceLabel]
   * @returns {Record<string, number>}
   * @private
   */
  #buildPreviousState(
    previousValues,
    expectedKeys,
    label,
    sourceLabel = 'prototype lookup'
  ) {
    if (!Array.isArray(expectedKeys) || expectedKeys.length === 0) {
      throw new Error(
        `[ExpressionContextBuilder] ${label} ${sourceLabel} returned no keys.`
      );
    }

    if (previousValues === null || previousValues === undefined) {
      return this.#createZeroedState(expectedKeys);
    }

    const normalized =
      previousValues instanceof Map
        ? this.#mapToObject(previousValues)
        : previousValues;

    if (!normalized || typeof normalized !== 'object' || Array.isArray(normalized)) {
      throw new Error(
        `[ExpressionContextBuilder] ${label} must be a plain object with numeric values.`
      );
    }

    this.#assertPreviousStateKeys(normalized, expectedKeys, label, sourceLabel);
    return { ...normalized };
  }

  /**
   * Validate previous-state keys against expected keys.
   *
   * @param {object} previousValues
   * @param {string[]} expectedKeys
   * @param {string} label
   * @param {string} sourceLabel
   * @private
   */
  #assertPreviousStateKeys(previousValues, expectedKeys, label, sourceLabel) {
    const expectedSet = new Set(expectedKeys);
    const actualKeys = Object.keys(previousValues);
    const missingKeys = expectedKeys.filter(
      (key) => !Object.prototype.hasOwnProperty.call(previousValues, key)
    );
    const extraKeys = actualKeys.filter((key) => !expectedSet.has(key));

    if (missingKeys.length || extraKeys.length) {
      const missingLabel = missingKeys.length ? missingKeys.join(', ') : 'none';
      const extraLabel = extraKeys.length ? extraKeys.join(', ') : 'none';
      throw new Error(
        `[ExpressionContextBuilder] ${label} keys do not match ${sourceLabel}. Expected ${expectedKeys.length}, got ${actualKeys.length}. Missing: ${missingLabel}. Extra: ${extraLabel}.`
      );
    }
  }

  /**
   * Create a zeroed state object for expected keys.
   *
   * @param {string[]} keys
   * @returns {Record<string, number>}
   * @private
   */
  #createZeroedState(keys) {
    const result = {};
    for (const key of keys) {
      result[key] = 0;
    }
    return result;
  }

  /**
   * Extract mood axes from mood component data.
   *
   * @param {object} moodData
   * @returns {object}
   */
  #extractMoodAxes(moodData) {
    const axes = {};
    for (const key of MOOD_AXES_KEYS) {
      axes[key] = moodData?.[key] ?? 0;
    }
    return axes;
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
