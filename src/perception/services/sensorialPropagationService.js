/**
 * @file SensorialPropagationService
 * @description Handles sensorial link propagation for perception events. Determines when
 * events should propagate to linked locations and prepares prefixed entries for recipients.
 * Extracted from AddPerceptionLogEntryHandler for single responsibility and testability.
 * @see specs/add_perception_log_entry_handler_robustness.md
 * @see tickets/ADDPERLOGENTHANROB-005.md
 */

import {
  NAME_COMPONENT_ID,
  SENSORIAL_LINKS_COMPONENT_ID,
} from '../../constants/componentIds.js';
import { ensureValidLogger } from '../../utils/index.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {object} PropagationParams
 * @property {string} originLocationId - Location where event originated
 * @property {object} entry - Original perception entry
 * @property {string} entry.descriptionText - Base description text
 * @property {object|undefined} alternateDescriptions - Sense-based alternates
 * @property {string|undefined} actorDescription - Actor-specific description
 * @property {string|undefined} targetDescription - Target-specific description
 * @property {string|undefined} targetId - Target entity ID
 * @property {string[]} excludedActors - Actors to exclude from propagation
 * @property {string|undefined} originatingActorId - Actor who initiated event
 */

/**
 * @typedef {object} LinkedLocation
 * @property {string} locationId - Linked location ID
 * @property {Set<string>} entityIds - Recipients in linked location
 * @property {string} mode - Recipient mode (exclusion/broadcast)
 * @property {object} prefixedEntry - Entry with origin prefix applied
 * @property {string} prefixedEntry.descriptionText - Prefixed description
 * @property {object|undefined} prefixedAlternateDescriptions - Prefixed alternates
 * @property {string|undefined} prefixedActorDescription - Prefixed actor description
 * @property {string|undefined} prefixedTargetDescription - Prefixed target description
 */

/**
 * Service for handling sensorial link propagation of perception events.
 * Encapsulates the logic for determining when propagation should occur and
 * preparing prefixed entries for linked locations.
 *
 * Propagation Rules:
 * 1. No propagation when using explicit recipients
 * 2. No propagation when originLocationId differs from current location (prevents recursive chains)
 * 3. Self-loops are filtered out (current location never in linked locations)
 * 4. Originating actor is always excluded from linked location recipients
 * 5. Entry descriptions are prefixed with "(From LocationName) "
 */
class SensorialPropagationService {
  #entityManager;
  #recipientSetBuilder;
  #logger;

  /**
   * Create a SensorialPropagationService instance.
   *
   * @param {object} deps - Dependencies
   * @param {import('../../entities/entityManager.js').default} deps.entityManager - Entity manager for component queries
   * @param {import('./recipientSetBuilder.js').default} deps.recipientSetBuilder - Builder for recipient sets
   * @param {object} deps.logger - Logger service
   */
  constructor({ entityManager, recipientSetBuilder, logger }) {
    this.#logger = ensureValidLogger(logger, 'SensorialPropagationService');

    validateDependency(entityManager, 'IEntityManager', this.#logger, {
      requiredMethods: ['getComponentData'],
    });

    validateDependency(recipientSetBuilder, 'IRecipientSetBuilder', this.#logger, {
      requiredMethods: ['build'],
    });

    this.#entityManager = entityManager;
    this.#recipientSetBuilder = recipientSetBuilder;
  }

  /**
   * Determines if sensorial propagation should occur.
   * Propagation is blocked when:
   * - Using explicit recipients (targeted delivery mode)
   * - Origin location differs from current location (prevents recursive propagation chains)
   *
   * @param {boolean} usingExplicitRecipients - Whether explicit recipient mode is active
   * @param {string|null|undefined} originLocationId - Origin location ID (if propagating from elsewhere)
   * @param {string} currentLocationId - Current location being processed
   * @returns {boolean} True if sensorial propagation should proceed
   */
  shouldPropagate(usingExplicitRecipients, originLocationId, currentLocationId) {
    // Explicit recipients block propagation - targeted delivery only
    if (usingExplicitRecipients) {
      return false;
    }

    // If originLocationId is set and differs from current, this is already a propagated event
    // Block further propagation to prevent recursive chains
    if (originLocationId && originLocationId !== currentLocationId) {
      return false;
    }

    return true;
  }

  /**
   * Gets linked locations with prefixed entries ready for propagation.
   * Returns an empty array if no sensorial links exist or all linked locations are filtered out.
   *
   * @param {PropagationParams} params - Propagation parameters
   * @returns {LinkedLocation[]} Array of linked locations with prefixed entries
   */
  getLinkedLocationsWithPrefixedEntries(params) {
    const {
      originLocationId,
      entry,
      alternateDescriptions,
      actorDescription,
      targetDescription,
      excludedActors,
      originatingActorId,
    } = params;

    // Get sensorial link targets from the origin location
    const sensorialLinksData = this.#entityManager.getComponentData(
      originLocationId,
      SENSORIAL_LINKS_COMPONENT_ID
    );
    const sensorialTargets = sensorialLinksData?.targets;

    // Filter and deduplicate linked location IDs
    // Invariant: Self-loop prevention - origin location is always excluded
    const linkedLocationIds = Array.isArray(sensorialTargets)
      ? [...new Set(sensorialTargets)].filter(
          (targetId) => typeof targetId === 'string' && targetId !== originLocationId
        )
      : [];

    if (linkedLocationIds.length === 0) {
      return [];
    }

    // Get origin location name for prefix
    const originName = this.#getOriginName(originLocationId);
    const prefixText = `(From ${originName}) `;

    // Build prefix applier function
    const applyPrefix = (text) =>
      typeof text === 'string' && text.length > 0 ? `${prefixText}${text}` : text;

    // Build prefixed entry and descriptions
    const prefixedEntry = {
      ...entry,
      descriptionText: applyPrefix(entry.descriptionText),
    };

    const prefixedAlternateDescriptions = alternateDescriptions
      ? Object.fromEntries(
          Object.entries(alternateDescriptions).map(([key, value]) => [
            key,
            typeof value === 'string' ? applyPrefix(value) : value,
          ])
        )
      : undefined;

    const prefixedActorDescription =
      typeof actorDescription === 'string'
        ? applyPrefix(actorDescription)
        : undefined;

    const prefixedTargetDescription =
      typeof targetDescription === 'string'
        ? applyPrefix(targetDescription)
        : undefined;

    // Build exclusion set - originating actor is always excluded from linked locations
    const exclusionSet = new Set(excludedActors);
    if (originatingActorId) {
      exclusionSet.add(originatingActorId);
    }
    const linkedExclusions = [...exclusionSet];

    // Build result array with recipient information for each linked location
    const results = [];

    for (const linkedLocationId of linkedLocationIds) {
      const { entityIds, mode } = this.#recipientSetBuilder.build({
        locationId: linkedLocationId,
        explicitRecipients: [],
        excludedActors: linkedExclusions,
      });

      results.push({
        locationId: linkedLocationId,
        entityIds,
        mode,
        prefixedEntry,
        prefixedAlternateDescriptions,
        prefixedActorDescription,
        prefixedTargetDescription,
      });
    }

    return results;
  }

  /**
   * Gets the display name for a location, falling back to location ID if no name component exists.
   *
   * @param {string} locationId - Location entity ID
   * @returns {string} Location name or ID
   * @private
   */
  #getOriginName(locationId) {
    const nameComponent = this.#entityManager.getComponentData(
      locationId,
      NAME_COMPONENT_ID
    );

    return typeof nameComponent?.text === 'string' && nameComponent.text.trim()
      ? nameComponent.text.trim()
      : locationId;
  }
}

export default SensorialPropagationService;
