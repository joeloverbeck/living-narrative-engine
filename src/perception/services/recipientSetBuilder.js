/**
 * @file RecipientSetBuilder
 *
 * Builds recipient sets for perception events, centralizing routing logic.
 *
 * @see specs/perception_event_logging_refactor.md - R3: Recipient Set Building Extraction
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * @typedef {object} RecipientSetResult
 * @property {Set<string>|string[]} entityIds - Recipient IDs (Set by default, sorted array when deterministic).
 * @property {'explicit'|'exclusion'|'broadcast'} mode - Routing mode used.
 */

/**
 * Builds recipient sets for perception events.
 * Single source of truth for recipient determination logic.
 */
class RecipientSetBuilder {
  /** @type {import('../../interfaces/IEntityManager.js').IEntityManager} */ #entityManager;
  /** @type {import('../../interfaces/coreServices.js').ILogger} */ #logger;

  /**
   * @param {object} deps
   * @param {import('../../interfaces/IEntityManager.js').IEntityManager} deps.entityManager
   * @param {import('../../interfaces/coreServices.js').ILogger} deps.logger
   */
  constructor({ entityManager, logger }) {
    this.#logger = ensureValidLogger(logger, 'RecipientSetBuilder');

    validateDependency(entityManager, 'IEntityManager', this.#logger, {
      requiredMethods: ['getEntitiesInLocation'],
    });

    this.#entityManager = entityManager;

    this.#logger.debug('RecipientSetBuilder initialized');
  }

  /**
   * Build recipient set based on routing parameters.
   *
   * @param {object} options
   * @param {string} options.locationId - Location to query
   * @param {string[]} [options.explicitRecipients] - Explicit recipient list
   * @param {string[]} [options.excludedActors] - Actors to exclude
   * @param {string} [options.traceId] - For logging correlation
   * @param {boolean} [options.deterministic=false] - When true, return sorted array
   * @returns {RecipientSetResult}
   */
  build({
    locationId,
    explicitRecipients,
    excludedActors,
    traceId,
    deterministic = false,
  }) {
    const normalizedRecipients = Array.isArray(explicitRecipients)
      ? explicitRecipients
      : [];
    const normalizedExclusions = Array.isArray(excludedActors)
      ? excludedActors
      : [];

    if (normalizedRecipients.length > 0) {
      this.#logger.debug(`RecipientSetBuilder [${traceId}]: using explicit recipients`, {
        count: normalizedRecipients.length,
      });
      return this.#formatResult(new Set(normalizedRecipients), 'explicit', deterministic);
    }

    const allInLocation =
      this.#entityManager.getEntitiesInLocation(locationId) ?? new Set();

    if (normalizedExclusions.length > 0) {
      const exclusionSet = new Set(normalizedExclusions);
      const filtered = new Set(
        [...allInLocation].filter((id) => !exclusionSet.has(id))
      );
      this.#logger.debug(`RecipientSetBuilder [${traceId}]: using exclusion mode`, {
        total: allInLocation.size,
        excluded: normalizedExclusions.length,
        remaining: filtered.size,
      });
      return this.#formatResult(filtered, 'exclusion', deterministic);
    }

    this.#logger.debug(`RecipientSetBuilder [${traceId}]: using broadcast mode`, {
      count: allInLocation.size,
    });
    return this.#formatResult(allInLocation, 'broadcast', deterministic);
  }

  /**
   * @param {Set<string>} entityIds
   * @param {'explicit'|'exclusion'|'broadcast'} mode
   * @param {boolean} deterministic
   * @returns {RecipientSetResult}
   * @private
   */
  #formatResult(entityIds, mode, deterministic) {
    if (!deterministic) {
      return { entityIds, mode };
    }

    const sorted = [...entityIds].sort();
    return { entityIds: sorted, mode };
  }
}

export default RecipientSetBuilder;
