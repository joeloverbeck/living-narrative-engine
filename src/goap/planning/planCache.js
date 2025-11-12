/**
 * @file Plan cache for GOAP planning
 * Caches plans to avoid replanning every turn
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';

/**
 * Caches plans for actors
 */
class PlanCache {
  #logger;
  #cache;

  /**
   * Plan cache constructor
   *
   * @param {object} params - Dependencies
   * @param {object} params.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });

    this.#logger = logger;
    this.#cache = new Map();
  }

  /**
   * Gets cached plan for actor
   *
   * @param {string} actorId - Entity ID of actor
   * @returns {object|null} Cached plan or null
   */
  get(actorId) {
    string.assertNonBlank(actorId, 'actorId', 'get', this.#logger);

    const plan = this.#cache.get(actorId);

    if (plan) {
      this.#logger.debug(`Cache hit for ${actorId}`);
    } else {
      this.#logger.debug(`Cache miss for ${actorId}`);
    }

    return plan || null;
  }

  /**
   * Stores plan for actor
   *
   * @param {string} actorId - Entity ID of actor
   * @param {object} plan - Plan object
   */
  set(actorId, plan) {
    string.assertNonBlank(actorId, 'actorId', 'set', this.#logger);

    if (!plan) {
      this.#logger.warn(`Attempted to cache null plan for ${actorId}`);
      return;
    }

    this.#cache.set(actorId, plan);
    this.#logger.debug(`Cached plan for ${actorId}: goal ${plan.goalId}`);
  }

  /**
   * Checks if plan exists for actor
   *
   * @param {string} actorId - Entity ID of actor
   * @returns {boolean} True if plan cached
   */
  has(actorId) {
    string.assertNonBlank(actorId, 'actorId', 'has', this.#logger);

    return this.#cache.has(actorId);
  }

  /**
   * Invalidates cached plan for actor
   *
   * @param {string} actorId - Entity ID of actor
   */
  invalidate(actorId) {
    string.assertNonBlank(actorId, 'actorId', 'invalidate', this.#logger);

    const hadPlan = this.#cache.has(actorId);
    this.#cache.delete(actorId);

    if (hadPlan) {
      this.#logger.debug(`Invalidated plan for ${actorId}`);
    }
  }

  /**
   * Invalidates all plans for specific goal
   *
   * @param {string} goalId - Goal ID
   */
  invalidateGoal(goalId) {
    string.assertNonBlank(goalId, 'goalId', 'invalidateGoal', this.#logger);

    let count = 0;
    for (const [actorId, plan] of this.#cache.entries()) {
      if (plan.goalId === goalId) {
        this.#cache.delete(actorId);
        count++;
      }
    }

    if (count > 0) {
      this.#logger.debug(`Invalidated ${count} plans for goal ${goalId}`);
    }
  }

  /**
   * Clears all cached plans
   */
  clear() {
    const size = this.#cache.size;
    this.#cache.clear();

    if (size > 0) {
      this.#logger.debug(`Cleared ${size} cached plans`);
    }
  }

  /**
   * Gets cache statistics
   *
   * @returns {object} Cache stats
   */
  getStats() {
    return {
      size: this.#cache.size,
      actors: Array.from(this.#cache.keys())
    };
  }
}

export default PlanCache;
