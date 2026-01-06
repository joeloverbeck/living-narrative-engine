/**
 * @file Expression Persistence Listener - Handles expression evaluation on state changes.
 */

import {
  MOOD_COMPONENT_ID,
  SEXUAL_STATE_COMPONENT_ID,
} from '../constants/componentIds.js';
import { validateDependency } from '../utils/dependencyUtils.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

class ExpressionPersistenceListener {
  #expressionContextBuilder;
  #expressionEvaluatorService;
  #expressionDispatcher;
  #entityManager;
  #logger;
  #previousStateCache;
  #turnCounter;

  /**
   * @param {object} deps
   * @param {object} deps.expressionContextBuilder
   * @param {object} deps.expressionEvaluatorService
   * @param {object} deps.expressionDispatcher
   * @param {object} deps.entityManager
   * @param {ILogger} deps.logger
   */
  constructor({
    expressionContextBuilder,
    expressionEvaluatorService,
    expressionDispatcher,
    entityManager,
    logger,
  }) {
    validateDependency(expressionContextBuilder, 'IExpressionContextBuilder', logger, {
      requiredMethods: ['buildContext'],
    });
    validateDependency(expressionEvaluatorService, 'IExpressionEvaluatorService', logger, {
      requiredMethods: ['evaluate'],
    });
    validateDependency(expressionDispatcher, 'IExpressionDispatcher', logger, {
      requiredMethods: ['dispatch'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getComponentData'],
    });
    validateDependency(logger, 'logger');

    this.#expressionContextBuilder = expressionContextBuilder;
    this.#expressionEvaluatorService = expressionEvaluatorService;
    this.#expressionDispatcher = expressionDispatcher;
    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#previousStateCache = new Map();
    this.#turnCounter = 0;
  }

  /**
   * Handle ACTION_DECIDED event.
   *
   * @param {{ type: string, payload?: { actorId?: string, extractedData?: { moodUpdate?: object, sexualUpdate?: object } } }} event
   */
  async handleEvent(event) {
    const { actorId, extractedData } = event?.payload || {};

    if (!actorId) {
      this.#logger.debug('Expression listener: No actorId in event, skipping');
      return;
    }

    const { moodUpdate, sexualUpdate } = extractedData || {};
    if (!moodUpdate && !sexualUpdate) {
      this.#logger.debug('Expression listener: No mood/sexual updates, skipping');
      return;
    }

    this.#turnCounter += 1;

    try {
      await this.#processStateChange(actorId, moodUpdate, sexualUpdate);
    } catch (err) {
      this.#logger.error(`Expression listener error for actor ${actorId}`, err);
    }
  }

  /**
   * Process mood/sexual state change and potentially dispatch expression.
   *
   * @private
   * @param {string} actorId
   * @param {object} moodUpdate
   * @param {object} sexualUpdate
   */
  async #processStateChange(actorId, moodUpdate, sexualUpdate) {
    const moodData = this.#getMoodData(actorId, moodUpdate);
    const sexualStateData = this.#getSexualStateData(actorId, sexualUpdate);

    if (!moodData) {
      this.#logger.warn(`Expression listener: No mood data for actor ${actorId}`);
      return;
    }

    const previousState = this.#previousStateCache.get(actorId) || null;

    const context = this.#expressionContextBuilder.buildContext(
      actorId,
      moodData,
      sexualStateData || null,
      previousState
    );

    const matchedExpression = this.#expressionEvaluatorService.evaluate(context);

    if (matchedExpression) {
      this.#logger.debug(
        `Expression matched for actor ${actorId}: ${matchedExpression.id}`
      );

      await this.#expressionDispatcher.dispatch(
        actorId,
        matchedExpression,
        this.#turnCounter
      );
    }

    this.#previousStateCache.set(actorId, {
      emotions: context.emotions,
      sexualStates: context.sexualStates,
      moodAxes: context.moodAxes,
    });
  }

  /**
   * Get mood data, merging update with existing component.
   *
   * @private
   * @param {string} actorId
   * @param {object} moodUpdate
   * @returns {object | null}
   */
  #getMoodData(actorId, moodUpdate) {
    try {
      const current = this.#entityManager.getComponentData(
        actorId,
        MOOD_COMPONENT_ID
      );
      if (moodUpdate && current) {
        return { ...current, ...moodUpdate };
      }
      return current || moodUpdate || null;
    } catch {
      return moodUpdate || null;
    }
  }

  /**
   * Get sexual state data, merging update with existing component.
   *
   * @private
   * @param {string} actorId
   * @param {object} sexualUpdate
   * @returns {object | null}
   */
  #getSexualStateData(actorId, sexualUpdate) {
    try {
      const current = this.#entityManager.getComponentData(
        actorId,
        SEXUAL_STATE_COMPONENT_ID
      );
      if (sexualUpdate && current) {
        return { ...current, ...sexualUpdate };
      }
      return current || sexualUpdate || null;
    } catch {
      return sexualUpdate || null;
    }
  }

  /**
   * Clear cached previous states (for testing or game reset).
   */
  clearCache() {
    this.#previousStateCache.clear();
    this.#turnCounter = 0;
  }

  /**
   * Get turn counter (for testing).
   *
   * @returns {number}
   */
  getTurnCounter() {
    return this.#turnCounter;
  }
}

export default ExpressionPersistenceListener;
