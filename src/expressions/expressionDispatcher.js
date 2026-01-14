/**
 * @file Expression Dispatcher - Dispatches expressions as perceptible events.
 */

import { NAME_COMPONENT_ID, POSITION_COMPONENT_ID } from '../constants/componentIds.js';
import { validateDependency } from '../utils/dependencyUtils.js';

const EVENT_ID = 'core:perceptible_event';
const DEFAULT_PERCEPTION_TYPE = 'emotion.expression';

class ExpressionDispatcher {
  #eventBus;
  #entityManager;
  #logger;
  #lastDispatchTurn;

  constructor({ eventBus, entityManager, logger }) {
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['dispatch'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getComponentData'],
    });
    validateDependency(logger, 'logger');

    this.#eventBus = eventBus;
    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#lastDispatchTurn = null;
  }

  /**
   * Dispatch an expression as a perceptible event.
   *
   * @param {string} actorId - Actor experiencing the expression.
   * @param {object} expression - Matched expression to dispatch.
   * @param {number} turnNumber - Current turn number for rate limiting.
   * @returns {Promise<boolean>} True if dispatched, false if rate limited or blocked.
   */
  async dispatch(actorId, expression, turnNumber) {
    const result = await this.dispatchWithResult(
      actorId,
      expression,
      turnNumber
    );
    return result.success;
  }

  /**
   * Dispatch an expression with a structured result.
   *
   * @param {string} actorId - Actor experiencing the expression.
   * @param {object} expression - Matched expression to dispatch.
   * @param {number} turnNumber - Current turn number for rate limiting.
   * @returns {Promise<{attempted: boolean, success: boolean, rateLimited: boolean, reason: string | null}>}
   */
  async dispatchWithResult(actorId, expression, turnNumber) {
    const hasTurnNumber = Number.isInteger(turnNumber);
    if (hasTurnNumber && this.#lastDispatchTurn === turnNumber) {
      this.#logger.debug(
        `Expression dispatch rate limited on turn ${turnNumber}`
      );
      return {
        attempted: false,
        success: false,
        rateLimited: true,
        reason: 'rate_limited',
      };
    }

    let attempted = false;
    try {
      const locationId = this.#getActorLocationId(actorId);
      if (!locationId) {
        this.#logger.warn(
          `Cannot dispatch expression: actor ${actorId} has no location`
        );
        return {
          attempted: false,
          success: false,
          rateLimited: false,
          reason: 'missing_location',
        };
      }

      const actorName = this.#getActorName(actorId);
      const descriptionText = this.#replacePlaceholders(
        expression?.description_text,
        {
          actor: actorName,
        }
      );

      const alternateDescriptions = this.#replaceAlternateDescriptions(
        expression?.alternate_descriptions,
        { actor: actorName }
      );

      const eventPayload = {
        eventName: EVENT_ID,
        locationId,
        originLocationId: locationId,
        descriptionText,
        timestamp: new Date().toISOString(),
        perceptionType: expression?.perception_type || DEFAULT_PERCEPTION_TYPE,
        actorId,
        targetId: null,
        involvedEntities: [],
        actorDescription: expression?.actor_description ?? null,
        targetDescription: null,
        alternateDescriptions,
        senseAware: true,
        contextualData: {
          source: 'expression_system',
          expressionId: expression?.id ?? null,
          category: expression?.category ?? 'calm',
        },
      };

      attempted = true;
      await this.#eventBus.dispatch(EVENT_ID, eventPayload);

      if (hasTurnNumber) {
        this.#lastDispatchTurn = turnNumber;
      }

      this.#logger.debug(
        `Dispatched expression ${expression?.id ?? 'unknown'} for actor ${actorId}`,
        {
          locationId,
          perceptionType: eventPayload.perceptionType,
        }
      );

      return {
        attempted,
        success: true,
        rateLimited: false,
        reason: null,
      };
    } catch (err) {
      this.#logger.error(
        `Failed to dispatch expression ${expression?.id ?? 'unknown'}`,
        err
      );
      return {
        attempted,
        success: false,
        rateLimited: false,
        reason: 'dispatch_error',
      };
    }
  }

  /**
   * Clear rate limit tracking (e.g., on new game or test reset).
   */
  clearRateLimits() {
    this.#lastDispatchTurn = null;
  }

  /**
   * Get actor's current location ID.
   *
   * @param actorId
   * @private
   */
  #getActorLocationId(actorId) {
    try {
      const locationComponent = this.#entityManager.getComponentData(
        actorId,
        POSITION_COMPONENT_ID
      );
      return locationComponent?.locationId || null;
    } catch {
      return null;
    }
  }

  /**
   * Get actor's display name.
   *
   * @param actorId
   * @private
   */
  #getActorName(actorId) {
    try {
      const nameComponent = this.#entityManager.getComponentData(
        actorId,
        NAME_COMPONENT_ID
      );
      return nameComponent?.text || nameComponent?.value || actorId;
    } catch {
      return actorId;
    }
  }

  /**
   * Replace placeholders in description text.
   *
   * @param text
   * @param values
   * @private
   */
  #replacePlaceholders(text, values) {
    if (typeof text !== 'string' || !text.length) return '';

    let result = text;
    for (const [placeholder, value] of Object.entries(values)) {
      result = result.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
    }
    return result;
  }

  /**
   * Replace placeholders in alternate descriptions.
   *
   * @param alternateDescriptions
   * @param values
   * @private
   */
  #replaceAlternateDescriptions(alternateDescriptions, values) {
    if (!alternateDescriptions || typeof alternateDescriptions !== 'object') {
      return null;
    }

    const replaced = {};
    for (const [key, value] of Object.entries(alternateDescriptions)) {
      if (typeof value === 'string') {
        replaced[key] = this.#replacePlaceholders(value, values);
      }
    }

    return Object.keys(replaced).length > 0 ? replaced : null;
  }
}

export default ExpressionDispatcher;
