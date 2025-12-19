/**
 * @file Context building system extracted from ActivityDescriptionService
 * @see activityDescriptionService.js
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * Builds contextual information for activities based on entity relationships and priority levels.
 * Handles relationship tone detection, intensity mapping, and contextual tone application.
 *
 * @class ActivityContextBuildingSystem
 */
class ActivityContextBuildingSystem {
  #entityManager;
  #logger;
  #nlgSystem;
  #cache;

  /**
   * Creates an instance of ActivityContextBuildingSystem.
   *
   * @param {object} dependencies - Service dependencies
   * @param {object} dependencies.entityManager - Entity manager for accessing entity instances
   * @param {object} dependencies.logger - Logger for diagnostic messages
   * @param {object} dependencies.nlgSystem - NLG system for gender detection and adverb manipulation
   */
  constructor({ entityManager, logger, nlgSystem }) {
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntityInstance'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(nlgSystem, 'IActivityNLGSystem', logger, {
      requiredMethods: ['detectEntityGender'],
    });

    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#nlgSystem = nlgSystem;
    this.#cache = new Map();
  }

  /**
   * Build lightweight context for an activity based on available component data.
   *
   * Retrieves closeness relationships from the personal-space-states:closeness component and
   * determines relationship tone based on partner status. Also detects target gender
   * and activity intensity.
   *
   * @param {string} actorId - Actor entity ID
   * @param {object} activity - Activity metadata with optional targetEntityId or targetId
   * @returns {object} Normalized context payload with targetId, intensity, relationshipTone, targetGender
   */
  buildActivityContext(actorId, activity) {
    const targetId = activity?.targetEntityId ?? activity?.targetId ?? null;

    const context = {
      targetId,
      intensity: this.determineActivityIntensity(activity?.priority),
      relationshipTone: 'neutral',
      targetGender: null,
    };

    if (!targetId || !actorId) {
      return context;
    }

    // Get closeness partners with caching
    const cachedPartners = this.#getClosenessPartners(actorId);

    // Detect gender using NLG system
    context.targetGender = this.#nlgSystem.detectEntityGender(targetId);

    // Detect relationship tone
    if (Array.isArray(cachedPartners) && cachedPartners.includes(targetId)) {
      context.relationshipTone = 'closeness_partner';
    }

    return context;
  }

  /**
   * Get closeness partners for an actor with caching
   *
   * Queries the personal-space-states:closeness component for the actor's partner list.
   * Results are cached to avoid repeated entity lookups.
   *
   * @private
   * @param {string} actorId - Actor entity ID
   * @returns {Array<string>} Array of partner entity IDs
   */
  #getClosenessPartners(actorId) {
    const cacheKey = `closeness:${actorId}`;

    if (this.#cache.has(cacheKey)) {
      return this.#cache.get(cacheKey);
    }

    let partners = [];
    try {
      const actorEntity = this.#entityManager.getEntityInstance(actorId);
      const closenessData = actorEntity?.getComponentData?.(
        'personal-space-states:closeness'
      );
      partners = Array.isArray(closenessData?.partners)
        ? [...closenessData.partners]
        : [];
    } catch (error) {
      this.#logger.warn(
        `Failed to retrieve closeness data for ${actorId}`,
        error
      );
      partners = [];
    }

    this.#cache.set(cacheKey, partners);
    return partners;
  }

  /**
   * Map activity priority onto an intensity bucket
   *
   * Converts numeric priority scores into categorical intensity levels
   * for use in contextual tone application.
   *
   * @param {number} priority - Activity priority score (defaults to 0)
   * @returns {string} Intensity level identifier ('casual', 'elevated', 'intense')
   */
  determineActivityIntensity(priority = 0) {
    if (priority >= 90) {
      return 'intense';
    }

    if (priority >= 70) {
      return 'elevated';
    }

    return 'casual';
  }

  /**
   * Apply contextual tone adjustments to an activity payload before rendering
   *
   * Modifies activity metadata based on relationship tone and intensity level.
   * For closeness partners, applies 'intimate' tone. For intense activities,
   * applies 'intense' tone with adverb and softener injection.
   *
   * @param {object} activity - Original activity metadata
   * @param {object} context - Context payload from buildActivityContext
   * @returns {object} Activity metadata with contextual overrides
   */
  applyContextualTone(activity, context) {
    const adjusted = { ...activity };

    if (!context || !context.targetId) {
      return adjusted;
    }

    if (context.relationshipTone === 'closeness_partner') {
      adjusted.contextualTone = 'intimate';
      return adjusted;
    }

    if (context.intensity === 'intense') {
      adjusted.contextualTone = 'intense';

      if (typeof adjusted.adverb === 'string') {
        adjusted.adverb = this.#nlgSystem.mergeAdverb(
          adjusted.adverb,
          'fiercely'
        );
      } else if (adjusted.type === 'dedicated') {
        adjusted.adverb = 'fiercely';
      }

      if (typeof adjusted.template === 'string') {
        adjusted.template = this.#nlgSystem.injectSoftener(
          adjusted.template,
          'fiercely'
        );
      }
    }

    return adjusted;
  }

  /**
   * Clear cache entries (useful for testing)
   *
   * Removes all cached closeness partner data. This is primarily used
   * in test scenarios to ensure clean state between tests.
   */
  clearCache() {
    this.#cache.clear();
  }

  /**
   * Invalidate closeness cache for a specific actor
   *
   * Removes cached closeness partner data for the specified actor.
   * This ensures that subsequent calls to buildActivityContext will
   * retrieve fresh closeness data from the entity manager.
   *
   * @param {string} actorId - Actor entity ID whose closeness cache should be invalidated
   */
  invalidateClosenessCache(actorId) {
    const cacheKey = `closeness:${actorId}`;
    this.#cache.delete(cacheKey);
  }

  /**
   * Provide controlled access to private helpers for white-box unit testing
   *
   * Exposes internal methods and cache access for comprehensive testing coverage.
   *
   * @returns {object} Object containing test hook functions
   */
  getTestHooks() {
    return {
      buildActivityContext: (...args) => this.buildActivityContext(...args),
      determineActivityIntensity: (...args) =>
        this.determineActivityIntensity(...args),
      applyContextualTone: (...args) => this.applyContextualTone(...args),
      getClosenessPartners: (actorId) => this.#getClosenessPartners(actorId),
    };
  }
}

export default ActivityContextBuildingSystem;
