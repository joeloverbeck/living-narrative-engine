/**
 * @file Expression Persistence Listener - Handles expression evaluation on state changes.
 */

import {
  MOOD_COMPONENT_ID,
  SEXUAL_STATE_COMPONENT_ID,
} from '../constants/componentIds.js';
import {
  ACTION_DECIDED_ID,
  MOOD_STATE_UPDATED_ID,
  TURN_STARTED_ID,
} from '../constants/eventIds.js';
import { validateDependency } from '../utils/dependencyUtils.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

class ExpressionPersistenceListener {
  #expressionContextBuilder;
  #expressionEvaluatorService;
  #expressionDispatcher;
  #expressionEvaluationLogger;
  #entityManager;
  #logger;
  #previousStateCache;
  #turnCounter;
  #expressionEvaluatedThisTurn;

  /**
   * Build the expression persistence listener.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {object} deps.expressionContextBuilder - Context builder for expression evaluation.
   * @param {object} deps.expressionEvaluatorService - Evaluator service for expressions.
   * @param {object} deps.expressionDispatcher - Dispatcher for matched expressions.
   * @param {object} deps.expressionEvaluationLogger - Logger for evaluation entries.
   * @param {object} deps.entityManager - Entity manager lookup.
   * @param {ILogger} deps.logger - Logger instance.
   */
  constructor({
    expressionContextBuilder,
    expressionEvaluatorService,
    expressionDispatcher,
    expressionEvaluationLogger,
    entityManager,
    logger,
  }) {
    validateDependency(expressionContextBuilder, 'IExpressionContextBuilder', logger, {
      requiredMethods: ['buildContext'],
    });
    validateDependency(expressionEvaluatorService, 'IExpressionEvaluatorService', logger, {
      requiredMethods: ['evaluate', 'evaluateAll'],
    });
    validateDependency(expressionDispatcher, 'IExpressionDispatcher', logger, {
      requiredMethods: ['dispatch', 'dispatchWithResult'],
    });
    validateDependency(expressionEvaluationLogger, 'IExpressionEvaluationLogger', logger, {
      requiredMethods: ['logEvaluation'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getComponentData'],
    });
    validateDependency(logger, 'logger');

    this.#expressionContextBuilder = expressionContextBuilder;
    this.#expressionEvaluatorService = expressionEvaluatorService;
    this.#expressionDispatcher = expressionDispatcher;
    this.#expressionEvaluationLogger = expressionEvaluationLogger;
    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#previousStateCache = new Map();
    this.#turnCounter = 0;
    this.#expressionEvaluatedThisTurn = new Set();
  }

  /**
   * Handle ACTION_DECIDED and MOOD_STATE_UPDATED events.
   *
   * @param {{ type?: string, payload?: { actorId?: string, extractedData?: { moodUpdate?: object, sexualUpdate?: object }, moodUpdate?: object, sexualUpdate?: object } }} event - Incoming event payload.
   */
  async handleEvent(event) {
    // TURN_STARTED_ID doesn't require a payload - it resets tracking state
    if (event?.type === TURN_STARTED_ID) {
      this.#expressionEvaluatedThisTurn.clear();
      this.#logger.debug(
        'ExpressionPersistenceListener: Turn started - cleared tracking set'
      );
      return;
    }

    if (!event?.payload) {
      return;
    }

    if (event.type === MOOD_STATE_UPDATED_ID) {
      const { actorId, moodUpdate, sexualUpdate } = event.payload;

      if (!actorId) {
        this.#logger.debug('Expression listener: No actorId in event, skipping');
        return;
      }

      if (!moodUpdate && !sexualUpdate) {
        this.#logger.debug(
          'Expression listener: No mood/sexual updates, skipping'
        );
        return;
      }

      this.#turnCounter += 1;

      try {
        await this.#processStateChange(
          actorId,
          moodUpdate,
          sexualUpdate,
          event.type
        );
        this.#expressionEvaluatedThisTurn.add(actorId);
      } catch (err) {
        this.#logger.error(`Expression listener error for actor ${actorId}`, err);
      }
      return;
    }

    if (event.type !== ACTION_DECIDED_ID) {
      return;
    }

    const { actorId, extractedData } = event.payload;

    if (!actorId) {
      this.#logger.debug('Expression listener: No actorId in event, skipping');
      return;
    }

    if (this.#expressionEvaluatedThisTurn.has(actorId)) {
      this.#logger.debug(
        `ExpressionPersistenceListener: Skipping for ${actorId} - already evaluated`
      );
      this.#expressionEvaluatedThisTurn.delete(actorId);
      return;
    }

    const { moodUpdate, sexualUpdate } = extractedData || {};
    if (!moodUpdate && !sexualUpdate) {
      this.#logger.debug('Expression listener: No mood/sexual updates, skipping');
      return;
    }

    this.#turnCounter += 1;

    try {
      await this.#processStateChange(
        actorId,
        moodUpdate,
        sexualUpdate,
        event.type
      );
    } catch (err) {
      this.#logger.error(`Expression listener error for actor ${actorId}`, err);
    }
  }

  /**
   * Process mood/sexual state change and potentially dispatch expression.
   *
   * @private
   * @param {string} actorId - Actor identifier.
   * @param {object} moodUpdate - Mood axes update.
   * @param {object} sexualUpdate - Sexual state update.
   * @param {string} eventType - Triggering event type.
   */
  async #processStateChange(actorId, moodUpdate, sexualUpdate, eventType) {
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

    if (this.#isStateUnchanged(previousState, context)) {
      this.#logger.debug(
        `Expression listener: No state change for actor ${actorId}, skipping`
      );
      return;
    }

    const matches = this.#expressionEvaluatorService.evaluateAll(context);
    const selectedExpression = matches[0] || null;

    let dispatchResult = {
      attempted: false,
      success: false,
      rateLimited: false,
      reason: 'no_match',
    };

    if (selectedExpression) {
      this.#logger.info('Expression matched', {
        actorId,
        turnNumber: this.#turnCounter,
        expressionId: selectedExpression.id ?? 'unknown',
      });

      dispatchResult = await this.#expressionDispatcher.dispatchWithResult(
        actorId,
        selectedExpression,
        this.#turnCounter
      );
    }

    const entry = {
      timestamp: new Date().toISOString(),
      actorId,
      turnNumber: this.#turnCounter,
      eventType,
      selected: selectedExpression
        ? this.#summarizeExpression(selectedExpression)
        : null,
      matches: matches.map((expression) =>
        this.#summarizeExpression(expression)
      ),
      dispatch: dispatchResult,
    };

    await this.#expressionEvaluationLogger.logEvaluation(entry);

    this.#previousStateCache.set(actorId, {
      emotions: context.emotions,
      sexualStates: context.sexualStates,
      moodAxes: context.moodAxes,
    });
  }

  /**
   * Normalize expression metadata for logging.
   *
   * @private
   * @param {object} expression
   * @returns {{id: string, priority: number, category: string}}
   */
  #summarizeExpression(expression) {
    const priority = Number.isFinite(expression?.priority)
      ? expression.priority
      : 0;
    return {
      id: expression?.id ?? 'unknown',
      priority,
      category: expression?.category ?? 'unknown',
    };
  }

  /**
   * Check if the evaluation-relevant state is unchanged.
   *
   * @private
   * @param {object|null} previousState - Cached previous state.
   * @param {object} context - Current evaluation context.
   * @returns {boolean} Whether the state is unchanged.
   */
  #isStateUnchanged(previousState, context) {
    if (!previousState) {
      return false;
    }

    return (
      this.#areShallowObjectsEqual(previousState.moodAxes, context.moodAxes) &&
      this.#areShallowObjectsEqual(previousState.emotions, context.emotions) &&
      this.#areShallowObjectsEqual(
        previousState.sexualStates,
        context.sexualStates
      )
    );
  }

  /**
   * Compare plain objects with primitive values.
   *
   * @private
   * @param {object|null} left - Left value.
   * @param {object|null} right - Right value.
   * @returns {boolean} Whether values are equal.
   */
  #areShallowObjectsEqual(left, right) {
    if (left === right) {
      return true;
    }

    if (!left || !right) {
      return false;
    }

    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(right, key)) {
        return false;
      }
      if (!Object.is(left[key], right[key])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get mood data, merging update with existing component.
   *
   * @private
   * @param {string} actorId - Actor identifier.
   * @param {object} moodUpdate - Mood update payload.
   * @returns {object | null} Merged mood data.
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
   * @param {string} actorId - Actor identifier.
   * @param {object} sexualUpdate - Sexual update payload.
   * @returns {object | null} Merged sexual state data.
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
   * @returns {number} Turn count.
   */
  getTurnCounter() {
    return this.#turnCounter;
  }
}

export default ExpressionPersistenceListener;
